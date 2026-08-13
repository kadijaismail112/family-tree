-- ============================================================================
-- Rootline — server-side operations
--
-- These are the actions that can't be expressed as a policy on a single row:
-- creating a family (family + membership must land together), redeeming an
-- invite (you must read a row you're not yet allowed to see), and bulk adds
-- that should be all-or-nothing.
-- ============================================================================

-- ── Create a family and join it, atomically ─────────────────────────────────

create or replace function public.create_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_family_id uuid;
  v_code      text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'family name is required';
  end if;

  insert into families (name, created_by)
  values (btrim(p_name), auth.uid())
  returning id into v_family_id;

  insert into memberships (family_id, user_id)
  values (v_family_id, auth.uid());

  -- A short, human-readable code. The random half can collide on the unique
  -- index, which would otherwise abort the whole family creation.
  declare
    v_stem text := left(
      coalesce(nullif(upper(regexp_replace(split_part(btrim(p_name), ' ', 1),
                                           '[^A-Za-z0-9]', '', 'g')), ''), 'FAMILY'),
      8
    );
  begin
    for i in 1 .. 5 loop
      v_code := v_stem || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
      begin
        insert into invites (family_id, code, created_by)
        values (v_family_id, v_code, auth.uid());
        exit;
      exception when unique_violation then
        if i = 5 then raise; end if;
      end;
    end loop;
  end;

  return v_family_id;
end;
$$;

-- ── Redeem an invite ────────────────────────────────────────────────────────

-- SECURITY DEFINER because the caller is by definition not yet a member, so
-- RLS would hide the very invite they are trying to use.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v from invites
  where lower(code) = lower(btrim(p_code))
  for update;

  if not found then
    raise exception 'no family found for that invite code';
  end if;
  if v.revoked then
    raise exception 'that invite has been revoked';
  end if;
  if v.expires_at is not null and v.expires_at < now() then
    raise exception 'that invite has expired';
  end if;
  if v.max_uses is not null and v.use_count >= v.max_uses then
    raise exception 'that invite has already been used the maximum number of times';
  end if;

  -- already a member: succeed quietly rather than erroring, and don't burn a use
  if exists (select 1 from memberships where family_id = v.family_id and user_id = auth.uid()) then
    return v.family_id;
  end if;

  insert into memberships (family_id, user_id) values (v.family_id, auth.uid());
  update invites set use_count = use_count + 1 where id = v.id;

  return v.family_id;
end;
$$;

-- ── Claim your own node ─────────────────────────────────────────────────────

create or replace function public.claim_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
begin
  select family_id into v_family from people where id = p_person_id;
  if v_family is null then
    raise exception 'person not found';
  end if;
  if not is_family_member(v_family) then
    raise exception 'not a member of that family';
  end if;
  if exists (
    select 1 from people
    where id = p_person_id and account_user_id is not null and account_user_id <> auth.uid()
  ) then
    raise exception 'that person has already been claimed';
  end if;

  -- one claim per family, released from any previous node
  update people set account_user_id = null
   where family_id = v_family and account_user_id = auth.uid();

  update people set account_user_id = auth.uid() where id = p_person_id;
end;
$$;

-- ── Remove a member ─────────────────────────────────────────────────────────

-- Their contributions stay, still credited to them: the provenance trail must
-- not develop holes just because someone left.
create or replace function public.remove_member(p_family_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_family_creator(p_family_id) then
    raise exception 'only the family creator can remove members';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'the creator cannot remove themselves; transfer the family first';
  end if;

  delete from memberships where family_id = p_family_id and user_id = p_user_id;
end;
$$;

-- ── Add several children at once ────────────────────────────────────────────

-- All-or-nothing: a half-inserted sibling set is worse than none.
-- p_children is [{"name": "...", "birth_year": 1994, "gender": "female"}, ...]
create or replace function public.add_children(
  p_family_id  uuid,
  p_parent_ids uuid[],
  p_children   jsonb
)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  child      jsonb;
  v_child_id uuid;
  v_parent   uuid;
begin
  if not is_family_member(p_family_id) then
    raise exception 'not a member of that family';
  end if;

  for child in select * from jsonb_array_elements(p_children) loop
    continue when length(btrim(coalesce(child ->> 'name', ''))) = 0;

    insert into people (family_id, name, birth_year, gender, added_by)
    values (
      p_family_id,
      btrim(child ->> 'name'),
      nullif(child ->> 'birth_year', '')::smallint,
      nullif(child ->> 'gender', '')::gender,
      auth.uid()
    )
    returning id into v_child_id;

    foreach v_parent in array p_parent_ids loop
      insert into relationships (family_id, from_person_id, to_person_id, type, added_by)
      values (p_family_id, v_parent, v_child_id, 'parent_of', auth.uid())
      on conflict (from_person_id, to_person_id) where type = 'parent_of' do nothing;
    end loop;

    return next v_child_id;
  end loop;
end;
$$;

-- ── Set a reaction (upsert with toggle-off) ─────────────────────────────────

create or replace function public.set_reaction(
  p_relationship_id uuid,
  p_type            confirmation_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family  uuid;
  v_current confirmation_type;
begin
  select family_id into v_family from relationships where id = p_relationship_id;
  if v_family is null or not is_family_member(v_family) then
    raise exception 'not a member of that family';
  end if;

  select type into v_current from confirmations
  where relationship_id = p_relationship_id and user_id = auth.uid();

  if v_current = p_type then
    -- pressing your current reaction again withdraws it
    delete from confirmations
    where relationship_id = p_relationship_id and user_id = auth.uid();
  else
    insert into confirmations (relationship_id, user_id, type)
    values (p_relationship_id, auth.uid(), p_type)
    on conflict (relationship_id, user_id)
    do update set type = excluded.type, updated_at = now();
  end if;
end;
$$;

-- ── Peek at an invite without joining ───────────────────────────────────────

-- The join page needs the family name before the caller is a member, which
-- RLS on invites would otherwise hide. Returns nothing for a bad/revoked/
-- expired code rather than erroring, so probing doesn't leak existence via
-- exception type — the empty result is the same either way from the client's
-- point of view. (A valid code still reveals the family name; that's the
-- point of sending someone the link.)
create or replace function public.peek_invite(p_code text)
returns table (family_id uuid, family_name text, member_count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v invites%rowtype;
begin
  select * into v from invites
  where lower(code) = lower(btrim(p_code));

  if not found or v.revoked then
    return;
  end if;
  if v.expires_at is not null and v.expires_at < now() then
    return;
  end if;

  return query
    select
      v.family_id,
      f.name,
      (select count(*) from memberships m where m.family_id = v.family_id)
    from families f
    where f.id = v.family_id;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.create_family(text)                        from public;
revoke execute on function public.accept_invite(text)                        from public;
revoke execute on function public.peek_invite(text)                          from public;
revoke execute on function public.claim_person(uuid)                         from public;
revoke execute on function public.remove_member(uuid, uuid)                  from public;
revoke execute on function public.add_children(uuid, uuid[], jsonb)          from public;
revoke execute on function public.set_reaction(uuid, confirmation_type)      from public;

grant execute on function public.create_family(text)                   to authenticated;
grant execute on function public.accept_invite(text)                   to authenticated;
grant execute on function public.peek_invite(text)                     to authenticated;
grant execute on function public.claim_person(uuid)                    to authenticated;
grant execute on function public.remove_member(uuid, uuid)             to authenticated;
grant execute on function public.add_children(uuid, uuid[], jsonb)     to authenticated;
grant execute on function public.set_reaction(uuid, confirmation_type) to authenticated;
