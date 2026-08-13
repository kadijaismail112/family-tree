-- `edits` is append-only: readable by the family, with no insert policy at all,
-- because only these triggers should ever write to it. But the triggers ran as
-- the calling user, so RLS blocked their insert and took the whole update down
-- with it — editing any person failed with "new row violates row-level security
-- policy for table edits".
--
-- Running them as the owner is what makes "written only by triggers" true: the
-- audit row lands, and a client still has no way to write one directly. Both
-- return `trigger`, so neither is callable through the Data API.
--
-- The same applies to clearing confirmations below: re-pointing an edge must
-- drop everyone's reactions, not just the caller's.

create or replace function record_person_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  detail_key text;
begin
  -- Written out field by field on purpose: a dynamic loop over the column
  -- list is shorter but fails in ways that are hard to see in a trigger.
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
  if old.voice_name_path is distinct from new.voice_name_path then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Voice recording',
            case when old.voice_name_path is null then '' else 'a recording' end,
            case when new.voice_name_path is null then '' else 'a recording' end, uid);
  end if;

  -- One row per changed key rather than one row holding the whole JSONB blob:
  -- the history is read by people, and "Details {…}" tells them nothing.
  if old.details is distinct from new.details then
    for detail_key in
      select k from (
        select jsonb_object_keys(coalesce(old.details, '{}'::jsonb)) as k
        union
        select jsonb_object_keys(coalesce(new.details, '{}'::jsonb)) as k
      ) keys
    loop
      if (old.details ->> detail_key) is distinct from (new.details ->> detail_key) then
        insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
        values (new.family_id, 'person', new.id, detail_key,
                old.details ->> detail_key, new.details ->> detail_key, uid);
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create or replace function record_relationship_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.type is distinct from new.type then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'relationship', new.id, 'type', old.type::text, new.type::text, auth.uid());
  end if;
  if old.kind is distinct from new.kind then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'relationship', new.id, 'kind', old.kind::text, new.kind::text, auth.uid());
  end if;
  -- Reactions endorsed a specific claim. Re-pointing the edge or changing what
  -- it asserts invalidates them; a softer qualifier change does not.
  if old.type is distinct from new.type
     or old.from_person_id is distinct from new.from_person_id
     or old.to_person_id   is distinct from new.to_person_id then
    delete from confirmations where relationship_id = new.id;
  end if;
  return new;
end;
$$;
