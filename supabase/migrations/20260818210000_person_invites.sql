-- ============================================================================
-- Dynasty — personal invites
--
-- Replaces the family-wide join code. That code was one shared secret per
-- family: FAMILYNAME-XXXX, four characters of Math.random(), reusable forever
-- by anyone who saw it. Here an invite names one person, is generated
-- server-side from a cryptographic source, expires, and works exactly once.
--
-- It also carries the person it was issued for, so accepting it does four
-- things in one transaction: join the family, claim that node, fill in what
-- the new member told us, and record that they accepted the terms.
-- ============================================================================

-- ── Terms acceptance ────────────────────────────────────────────────────────

-- Recorded on the profile rather than inferred from "has an account", because
-- when someone agreed — and therefore to which version — is the part that
-- matters if it is ever asked.
alter table profiles
  add column if not exists terms_accepted_at timestamptz;

-- ── The invite ──────────────────────────────────────────────────────────────

create table if not exists person_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  -- The node this invite is *for*. Composite FK keeps the person and the
  -- invite in the same family, the same way relationships are kept honest.
  person_id   uuid not null,
  token       text not null unique,
  invited_by  uuid references profiles (id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references profiles (id) on delete set null,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now(),
  foreign key (person_id, family_id) references people (id, family_id) on delete cascade
);

create index if not exists person_invites_person_idx on person_invites (person_id);
create index if not exists person_invites_family_idx on person_invites (family_id);

alter table person_invites enable row level security;

-- Members see and manage invites for their own family. Nobody reads a token
-- they were not sent: the accept path runs security definer instead.
create policy person_invites_select on person_invites for select to authenticated
  using (is_family_member(family_id));

create policy person_invites_update on person_invites for update to authenticated
  using (is_family_member(family_id)) with check (is_family_member(family_id));

-- No insert policy: create_person_invite() is the only way to mint one, so a
-- client cannot choose its own token.

-- ── Minting ─────────────────────────────────────────────────────────────────

-- 128 bits from pgcrypto, hex-encoded. The old code put the family's own name
-- in the secret and left four random characters after it — about 1.7 million
-- guesses against a target you could name. This is not guessable, and being
-- generated here means the client never gets to pick it.
create or replace function public.create_person_invite(
  p_person_id uuid,
  p_days integer default 14
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family uuid;
  v_token  text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'an invite must last between 1 and 90 days';
  end if;

  select family_id into v_family from people where id = p_person_id;
  if v_family is null then
    raise exception 'person not found';
  end if;
  if not is_family_member(v_family) then
    raise exception 'not a member of that family';
  end if;
  if exists (select 1 from people where id = p_person_id and account_user_id is not null) then
    raise exception 'that person has already joined';
  end if;

  -- One live invite per person: re-inviting supersedes rather than accumulates,
  -- so a stale link in an old message stops working once a new one is sent.
  update person_invites
     set revoked = true
   where person_id = p_person_id and accepted_at is null and not revoked;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into person_invites (family_id, person_id, token, invited_by, expires_at)
  values (v_family, p_person_id, v_token, auth.uid(), now() + make_interval(days => p_days));

  return v_token;
end;
$$;

-- ── Looking at an invite before signing up ──────────────────────────────────

-- Callable anonymously, because the whole point is that the recipient sees who
-- invited them before deciding to create an account. That is only safe because
-- the token is unguessable — the old peek_invite() was a free oracle for
-- brute-forcing a four-character code, and this is not.
--
-- Returns nothing at all for a bad, used, revoked or expired token, so probing
-- cannot tell those cases apart.
create or replace function public.peek_person_invite(p_token text)
returns table (
  family_name text,
  person_name text,
  invited_by_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v person_invites%rowtype;
begin
  select * into v from person_invites where token = btrim(p_token);

  if not found or v.revoked or v.accepted_at is not null or v.expires_at < now() then
    return;
  end if;

  return query
    select f.name, p.name, coalesce(pr.display_name, 'A relative'), v.expires_at
      from people p
      join families f on f.id = v.family_id
      left join profiles pr on pr.id = v.invited_by
     where p.id = v.person_id;
end;
$$;

-- ── Accepting ───────────────────────────────────────────────────────────────

-- Everything the acceptance means happens here or not at all: join the family,
-- take ownership of the node, write what they told us, burn the invite, record
-- consent. Split across the client these could half-succeed and leave someone
-- a member of a tree with no node, or a claimed node they cannot see.
create or replace function public.accept_person_invite(
  p_token        text,
  p_name         text,
  p_birth_date   date default null,
  p_current_city text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v         person_invites%rowtype;
  v_details jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'please tell us your name';
  end if;

  select * into v from person_invites
   where token = btrim(p_token)
   for update;

  -- One message for every failure: a recipient cannot tell a typo from an
  -- expired link, and neither can someone probing.
  if not found
     or v.revoked
     or v.accepted_at is not null
     or v.expires_at < now() then
    raise exception 'this invite is no longer valid — ask your relative to send a new one';
  end if;

  if exists (
    select 1 from people
     where id = v.person_id
       and account_user_id is not null
       and account_user_id <> auth.uid()
  ) then
    raise exception 'someone has already joined as this person';
  end if;

  if not exists (
    select 1 from memberships where family_id = v.family_id and user_id = auth.uid()
  ) then
    insert into memberships (family_id, user_id) values (v.family_id, auth.uid());
  end if;

  -- One claimed node per person per family, as claim_person() does.
  update people set account_user_id = null
   where family_id = v.family_id and account_user_id = auth.uid();

  v_details := coalesce((select details from people where id = v.person_id), '{}'::jsonb);
  if p_current_city is not null and length(btrim(p_current_city)) > 0 then
    v_details := v_details || jsonb_build_object('currentCity', btrim(p_current_city));
  end if;

  update people
     set account_user_id = auth.uid(),
         name            = btrim(p_name),
         birth_date      = coalesce(p_birth_date, birth_date),
         life_status     = coalesce(life_status, 'living'),
         details         = v_details
   where id = v.person_id;

  update person_invites
     set accepted_at = now(), accepted_by = auth.uid()
   where id = v.id;

  update profiles
     set terms_accepted_at = coalesce(terms_accepted_at, now())
   where id = auth.uid();

  return v.family_id;
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.create_person_invite(uuid, integer)        from public;
revoke execute on function public.peek_person_invite(text)                   from public;
revoke execute on function public.accept_person_invite(text, text, date, text) from public;

grant execute on function public.create_person_invite(uuid, integer)         to authenticated;
-- anon included on purpose: the recipient has no account yet.
grant execute on function public.peek_person_invite(text)                    to anon, authenticated;
grant execute on function public.accept_person_invite(text, text, date, text) to authenticated;

-- ── Retiring the family-wide code ───────────────────────────────────────────
--
-- The shared code is replaced, not merely hidden. Leaving the RPCs callable
-- would keep a guessable path into a family reachable from any authenticated
-- session regardless of what the UI offers.
--
-- Existing invite rows are kept for the record; none of them can be redeemed.

revoke execute on function public.accept_invite(text) from authenticated;
revoke execute on function public.peek_invite(text)   from authenticated;

update invites set revoked = true where not revoked;
