-- ============================================================================
-- Dynasty — consent as a record, not a flag
--
-- profiles.terms_accepted_at says someone agreed. It does not say what they
-- agreed to, and it sits on a mutable row that ordinary application writes
-- touch. Revise a policy and every existing timestamp quietly comes to mean
-- "accepted the current text" — words that person never saw.
--
-- This is the evidence version: one row per person per document per version,
-- append-only, recording which text was accepted and through which flow.
-- ============================================================================

create type consent_document as enum ('terms', 'privacy');

create table consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  document    consent_document not null,
  -- The version string shown on the policy page at the moment of acceptance.
  version     text not null check (length(btrim(version)) > 0),
  -- Which flow it came through: 'signup', 'invite'. Useful when someone asks
  -- how a particular person came to agree.
  method      text not null check (length(btrim(method)) > 0),
  accepted_at timestamptz not null default now(),

  -- Accepting the same version twice is the same fact, not two facts. This
  -- also makes the writes below safely idempotent.
  unique (user_id, document, version)
);

create index consents_user_idx on consents (user_id, document);

alter table consents enable row level security;

-- You can read your own consent history — a person is entitled to see what
-- they agreed to and when.
create policy consents_select_own on consents for select to authenticated
using (user_id = auth.uid());

-- No insert, update or delete policy on purpose. Rows are written only by the
-- security-definer functions below, so a client cannot forge a consent it
-- never gave, nor erase one it did. A consent log you can edit is not a log.

-- ── Recording ───────────────────────────────────────────────────────────────

-- Called from handle_new_user() and accept_person_invite(). Takes the versions
-- as they were displayed, so the record reflects what was on screen rather
-- than whatever is current when the row is written.
create or replace function public.record_consent(
  p_user_id         uuid,
  p_terms_version   text,
  p_privacy_version text,
  p_method          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(btrim(p_terms_version), '') = ''
     or coalesce(btrim(p_privacy_version), '') = '' then
    raise exception 'consent requires the document versions that were shown';
  end if;

  insert into consents (user_id, document, version, method)
  values (p_user_id, 'terms', btrim(p_terms_version), p_method),
         (p_user_id, 'privacy', btrim(p_privacy_version), p_method)
  on conflict (user_id, document, version) do nothing;
end;
$$;

revoke execute on function public.record_consent(uuid, text, text, text) from public, anon, authenticated;

-- ── Signup writes the record as part of creating the account ────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms   text := new.raw_user_meta_data ->> 'terms_version';
  v_privacy text := new.raw_user_meta_data ->> 'privacy_version';
begin
  if coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') <> 'true' then
    raise exception 'terms must be accepted to create an account'
      using errcode = 'check_violation';
  end if;

  insert into profiles (id, display_name, email, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    now()
  )
  on conflict (id) do nothing;

  -- Older clients that accept without sending versions still get an account,
  -- but the detailed record only exists where the versions were supplied —
  -- better an honest gap than a row asserting a version nobody displayed.
  if coalesce(btrim(v_terms), '') <> '' and coalesce(btrim(v_privacy), '') <> '' then
    perform record_consent(new.id, v_terms, v_privacy, 'signup');
  end if;

  return new;
end;
$$;
