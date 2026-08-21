# Security

Dynasty stores family history — names, dates, photographs and relationships,
including information about people who never signed up for it. Reports about
anything that could expose that data are taken seriously.

## Reporting a vulnerability

Email **security@trydynasty.app** with enough detail to reproduce the issue.
Please don't open a public issue for anything exploitable.

You can expect an acknowledgement within a few days. If you'd like credit for
the report, say so and you'll get it.

## What's most worth looking at

The security model is small enough to describe in a paragraph, which also makes
it easy to check.

Membership of a family is the entire privacy boundary. Every row-level security
policy reduces to `is_family_member(family_id)`, defined once in
`supabase/migrations/*_rls.sql`. If you can read or write a family's data
without a membership row, that's the bug worth reporting.

Specific areas:

- **Invite tokens** — they grant full access to a family. Anything that lets a
  token be guessed, enumerated, or reused past its limits.
- **RLS bypass** — any query path returning rows from a family you don't belong
  to, including through the RPCs in `supabase/migrations/*_rpc.sql`.
- **Storage** — photographs and voice recordings live in private buckets served
  by signed URL. Any way to reach an object without a signed link, or to reach
  another family's objects.
- **Provenance** — `added_by` is stamped server-side by trigger and is meant to
  be unforgeable.

## Out of scope

- Missing headers or configuration findings with no demonstrated impact.
- Automated scanner output without a working proof of concept.
- Denial of service through volume.
- Social engineering of users or maintainers.

## A note on the data model

Some things that look like flaws are deliberate, and are documented as such:

- **Any member of a family can edit or delete anything in it.** There are no
  per-entry permissions inside a tree. Families are expected to be people who
  already trust each other; the invite is the trust boundary, not the row.
- **Contested entries stay visible.** Disputed connections are flagged rather
  than removed, so disagreement is recorded instead of silently resolved.

If you think either of those is wrong, that's a design conversation and an
issue is a fine place for it.
