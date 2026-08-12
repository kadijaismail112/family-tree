import type { Person, Relationship } from "./types";
import { isLineageKind } from "./types";
import { CURRENT_USER_ID } from "./seed";

/**
 * Who is related by blood, and who married in.
 *
 * Blood relatives are the reference person's direct ancestors plus everyone
 * descended from any of those ancestors — i.e. anyone sharing a common
 * ancestor with them. Everyone else reached the tree by marriage.
 *
 * The reference is your own claimed node when you have one, so "blood
 * relative" means blood relative *of you*, which is how people actually
 * think about it (your mother is your blood, even though she married into
 * your father's line). With no claimed node — an ancestral tree nobody has
 * claimed yet — it falls back to the forebear with the most descendants,
 * making it "the bloodline this tree follows".
 */
export interface Kinship {
  bloodIds: Set<string>;
  referenceId: string | null;
}

export function computeKinship(
  people: Person[],
  relationships: Relationship[]
): Kinship {
  if (people.length === 0) return { bloodIds: new Set(), referenceId: null };

  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const p of people) {
    parents.set(p.id, []);
    children.set(p.id, []);
  }
  for (const r of relationships) {
    if (r.type !== "PARENT_OF") continue;
    // a step- or foster-parent is family, but they do not carry a bloodline
    if (!isLineageKind(r.kind)) continue;
    children.get(r.fromPersonId)?.push(r.toPersonId);
    parents.get(r.toPersonId)?.push(r.fromPersonId);
  }

  const walk = (seeds: string[], edges: Map<string, string[]>) => {
    const seen = new Set<string>();
    const queue = [...seeds];
    while (queue.length) {
      const id = queue.pop()!;
      for (const next of edges.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  };

  // reference: your node, else whoever has the most descendants
  let referenceId = people.find((p) => p.accountUserId === CURRENT_USER_ID)?.id ?? null;
  if (!referenceId) {
    let best = -1;
    for (const p of people) {
      const n = walk([p.id], children).size;
      if (n > best) {
        best = n;
        referenceId = p.id;
      }
    }
  }
  if (!referenceId) return { bloodIds: new Set(), referenceId: null };

  const siblings = new Map<string, string[]>();
  for (const p of people) siblings.set(p.id, []);
  for (const r of relationships) {
    if (r.type !== "SIBLING_OF") continue;
    if (!isLineageKind(r.kind)) continue;
    siblings.get(r.fromPersonId)?.push(r.toPersonId);
    siblings.get(r.toPersonId)?.push(r.fromPersonId);
  }

  // Seed with the reference and their direct ancestors. Parents only count
  // upward from the reference — a parent of some other blood relative is
  // that relative's other parent, who married in.
  const bloodIds = new Set<string>([referenceId]);
  walk([referenceId], parents).forEach((id) => bloodIds.add(id));

  // Then close over children and siblings. A sibling link implies a shared
  // parent even when that parent was never recorded, so a great-uncle known
  // only as "grandpa's brother" still counts as blood.
  for (let pass = 0; pass < people.length; pass++) {
    let grew = false;
    for (const id of Array.from(bloodIds)) {
      for (const next of [...(children.get(id) ?? []), ...(siblings.get(id) ?? [])]) {
        if (!bloodIds.has(next)) {
          bloodIds.add(next);
          grew = true;
        }
      }
    }
    if (!grew) break;
  }

  return { bloodIds, referenceId };
}
