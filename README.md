# Dynasty

A private, collaborative family tree. Anyone in a family can add a relative;
every person and every connection permanently records who added it, and members
can confirm or dispute any claim. There is no single admin who owns the truth.

```bash
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npm install
npm run dev                  # http://localhost:3000
```

Accounts and trees live in [Supabase](https://supabase.com): Auth for signup/login,
Postgres (with row-level security) for the data, and Storage for photos and
voice clips. Membership is the privacy boundary — you only see families you
belong to.

## Local schema

The SQL in `supabase/migrations/` is already applied to the linked project.
To apply it to a new project:

```bash
supabase link --project-ref <ref>
supabase db push
supabase gen types typescript --linked > lib/database.types.ts
```

In the Supabase dashboard, add `http://localhost:3000/auth/callback` to
**Authentication → URL configuration → Redirect URLs**, and set the site URL
to `http://localhost:3000`.

Production runs at `https://www.trydynasty.app`. Add
`https://www.trydynasty.app/auth/callback` to the same **Redirect URLs** list and
set the site URL to `https://www.trydynasty.app` — signup confirmations and
password resets build their return link from the browser's origin, so they fail
against any origin Supabase hasn't been told to allow.

## What's in it

**Three views of the same family**

- **Tree** — a generational layout: parents above children, spouses side by
  side, one descent line per couple springing from the marriage bar.
- **Clusters** — regroups everyone by current city, birth city, college, jobs
  or decade born, with a bubble per value.
- **Map** — an orthographic globe with a node per city, sized by how many
  relatives live there.

**Understanding a tree**

- **Kinship calculator** — pick two people (search, or tap them on the canvas)
  and get the named relation: "4th cousins once removed", "great-grandmother",
  "sibling-in-law". Gendered wording only when a gender is recorded.
- **Isolate** — clears the canvas down to one person's parents, siblings,
  partner and children.
- **How are we connected?** — traces the chain between you and anyone else.
- **Blood vs married in** — colour on each card encodes how someone joined the
  family, and nothing else.

**Keeping it honest**

- **Provenance** on every person and connection, plus an edit history recording
  who changed what, from what, to what.
- **Confirm / dispute** per connection, with a running tally. Disputed branches
  stay visible and flagged; nothing is silently deleted.
- **Assumed connections** — the app infers what the data implies (your
  sibling's parent is probably yours; two people sharing a child are probably
  partners) and offers each as a confirm/deny rather than acting on it.

**Per person** — photos with tagging, a voice recording of their name,
comments, and optional fields for city, college, jobs, socials and more. Only
fields that have been filled in are shown.

See `supabase/DESIGN.md` for the data model, RLS, and the RPCs that create a
family or redeem an invite.
