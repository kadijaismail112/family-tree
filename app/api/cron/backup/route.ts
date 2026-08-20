import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nightly snapshot of every family, written to the private `backups` bucket.
 *
 * Any member can delete any person; deletion cascades through relationships,
 * photos and comments; and the audit trigger only records updates, so a
 * deletion leaves nothing behind. Without this there is no answer to "someone
 * removed my grandmother and everything attached to her".
 *
 * One JSON file per family per run, so restoring one family never means
 * untangling it from everyone else's data. Media is referenced by storage path
 * rather than copied — the bytes still live in their own buckets, and the
 * reaper leaves referenced objects alone.
 *
 * GET  — snapshot everything (what the cron calls).
 * GET ?family=<id> — snapshot one family, for checking the format by hand.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "backups";
/** Snapshots older than this are pruned, so storage doesn't grow forever. */
const KEEP_DAYS = 30;

type Admin = ReturnType<typeof createAdminClient>;

async function snapshotFamily(admin: Admin, familyId: string) {
  const [
    family,
    memberships,
    people,
    relationships,
    confirmations,
    photos,
    photoTags,
    comments,
    edits,
    invites,
  ] = await Promise.all([
    admin.from("families").select("*").eq("id", familyId).single(),
    admin.from("memberships").select("*").eq("family_id", familyId),
    admin.from("people").select("*").eq("family_id", familyId),
    admin.from("relationships").select("*").eq("family_id", familyId),
    admin
      .from("confirmations")
      .select("*, relationships!inner(family_id)")
      .eq("relationships.family_id", familyId),
    admin.from("photos").select("*").eq("family_id", familyId),
    admin.from("photo_tags").select("*, people!inner(family_id)").eq("people.family_id", familyId),
    admin.from("comments").select("*").eq("family_id", familyId),
    admin.from("edits").select("*").eq("family_id", familyId),
    admin.from("invites").select("*").eq("family_id", familyId),
  ]);

  // A snapshot missing a table is worse than no snapshot, because it looks
  // like a restore point and isn't one.
  const failed = [
    family,
    memberships,
    people,
    relationships,
    confirmations,
    photos,
    photoTags,
    comments,
    edits,
    invites,
  ].find((r) => r.error)?.error;
  if (failed) throw new Error(`family ${familyId}: ${failed.message}`);

  return {
    format: 1,
    takenAt: new Date().toISOString(),
    familyId,
    family: family.data,
    memberships: memberships.data ?? [],
    people: people.data ?? [],
    relationships: relationships.data ?? [],
    confirmations: confirmations.data ?? [],
    photos: photos.data ?? [],
    photoTags: photoTags.data ?? [],
    comments: comments.data ?? [],
    edits: edits.data ?? [],
    invites: invites.data ?? [],
  };
}

async function prune(admin: Admin, familyId: string) {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const { data } = await admin.storage.from(BUCKET).list(familyId, { limit: 1000 });
  const stale = (data ?? [])
    .filter((o) => o.id !== null && new Date(o.created_at ?? 0).getTime() < cutoff)
    .map((o) => `${familyId}/${o.name}`);
  if (stale.length) await admin.storage.from(BUCKET).remove(stale);
  return stale.length;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const only = new URL(request.url).searchParams.get("family");

  try {
    const admin = createAdminClient();
    const { data: families, error } = await admin
      .from("families")
      .select("id, name")
      .order("created_at");
    if (error) throw new Error(error.message);

    const targets = (families ?? []).filter((f) => !only || f.id === only);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const results: { family: string; bytes: number; people: number; pruned: number }[] = [];
    const failures: { family: string; error: string }[] = [];

    for (const f of targets) {
      try {
        const snapshot = await snapshotFamily(admin, f.id);
        const body = JSON.stringify(snapshot);
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(`${f.id}/${stamp}.json`, new Blob([body], { type: "application/json" }), {
            contentType: "application/json",
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message);
        results.push({
          family: f.name,
          bytes: body.length,
          people: snapshot.people.length,
          pruned: await prune(admin, f.id),
        });
      } catch (err) {
        // One bad family shouldn't cost every other family its snapshot.
        failures.push({
          family: f.name,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    return NextResponse.json(
      {
        takenAt: new Date().toISOString(),
        familiesBackedUp: results.length,
        failed: failures.length,
        keepDays: KEEP_DAYS,
        results,
        failures,
      },
      { status: failures.length ? 207 : 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
