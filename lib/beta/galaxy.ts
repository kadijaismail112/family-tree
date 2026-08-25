import type { Person, Relationship } from "../types";
import { buildGraph, type Graph } from "./world";

/**
 * TRIAL 2 · One canvas, everybody on it, nobody moving.
 *
 * Trial 1 swapped the whole screen for each family, which made every world
 * legible and cost you the sense that they are all one tree. Here the graph
 * is laid out once in three dimensions and never re-laid: each bloodline
 * spreads out from its own root as an island, and a marriage is a link that
 * reaches across the gap between two of them.
 *
 * Nothing is hidden to make room. Focus is done with the camera — fly to a
 * person and their family fills the frame while everyone else falls away into
 * depth, still drawn, still connected, just far off. That is the whole idea:
 * you should be able to see where you are without losing where it sits.
 */

/** the gap between one generation and the next, in world units */
export const ROW_H = 210;
/** how far apart two people stand in the same sibling row */
export const COL_W = 165;
/** how far an island drifts from its neighbour, in depth */
export const PLANE_GAP = 560;

export interface GalaxyNode {
  personId: string;
  x: number;
  y: number;
  z: number;
  /** 0 is the root generation of the whole tree; larger is younger */
  generation: number;
  /** the bloodline whose island they stand on */
  islandId: string;
}

export interface GalaxyLink {
  id: string;
  a: string;
  b: string;
  kind: "parent" | "spouse" | "sibling";
  /** the two ends stand on different islands — this is a bridge between families */
  bridge: boolean;
}

export interface Galaxy {
  nodes: Map<string, GalaxyNode>;
  links: GalaxyLink[];
  minGeneration: number;
  maxGeneration: number;
  graph: Graph;
}

const listOf = (m: Map<string, string[]>, k: string) => m.get(k) ?? [];

/**
 * Generation by relaxation: a parent edge pushes the child one level down, a
 * marriage or a sibling link pulls both to the same level, and a parent is
 * pulled back up to sit directly above their earliest child.
 *
 * That last rule is what stops somebody's in-laws floating at the top of the
 * canvas. Marriage drags a spouse down to their partner's level, but their
 * own parents have nothing below them pushing, so without it they stay
 * stranded at the root — three empty rows above the daughter they belong to.
 *
 * Every rule only ever raises a number, so the whole thing climbs to a fixed
 * point instead of oscillating between two answers.
 */
function assignGenerations(people: Person[], g: Graph): Map<string, number> {
  const gen = new Map<string, number>();
  for (const p of people) gen.set(p.id, 0);

  for (let pass = 0; pass < people.length + 4; pass++) {
    let moved = false;
    for (const p of people) {
      const id = p.id;
      let want = gen.get(id)!;
      for (const parent of listOf(g.parents, id))
        want = Math.max(want, (gen.get(parent) ?? 0) + 1);
      for (const peer of [...listOf(g.spouses, id), ...listOf(g.siblings, id)])
        want = Math.max(want, gen.get(peer) ?? 0);
      const kids = listOf(g.children, id);
      if (kids.length) {
        let earliest = Infinity;
        for (const kid of kids) earliest = Math.min(earliest, gen.get(kid) ?? 0);
        if (earliest !== Infinity) want = Math.max(want, earliest - 1);
      }
      if (want !== gen.get(id)) {
        gen.set(id, want);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return gen;
}

/** how many people hang off someone, used to let the biggest lineage lead */
function descendantCount(id: string, g: Graph): number {
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const cur = queue.pop()!;
    for (const child of listOf(g.children, cur))
      if (!seen.has(child)) {
        seen.add(child);
        queue.push(child);
      }
  }
  return seen.size - 1;
}

/**
 * Islands are spread on a spiral rather than a grid so that no two sit
 * directly behind one another — every bloodline keeps a clear line of sight
 * from anywhere you might stand.
 */
function spiralSlot(index: number, step: number): { x: number; z: number } {
  if (index === 0) return { x: 0, z: 0 };
  const turn = index * 2.399963; // golden angle, in radians
  const radius = step * Math.sqrt(index) * 0.62;
  return { x: Math.cos(turn) * radius, z: Math.sin(turn) * radius };
}

export function buildGalaxy(
  people: Person[],
  relationships: Relationship[],
  graph?: Graph
): Galaxy {
  const g = graph ?? buildGraph(people, relationships);
  const gen = assignGenerations(people, g);
  const nodes = new Map<string, GalaxyNode>();

  // Roots lead their own island. The one with the most people below them goes
  // first, so the largest family claims the middle of the canvas.
  const roots = people
    .filter((p) => listOf(g.parents, p.id).length === 0)
    .map((p) => ({ id: p.id, weight: descendantCount(p.id, g) }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));

  const islandOrder: string[] = [];
  const claimed = new Set<string>();

  const place = (personId: string, islandId: string, x: number, z: number) => {
    if (nodes.has(personId)) return;
    const generation = gen.get(personId) ?? 0;
    nodes.set(personId, { personId, x, y: generation * ROW_H, z, generation, islandId });
  };

  // Each bloodline is laid out around its own origin and moved into place
  // afterwards, because where it belongs depends on how wide it turns out to
  // be — which is not known until it has been drawn.
  for (const root of roots) {
    if (claimed.has(root.id)) continue;
    const islandId = root.id;
    islandOrder.push(islandId);

    const queue: { id: string; x: number; z: number }[] = [
      { id: root.id, x: 0, z: 0 },
    ];
    place(root.id, islandId, 0, 0);
    claimed.add(root.id);

    while (queue.length) {
      const cur = queue.shift()!;

      // Partners stand beside them. Someone with parents of their own is left
      // where they are: their own bloodline will claim them, and the marriage
      // becomes the bridge across.
      const partners = listOf(g.spouses, cur.id).filter(
        (id) => !nodes.has(id) && listOf(g.parents, id).length === 0
      );
      partners.forEach((partnerId, i) => {
        // deliberately the same depth as their partner: an island is a flat
        // plane, so a row of people reads as one generation. Depth is what
        // separates one bloodline from another, and nothing else.
        place(partnerId, islandId, cur.x + COL_W * (i + 1), cur.z);
        claimed.add(partnerId);
      });

      // brothers and sisters share the row
      const sibs = listOf(g.siblings, cur.id).filter((id) => !nodes.has(id));
      sibs.forEach((sibId, i) => {
        place(sibId, islandId, cur.x - COL_W * (i + 1), cur.z);
        claimed.add(sibId);
        queue.push({ id: sibId, x: cur.x - COL_W * (i + 1), z: cur.z });
      });

      const kids = listOf(g.children, cur.id).filter((id) => !nodes.has(id));
      const span = (kids.length - 1) * COL_W;
      kids.forEach((kidId, i) => {
        const kx = cur.x + i * COL_W - span / 2;
        place(kidId, islandId, kx, cur.z);
        claimed.add(kidId);
        queue.push({ id: kidId, x: kx, z: cur.z });
      });
    }
  }

  // anyone the walk never reached — a closed loop with no root, or somebody
  // with no connections at all — still needs somewhere to stand
  for (const p of people) {
    if (nodes.has(p.id)) continue;
    islandOrder.push(p.id);
    place(p.id, p.id, 0, 0);
  }

  // Fanning children out under each parent independently lets two branches
  // of the same generation land on top of each other. Nothing above knows
  // what the rest of the row is doing, so the row is tidied once at the end:
  // hold the order, push everyone apart to a readable gap, keep the middle.
  const rows = new Map<string, GalaxyNode[]>();
  for (const node of Array.from(nodes.values())) {
    const key = `${node.islandId}:${node.generation}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(node);
  }
  for (const row of Array.from(rows.values())) {
    if (row.length < 2) continue;
    row.sort((a, b) => a.x - b.x || a.personId.localeCompare(b.personId));
    const middleBefore = row.reduce((sum, n) => sum + n.x, 0) / row.length;
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i - 1].x;
      if (gap < COL_W) row[i].x = row[i - 1].x + COL_W;
    }
    const middleAfter = row.reduce((sum, n) => sum + n.x, 0) / row.length;
    const recentre = middleBefore - middleAfter;
    for (const n of row) n.x += recentre;
  }

  // Now that every bloodline has its true width, they can be spread far
  // enough apart not to stand inside one another. A fixed gap was never going
  // to do it — one family of forty is wider than four families of three.
  const members = new Map<string, GalaxyNode[]>();
  for (const node of Array.from(nodes.values())) {
    if (!members.has(node.islandId)) members.set(node.islandId, []);
    members.get(node.islandId)!.push(node);
  }

  let widest = COL_W;
  const extent = new Map<string, { midX: number; halfW: number }>();
  for (const [islandId, group] of Array.from(members.entries())) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const n of group) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
    }
    const halfW = (maxX - minX) / 2 + COL_W;
    extent.set(islandId, { midX: (minX + maxX) / 2, halfW });
    widest = Math.max(widest, halfW);
  }

  const step = widest * 2 + PLANE_GAP;
  islandOrder.forEach((islandId, index) => {
    const group = members.get(islandId);
    const box = extent.get(islandId);
    if (!group || !box) return;
    const slot = spiralSlot(index, step);
    for (const n of group) {
      n.x += slot.x - box.midX;
      n.z += slot.z;
    }
  });

  const links: GalaxyLink[] = [];
  const seenPair = new Set<string>();
  for (const r of relationships) {
    const a = nodes.get(r.fromPersonId);
    const b = nodes.get(r.toPersonId);
    if (!a || !b) continue;
    const kind =
      r.type === "PARENT_OF" ? "parent" : r.type === "SPOUSE_OF" ? "spouse" : "sibling";
    const key = `${kind}:${[r.fromPersonId, r.toPersonId].sort().join(">")}`;
    if (seenPair.has(key)) continue;
    seenPair.add(key);
    links.push({
      id: r.id,
      a: r.fromPersonId,
      b: r.toPersonId,
      kind,
      bridge: a.islandId !== b.islandId,
    });
  }

  let minGeneration = 0;
  let maxGeneration = 0;
  for (const n of Array.from(nodes.values())) {
    minGeneration = Math.min(minGeneration, n.generation);
    maxGeneration = Math.max(maxGeneration, n.generation);
  }

  return { nodes, links, minGeneration, maxGeneration, graph: g };
}

/**
 * The band you are reading: everyone within `up` generations above the cursor
 * and `down` below it who is actually related to the person in focus. The
 * generation window is what the up and down controls move; the relatedness
 * test is what stops the window from filling with strangers who happen to
 * have been born at the same time.
 */
export function focusBand(
  anchorId: string,
  generationCursor: number,
  galaxy: Galaxy,
  up = 2,
  down = 2
): Set<string> {
  const g = galaxy.graph;
  const withinReach = new Set<string>([anchorId]);
  // three steps of blood or marriage covers a grandparent, a cousin, and the
  // parents of whoever somebody married
  let frontier = [anchorId];
  for (let step = 0; step < 3; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const other of [
        ...listOf(g.parents, id),
        ...listOf(g.children, id),
        ...listOf(g.siblings, id),
        ...listOf(g.spouses, id),
      ]) {
        if (withinReach.has(other)) continue;
        withinReach.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }

  const out = new Set<string>();
  for (const id of Array.from(withinReach)) {
    const node = galaxy.nodes.get(id);
    if (!node) continue;
    if (
      node.generation >= generationCursor - up &&
      node.generation <= generationCursor + down
    ) {
      out.add(id);
    }
  }
  return out;
}
