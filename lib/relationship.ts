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
  /** what A is to B on its own — "3rd cousin", "step-father", "wife" */
  aTerm?: string;
  /** what B is to A on its own — the mirror of `aTerm` */
  bTerm?: string;
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

/**
 * A blood tie held as structure rather than as a finished string, because
 * in-law wording has to re-say the same tie in someone else's gender: your
 * sister's husband is your brother-in-law, not your "sister-in-law".
 * Every `Kin` reads as "A is B's …".
 */
type Kin =
  | { t: "ancestor"; gen: number }
  | { t: "descendant"; gen: number }
  | { t: "sibling"; half: boolean }
  | { t: "pibling"; gen: number }
  | { t: "nibling"; gen: number }
  | { t: "cousin"; degree: number; removed: number };

/** the same tie seen from the other end */
function invert(kin: Kin): Kin {
  switch (kin.t) {
    case "ancestor":
      return { t: "descendant", gen: kin.gen };
    case "descendant":
      return { t: "ancestor", gen: kin.gen };
    case "pibling":
      return { t: "nibling", gen: kin.gen };
    case "nibling":
      return { t: "pibling", gen: kin.gen };
    default:
      return kin;
  }
}

function termFor(kin: Kin, gender?: Gender): string {
  switch (kin.t) {
    case "ancestor":
      return ancestorTerm(kin.gen, gender);
    case "descendant":
      return descendantTerm(kin.gen, gender);
    case "sibling":
      return word(kin.half ? "half-sibling" : "sibling", gender);
    case "pibling":
      return piblingTerm(kin.gen, gender);
    case "nibling":
      return niblingTerm(kin.gen, gender);
    case "cousin":
      return `${ordinal(kin.degree)} cousin${removedSuffix(kin.removed)}`;
  }
}

/** the headline form, which goes plural for the symmetric ties */
function pairLabel(kin: Kin, gender?: Gender) {
  if (kin.t === "sibling") return kin.half ? "Half-siblings" : "Siblings";
  if (kin.t === "cousin")
    return `${ordinal(kin.degree)} cousins${removedSuffix(kin.removed)}`;
  return capitalise(termFor(kin, gender));
}

/**
 * English only hands out "-in-law" to the closest ties: a spouse's aunt is an
 * "aunt by marriage", never an "aunt-in-law". The two directions are not
 * mirror images either — the person married to your mother is your
 * step-father, while your daughter's husband is your son-in-law.
 */

/** the person married to your {kin} — your sister's husband, your mother's husband */
function spouseOfKinTerm(kin: Kin, gender?: Gender) {
  if (kin.t === "ancestor") return `step-${termFor(kin, gender)}`;
  if (kin.t === "descendant") return `${termFor(kin, gender)}-in-law`;
  if (kin.t === "sibling") return `${word("sibling", gender)}-in-law`;
  return `${termFor(kin, gender)} by marriage`;
}

/** your spouse's {kin} — your husband's mother, your wife's son */
function kinOfSpouseTerm(kin: Kin, gender?: Gender) {
  if (kin.t === "ancestor") return `${termFor(kin, gender)}-in-law`;
  if (kin.t === "descendant") return `step-${termFor(kin, gender)}`;
  if (kin.t === "sibling") return `${word("sibling", gender)}-in-law`;
  return `${termFor(kin, gender)} by marriage`;
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

/** the blood tie only — "A is B's …" — or null when they share no ancestor */
function bloodKin(
  aId: string,
  bId: string,
  parents: Map<string, string[]>
): { kin: Kin; ancestors: string[] } | null {
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

  if (d1 === 0) return { kin: { t: "ancestor", gen: d2 }, ancestors };
  if (d2 === 0) return { kin: { t: "descendant", gen: d1 }, ancestors };

  if (d1 === 1 && d2 === 1) {
    const aParents = (parents.get(aId) ?? []).length;
    const bParents = (parents.get(bId) ?? []).length;
    const half = ancestors.length === 1 && aParents > 1 && bParents > 1;
    return { kin: { t: "sibling", half }, ancestors };
  }

  if (d1 === 1) return { kin: { t: "pibling", gen: d2 }, ancestors };
  if (d2 === 1) return { kin: { t: "nibling", gen: d1 }, ancestors };

  return {
    kin: {
      t: "cousin",
      degree: Math.min(d1, d2) - 1,
      removed: Math.abs(d1 - d2),
    },
    ancestors,
  };
}

function withArticle(term: string) {
  return `${/^[aeiou]/i.test(term) ? "an" : "a"} ${term}`;
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
  const ga = genderOf(aId);
  const gb = genderOf(bId);

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

  const blood = bloodKin(aId, bId, parents);
  if (blood) {
    const aTerm = termFor(blood.kin, ga);
    const bTerm = termFor(invert(blood.kin), gb);
    return {
      kind: "blood",
      label: pairLabel(blood.kin, ga),
      aTerm,
      bTerm,
      aToB: `${name(aId)} is ${withArticle(aTerm)} of ${name(bId)}.`,
      bToA: `${name(bId)} is ${withArticle(bTerm)} of ${name(aId)}.`,
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
    const aTerm = word("spouse", ga);
    const bTerm = word("spouse", gb);
    return {
      kind: "spouse",
      label: "Spouses",
      aTerm,
      bTerm,
      aToB: `${name(aId)} is the ${aTerm} of ${name(bId)}.`,
      bToA: `${name(bId)} is the ${bTerm} of ${name(aId)}.`,
      commonAncestorIds: [],
      path,
    };
  }

  // in-laws: one of them is married to a blood relative of the other
  for (const spouse of spouses.get(aId) ?? []) {
    const rel = bloodKin(spouse, bId, parents);
    if (!rel) continue;
    // A married into B's line: A is the spouse of B's {rel}
    const aTerm = spouseOfKinTerm(rel.kin, ga);
    const bTerm = kinOfSpouseTerm(invert(rel.kin), gb);
    return {
      kind: "marriage",
      label: capitalise(aTerm),
      aTerm,
      bTerm,
      aToB: `${name(aId)} is ${withArticle(aTerm)} of ${name(bId)}.`,
      bToA: `${name(bId)} is ${withArticle(bTerm)} of ${name(aId)}.`,
      via: `Through ${name(spouse)}, ${name(bId)}'s ${termFor(rel.kin, genderOf(spouse))}`,
      commonAncestorIds: rel.ancestors,
      path,
    };
  }
  for (const spouse of spouses.get(bId) ?? []) {
    const rel = bloodKin(spouse, aId, parents);
    if (!rel) continue;
    // B married into A's line: B is the spouse of A's {rel}
    const bTerm = spouseOfKinTerm(rel.kin, gb);
    const aTerm = kinOfSpouseTerm(invert(rel.kin), ga);
    return {
      kind: "marriage",
      label: capitalise(aTerm),
      aTerm,
      bTerm,
      aToB: `${name(aId)} is ${withArticle(aTerm)} of ${name(bId)}.`,
      bToA: `${name(bId)} is ${withArticle(bTerm)} of ${name(aId)}.`,
      via: `Through ${name(spouse)}, ${name(aId)}'s ${termFor(rel.kin, genderOf(spouse))}`,
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
