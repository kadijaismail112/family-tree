-- ============================================================================
-- Dynasty — backup storage
--
-- A family tree is the kind of data people cannot rebuild. Any member can
-- delete any person, deletion cascades, and the audit trigger only fires on
-- UPDATE — so a deletion currently leaves no trace and no way back.
--
-- This bucket holds nightly JSON snapshots of every family. It is deliberately
-- unreachable from the app: no policy is granted to `authenticated`, so only
-- the service role (the cron job, and you) can read or write it. A snapshot is
-- a copy of the whole family, so exposing it to members would hand any one of
-- them a download of everything.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/json'])
on conflict (id) do nothing;

-- No policies on purpose. Row-level security on storage.objects denies by
-- default, and the service role bypasses it — which is exactly the access
-- pattern wanted here.
