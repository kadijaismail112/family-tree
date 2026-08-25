import type { Person, Store } from "./types";
import { describeRelationship } from "./relationship";

export interface SpotlightCard {
  person: Person;
  familyId: string;
  familyName: string;
  /** e.g. "your aunt" — absent until they claim a node */
  relation?: string;
  via?: string;
}

/**
 * Monday-stable week key so the dashboard set does not reshuffle on refresh.
 */
export function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickStable<T>(items: T[], n: number, seed: string, idOf: (item: T) => string): T[] {
  const ranked = items.map((item) => ({
    item,
    key: hash(`${seed}:${idOf(item)}`),
  }));
  ranked.sort((a, b) => a.key - b.key);
  return ranked.slice(0, n).map((r) => r.item);
}

/**
 * Three or four relatives for the signed-in home. The same people stay up
 * for the calendar week, then a new draw.
 */
export function weeklySpotlight(
  state: Store,
  userId: string,
  count = 4
): SpotlightCard[] {
  const myFamilies = state.memberships
    .filter((m) => m.userId === userId)
    .map((m) => state.families.find((f) => f.id === m.familyId))
    .filter((f): f is NonNullable<typeof f> => !!f);

  const pool: SpotlightCard[] = [];
  for (const family of myFamilies) {
    const people = state.people.filter((p) => p.familyId === family.id);
    const rels = state.relationships.filter((r) => r.familyId === family.id);
    const me = people.find((p) => p.accountUserId === userId);
    for (const person of people) {
      if (me && person.id === me.id) continue;
      let relation: string | undefined;
      let via: string | undefined;
      if (me) {
        const named = describeRelationship(person.id, me.id, people, rels);
        if (named.kind !== "none" && named.aTerm) {
          relation = `Your ${named.aTerm}`;
          via = named.via;
        } else if (named.kind === "distant") {
          relation = named.label;
          via = named.via;
        }
      }
      pool.push({
        person,
        familyId: family.id,
        familyName: family.name,
        relation,
        via,
      });
    }
  }

  const withPhoto = pool.filter((c) => c.person.photoUrl);
  const named = pool.filter((c) => c.relation && !c.person.photoUrl);
  const rest = pool.filter((c) => !c.relation && !c.person.photoUrl);
  const seed = `${userId}:${weekKey()}`;
  const idOf = (c: SpotlightCard) => c.person.id;
  // Portrait first — the carousel is built around a main image — then people
  // we can name a relation for, then whoever else is in the trees.
  const preferred = pickStable(withPhoto, count, seed, idOf);
  if (preferred.length >= count) return preferred;
  const namedFill = pickStable(named, count - preferred.length, `${seed}:named`, idOf);
  const picked = [...preferred, ...namedFill];
  if (picked.length >= count) return picked;
  return [
    ...picked,
    ...pickStable(rest, count - picked.length, `${seed}:rest`, idOf),
  ];
}
