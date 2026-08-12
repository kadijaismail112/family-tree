# Rootline

A private, collaborative family tree. Anyone in a family can add a relative;
every person and every connection permanently records who added it, and members
can confirm or dispute any claim. There is no single admin who owns the truth.

```bash
npm install
npm run dev     # http://localhost:3000
```

No database or API keys — everything persists to the browser's `localStorage`,
so the app runs entirely offline and family details never leave the device.

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

## Notable implementation details

- `lib/layout.ts` — generational layout with barycentre relaxation, so parents
  centre over their children. Each set of co-parents gets its own sibling bar
  lane, so unrelated branches never merge into one rail.
- `lib/relationship.ts` — the kinship algorithm, from the two distances to a
  most-recent common ancestor.
- `lib/kinship.ts` — blood vs married-in. Step and foster ties are family but
  don't carry a bloodline; adoptive ones do.
- `lib/suggestions.ts` — the inference rules behind assumed connections.
- `lib/geo.ts` — a built-in gazetteer rather than a geocoding API, so home
  cities are never sent anywhere.

## Demo data

Two seeded families: a small one for the basics, and **Ghebre Family — 7
generations** (61 people, 1835→2008) used to exercise the layout, the
suggestion engine and cluster mode at realistic scale. "Reset demo" on the
dashboard restores them.

## Status

A working prototype with no backend. Auth, a real database and multi-device
sync are deliberately out of scope — the tradeoff is that clearing browser
storage loses the tree, and there is no export yet.
