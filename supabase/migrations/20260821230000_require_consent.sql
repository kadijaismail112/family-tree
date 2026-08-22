-- ============================================================================
-- Dynasty — no account without recorded consent
--
-- The previous migration made the timestamp get written. This makes it
-- required: handle_new_user() now refuses to create a profile at all unless
-- consent was passed, so "an account exists" and "that person accepted the
-- terms" become the same fact.
--
-- Why not rely on the checkbox: a disabled button is a suggestion. It lives in
-- one component, on one page, and it is one refactor or one extra signup path
-- away from being silently skipped — which is exactly how the earlier accounts
-- ended up with terms_accepted_at NULL while the checkbox was on screen and
-- working. Enforcing it here means every route into the product, present and
-- future, has to carry consent or it fails loudly at creation time.
-- ============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Raising aborts the auth.users insert too, so a rejected signup leaves no
  -- half-made account behind.
  if coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true' then
    raise exception 'terms must be accepted to create an account'
      using errcode = 'check_violation';
  end if;

  insert into profiles (id, display_name, email, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    -- Server clock, never a client-supplied time.
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The two accounts predating this keep terms_accepted_at NULL. Back-filling
-- would manufacture a consent record that was never given, which defeats the
-- point of having one. They are simply accounts from before the record
-- existed, and can be told apart from every later account by exactly that.
