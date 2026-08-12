-- ============================================================================
-- Rootline — storage
--
-- Photos are base64 data URLs in localStorage today, sharing a 5–10MB budget
-- with everything else; a dozen real photos would break it, and the failure is
-- silent. They belong in object storage.
--
-- Buckets are private. Reads go through signed URLs so a leaked object key
-- can't expose a family's photographs to the internet.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('person-photos', 'person-photos', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('voice-names',   'voice-names',   false, 5242880,
   array['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav']),
  ('avatars',       'avatars',       false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Object keys are laid out as  <family_id>/<person_id>/<uuid>.<ext>  so the
-- first path segment answers "which family owns this?".
--
-- The segment is compared as text rather than cast to uuid: a malformed key
-- would make the cast raise inside the policy, and an error in a policy is a
-- much worse failure than a non-match.

create policy "family photos are readable by members"
on storage.objects for select to authenticated
using (
  bucket_id = 'person-photos'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

create policy "family photos are writable by members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'person-photos'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

create policy "family photos are removable by members"
on storage.objects for delete to authenticated
using (
  bucket_id = 'person-photos'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

create policy "voice names are readable by members"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-names'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

create policy "voice names are writable by members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-names'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

create policy "voice names are removable by members"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voice-names'
  and exists (
    select 1 from memberships m
    where m.user_id = auth.uid()
      and m.family_id::text = (storage.foldername(name))[1]
  )
);

-- Avatars are keyed by the owner's user id: <user_id>/<uuid>.<ext>
create policy "avatars are readable by authenticated users"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

create policy "avatars are writable by their owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars are removable by their owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
