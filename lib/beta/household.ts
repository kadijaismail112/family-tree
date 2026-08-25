import type { Person, Relationship } from "../types";
import { isLineageKind, isLineageSiblingKind } from "../types";

/**
 * A household: one couple and their children. Nothing else.
 *
 * Every previous attempt at this page tried to draw a slice of the whole
 * graph — a generation, a radius, a bounding box — and every one of them put
 * an aunt by marriage next to a step-parent next to a cousin and called it a
 * family. A horizontal slice of a tree is not a family; it is a coincidence
 * of birth years.
 *
 * A household is the unit people actually think in, and it has the property
 * the big trees need: it is bounded. Eight children and two parents is ten
 * people whether the tree holds forty of them or four thousand.
 *
 * Everyone stands in at most a few of them — the one they were born into, and
 * the one or two they went on to make — and those overlaps are the doors.
 * Walking up through a parent lands you in the house they grew up in, where
 * their brothers and sisters are just the other children. Walking down through
 * a child lands you in the house that child went on to keep.
 */

export interface Household {
  /** stable across rebuilds: the heads' ids, sorted */
  id: string;
  /** the one or two people who head it */
  headIds: string[];
  /** their children, oldest first */
  childIds: string[];
}

export interface Households {
  byId: Map<string, Household>;
  /** the household someone was born into */
  bornInto: Map<string, string>;
  /** the households someone heads — more than one if they remarried */
  headOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
  siblingsOf: Map<string, string[]>;
}

const listOf = (m: Map<string, string[]>, k: string) => m.get(k) ?? [];

function add(m: Map<string, string[]>, k: string, v: string) {
  const list = m.get(k);
  if (!list) m.set(k, [v]);
  else if (!list.includes(v)) list.push(v);
}

export function householdId(headIds: string[]) {
  return [...headIds].sort().join("+");
}

export function buildHouseholds(
  people: Person[],
  relationships: Relationship[]
): Households {
  const known = new Set(people.map((p) => p.id));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();
  const siblingsOf = new Map<string, string[]>();

  for (const r of relationships) {
    if (!known.has(r.fromPersonId) || !known.has(r.toPersonId)) continue;
    if (r.type === "PARENT_OF") {
      if (!isLineageKind(r.kind)) continue;
      add(parentsOf, r.toPersonId, r.fromPersonId);
      add(childrenOf, r.fromPersonId, r.toPersonId);
    } else if (r.type === "SPOUSE_OF") {
      add(spousesOf, r.fromPersonId, r.toPersonId);
      add(spousesOf, r.toPersonId, r.fromPersonId);
    } else if (r.type === "SIBLING_OF") {
      if (!isLineageSiblingKind(r.kind)) continue;
      add(siblingsOf, r.fromPersonId, r.toPersonId);
      add(siblingsOf, r.toPersonId, r.fromPersonId);
    }
  }

  // anyone sharing a parent is a sibling, recorded or not
  for (const kids of Array.from(childrenOf.values())) {
    for (const a of kids) for (const b of kids) if (a !== b) add(siblingsOf, a, b);
  }

  const born = new Date().getFullYear() + 1;
  const byId = new Map(people.map((p) => [p.id, p]));
  const birthOf = (id: string) => {
    const year = parseInt(byId.get(id)?.birthYear ?? "", 10);
    return isNaN(year) ? born : year;
  };

  const households = new Map<string, Household>();
  const bornInto = new Map<string, string>();
  const headOf = new Map<string, string[]>();

  const ensure = (headIds: string[]) => {
    const id = householdId(headIds);
    let house = households.get(id);
    if (!house) {
      house = { id, headIds: [...headIds].sort(), childIds: [] };
      households.set(id, house);
      for (const head of house.headIds) add(headOf, head, id);
    }
    return house;
  };

  // Children group by exactly who their parents are. Two half-siblings with
  // different mothers belong to two households, which is the truth of it —
  // merging them would invent a family that never existed.
  for (const person of people) {
    const parents = listOf(parentsOf, person.id);
    if (!parents.length) continue;
    const house = ensure(parents);
    house.childIds.push(person.id);
    bornInto.set(person.id, house.id);
  }

  // a marriage with no children recorded is still a household
  for (const person of people) {
    for (const spouse of listOf(spousesOf, person.id)) {
      const id = householdId([person.id, spouse]);
      if (!households.has(id)) ensure([person.id, spouse]);
    }
  }

  for (const house of Array.from(households.values())) {
    house.childIds.sort(
      (a, b) =>
        birthOf(a) - birthOf(b) ||
        (byId.get(a)?.name ?? "").localeCompare(byId.get(b)?.name ?? "")
    );
  }

  return { byId: households, bornInto, headOf, parentsOf, childrenOf, spousesOf, siblingsOf };
}

/**
 * The household to open when somebody is chosen. The one they keep, if they
 * keep one — that is where their own life is — and otherwise the one they
 * grew up in, which for a child is the only one they are in.
 */
export function homeHouseholdFor(
  personId: string,
  houses: Households
): string | null {
  const kept = listOf(houses.headOf, personId);
  if (kept.length) {
    // the one with children first, so a childless second marriage doesn't win
    const withKids = kept.find((id) => (houses.byId.get(id)?.childIds.length ?? 0) > 0);
    return withKids ?? kept[0];
  }
  return houses.bornInto.get(personId) ?? null;
}

export interface Doorway {
  /** the person you step through */
  throughId: string;
  householdId: string;
  /** who is on the other side, for the label */
  headIds: string[];
  childCount: number;
}

/** the houses each head of this one grew up in */
export function doorsUp(house: Household, houses: Households): Doorway[] {
  const out: Doorway[] = [];
  for (const head of house.headIds) {
    const up = houses.bornInto.get(head);
    if (!up || up === house.id) continue;
    const target = houses.byId.get(up);
    if (!target) continue;
    out.push({
      throughId: head,
      householdId: up,
      headIds: target.headIds,
      childCount: target.childIds.length,
    });
  }
  return out;
}

/** the houses the children of this one went on to keep */
export function doorsDown(house: Household, houses: Households): Doorway[] {
  const out: Doorway[] = [];
  for (const child of house.childIds) {
    for (const down of listOf(houses.headOf, child)) {
      if (down === house.id) continue;
      const target = houses.byId.get(down);
      if (!target) continue;
      out.push({
        throughId: child,
        householdId: down,
        headIds: target.headIds,
        childCount: target.childIds.length,
      });
    }
  }
  return out;
}

/**
 * The other unions a head of this household is part of — a second marriage,
 * or the children of one. Kept apart from the doors up and down because it
 * is a step sideways, not a step through a generation.
 */
export function doorsAcross(house: Household, houses: Households): Doorway[] {
  const out: Doorway[] = [];
  for (const head of house.headIds) {
    for (const other of listOf(houses.headOf, head)) {
      if (other === house.id) continue;
      const target = houses.byId.get(other);
      if (!target) continue;
      out.push({
        throughId: head,
        householdId: other,
        headIds: target.headIds,
        childCount: target.childIds.length,
      });
    }
  }
  return out;
}
