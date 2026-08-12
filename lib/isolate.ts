import type { Person, Relationship } from "./types";
import { NODE_H, NODE_W } from "./layout";
import { parentsOf, spousesOf } from "./helpers";

const COL = NODE_W + 46;
const ROW = NODE_H + 140;

export interface IsolateLayout {
  positions: Map<string, { x: number; y: number }>;
  focusIds: Set<string>;
  centre: { x: number; y: number };
}

function childrenOf(relationships: Relationship[], personId: string) {
  return relationships
    .filter((r) => r.type === "PARENT_OF" && r.fromPersonId === personId)
    .map((r) => r.toPersonId);
}

function siblingsOf(relationships: Relationship[], personId: string) {
  const out = new Set<string>();
  // explicit sibling links
  for (const r of relationships) {
    if (r.type !== "SIBLING_OF") continue;
    if (r.fromPersonId === personId) out.add(r.toPersonId);
    if (r.toPersonId === personId) out.add(r.fromPersonId);
  }
  // anyone sharing a parent
  for (const parent of parentsOf(relationships, personId)) {
    for (const kid of childrenOf(relationships, parent)) {
      if (kid !== personId) out.add(kid);
    }
  }
  return Array.from(out);
}

const byBirth = (people: Person[]) => (a: string, b: string) => {
  const ya = parseInt(people.find((p) => p.id === a)?.birthYear ?? "", 10);
  const yb = parseInt(people.find((p) => p.id === b)?.birthYear ?? "", 10);
  if (isNaN(ya) && isNaN(yb)) return 0;
  if (isNaN(ya)) return 1;
  if (isNaN(yb)) return -1;
  return ya - yb;
};

/**
 * Rebuild the canvas around one person: parents above, siblings and partners
 * beside them, children below. Nobody else is placed at all — the caller
 * drops them from the graph entirely, because leaving them faded still drags
 * their connecting lines across the stage and undoes the isolation.
 */
export function layoutIsolated(
  people: Person[],
  relationships: Relationship[],
  focusId: string
): IsolateLayout {
  const sort = byBirth(people);
  const alive = new Set(people.map((p) => p.id));
  const keep = (ids: string[]) => ids.filter((id) => alive.has(id) && id !== focusId);

  const parents = keep(parentsOf(relationships, focusId)).sort(sort);
  const spouses = keep(spousesOf(relationships, focusId)).sort(sort);
  const siblings = keep(siblingsOf(relationships, focusId))
    .filter((id) => !spouses.includes(id))
    .sort(sort);
  const kids = keep(childrenOf(relationships, focusId)).sort(sort);

  const positions = new Map<string, { x: number; y: number }>();
  const focusIds = new Set<string>([focusId, ...parents, ...spouses, ...siblings, ...kids]);

  // middle row: siblings | the person | partners, with the person dead centre
  const middle = [...siblings, focusId, ...spouses];
  const selfIndex = siblings.length;
  middle.forEach((id, i) => {
    positions.set(id, { x: (i - selfIndex) * COL, y: 0 });
  });

  // parents sit as a pair centred over the person
  parents.forEach((id, i) => {
    const span = (parents.length - 1) * COL;
    positions.set(id, { x: i * COL - span / 2, y: -ROW });
  });

  // children centre under the person and their partner
  const kidAnchor = spouses.length ? (spouses.length * COL) / 2 : 0;
  kids.forEach((id, i) => {
    const span = (kids.length - 1) * COL;
    positions.set(id, { x: kidAnchor + i * COL - span / 2, y: ROW });
  });

  return {
    positions,
    focusIds,
    centre: { x: 0 + NODE_W / 2, y: 0 + NODE_H / 2 },
  };
}
