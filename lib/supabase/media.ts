import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

export function mimeBase(type: string) {
  return type.split(";")[0].trim().toLowerCase();
}

export function extFor(kind: "image" | "audio", mime: string): string | null {
  const base = mimeBase(mime);
  return (kind === "image" ? IMAGE_EXT : AUDIO_EXT)[base] ?? null;
}

export async function sourceToBlob(source: string): Promise<Blob> {
  const res = await fetch(source);
  if (!res.ok) throw new Error("Couldn't read that file");
  return res.blob();
}

export async function uploadFamilyFile(
  supabase: SupabaseClient<Database>,
  bucket: "person-photos" | "voice-names",
  familyId: string,
  personId: string,
  blob: Blob
): Promise<string> {
  const kind = bucket === "person-photos" ? "image" : "audio";
  const mime = mimeBase(blob.type);
  const ext = extFor(kind, mime);
  if (!ext) {
    throw new Error(
      kind === "image"
        ? "Please use a JPEG, PNG, WebP or HEIC image."
        : "Please use a WebM, MP3, MP4, OGG or WAV recording."
    );
  }
  const path = `${familyId}/${personId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedUrlMap(
  supabase: SupabaseClient<Database>,
  bucket: "person-photos" | "voice-names",
  paths: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  // Long enough that a tab left open for the afternoon doesn't come back to a
  // grid of broken images; the store only re-signs when it reloads.
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, 8 * 60 * 60);
  if (error || !data) return out;
  for (const row of data) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
