-- pgcrypto lives in the extensions schema on hosted Supabase. create_family
-- pinned search_path to public only, so gen_random_bytes was invisible and
-- family creation failed after the family+membership inserts (the function
-- then aborted, so those rolled back).
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
