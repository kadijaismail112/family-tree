import type { Relationship, RelationType } from "./types";
import { parentsOf } from "./helpers";

/**
 * Assumed connections — relationships the recorded data implies but nobody
 * has actually asserted yet. Each one is offered for a confirm/deny; a denial
 * is remembered by `key` so it never comes back.
 */
export interface Suggestion {
  key: string;
  type: RelationType;
  fromPersonId: string;
  toPersonId: string;
  /** whose panels should offer this — child only for parents, both otherwise */
  audience: string[];
  /** why we think so, e.g. "They're both children of Elena Rivera." */
  reasonKind: "siblingsParent" | "sharedParent" | "sharedSibling" | "sharedChild";
  viaPersonId: string;
}

const pairKey = (a: string, b: string) => [a, b].sort().join(">");

export function suggestionKey(
  type: RelationType,
  fromId: string,
  toId: string
): string {
  return type === "PARENT_OF"
    ? `PARENT_OF|${fromId}>${toId}`
    : `${type}|${pairKey(fromId, toId)}`;
}

export function allSuggestions(
  relationships: Relationship[],
  dismissed: string[]
): Suggestion[] {
  const dismissedSet = new Set(dismissed);
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  // any recorded relationship between a pair blocks inferring a different one
  const related = new Set<string>();
  for (const r of relationships) related.add(pairKey(r.fromPersonId, r.toPersonId));

  const siblings = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  const addTo = (map: Map<string, Set<string>>, k: string, v: string) => {
    if (!map.has(k)) map.set(k, new Set());
    map.get(k)!.add(v);
  };
  for (const r of relationships) {
    if (r.type === "SIBLING_OF") {
      addTo(siblings, r.fromPersonId, r.toPersonId);
      addTo(siblings, r.toPersonId, r.fromPersonId);
    } else if (r.type === "PARENT_OF") {
      addTo(children, r.fromPersonId, r.toPersonId);
    }
  }

  const push = (s: Omit<Suggestion, "key">) => {
    const key = suggestionKey(s.type, s.fromPersonId, s.toPersonId);
    if (dismissedSet.has(key) || seen.has(key)) return;
    if (s.fromPersonId === s.toPersonId) return;
    if (related.has(pairKey(s.fromPersonId, s.toPersonId))) return;
    seen.add(key);
    out.push({ ...s, key });
  };

  // 1. Your sibling's parent is probably your parent too.
  for (const [personId, sibs] of Array.from(siblings.entries())) {
    const mine = new Set(parentsOf(relationships, personId));
    for (const sib of Array.from(sibs)) {
      for (const parentId of parentsOf(relationships, sib)) {
        if (mine.has(parentId)) continue;
        push({
          type: "PARENT_OF",
          fromPersonId: parentId,
          toPersonId: personId,
          audience: [personId],
          reasonKind: "siblingsParent",
          viaPersonId: sib,
        });
      }
    }
  }

  // 2. Two people who share a parent are probably siblings.
  for (const [parentId, kids] of Array.from(children.entries())) {
    const list = Array.from(kids);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        push({
          type: "SIBLING_OF",
          fromPersonId: list[i],
          toPersonId: list[j],
          audience: [list[i], list[j]],
          reasonKind: "sharedParent",
          viaPersonId: parentId,
        });
      }
    }
  }

  // 3. Siblings of the same person are probably siblings of each other.
  for (const [middleId, sibs] of Array.from(siblings.entries())) {
    const list = Array.from(sibs);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (siblings.get(list[i])?.has(list[j])) continue;
        push({
          type: "SIBLING_OF",
          fromPersonId: list[i],
          toPersonId: list[j],
          audience: [list[i], list[j]],
          reasonKind: "sharedSibling",
          viaPersonId: middleId,
        });
      }
    }
  }

  // 4. Two people who share a child are probably partners.
  const parentsByChild = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type !== "PARENT_OF") continue;
    if (!parentsByChild.has(r.toPersonId)) parentsByChild.set(r.toPersonId, []);
    parentsByChild.get(r.toPersonId)!.push(r.fromPersonId);
  }
  for (const [childId, parents] of Array.from(parentsByChild.entries())) {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        push({
          type: "SPOUSE_OF",
          fromPersonId: parents[i],
          toPersonId: parents[j],
          audience: [parents[i], parents[j]],
          reasonKind: "sharedChild",
          viaPersonId: childId,
        });
      }
    }
  }

  return out;
}

export function suggestionsFor(
  relationships: Relationship[],
  dismissed: string[],
  personId: string
): Suggestion[] {
  return allSuggestions(relationships, dismissed).filter((s) =>
    s.audience.includes(personId)
  );
}
