import type { Confirmation, Person, Relationship, Store } from "./types";
import { PERSON_DETAIL_FIELDS } from "./types";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const HUES = ["#0f766e", "#b45309", "#7c3aed", "#be123c", "#1d4ed8", "#4d7c0f", "#0e7490", "#a21caf"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function userName(state: Store, userId: string) {
  if (!userId) return "a former member";
  return state.users.find((u) => u.id === userId)?.name ?? "Unknown member";
}

export function tallyFor(confirmations: Confirmation[], relationshipId: string) {
  const mine = confirmations.filter((c) => c.relationshipId === relationshipId);
  return {
    confirms: mine.filter((c) => c.type === "CONFIRM").length,
    disputes: mine.filter((c) => c.type === "DISPUTE").length,
  };
}

export function lifespan(birthYear?: string, deathYear?: string) {
  if (!birthYear && !deathYear) return null;
  if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
  if (birthYear) return `b. ${birthYear}`;
  return `d. ${deathYear}`;
}

/** Full date when we have one, year when that is all anybody knew. */
export function formatDateOrYear(date?: string, year?: string) {
  if (date) {
    const d = new Date(`${date}T00:00:00`);
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
  }
  return year ?? null;
}

/**
 * "No death date" and "still living" are different claims, so this only
 * answers true when someone actually said so.
 */
export function isLiving(person: Person) {
  if (person.lifeStatus) return person.lifeStatus === "living";
  return undefined; // unknown
}

export function ageOf(person: Person) {
  const birth = parseInt(person.birthYear ?? "", 10);
  if (isNaN(birth)) return null;
  const end = parseInt(person.deathYear ?? "", 10);
  return (isNaN(end) ? new Date().getFullYear() : end) - birth;
}

/**
 * The audit trigger records a detail change under its storage key, since the
 * database has no idea what we call these on screen.
 */
export function editFieldLabel(field: string) {
  return PERSON_DETAIL_FIELDS.find((f) => f.key === field)?.label ?? field;
}

/**
 * Smart search: matches a person by name, notes, or any additional-info
 * field (city, college, jobs…). Returns null for no match, or a hint about
 * where the match came from ("Current city · San Diego, CA").
 */
export function personMatch(person: Person, query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (person.name.toLowerCase().includes(q)) return null; // name match needs no hint
  if (person.notes?.toLowerCase().includes(q)) return `Notes · ${person.notes}`;
  for (const field of PERSON_DETAIL_FIELDS) {
    const value = person.details?.[field.key];
    if (value && value.toLowerCase().includes(q)) {
      return `${field.label} · ${value}`;
    }
  }
  return null;
}

export function personMatches(person: Person, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return person.name.toLowerCase().includes(q) || personMatch(person, q) !== null;
}

/** Ids of everyone recorded as a spouse of this person. */
export function spousesOf(relationships: Relationship[], personId: string): string[] {
  const out: string[] = [];
  for (const r of relationships) {
    if (r.type !== "SPOUSE_OF") continue;
    if (r.fromPersonId === personId) out.push(r.toPersonId);
    else if (r.toPersonId === personId) out.push(r.fromPersonId);
  }
  return out;
}

/** Ids of everyone recorded as a parent of this person. */
export function parentsOf(relationships: Relationship[], personId: string): string[] {
  return relationships
    .filter((r) => r.type === "PARENT_OF" && r.toPersonId === personId)
    .map((r) => r.fromPersonId);
}

/**
 * Shortest chain of relationships between two people, ignoring edge
 * direction. Powers the "Me" highlight. Returns null if unconnected.
 */
export function findPath(
  relationships: Relationship[],
  fromPersonId: string,
  toPersonId: string
): { personIds: string[]; relationshipIds: string[] } | null {
  if (fromPersonId === toPersonId)
    return { personIds: [fromPersonId], relationshipIds: [] };
  const adj = new Map<string, { other: string; relId: string }[]>();
  for (const r of relationships) {
    if (!adj.has(r.fromPersonId)) adj.set(r.fromPersonId, []);
    if (!adj.has(r.toPersonId)) adj.set(r.toPersonId, []);
    adj.get(r.fromPersonId)!.push({ other: r.toPersonId, relId: r.id });
    adj.get(r.toPersonId)!.push({ other: r.fromPersonId, relId: r.id });
  }
  const prev = new Map<string, { person: string; relId: string }>();
  const visited = new Set([fromPersonId]);
  const queue = [fromPersonId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toPersonId) break;
    for (const { other, relId } of adj.get(cur) ?? []) {
      if (visited.has(other)) continue;
      visited.add(other);
      prev.set(other, { person: cur, relId });
      queue.push(other);
    }
  }
  if (!visited.has(toPersonId)) return null;
  const personIds = [toPersonId];
  const relationshipIds: string[] = [];
  let cur = toPersonId;
  while (cur !== fromPersonId) {
    const step = prev.get(cur)!;
    relationshipIds.push(step.relId);
    personIds.push(step.person);
    cur = step.person;
  }
  return { personIds: personIds.reverse(), relationshipIds };
}

/** Downscale an image before upload, so a phone photo isn't sent at full size. */
export function fileToDataUrl(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(months / 12);
  return `${years} yr${years > 1 ? "s" : ""} ago`;
}
