-- ============================================================================
-- Dynasty — invite bounds, audit-log diffing, upload ceilings
--
-- Three separate problems, all of the same shape: a default that was fine for
-- a prototype and is not fine once other families are using this.
-- ============================================================================

-- ── 1. Invites expire and run out ───────────────────────────────────────────
--
-- redeem_invite() already checks expires_at, max_uses and revoked. Both
-- columns were nullable with no default, so every invite ever created was
-- unlimited and permanent — and membership is the entire privacy boundary, so
-- one forwarded code is indefinite access to a family's whole history.
--
-- The checks stay where they are; this only stops new invites being born
-- unbounded.

alter table invites
  alter column expires_at set default (now() + interval '30 days'),
  alter column max_uses   set default 25;

-- Existing rows are left alone on purpose: bounding a code someone is halfway
-- through using would lock them out with no explanation. Bound them
-- deliberately instead, e.g.
--
--   update invites
--      set expires_at = now() + interval '30 days'
--    where expires_at is null and not revoked;

-- Redemption is rate-limited by code, so a leaked-but-expired code can't be
-- brute-forced into a live one by guessing neighbours.
create index if not exists invites_code_idx on invites (code) where not revoked;

-- ── 2. The audit trail stops storing whole JSON blobs ───────────────────────
--
-- record_person_edit() wrote old.details::text and new.details::text — the
-- entire details object on both sides — for any change to any key inside it.
-- Editing one city stored the whole blob twice. This walks the union of keys
-- and records only what actually differs, one row per changed field.

create or replace function record_person_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k   text;
  old_v text;
  new_v text;
begin
  if old.name is distinct from new.name then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Name', old.name, new.name, uid);
  end if;
  if old.birth_year is distinct from new.birth_year then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Birth year', old.birth_year::text, new.birth_year::text, uid);
  end if;
  if old.death_year is distinct from new.death_year then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Death year', old.death_year::text, new.death_year::text, uid);
  end if;
  if old.birth_date is distinct from new.birth_date then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Birth date', old.birth_date::text, new.birth_date::text, uid);
  end if;
  if old.death_date is distinct from new.death_date then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Death date', old.death_date::text, new.death_date::text, uid);
  end if;
  if old.life_status is distinct from new.life_status then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Status', old.life_status::text, new.life_status::text, uid);
  end if;
  if old.gender is distinct from new.gender then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Gender', old.gender::text, new.gender::text, uid);
  end if;
  if old.notes is distinct from new.notes then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Notes', old.notes, new.notes, uid);
  end if;
  if old.photo_path is distinct from new.photo_path then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Profile picture',
            case when old.photo_path is null then '' else 'a photo' end,
            case when new.photo_path is null then '' else 'a photo' end, uid);
  end if;

  -- One row per changed key, carrying only that key's values. The label is the
  -- raw key ("currentCity"); the UI already owns the human wording for these.
  if old.details is distinct from new.details then
    for k in
      select jsonb_object_keys(coalesce(old.details, '{}'::jsonb))
      union
      select jsonb_object_keys(coalesce(new.details, '{}'::jsonb))
    loop
      old_v := old.details ->> k;
      new_v := new.details ->> k;
      if old_v is distinct from new_v then
        insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
        values (new.family_id, 'person', new.id, k, old_v, new_v, uid);
      end if;
    end loop;
  end if;

  return new;
end;
$$;

-- ── 3. Upload ceilings match what the client actually produces ──────────────
--
-- fileToDataUrl() downscales to 900px at JPEG 0.82 before upload — roughly
-- 100–200KB. The buckets accepted 10MB, so the entire cost model rested on a
-- browser-side function that anything talking to the API directly could skip.
--
-- HEIC stays allowed: iPhone shares can arrive in it, and canvas cannot always
-- decode it to re-encode as JPEG.

update storage.buckets set file_size_limit = 3145728  where id = 'person-photos'; -- 3MB
update storage.buckets set file_size_limit = 2097152  where id = 'voice-names';   -- 2MB
update storage.buckets set file_size_limit = 1048576  where id = 'avatars';       -- 1MB
