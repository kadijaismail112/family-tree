import type { Person, Store } from "./types";
import { isLineageKind } from "./types";
import { groupByCity } from "./geo";
import { ageOf } from "./helpers";

/**
 * Everything the profile page reports about one member — computed across
 * every family they belong to, since a person's relatives don't stop at a
 * single tree.
 */
export interface FamilyStat {
  familyId: string;
  familyName: string;
  people: number;
  members: number;
  /** the node in that tree that is you, if you've been placed in it */
  selfPersonId: string | null;
  generations: number;
}

export interface ProfileStats {
  families: FamilyStat[];
  totalRelatives: number;
  /** "1st cousins" → 4, keyed by degree */
  cousinsByDegree: { degree: number; count: number }[];
  closeCounts: {
    parents: number;
    siblings: number;
    children: number;
    grandparents: number;
    auntsUncles: number;
    niecesNephews: number;
  };
  oldestLiving: { person: Person; age: number; familyName: string } | null;
  citiesWithRelatives: number;
  topCity: { city: string; count: number } | null;
  livingCount: number;
  unknownStatusCount: number;
}

/** ancestors of `id` → generations up, following bloodline edges only */
function ancestorDepths(id: string, parents: Map<string, string[]>) {
  const depths = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  let depth = 0;
  while (frontier.length) {
    depth++;
    const next: string[] = [];
    for (const person of frontier) {
      for (const parent of parents.get(person) ?? []) {
        if (depths.has(parent)) continue;
        depths.set(parent, depth);
        next.push(parent);
      }
    }
    frontier = next;
  }
  return depths;
}

export function computeProfile(state: Store, userId: string): ProfileStats {
  const myFamilyIds = state.memberships
    .filter((m) => m.userId === userId)
    .map((m) => m.familyId);

  const families: FamilyStat[] = [];
  const cousinsByDegree = new Map<number, number>();
  const closeCounts = {
    parents: 0,
    siblings: 0,
    children: 0,
    grandparents: 0,
    auntsUncles: 0,
    niecesNephews: 0,
  };
  const relatives = new Set<string>();
  const relativePeople: { person: Person; familyName: string }[] = [];

  for (const familyId of myFamilyIds) {
    const family = state.families.find((f) => f.id === familyId);
    if (!family) continue;
    const people = state.people.filter((p) => p.familyId === familyId);
    const rels = state.relationships.filter((r) => r.familyId === familyId);

    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    for (const p of people) {
      parents.set(p.id, []);
      children.set(p.id, []);
    }
    for (const r of rels) {
      if (r.type !== "PARENT_OF" || !isLineageKind(r.kind)) continue;
      parents.get(r.toPersonId)?.push(r.fromPersonId);
      children.get(r.fromPersonId)?.push(r.toPersonId);
    }

    const self = people.find((p) => p.accountUserId === userId) ?? null;

    // rough generation depth of the whole tree, for the family card
    let generations = 0;
    for (const p of people) {
      const d = ancestorDepths(p.id, parents);
      generations = Math.max(generations, Math.max(...Array.from(d.values())) + 1);
    }

    families.push({
      familyId,
      familyName: family.name,
      people: people.length,
      members: state.memberships.filter((m) => m.familyId === familyId).length,
      selfPersonId: self?.id ?? null,
      generations,
    });

    if (!self) continue;

    // Classify everyone by where they sit relative to you: the standard
    // genealogy rule from the two distances to a common ancestor.
    const mine = ancestorDepths(self.id, parents);
    for (const other of people) {
      if (other.id === self.id) continue;
      const theirs = ancestorDepths(other.id, parents);

      let best: { d1: number; d2: number } | null = null;
      theirs.forEach((d2, id) => {
        const d1 = mine.get(id);
        if (d1 === undefined) return;
        if (!best || d1 + d2 < best.d1 + best.d2) best = { d1, d2 };
      });
      if (!best) continue;
      const { d1, d2 } = best as { d1: number; d2: number };

      relatives.add(other.id);
      relativePeople.push({ person: other, familyName: family.name });

      if (d1 === 0 && d2 === 1) closeCounts.children++;
      else if (d1 === 1 && d2 === 0) closeCounts.parents++;
      else if (d1 === 2 && d2 === 0) closeCounts.grandparents++;
      else if (d1 === 1 && d2 === 1) closeCounts.siblings++;
      else if (d1 === 2 && d2 === 1) closeCounts.auntsUncles++;
      else if (d1 === 1 && d2 === 2) closeCounts.niecesNephews++;
      else if (d1 >= 2 && d2 >= 2) {
        // cousins: degree is the nearer distance minus one
        const degree = Math.min(d1, d2) - 1;
        cousinsByDegree.set(degree, (cousinsByDegree.get(degree) ?? 0) + 1);
      }
    }
  }

  // oldest *living* relative — only counts people actually marked living
  let oldestLiving: ProfileStats["oldestLiving"] = null;
  for (const { person, familyName } of relativePeople) {
    if (person.lifeStatus !== "living") continue;
    const age = ageOf(person);
    if (age === null) continue;
    if (!oldestLiving || age > oldestLiving.age)
      oldestLiving = { person, age, familyName };
  }

  const allRelatives = relativePeople.map((r) => r.person);
  const { groups } = groupByCity(allRelatives);
  const livingGroups = groupByCity(
    allRelatives.filter((p) => p.lifeStatus === "living")
  ).groups;

  return {
    families,
    totalRelatives: relatives.size,
    cousinsByDegree: Array.from(cousinsByDegree.entries())
      .map(([degree, count]) => ({ degree, count }))
      .sort((a, b) => a.degree - b.degree),
    closeCounts,
    oldestLiving,
    citiesWithRelatives: groups.length,
    topCity: livingGroups.length
      ? { city: livingGroups[0].city.name, count: livingGroups[0].people.length }
      : groups.length
        ? { city: groups[0].city.name, count: groups[0].people.length }
        : null,
    livingCount: allRelatives.filter((p) => p.lifeStatus === "living").length,
    unknownStatusCount: allRelatives.filter((p) => !p.lifeStatus).length,
  };
}
