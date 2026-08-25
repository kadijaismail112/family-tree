import type { Person, Relationship } from "../types";
import { isLineageKind, isLineageSiblingKind } from "../types";

/**
 * A "world" is one family at the scope a person actually holds in their head:
 * grandparents down to grandchildren, plus whoever married in.
 *
 * The graph underneath is one large, loosely connected thing — every family in
 * the tree touching every other through the people who married between them.
 * Rendering all of it at once is the reason a big tree turns into a hairball,
 * so this cuts a window into it instead. A spouse is the seam: they stand in
 * this world but belong to another one, which makes them the door through to
 * it.
 */

/** grandparents (-2) through grandchildren (+2) */
export const MIN_GEN = -2;
export const MAX_GEN = 2;

export type WorldRole = "anchor" | "blood" | "spouse";

export interface WorldMember {
  personId: string;
  /** -2 grandparents · 0 the anchor's own row · +2 grandchildren */
  generation: number;
  role: WorldRole;
  /** who they married into this world, when role is "spouse" */
  marriedToId?: string;
  /** they have a family of their own that this world doesn't show */
  portal: boolean;
  /** how many people are through that door and not already here */
  beyond: number;
}

export interface World {
  anchorId: string;
  members: WorldMember[];
  /** members bucketed by generation, each row ordered for display */
  rows: { generation: number; members: WorldMember[] }[];
  ids: Set<string>;
}

interface Graph {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  spouses: Map<string, string[]>;
  siblings: Map<string, string[]>;
}

const listOf = (m: Map<string, string[]>, k: string) => m.get(k) ?? [];

function add(m: Map<string, string[]>, k: string, v: string) {
  const list = m.get(k);
  if (!list) m.set(k, [v]);
  else if (!list.includes(v)) list.push(v);
}

export type { Graph };

export function buildGraph(people: Person[], relationships: Relationship[]): Graph {
  const alive = new Set(people.map((p) => p.id));
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  const siblings = new Map<string, string[]>();

  for (const r of relationships) {
    if (!alive.has(r.fromPersonId) || !alive.has(r.toPersonId)) continue;
    if (r.type === "PARENT_OF") {
      if (!isLineageKind(r.kind)) continue;
      add(parents, r.toPersonId, r.fromPersonId);
      add(children, r.fromPersonId, r.toPersonId);
    } else if (r.type === "SPOUSE_OF") {
      add(spouses, r.fromPersonId, r.toPersonId);
      add(spouses, r.toPersonId, r.fromPersonId);
    } else if (r.type === "SIBLING_OF") {
      if (!isLineageSiblingKind(r.kind)) continue;
      add(siblings, r.fromPersonId, r.toPersonId);
      add(siblings, r.toPersonId, r.fromPersonId);
    }
  }

  // anyone sharing a parent is a sibling too, whether or not it was recorded
  for (const [parentId, kids] of Array.from(children.entries())) {
    void parentId;
    for (const a of kids)
      for (const b of kids) if (a !== b) add(siblings, a, b);
  }

  return { parents, children, spouses, siblings };
}

/**
 * Everyone a world centred on `anchorId` contains: two generations up, two
 * down, the brothers and sisters of everyone on that line, and whoever
 * married any of them. Cousins are left out on purpose — they are the point
 * where a world stops being one family and starts being the whole tree again.
 */
function reach(
  anchorId: string,
  g: Graph
): Map<string, { gen: number; role: WorldRole; marriedToId?: string }> {
  const out = new Map<string, { gen: number; role: WorldRole; marriedToId?: string }>();
  const place = (id: string, gen: number, role: WorldRole, marriedToId?: string) => {
    const seen = out.get(id);
    // blood standing wins: someone who is both a relative and married to a
    // relative belongs here as the relative
    if (seen && (seen.role !== "spouse" || role === "spouse")) return;
    out.set(id, { gen, role, marriedToId });
  };

  place(anchorId, 0, "anchor");

  // the direct line, two steps each way
  const line: [string, number][] = [[anchorId, 0]];
  let up = [anchorId];
  for (let gen = -1; gen >= MIN_GEN; gen--) {
    const next: string[] = [];
    for (const id of up)
      for (const parent of listOf(g.parents, id)) {
        place(parent, gen, "blood");
        line.push([parent, gen]);
        next.push(parent);
      }
    up = next;
  }
  let down = [anchorId];
  for (let gen = 1; gen <= MAX_GEN; gen++) {
    const next: string[] = [];
    for (const id of down)
      for (const child of listOf(g.children, id)) {
        place(child, gen, "blood");
        line.push([child, gen]);
        next.push(child);
      }
    down = next;
  }

  // their brothers and sisters stand alongside them
  for (const [id, gen] of line)
    for (const sib of listOf(g.siblings, id)) place(sib, gen, "blood");

  // and whoever married into any of those rows
  for (const [id, at] of Array.from(out.entries())) {
    if (at.role === "spouse") continue;
    for (const sp of listOf(g.spouses, id)) place(sp, at.gen, "spouse", id);
  }

  return out;
}

/**
 * A spouse is only a door when there is something on the other side: their own
 * parents, siblings or children that this world doesn't already show.
 */
function beyondCount(personId: string, here: Set<string>, g: Graph): number {
  const theirs = reach(personId, g);
  let n = 0;
  for (const id of Array.from(theirs.keys())) if (!here.has(id)) n++;
  return n;
}

export function buildWorld(
  anchorId: string,
  people: Person[],
  relationships: Relationship[],
  graph?: Graph
): World {
  const g = graph ?? buildGraph(people, relationships);
  const known = new Set(people.map((p) => p.id));
  const placed = reach(anchorId, g);
  const ids = new Set(Array.from(placed.keys()).filter((id) => known.has(id)));

  const members: WorldMember[] = [];
  for (const [personId, at] of Array.from(placed.entries())) {
    if (!known.has(personId)) continue;
    const beyond = at.role === "spouse" ? beyondCount(personId, ids, g) : 0;
    members.push({
      personId,
      generation: at.gen,
      role: at.role,
      marriedToId: at.marriedToId,
      portal: at.role === "spouse" && beyond > 0,
      beyond,
    });
  }

  const byName = new Map(people.map((p) => [p.id, p]));
  const birth = (id: string) => {
    const y = parseInt(byName.get(id)?.birthYear ?? "", 10);
    return isNaN(y) ? Number.POSITIVE_INFINITY : y;
  };

  const rows: World["rows"] = [];
  const spouseIds = (id: string) => listOf(g.spouses, id);
  for (let gen = MIN_GEN; gen <= MAX_GEN; gen++) {
    const inRow = members.filter((m) => m.generation === gen);
    if (!inRow.length) continue;
    const seat = new Map(inRow.map((m) => [m.personId, m]));

    // Order by whole couples rather than by people, so a husband and wife are
    // never split by whoever happens to sit between them by birth year.
    const leads = inRow
      .filter((m) => m.role !== "spouse")
      .sort((a, b) => {
        if (a.role === "anchor") return -1;
        if (b.role === "anchor") return 1;
        return birth(a.personId) - birth(b.personId);
      });

    const ordered: WorldMember[] = [];
    const taken = new Set<string>();
    for (const lead of leads) {
      if (taken.has(lead.personId)) continue;
      taken.add(lead.personId);
      ordered.push(lead);
      for (const sp of spouseIds(lead.personId)) {
        const partner = seat.get(sp);
        if (!partner || taken.has(sp)) continue;
        taken.add(sp);
        ordered.push(partner);
      }
    }
    // a spouse whose partner sits in another row still needs a place
    for (const m of inRow) if (!taken.has(m.personId)) ordered.push(m);
    rows.push({ generation: gen, members: ordered });
  }

  return { anchorId, members, rows, ids };
}

export const GEN_LABEL: Record<number, string> = {
  [-2]: "Grandparents",
  [-1]: "Parents",
  0: "Their generation",
  1: "Children",
  2: "Grandchildren",
};
