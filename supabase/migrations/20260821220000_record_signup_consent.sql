-- ============================================================================
-- Dynasty — actually record consent at signup
--
-- The signup form has had a required Terms/Privacy checkbox for a while, and
-- it does gate the button. But nothing ever wrote the answer down: every
-- profile created through /signup has terms_accepted_at NULL.
--
-- A checkbox nobody records is not consent. If someone later asks whether they
-- agreed — or a regulator does — "the button was disabled until they ticked
-- it" is not an answer, because there is no evidence any particular person
-- ticked anything.
--
-- accept_person_invite() already stamps terms_accepted_at, so the invite path
-- was fine. This closes the direct-signup path the same way: server-side, in
-- the same trigger that creates the profile, so it cannot be skipped by a
-- client that decides not to send it.
-- ============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, email, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    -- Stamped from the server clock, never from anything the client sends, so
    -- the recorded time is the moment the account was actually created.
    case
      when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now()
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Existing rows are deliberately left NULL. Back-filling them would invent a
-- consent record for people whose agreement was never captured, which is
-- exactly the thing this migration exists to stop. They are better read as
-- what they are: accounts predating the record.
