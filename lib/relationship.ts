import type { Gender, Person, Relationship } from "./types";
import { isLineageKind } from "./types";

/**
 * Names the kinship between two people the way a family would say it —
 * "2nd cousins once removed", "great-grandparent", "aunt or uncle".
 *
 * Wording follows a person's recorded gender when there is one, and stays
 * neutral otherwise — "aunt or uncle" rather than a guess from their name.
 */
export interface RelationResult {
  kind: "self" | "blood" | "spouse" | "marriage" | "distant" | "none";
  /** short form, e.g. "3rd cousins" */
  label: string;
  /** "Yosief is a 3rd cousin of Naomi" */
  aToB: string;
  /** "Naomi is a 3rd cousin of Yosief" */
  bToA: string;
  /** how we worked it out */
  via?: string;
  commonAncestorIds: string[];
  path: { personIds: string[]; relationshipIds: string[] } | null;
}

const ORDINALS = [
  "", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th",
];
const TIMES = ["", "once", "twice", "three times", "four times", "five times"];

function ordinal(n: number) {
  return ORDINALS[n] ?? `${n}th`;
}
function removedSuffix(n: number) {
  if (n === 0) return "";
  return ` ${TIMES[n] ?? `${n} times`} removed`;
}
/**
 * "great-" stacks fast: by the sixth generation you get an unreadable
 * great-great-great-great-grandparent. Genealogy convention spells out the
 * first couple then switches to an ordinal — "4th great-grandparent".
 */
function greatPrefix(count: number) {
  if (count <= 0) return "";
  if (count <= 2) return "great-".repeat(count);
  return `${ordinal(count)} great-`;
}

/**
 * Gendered wording when we know, neutral when we don't. Gender is never
 * inferred from a name — an unset field simply yields "parent", "sibling",
 * "aunt or uncle".
 */
const WORDS: Record<string, [female: string, male: string, neutral: string]> = {
  parent: ["mother", "father", "parent"],
  child: ["daughter", "son", "child"],
  grandparent: ["grandmother", "grandfather", "grandparent"],
  grandchild: ["granddaughter", "grandson", "grandchild"],
  sibling: ["sister", "brother", "sibling"],
  "half-sibling": ["half-sister", "half-brother", "half-sibling"],
  pibling: ["aunt", "uncle", "aunt or uncle"],
  nibling: ["niece", "nephew", "niece or nephew"],
  spouse: ["wife", "husband", "spouse"],
};

function word(base: keyof typeof WORDS, gender?: Gender) {
  const [f, m, n] = WORDS[base];
  return gender === "female" ? f : gender === "male" ? m : n;
}

/** 1 → parent, 2 → grandparent, 3 → great-grandparent, 6 → 4th great-… */
function ancestorTerm(gen: number, gender?: Gender) {
  if (gen === 1) return word("parent", gender);
  return `${greatPrefix(gen - 2)}${word("grandparent", gender)}`;
}
function descendantTerm(gen: number, gender?: Gender) {
  if (gen === 1) return word("child", gender);
  return `${greatPrefix(gen - 2)}${word("grandchild", gender)}`;
}
/** 2 → aunt or uncle, 3 → great-aunt or great-uncle */
function piblingTerm(gen: number, gender?: Gender) {
  const g = greatPrefix(gen - 2);
  if (gender) return `${g}${word("pibling", gender)}`;
  return `${g}aunt or ${g}uncle`;
}
function niblingTerm(gen: number, gender?: Gender) {
  const g = greatPrefix(gen - 2);
  if (gender) return `${g}${word("nibling", gender)}`;
  return `${g}niece or ${g}nephew`;
}

function buildMaps(relationships: Relationship[]) {
  const parents = new Map<string, string[]>();
  const spouses = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(v);
  };
  for (const r of relationships) {
    if (r.type === "PARENT_OF" && isLineageKind(r.kind))
      push(parents, r.toPersonId, r.fromPersonId);
    else if (r.type === "SPOUSE_OF") {
      push(spouses, r.fromPersonId, r.toPersonId);
      push(spouses, r.toPersonId, r.fromPersonId);
    }
  }
  return { parents, spouses };
}

/** every ancestor of `id` mapped to how many generations up they sit */
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

/** shortest chain between two people over any relationship type */
function findChain(relationships: Relationship[], from: string, to: string) {
  if (from === to) return { personIds: [from], relationshipIds: [] };
  const adj = new Map<string, { other: string; relId: string }[]>();
  for (const r of relationships) {
    if (!adj.has(r.fromPersonId)) adj.set(r.fromPersonId, []);
    if (!adj.has(r.toPersonId)) adj.set(r.toPersonId, []);
    adj.get(r.fromPersonId)!.push({ other: r.toPersonId, relId: r.id });
    adj.get(r.toPersonId)!.push({ other: r.fromPersonId, relId: r.id });
  }
  const prev = new Map<string, { person: string; relId: string }>();
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const { other, relId } of adj.get(cur) ?? []) {
      if (seen.has(other)) continue;
      seen.add(other);
      prev.set(other, { person: cur, relId });
      queue.push(other);
    }
  }
  if (!seen.has(to)) return null;
  const personIds = [to];
  const relationshipIds: string[] = [];
  let cur = to;
  while (cur !== from) {
    const step = prev.get(cur)!;
    relationshipIds.push(step.relId);
    personIds.push(step.person);
    cur = step.person;
  }
  return { personIds: personIds.reverse(), relationshipIds };
}

/** the blood relation only, or null */
function bloodRelation(
  aId: string,
  bId: string,
  parents: Map<string, string[]>,
  genderOf: (id: string) => Gender | undefined = () => undefined
): { label: string; aTerm: string; bTerm: string; ancestors: string[] } | null {
  const ga = genderOf(aId);
  const gb = genderOf(bId);
  const da = ancestorDepths(aId, parents);
  const db = ancestorDepths(bId, parents);

  let best: { id: string; d1: number; d2: number } | null = null;
  db.forEach((d2, id) => {
    const d1 = da.get(id);
    if (d1 === undefined) return;
    if (!best || d1 + d2 < best.d1 + best.d2) best = { id, d1, d2 };
  });
  if (!best) return null;
  const { d1, d2 } = best as { id: string; d1: number; d2: number };

  // every ancestor that ties for closest — two of them means full siblings
  const ancestors: string[] = [];
  db.forEach((d2b, id) => {
    const d1b = da.get(id);
    if (d1b === d1 && d2b === d2) ancestors.push(id);
  });

  if (d1 === 0)
    return {
      label: ancestorTerm(d2, ga),
      aTerm: ancestorTerm(d2, ga),
      bTerm: descendantTerm(d2, gb),
      ancestors,
    };
  if (d2 === 0)
    return {
      label: descendantTerm(d1, ga),
      aTerm: descendantTerm(d1, ga),
      bTerm: ancestorTerm(d1, gb),
      ancestors,
    };

  if (d1 === 1 && d2 === 1) {
    const sharedParents = ancestors.length;
    const aParents = (parents.get(aId) ?? []).length;
    const bParents = (parents.get(bId) ?? []).length;
    const half = sharedParents === 1 && aParents > 1 && bParents > 1;
    const base = half ? ("half-sibling" as const) : ("sibling" as const);
    return {
      label: half ? "Half-siblings" : "Siblings",
      aTerm: word(base, ga),
      bTerm: word(base, gb),
      ancestors,
    };
  }

  if (d1 === 1)
    return {
      label: piblingTerm(d2, ga),
      aTerm: piblingTerm(d2, ga),
      bTerm: niblingTerm(d2, gb),
      ancestors,
    };
  if (d2 === 1)
    return {
      label: niblingTerm(d1, ga),
      aTerm: niblingTerm(d1, ga),
      bTerm: piblingTerm(d1, gb),
      ancestors,
    };

  const degree = Math.min(d1, d2) - 1;
  const removed = Math.abs(d1 - d2);
  const term = `${ordinal(degree)} cousin${removedSuffix(removed)}`;
  return {
    label: `${ordinal(degree)} cousins${removedSuffix(removed)}`,
    aTerm: term,
    bTerm: term,
    ancestors,
  };
}

export function describeRelationship(
  aId: string,
  bId: string,
  people: Person[],
  relationships: Relationship[]
): RelationResult {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "Unknown";
  const { parents, spouses } = buildMaps(relationships);
  const genderOf = (id: string) => people.find((p) => p.id === id)?.gender;
  const path = findChain(relationships, aId, bId);

  if (aId === bId) {
    return {
      kind: "self",
      label: "The same person",
      aToB: `${name(aId)} is the same person.`,
      bToA: "",
      commonAncestorIds: [],
      path,
    };
  }

  const blood = bloodRelation(aId, bId, parents, genderOf);
  if (blood) {
    const article = /^[aeiou]/i.test(blood.aTerm) ? "an" : "a";
    const articleB = /^[aeiou]/i.test(blood.bTerm) ? "an" : "a";
    return {
      kind: "blood",
      label: capitalise(blood.label),
      aToB: `${name(aId)} is ${article} ${blood.aTerm} of ${name(bId)}.`,
      bToA: `${name(bId)} is ${articleB} ${blood.bTerm} of ${name(aId)}.`,
      via:
        blood.ancestors.length > 0
          ? `Common ancestor${blood.ancestors.length > 1 ? "s" : ""}: ${blood.ancestors
              .map(name)
              .join(" and ")}`
          : undefined,
      commonAncestorIds: blood.ancestors,
      path,
    };
  }

  if ((spouses.get(aId) ?? []).includes(bId)) {
    return {
      kind: "spouse",
      label: "Spouses",
      aToB: `${name(aId)} is the ${word("spouse", genderOf(aId))} of ${name(bId)}.`,
      bToA: `${name(bId)} is the ${word("spouse", genderOf(bId))} of ${name(aId)}.`,
      commonAncestorIds: [],
      path,
    };
  }

  // in-laws: one of them is married to a blood relative of the other
  for (const spouse of spouses.get(aId) ?? []) {
    const rel = bloodRelation(spouse, bId, parents, genderOf);
    if (!rel) continue;
    return {
      kind: "marriage",
      label: `${capitalise(rel.aTerm)}-in-law`,
      aToB: `${name(aId)} is married to ${name(bId)}'s ${rel.aTerm}, ${name(spouse)}.`,
      bToA: `${name(bId)} is ${name(aId)}'s ${rel.bTerm} by marriage.`,
      via: `Through ${name(spouse)}`,
      commonAncestorIds: rel.ancestors,
      path,
    };
  }
  for (const spouse of spouses.get(bId) ?? []) {
    const rel = bloodRelation(spouse, aId, parents, genderOf);
    if (!rel) continue;
    return {
      kind: "marriage",
      label: `${capitalise(rel.aTerm)}-in-law`,
      aToB: `${name(aId)} is ${name(bId)}'s ${rel.bTerm} by marriage.`,
      bToA: `${name(bId)} is married to ${name(aId)}'s ${rel.aTerm}, ${name(spouse)}.`,
      via: `Through ${name(spouse)}`,
      commonAncestorIds: rel.ancestors,
      path,
    };
  }

  if (path) {
    return {
      kind: "distant",
      label: "Related by marriage",
      aToB: `${name(aId)} and ${name(bId)} are connected through ${
        path.personIds.length - 2
      } ${path.personIds.length - 2 === 1 ? "person" : "people"}, but share no common ancestor.`,
      bToA: "",
      commonAncestorIds: [],
      path,
    };
  }

  return {
    kind: "none",
    label: "No recorded relationship",
    aToB: `Nothing recorded yet links ${name(aId)} and ${name(bId)}.`,
    bToA: "",
    commonAncestorIds: [],
    path: null,
  };
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
