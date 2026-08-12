import type { Person } from "./types";
import { NODE_H, NODE_W } from "./layout";

export type ClusterKey = "currentCity" | "birthCity" | "college" | "jobs" | "decade";

export const CLUSTER_OPTIONS: { key: ClusterKey; label: string }[] = [
  { key: "currentCity", label: "Current city" },
  { key: "birthCity", label: "Birth city" },
  { key: "college", label: "College" },
  { key: "jobs", label: "Jobs" },
  { key: "decade", label: "Decade born" },
];

export interface ClusterBubble {
  id: string;
  label: string;
  count: number;
  muted: boolean; // the "no info" group
  x: number; // top-left
  y: number;
  size: number; // diameter
}

export interface ClusterLayout {
  bubbles: ClusterBubble[];
  positions: Map<string, { x: number; y: number }>;
}

function valueFor(person: Person, key: ClusterKey): string | null {
  if (key === "decade") {
    const y = parseInt(person.birthYear ?? "", 10);
    if (isNaN(y)) return null;
    return `Born in the ${Math.floor(y / 10) * 10}s`;
  }
  return person.details?.[key] ?? null;
}

// Group by the part before the first comma so "San Diego, CA" and
// "San Diego" land in the same bucket, and "UC San Diego, Class of 2016"
// clusters with other UCSD grads.
function groupKeyOf(value: string): string {
  return value.split(",")[0].trim().toLowerCase();
}

function displayLabel(value: string): string {
  return value.split(",")[0].trim();
}

export function layoutClusters(people: Person[], key: ClusterKey): ClusterLayout {
  const groups = new Map<string, { label: string; people: Person[]; muted: boolean }>();

  for (const person of people) {
    const value = valueFor(person, key);
    const gk = value ? `v:${groupKeyOf(value)}` : "none";
    if (!groups.has(gk)) {
      groups.set(gk, {
        label: value ? displayLabel(value) : "No info yet",
        people: [],
        muted: !value,
      });
    }
    groups.get(gk)!.people.push(person);
  }

  const ordered = Array.from(groups.values()).sort((a, b) => {
    if (a.muted !== b.muted) return a.muted ? 1 : -1; // "no info" last
    return b.people.length - a.people.length;
  });

  const bubbles: ClusterBubble[] = [];
  const positions = new Map<string, { x: number; y: number }>();

  // circle geometry per cluster
  const measured = ordered.map((g) => {
    const n = g.people.length;
    const ring = n === 1 ? 0 : Math.max(150, (n * (NODE_W + 60)) / (2 * Math.PI));
    const radius = ring + NODE_H + 90;
    return { ...g, ring, radius };
  });

  // wrap clusters into rows
  const MAX_ROW = 2200;
  const GAP = 90;
  type Measured = (typeof measured)[number];
  const rows: Measured[][] = [];
  let current: Measured[] = [];
  let used = 0;

  for (const g of measured) {
    const d = g.radius * 2;
    if (current.length && used + GAP + d > MAX_ROW) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(g);
    used += (current.length > 1 ? GAP : 0) + d;
  }
  if (current.length) rows.push(current);

  const rowWidth = (row: Measured[]) =>
    row.reduce((sum, g, i) => sum + (i ? GAP : 0) + g.radius * 2, 0);
  const widest = Math.max(...rows.map(rowWidth), 0);

  // each row is centred on the widest row, and bubbles share a mid-line
  let cy = 0;
  for (const row of rows) {
    const rowHeight = Math.max(...row.map((g) => g.radius * 2));
    let cx = (widest - rowWidth(row)) / 2;

    for (const g of row) {
      const d = g.radius * 2;
      const centerX = cx + g.radius;
      const centerY = cy + rowHeight / 2;

      bubbles.push({
        id: `cluster-${g.label}-${bubbles.length}`,
        label: g.label,
        count: g.people.length,
        muted: g.muted,
        x: cx,
        y: centerY - g.radius,
        size: d,
      });

      g.people.forEach((p, i) => {
        if (g.people.length === 1) {
          positions.set(p.id, { x: centerX - NODE_W / 2, y: centerY - NODE_H / 2 });
          return;
        }
        const angle = (i / g.people.length) * 2 * Math.PI - Math.PI / 2;
        positions.set(p.id, {
          x: centerX + g.ring * Math.cos(angle) - NODE_W / 2,
          y: centerY + g.ring * Math.sin(angle) - NODE_H / 2,
        });
      });

      cx += d + GAP;
    }
    cy += rowHeight + GAP;
  }

  return { bubbles, positions };
}
