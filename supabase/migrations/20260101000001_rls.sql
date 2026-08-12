-- ============================================================================
-- Rootline — row level security
--
-- The prototype had one function, assertFamilyMember(), as its entire privacy
-- boundary. That idea survives: every policy here reduces to "is the caller a
-- member of this family?", expressed once in is_family_member() so there is a
-- single place to audit if a leak is ever suspected.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- SECURITY DEFINER matters: a policy on `memberships` that queried
-- `memberships` directly would recurse infinitely. Running as the owner
-- bypasses RLS for this lookup and breaks the cycle. The pinned search_path
-- stops a caller shadowing `memberships` with their own table.
create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where family_id = p_family_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_creator(p_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from families
    where id = p_family_id
      and created_by = auth.uid()
  );
$$;

-- "do we share any family?" — the basis for seeing another member's profile.
-- Also SECURITY DEFINER, so the profiles policy never nests inside the
-- memberships policy.
create or replace function public.shares_family_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.family_id = mine.family_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.shares_family_with(uuid) from public;
grant  execute on function public.shares_family_with(uuid) to authenticated;

revoke execute on function public.is_family_member(uuid)  from public;
revoke execute on function public.is_family_creator(uuid) from public;
grant  execute on function public.is_family_member(uuid)  to authenticated;
grant  execute on function public.is_family_creator(uuid) to authenticated;

-- ── Enable RLS everywhere ───────────────────────────────────────────────────

alter table profiles              enable row level security;
alter table families              enable row level security;
alter table memberships           enable row level security;
alter table invites               enable row level security;
alter table people                enable row level security;
alter table relationships         enable row level security;
alter table confirmations         enable row level security;
alter table dismissed_suggestions enable row level security;
alter table photos                enable row level security;
alter table photo_tags            enable row level security;
alter table comments              enable row level security;
alter table edits                 enable row level security;

-- ── Profiles ────────────────────────────────────────────────────────────────

-- You can see yourself, and anyone who shares a family with you — that is
-- what makes "added by Carol" renderable. Not the whole user table.
create policy profiles_select on profiles for select to authenticated
using (id = auth.uid() or shares_family_with(id));

create policy profiles_update on profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- inserts happen in the on_auth_user_created trigger, not from the client

-- ── Families ────────────────────────────────────────────────────────────────

create policy families_select on families for select to authenticated
using (is_family_member(id));

-- Prefer the create_family() RPC, which also makes you a member atomically.
create policy families_insert on families for insert to authenticated
with check (created_by = auth.uid());

create policy families_update on families for update to authenticated
using (is_family_member(id)) with check (is_family_member(id));

create policy families_delete on families for delete to authenticated
using (is_family_creator(id));

-- ── Memberships ─────────────────────────────────────────────────────────────

create policy memberships_select on memberships for select to authenticated
using (is_family_member(family_id));

-- Joining is only ever via accept_invite(); creating is via create_family().
-- No direct insert policy, so nobody can add themselves to a family by id.

-- Leave a family yourself, or be removed by whoever started it.
create policy memberships_delete on memberships for delete to authenticated
using (user_id = auth.uid() or is_family_creator(family_id));

-- ── Invites ─────────────────────────────────────────────────────────────────

create policy invites_select on invites for select to authenticated
using (is_family_member(family_id));

create policy invites_insert on invites for insert to authenticated
with check (is_family_member(family_id) and created_by = auth.uid());

create policy invites_update on invites for update to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));

-- Redeeming a code you were sent is handled by accept_invite(), which reads
-- the invite as the definer — otherwise you'd have to be a member already to
-- look up the invite that lets you become one.

-- ── Family data ─────────────────────────────────────────────────────────────
-- Every member has identical write rights, matching the "no single admin"
-- requirement. Provenance is enforced by trigger, not by policy.

create policy people_all on people for all to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy relationships_all on relationships for all to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy dismissed_all on dismissed_suggestions for all to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy photos_all on photos for all to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy photo_tags_all on photo_tags for all to authenticated
using (exists (select 1 from photos p where p.id = photo_id and is_family_member(p.family_id)))
with check (exists (select 1 from photos p where p.id = photo_id and is_family_member(p.family_id)));

-- ── Confirmations ───────────────────────────────────────────────────────────

create policy confirmations_select on confirmations for select to authenticated
using (exists (
  select 1 from relationships r
  where r.id = relationship_id and is_family_member(r.family_id)
));

-- You may only ever speak for yourself: no confirming on someone else's behalf.
create policy confirmations_write on confirmations for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from relationships r where r.id = relationship_id and is_family_member(r.family_id))
);

create policy confirmations_update on confirmations for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy confirmations_delete on confirmations for delete to authenticated
using (user_id = auth.uid());

-- ── Comments ────────────────────────────────────────────────────────────────

create policy comments_select on comments for select to authenticated
using (is_family_member(family_id));

create policy comments_insert on comments for insert to authenticated
with check (is_family_member(family_id) and user_id = auth.uid());

-- Edit or delete your own words only.
create policy comments_update on comments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comments_delete on comments for delete to authenticated
using (user_id = auth.uid());

-- ── Edits ───────────────────────────────────────────────────────────────────

-- Readable by the family, written only by triggers, never updated or deleted.
-- An audit trail you can rewrite is not an audit trail.
create policy edits_select on edits for select to authenticated
using (is_family_member(family_id));
