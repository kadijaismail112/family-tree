# Rootline on Supabase — data model & account management

Four migrations in `supabase/migrations/`, in order:

| File | What it does |
|---|---|
| `…000_schema.sql` | Enums, tables, constraints, indexes, triggers |
| `…001_rls.sql` | The privacy boundary — one helper, then policies |
| `…002_rpc.sql` | Operations a single-row policy can't express |
| `…003_storage.sql` | Private buckets for photos, voice clips, avatars |

```bash
supabase init            # if you haven't
supabase start           # local stack, needs Docker
supabase db reset        # applies all four migrations from scratch
supabase gen types typescript --local > lib/database.types.ts
```

> **These migrations have not been executed.** Docker wasn't available in the
> environment they were written in, so nothing here has run against a real
> Postgres. Apply them locally with `supabase db reset` before pushing to a
> hosted project, and expect to fix a typo or two. The logic is the considered
> part; the syntax is unverified.

Then run through the checklist in *Before you trust the policies* below.

---

## 1. Every data entry point, and where it lands

Each of these is a place the current app writes data. All of them survive the
move; the column that was a convention becomes a constraint.

| In the app | Table | Notes |
|---|---|---|
| Add a person | `people` | `added_by` stamped from the session by trigger |
| Add several children | `people` + `relationships` | `add_children()` — all-or-nothing |
| Connect two people | `relationships` | type + optional qualifier |
| Edit a person's details | `people` | every field change writes an `edits` row |
| Edit a connection | `relationships` | type change clears its reactions, by trigger |
| Confirm / dispute | `confirmations` | `set_reaction()`, one standing reaction per person |
| Deny an assumed link | `dismissed_suggestions` | keyed, so it's never re-offered |
| More-details fields | `people.details` (JSONB) | 13 optional keys; GIN-indexed |
| Profile picture | `people.photo_path` + `person-photos` bucket | |
| Photo + tags | `photos`, `photo_tags` | tags are rows, not an array |
| Voice recording of a name | `people.voice_name_path` + `voice-names` bucket | |
| Comment | `comments` | edit/delete your own only |
| Create a family | `families` + `memberships` + `invites` | `create_family()` |
| Join with a code | `memberships` | `accept_invite()` |
| Claim your node | `people.account_user_id` | `claim_person()` |
| Remove a member | `memberships` | `remove_member()`, creator only |

**Things the database now enforces that the prototype only assumed**

- `added_by` is set from `auth.uid()` and silently reverted if a client tries
  to change it on update.
- A relationship's two endpoints must belong to its own family (composite FK).
- Symmetric relationships can't be stored twice in opposite order — a
  normalised `least/greatest` unique index, which the old
  `@@unique([from, to, type])` couldn't catch.
- A qualifier must be valid for its type: no `foster` spouses.
- `birth_date` sets `birth_year`, so the two can never disagree — the exact
  duplication bug that existed in the prototype.
- The audit trail is append-only: readable by the family, written only by
  triggers, with no update or delete policy at all.

---

## 2. Trees belong to accounts

The chain is `auth.users → profiles → memberships → families → everything`.

Membership is the whole privacy boundary. Every policy reduces to
`is_family_member(family_id)`, defined once so there's a single place to audit.

```sql
create policy people_all on people for all to authenticated
using (is_family_member(family_id)) with check (is_family_member(family_id));
```

**The one non-obvious part.** `is_family_member` is `SECURITY DEFINER`. A
policy on `memberships` that queried `memberships` would recurse infinitely —
this is the single most common way Supabase RLS goes wrong. Running the lookup
as the function owner bypasses RLS and breaks the cycle. Its `search_path` is
pinned so a caller can't shadow `memberships` with a table of their own.

**Two operations can't be policies.** Creating a family needs the family and
the membership to land together, and redeeming an invite means reading a row
you're by definition not yet allowed to see. Both are `SECURITY DEFINER` RPCs
that do their own authorisation.

A person is *not* an account. Most relatives will never sign up but still need
a node — `account_user_id` links the two if they ever do, and a partial unique
index keeps it to one claimed node per person per family.

---

## 3. Managing accounts

Supabase Auth owns signup, login, password reset and sessions. A trigger on
`auth.users` creates the matching `profiles` row, so the app never has to
remember to.

**Visibility.** You can read your own profile plus anyone who shares a family
with you — that's what makes "added by Carol" renderable without exposing the
whole user table.

**Roles.** There are none, deliberately: every member has identical write
rights, which is the "no single admin" requirement. The single exception is
that whoever created a family can remove members — the lightest moderation
that still answers "someone is spamming our tree".

**Leaving and removal.** Both delete a `memberships` row and nothing else.
Everything the person contributed stays, still credited to them. The
provenance trail must not develop holes because someone left.

### Account deletion — decide before launch

Deleting from `auth.users` cascades to `profiles`, and every `added_by` /
`user_id` becomes `NULL`. The tree survives intact but its history reads
"added by a former member" everywhere. That's correct for a GDPR erasure
request and wrong as the default for someone who just wants to stop using the
app.

Recommended: offer both.

- **Leave** — drop memberships, keep the profile. Attribution intact.
- **Delete account** — hard delete, attribution anonymised. Say so plainly in
  the confirmation, because it is irreversible and it degrades other people's
  records, not just your own.

---

## Before you trust the policies

RLS is the kind of thing that looks right and silently isn't. With two test
accounts, A and B, in separate families, confirm each of these:

1. B cannot `select` A's family, people, relationships, photos or comments.
2. B cannot insert a person into A's family by passing A's `family_id`.
3. B redeeming A's invite code gains access — and the `use_count` increments.
4. A member cannot change `added_by` on an existing row (the trigger should
   silently revert it).
5. A member cannot insert a `confirmation` with someone else's `user_id`.
6. Nobody can `update` or `delete` a row in `edits`.
7. B cannot download an object under A's family prefix, even with the exact
   object key.
8. A non-creator calling `remove_member` gets an exception.
9. Editing a relationship's `type` clears its confirmations; editing only its
   `kind` does not.

Items 4 through 7 are the ones most likely to be quietly broken, because the
happy path looks identical either way.

## Decisions worth vetting

1. **`details` as JSONB.** Right for 13 sparse, display-only, growing fields.
   If any of them ever needs a foreign key or a real constraint — current city
   becoming a `cities` table for the map, say — promote that one to a column.
2. **Dismissed suggestions are family-scoped**, matching the prototype: one
   person's denial hides the suggestion for everyone. Make the primary key
   `(family_id, key, user_id)` if denials should be personal.
3. **Only the creator can remove members**, and they can't remove themselves.
   You'll want family transfer before that becomes a real product.
4. **Invites still don't expire by default.** The columns exist and
   `accept_invite()` honours them — `create_family()` just doesn't set them.
   Decide whether a fresh invite should expire in, say, 30 days.
5. **No soft delete on people.** Deleting cascades to their relationships,
   photos and comments. Given there's still no undo, consider `deleted_at`
   instead of a real delete.
6. **Photo cleanup.** Deleting a `photos` row does not delete the object.
   Either a scheduled sweep or a trigger calling `storage.delete`.

## Not in these migrations

- **Realtime.** `supabase_realtime` on `people` / `relationships` /
  `confirmations` would make a shared tree update live for everyone. Cheap to
  add; think about how it interacts with the canvas layout recomputing.
- **Export.** Still the biggest durability gap: with a database you can back
  up, but a member still can't take their tree with them. A `family_export()`
  RPC returning one JSON document is a small job.
- **Rate limiting** on `accept_invite` — codes are guessable at 4 hex chars.
  Lengthen the code or add attempt throttling before any tree is public.

## Porting the client

`lib/store.tsx` is already the single write path — every mutation in the app
goes through it. Swap its bodies for Supabase calls and the UI shouldn't need
to change:

| Store action | Becomes |
|---|---|
| `createFamily` | `rpc('create_family', { p_name })` |
| `joinFamilyByCode` | `rpc('accept_invite', { p_code })` |
| `addPerson` | `from('people').insert(...)` |
| `addChildren` | `rpc('add_children', ...)` |
| `updatePerson` | `from('people').update(...)` — history is automatic |
| `addRelationship` | `from('relationships').insert(...)` |
| `updateRelationship` | `from('relationships').update(...)` — reactions clear themselves |
| `setReaction` | `rpc('set_reaction', ...)` |
| `removeMember` | `rpc('remove_member', ...)` |
| `editsFor` | `from('edits').select()` |

Two things to drop on the way: the client-side `uid()` generator (the database
issues ids now) and the `localStorage` persistence effect. The seed data and
`mergeNewSeedFamilies` become a dev-only seed script.

Note the case change — the app's enums are `PARENT_OF`, the database's are
`parent_of`. Map once at the client boundary rather than sprinkling
`.toLowerCase()` through the components.
