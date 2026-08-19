import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deletes stored objects nothing points at any more.
 *
 * `on delete cascade` tidies the tables but never touches the buckets, so a
 * removed person, photo or family leaves its bytes behind — billed forever and
 * still present when someone asks to be erased.
 *
 * Two safety rules, both load-bearing:
 *
 *  1. Nothing newer than GRACE_MS is ever deleted. An upload lands in storage
 *     before the row referencing it is written, so a reaper running in that gap
 *     would delete a file that is about to become valid.
 *  2. If any reference query fails, the run aborts. A partial picture of what
 *     is referenced would classify live objects as orphans.
 *
 * Dry run unless called with ?apply=1, so hitting the URL by hand is safe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRACE_MS = 24 * 60 * 60 * 1000;
const PAGE = 100;

type Bucket = "person-photos" | "voice-names" | "avatars";

interface Found {
  path: string;
  createdAt: number;
}

/** Storage keys are <a>/<b>/<file>, so walk rather than assuming one level. */
async function walk(
  storage: ReturnType<typeof createAdminClient>["storage"],
  bucket: Bucket,
  prefix = "",
  depth = 0
): Promise<Found[]> {
  if (depth > 3) return [];
  const out: Found[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A row with no id is a folder placeholder, not an object.
      if (entry.id === null) {
        out.push(...(await walk(storage, bucket, path, depth + 1)));
      } else {
        out.push({
          path,
          createdAt: new Date(entry.created_at ?? 0).getTime(),
        });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

export async function GET(request: Request) {
  // Unconfigured and unauthorised answer identically. A 500 for "no secret
  // set" would tell an unauthenticated caller the route exists and is merely
  // misconfigured, which is more than they need to know.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apply = new URL(request.url).searchParams.get("apply") === "1";

  try {
    const admin = createAdminClient();

    const [people, photos, profiles] = await Promise.all([
      admin.from("people").select("photo_path, voice_name_path"),
      admin.from("photos").select("storage_path"),
      admin.from("profiles").select("avatar_path"),
    ]);

    // Rule 2: an incomplete reference set would look like a pile of orphans.
    const failed = [people, photos, profiles].find((r) => r.error)?.error;
    if (failed) {
      return NextResponse.json(
        { error: `aborted, could not read references: ${failed.message}` },
        { status: 500 }
      );
    }

    const referenced: Record<Bucket, Set<string>> = {
      "person-photos": new Set(
        [
          ...(people.data ?? []).map((p) => p.photo_path),
          ...(photos.data ?? []).map((p) => p.storage_path),
        ].filter((p): p is string => !!p)
      ),
      "voice-names": new Set(
        (people.data ?? [])
          .map((p) => p.voice_name_path)
          .filter((p): p is string => !!p)
      ),
      avatars: new Set(
        (profiles.data ?? [])
          .map((p) => p.avatar_path)
          .filter((p): p is string => !!p)
      ),
    };

    const cutoff = Date.now() - GRACE_MS;
    const report: Record<string, unknown> = {};
    let deletedTotal = 0;

    for (const bucket of Object.keys(referenced) as Bucket[]) {
      const objects = await walk(admin.storage, bucket);
      const orphans = objects.filter(
        (o) => !referenced[bucket].has(o.path) && o.createdAt < cutoff
      );
      const tooNew = objects.filter(
        (o) => !referenced[bucket].has(o.path) && o.createdAt >= cutoff
      ).length;

      let deleted = 0;
      if (apply && orphans.length) {
        for (let i = 0; i < orphans.length; i += PAGE) {
          const batch = orphans.slice(i, i + PAGE).map((o) => o.path);
          const { error } = await admin.storage.from(bucket).remove(batch);
          if (error) throw new Error(`remove ${bucket}: ${error.message}`);
          deleted += batch.length;
        }
      }
      deletedTotal += deleted;

      report[bucket] = {
        objects: objects.length,
        referenced: referenced[bucket].size,
        orphans: orphans.length,
        withinGracePeriod: tooNew,
        deleted,
        sample: orphans.slice(0, 5).map((o) => o.path),
      };
    }

    return NextResponse.json({
      mode: apply ? "apply" : "dry-run",
      graceHours: GRACE_MS / 3_600_000,
      deletedTotal,
      buckets: report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "reap failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
