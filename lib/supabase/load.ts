import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Store } from "@/lib/types";
import {
  mapComment,
  mapConfirmation,
  mapFamily,
  mapInvite,
  mapMembership,
  mapPerson,
  mapPhoto,
  mapRelationship,
  mapUser,
} from "./map";
import { signedUrlMap } from "./media";

export const EMPTY_STORE: Store = {
  users: [],
  families: [],
  memberships: [],
  invites: [],
  people: [],
  relationships: [],
  confirmations: [],
  photos: [],
  comments: [],
  edits: [],
  dismissedSuggestions: [],
};

export async function loadStore(
  supabase: SupabaseClient<Database>
): Promise<Store> {
  const [
    profiles,
    families,
    memberships,
    invites,
    people,
    relationships,
    confirmations,
    dismissed,
    photos,
    tags,
    comments,
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("families").select("*"),
    supabase.from("memberships").select("*"),
    supabase.from("invites").select("*"),
    supabase.from("people").select("*"),
    supabase.from("relationships").select("*"),
    supabase.from("confirmations").select("*"),
    supabase.from("dismissed_suggestions").select("*"),
    supabase.from("photos").select("*"),
    supabase.from("photo_tags").select("*"),
    supabase.from("comments").select("*"),
  ]);

  const firstError = [
    profiles,
    families,
    memberships,
    invites,
    people,
    relationships,
    confirmations,
    dismissed,
    photos,
    tags,
    comments,
  ].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  const photoPaths = [
    ...(people.data ?? []).map((p) => p.photo_path),
    ...(photos.data ?? []).map((p) => p.storage_path),
  ].filter((p): p is string => !!p);
  const voicePaths = (people.data ?? [])
    .map((p) => p.voice_name_path)
    .filter((p): p is string => !!p);

  const [photoUrls, voiceUrls] = await Promise.all([
    signedUrlMap(supabase, "person-photos", photoPaths),
    signedUrlMap(supabase, "voice-names", voicePaths),
  ]);
  const urls = new Map<string, string>([
    ...Array.from(photoUrls.entries()),
    ...Array.from(voiceUrls.entries()),
  ]);

  const tagsByPhoto = new Map<string, string[]>();
  for (const t of tags.data ?? []) {
    const list = tagsByPhoto.get(t.photo_id) ?? [];
    list.push(t.person_id);
    tagsByPhoto.set(t.photo_id, list);
  }

  return {
    users: (profiles.data ?? []).map(mapUser),
    families: (families.data ?? []).map(mapFamily),
    memberships: (memberships.data ?? []).map(mapMembership),
    invites: (invites.data ?? []).map(mapInvite),
    people: (people.data ?? []).map((p) => mapPerson(p, urls)),
    relationships: (relationships.data ?? []).map(mapRelationship),
    confirmations: (confirmations.data ?? []).map(mapConfirmation),
    photos: (photos.data ?? []).map((p) =>
      mapPhoto(p, tagsByPhoto.get(p.id) ?? [], urls)
    ),
    comments: (comments.data ?? []).map(mapComment),
    // `edits` is deliberately absent: it is append-only and unbounded, and the
    // history panel is the only thing that reads it. Fetching it per entity on
    // open keeps the whole audit trail out of every session's boot payload.
    edits: [],
    dismissedSuggestions: (dismissed.data ?? []).map((d) => d.key),
  };
}
