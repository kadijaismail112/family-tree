-- ============================================================================
-- Rootline — schema
--
-- Mirrors the shapes in lib/types.ts, with the constraints that were only
-- conventions in the localStorage prototype now enforced by the database:
--   • provenance (added_by) is set from the session, never from the client
--   • a relationship's two people must belong to its family
--   • symmetric relationships can't be recorded twice in opposite order
--   • a relationship's qualifier must be valid for its type
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "moddatetime";   -- updated_at triggers

-- ── Enums ───────────────────────────────────────────────────────────────────

create type relation_type as enum ('parent_of', 'spouse_of', 'sibling_of');

-- One enum for every qualifier; a CHECK below keeps each type to its own set.
-- 'step' and 'adoptive' legitimately apply to both parents and siblings.
create type relation_kind as enum (
  'biological', 'adoptive', 'step', 'foster',   -- parent_of
  'married', 'partner', 'engaged', 'former',    -- spouse_of
  'full', 'half'                                -- sibling_of
);

create type confirmation_type as enum ('confirm', 'dispute');

-- Only ever used to choose the right word ("mother" vs "parent"). Nullable,
-- and never inferred from a name.
create type gender as enum ('female', 'male', 'other');

-- Explicit, because "no death date" and "still living" are different claims.
create type life_status as enum ('living', 'deceased');

create type audit_entity as enum ('person', 'relationship');

-- ── Accounts ────────────────────────────────────────────────────────────────

-- Supabase owns auth.users. This is the app-visible mirror: safe to join
-- against and safe to expose to other members of a shared family.
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email        text,
  avatar_path  text,                      -- object key in the 'avatars' bucket
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Families ────────────────────────────────────────────────────────────────

create table families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  -- the one member who may remove others: the lightest possible moderation
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership is the entire privacy boundary: every policy below reduces to
-- "is the caller a member of this family?"
create table memberships (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  unique (family_id, user_id)
);
create index memberships_user_idx on memberships (user_id);

create table invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  code       text not null unique,
  created_by uuid references profiles (id) on delete set null,
  -- the prototype's invites never expired and had unlimited uses; these
  -- columns exist so that stays a deliberate choice rather than an oversight
  expires_at timestamptz,
  max_uses   integer check (max_uses is null or max_uses > 0),
  use_count  integer not null default 0,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index invites_family_idx on invites (family_id);

-- ── People ──────────────────────────────────────────────────────────────────

create table people (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),

  -- Years are what most people know; the full dates are optional and win for
  -- display. A trigger keeps the year in step so there is one answer to
  -- "when were they born".
  birth_year  smallint check (birth_year between 1000 and 2200),
  death_year  smallint check (death_year between 1000 and 2200),
  birth_date  date,
  death_date  date,
  life_status life_status,
  gender      gender,

  photo_path      text,   -- object key in the 'person-photos' bucket
  voice_name_path text,   -- pronunciation of their name
  notes           text,

  -- Free-text extras (current city, college, jobs, socials…). JSONB rather
  -- than 13 sparse columns: they are optional, display-only, and the set
  -- grows. Indexed below for the cluster/search views.
  details jsonb not null default '{}'::jsonb,

  -- set when this person claims their own node
  account_user_id uuid references profiles (id) on delete set null,

  -- provenance: who created this row. Defaulted from the session and locked
  -- against later edits by a trigger.
  added_by   uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint death_after_birth check (
    birth_date is null or death_date is null or death_date >= birth_date
  ),
  -- lets relationships prove both endpoints share the family (see below)
  unique (id, family_id)
);
create index people_family_idx  on people (family_id);
create index people_details_idx on people using gin (details jsonb_path_ops);
create index people_name_idx    on people using gin (to_tsvector('simple', name));
-- at most one person per family may be claimed by a given account
create unique index people_one_claim_per_family
  on people (family_id, account_user_id)
  where account_user_id is not null;

-- ── Relationships ───────────────────────────────────────────────────────────

create table relationships (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families (id) on delete cascade,
  from_person_id uuid not null,
  to_person_id   uuid not null,
  type           relation_type not null,
  kind           relation_kind,

  added_by   uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Composite FKs: an edge can only join two people inside its own family.
  -- This was unenforceable in the prototype.
  foreign key (from_person_id, family_id) references people (id, family_id) on delete cascade,
  foreign key (to_person_id, family_id)   references people (id, family_id) on delete cascade,

  constraint no_self_relationship check (from_person_id <> to_person_id),

  constraint kind_matches_type check (
    kind is null
    or (type = 'parent_of'  and kind in ('biological', 'adoptive', 'step', 'foster'))
    or (type = 'spouse_of'  and kind in ('married', 'partner', 'engaged', 'former'))
    or (type = 'sibling_of' and kind in ('full', 'half', 'step', 'adoptive'))
  )
);

-- parent_of is directional: (parent, child) is not (child, parent)
create unique index relationships_parent_unique
  on relationships (from_person_id, to_person_id)
  where type = 'parent_of';

-- spouse_of and sibling_of are symmetric, so normalise the pair before
-- enforcing uniqueness — otherwise (A,B) and (B,A) both insert happily.
create unique index relationships_symmetric_unique
  on relationships (
    least(from_person_id, to_person_id),
    greatest(from_person_id, to_person_id),
    type
  )
  where type <> 'parent_of';

create index relationships_family_idx on relationships (family_id);
create index relationships_from_idx   on relationships (from_person_id);
create index relationships_to_idx     on relationships (to_person_id);

-- ── Corroboration ───────────────────────────────────────────────────────────

create table confirmations (
  id              uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references relationships (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  type            confirmation_type not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- one standing reaction per person per edge; changing your mind overwrites
  unique (relationship_id, user_id)
);
create index confirmations_relationship_idx on confirmations (relationship_id);

-- Assumed connections a member has denied, so the engine stops offering them.
-- Family-scoped, matching the prototype: a denial hides it for everyone.
-- Make this (family_id, key, user_id) if denials should be per-member instead.
create table dismissed_suggestions (
  family_id    uuid not null references families (id) on delete cascade,
  key          text not null,          -- e.g. 'PARENT_OF|<parent>><child>'
  dismissed_by uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (family_id, key)
);

-- ── Media & conversation ────────────────────────────────────────────────────

create table photos (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families (id) on delete cascade,
  person_id    uuid not null,          -- the node it was uploaded to
  storage_path text not null,          -- object key in 'person-photos'
  caption      text,
  added_by     uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (person_id, family_id) references people (id, family_id) on delete cascade
);
create index photos_family_idx on photos (family_id);

-- Tagging is its own table so "photos of or with this person" is one index
-- lookup rather than a scan over an array column.
create table photo_tags (
  photo_id  uuid not null references photos (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (photo_id, person_id)
);
create index photo_tags_person_idx on photo_tags (person_id);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  person_id  uuid not null,
  user_id    uuid references profiles (id) on delete set null,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (person_id, family_id) references people (id, family_id) on delete cascade
);
create index comments_person_idx on comments (person_id);

-- ── Audit trail ─────────────────────────────────────────────────────────────

-- Provenance records who *added* a row; without this, later edits leave no
-- trace — a hole exactly where disputes arise. Append-only (no update/delete
-- policy is granted below).
create table edits (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families (id) on delete cascade,
  entity     audit_entity not null,
  entity_id  uuid not null,
  field      text not null,
  old_value  text,
  new_value  text,
  user_id    uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index edits_entity_idx on edits (entity_id, created_at desc);
create index edits_family_idx on edits (family_id, created_at desc);

-- ── Triggers ────────────────────────────────────────────────────────────────

create trigger profiles_updated      before update on profiles      for each row execute procedure moddatetime (updated_at);
create trigger families_updated      before update on families      for each row execute procedure moddatetime (updated_at);
create trigger people_updated        before update on people        for each row execute procedure moddatetime (updated_at);
create trigger relationships_updated before update on relationships for each row execute procedure moddatetime (updated_at);
create trigger confirmations_updated before update on confirmations for each row execute procedure moddatetime (updated_at);
create trigger comments_updated      before update on comments      for each row execute procedure moddatetime (updated_at);

-- A new signup gets a profile automatically, so the app never has to remember.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Provenance is stamped from the session, and cannot be rewritten afterwards.
create or replace function stamp_added_by()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
  else
    new.added_by := old.added_by;   -- silently ignore client attempts to change it
  end if;
  return new;
end;
$$;

create trigger people_provenance        before insert or update on people        for each row execute procedure stamp_added_by();
create trigger relationships_provenance before insert or update on relationships for each row execute procedure stamp_added_by();
create trigger photos_provenance        before insert or update on photos        for each row execute procedure stamp_added_by();

-- One source of truth for dates: a full date always sets its year, and a
-- recorded death implies the person is no longer living.
create or replace function normalise_person_dates()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is not null then
    new.birth_year := extract(year from new.birth_date);
  end if;
  if new.death_date is not null then
    new.death_year := extract(year from new.death_date);
  end if;
  if new.death_date is not null or new.death_year is not null then
    new.life_status := 'deceased';
  end if;
  return new;
end;
$$;

create trigger people_dates before insert or update on people
  for each row execute procedure normalise_person_dates();

-- The audit trail writes itself, so no client can edit without being recorded.
create or replace function record_person_edit()
returns trigger
language plpgsql
as $$
declare
  uid uuid := auth.uid();
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
  if old.details is distinct from new.details then
    insert into edits (family_id, entity, entity_id, field, old_value, new_value, user_id)
    values (new.family_id, 'person', new.id, 'Details', old.details::text, new.details::text, uid);
  end if;
  return new;
end;
$$;

create trigger people_audit after update on people
  for each row execute procedure record_person_edit();

create or replace function record_relationship_edit()
returns trigger
language plpgsql
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

create trigger relationships_audit after update on relationships
  for each row execute procedure record_relationship_edit();
