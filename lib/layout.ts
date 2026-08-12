import type { Person, Relationship } from "./types";

export const NODE_W = 190;
export const NODE_H = 82;
const X_GAP = 60; // between units in a row
const COUPLE_GAP = 24; // between spouses in a couple unit
const Y_GAP = 110;
const COMPONENT_GAP = 160;

export interface Positioned {
  id: string;
  x: number;
  y: number;
  generation: number;
}

/**
 * Generational layout:
 *  1. Split into connected components.
 *  2. Within a component, assign generations by relaxation:
 *     PARENT_OF pushes child one level below parent; SPOUSE/SIBLING equalize.
 *  3. Group spouses into "couple units", order units in each row by the
 *     average x of their parents (barycenter), then lay rows out with
 *     collision-free spacing, centered per row.
 */
export function layoutTree(
  people: Person[],
  relationships: Relationship[]
): Map<string, Positioned> {
  const result = new Map<string, Positioned>();
  if (people.length === 0) return result;

  const ids = people.map((p) => p.id);
  const idSet = new Set(ids);
  const rels = relationships.filter(
    (r) => idSet.has(r.fromPersonId) && idSet.has(r.toPersonId)
  );

  // --- connected components ---
  const adj = new Map<string, string[]>();
  ids.forEach((id) => adj.set(id, []));
  rels.forEach((r) => {
    adj.get(r.fromPersonId)!.push(r.toPersonId);
    adj.get(r.toPersonId)!.push(r.fromPersonId);
  });

  const componentOf = new Map<string, number>();
  let compCount = 0;
  for (const id of ids) {
    if (componentOf.has(id)) continue;
    const queue = [id];
    componentOf.set(id, compCount);
    while (queue.length) {
      const cur = queue.pop()!;
      for (const nb of adj.get(cur)!) {
        if (!componentOf.has(nb)) {
          componentOf.set(nb, compCount);
          queue.push(nb);
        }
      }
    }
    compCount++;
  }

  let xOffset = 0;

  for (let comp = 0; comp < compCount; comp++) {
    const compIds = ids.filter((id) => componentOf.get(id) === comp);
    const compRels = rels.filter((r) => componentOf.get(r.fromPersonId) === comp);

    // --- generation assignment by relaxation ---
    const kidsOfGen = new Map<string, string[]>();
    const parentsOfGen = new Map<string, string[]>();
    compIds.forEach((id) => {
      kidsOfGen.set(id, []);
      parentsOfGen.set(id, []);
    });
    for (const r of compRels) {
      if (r.type !== "PARENT_OF") continue;
      kidsOfGen.get(r.fromPersonId)!.push(r.toPersonId);
      parentsOfGen.get(r.toPersonId)!.push(r.fromPersonId);
    }

    const gen = new Map<string, number>();
    compIds.forEach((id) => gen.set(id, 0));

    const settleDown = () => {
      for (let iter = 0; iter < compIds.length + compRels.length + 2; iter++) {
        let changed = false;
        for (const r of compRels) {
          const a = gen.get(r.fromPersonId)!;
          const b = gen.get(r.toPersonId)!;
          if (r.type === "PARENT_OF") {
            if (b < a + 1) {
              gen.set(r.toPersonId, a + 1);
              changed = true;
            }
          } else {
            // symmetric: pull to the same level (take the max so parents stay above)
            const m = Math.max(a, b);
            if (a !== m) {
              gen.set(r.fromPersonId, m);
              changed = true;
            }
            if (b !== m) {
              gen.set(r.toPersonId, m);
              changed = true;
            }
          }
        }
        if (!changed) break;
      }
    };

    // Pushing children down from parents is not enough on its own: someone
    // who married in and has no recorded ancestors would stay pinned to the
    // top generation no matter how deep their children sit — a grandmother
    // landing beside her great-great-grandparents-in-law, with an edge
    // crossing six rows. Pull every such person down to just above their
    // earliest child, then let the downward pass settle again.
    for (let round = 0; round < 8; round++) {
      settleDown();
      let moved = false;
      for (const id of compIds) {
        if (parentsOfGen.get(id)!.length > 0) continue; // has ancestors above
        const kids = kidsOfGen.get(id)!;
        if (kids.length === 0) continue;
        const target = Math.min(...kids.map((k) => gen.get(k)!)) - 1;
        if (target !== gen.get(id)!) {
          gen.set(id, target);
          moved = true;
        }
      }
      if (!moved) break;
    }

    const minGen = Math.min(...compIds.map((id) => gen.get(id)!));
    compIds.forEach((id) => gen.set(id, gen.get(id)! - minGen));

    // --- couple units ---
    const spouseOf = new Map<string, string>();
    for (const r of compRels) {
      if (r.type !== "SPOUSE_OF") continue;
      if (!spouseOf.has(r.fromPersonId) && !spouseOf.has(r.toPersonId)) {
        spouseOf.set(r.fromPersonId, r.toPersonId);
        spouseOf.set(r.toPersonId, r.fromPersonId);
      }
    }

    interface Unit {
      members: string[]; // 1 or 2 people, left-to-right
      generation: number;
      x: number; // center x, assigned later
      width: number;
    }
    const unitOf = new Map<string, Unit>();
    const units: Unit[] = [];
    for (const id of compIds) {
      if (unitOf.has(id)) continue;
      const partner = spouseOf.get(id);
      const members =
        partner && gen.get(partner) === gen.get(id) && !unitOf.has(partner)
          ? [id, partner]
          : [id];
      const unit: Unit = {
        members,
        generation: gen.get(id)!,
        x: 0,
        width: members.length * NODE_W + (members.length - 1) * COUPLE_GAP,
      };
      members.forEach((m) => unitOf.set(m, unit));
      units.push(unit);
    }

    const parentsOf = new Map<string, string[]>();
    compIds.forEach((id) => parentsOf.set(id, []));
    for (const r of compRels) {
      if (r.type === "PARENT_OF") parentsOf.get(r.toPersonId)!.push(r.fromPersonId);
    }

    const maxGen = Math.max(...compIds.map((id) => gen.get(id)!));
    const rows: Unit[][] = [];
    for (let g = 0; g <= maxGen; g++) {
      rows.push(units.filter((u) => u.generation === g));
    }

    // temporary member x lookup (center of each member within its unit)
    const memberX = (unit: Unit, memberId: string) => {
      const idx = unit.members.indexOf(memberId);
      const start = unit.x - unit.width / 2;
      return start + idx * (NODE_W + COUPLE_GAP) + NODE_W / 2;
    };

    const childrenOf = new Map<string, string[]>();
    compIds.forEach((id) => childrenOf.set(id, []));
    for (const r of compRels) {
      if (r.type === "PARENT_OF") childrenOf.get(r.fromPersonId)!.push(r.toPersonId);
    }

    // average x of the units linked to `u` in a neighbouring generation
    const baryOf = (
      u: Unit,
      links: Map<string, string[]>,
      accept: (gen: number) => boolean
    ) => {
      const xs: number[] = [];
      for (const m of u.members) {
        for (const other of links.get(m) ?? []) {
          const ou = unitOf.get(other);
          if (ou && ou !== u && accept(ou.generation)) xs.push(memberX(ou, other));
        }
      }
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };

    // order each row by where its parents sit, then pack left to right
    for (let g = 0; g < rows.length; g++) {
      const scored = rows[g].map((u, i) => ({
        u,
        i,
        s: baryOf(u, parentsOf, (pg) => pg < g),
      }));
      scored.sort(
        (a, b) => (a.s ?? a.i * 1e4) - (b.s ?? b.i * 1e4) || a.i - b.i
      );
      rows[g] = scored.map((x) => x.u);
      let cursor = 0;
      for (const u of rows[g]) {
        u.x = cursor + u.width / 2;
        cursor = u.x + u.width / 2 + X_GAP;
      }
    }

    // Pull each unit toward the people it's connected to, keeping row order
    // and minimum spacing, then slide the whole row so its centre lands where
    // the connections wanted it. Alternating up/down passes settles parents
    // over their children and children under their parents.
    const rightOf = (left: Unit, u: Unit) =>
      left.x + left.width / 2 + X_GAP + u.width / 2;
    const leftOf = (right: Unit, u: Unit) =>
      right.x - right.width / 2 - X_GAP - u.width / 2;
    const spaceOut = (row: Unit[]) => {
      for (let i = 1; i < row.length; i++) {
        const min = rightOf(row[i - 1], row[i]);
        if (row[i].x < min) row[i].x = min;
      }
    };

    const relax = (row: Unit[], desired: (u: Unit) => number | null) => {
      const want = row.map(desired);
      row.forEach((u, i) => {
        const w = want[i];
        if (w !== null) u.x = w;
      });
      spaceOut(row);
      // Units with nothing above or below them (e.g. a great-uncle attached
      // only by a sibling link) would otherwise be shoved right and never
      // pulled back, opening a gap that grows each pass. Tuck them against
      // whichever neighbour they have.
      for (let i = 0; i < row.length; i++) {
        if (want[i] !== null) continue;
        if (i > 0) row[i].x = rightOf(row[i - 1], row[i]);
        else if (row.length > 1) row[i].x = leftOf(row[i + 1], row[i]);
      }
      spaceOut(row);
      const anchored = row.map((_, i) => i).filter((i) => want[i] !== null);
      if (anchored.length) {
        const actual =
          anchored.reduce((s, i) => s + row[i].x, 0) / anchored.length;
        const target =
          anchored.reduce((s, i) => s + want[i]!, 0) / anchored.length;
        const shift = target - actual;
        row.forEach((u) => (u.x += shift));
      }
    };

    for (let iter = 0; iter < 5; iter++) {
      for (let g = rows.length - 2; g >= 0; g--) {
        relax(rows[g], (u) => baryOf(u, childrenOf, (cg) => cg > g));
      }
      for (let g = 1; g < rows.length; g++) {
        relax(rows[g], (u) => baryOf(u, parentsOf, (pg) => pg < g));
      }
    }

    // centre every row on the component's midline
    {
      const left = Math.min(...units.map((u) => u.x - u.width / 2));
      const right = Math.max(...units.map((u) => u.x + u.width / 2));
      const mid = (left + right) / 2;
      for (const row of rows) {
        if (!row.length) continue;
        const rl = Math.min(...row.map((u) => u.x - u.width / 2));
        const rr = Math.max(...row.map((u) => u.x + u.width / 2));
        // only nudge rows that are narrower than the whole tree, and only
        // when nothing anchors them (a row with parents stays aligned)
        const anchored = row.some(
          (u) =>
            baryOf(u, parentsOf, () => true) !== null ||
            baryOf(u, childrenOf, () => true) !== null
        );
        if (!anchored) {
          const shift = mid - (rl + rr) / 2;
          row.forEach((u) => (u.x += shift));
        }
      }
    }

    // --- emit positions, tracking component bounds ---
    let minX = Infinity;
    let maxX = -Infinity;
    for (const u of units) {
      const start = u.x - u.width / 2;
      u.members.forEach((m, idx) => {
        const x = start + idx * (NODE_W + COUPLE_GAP);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + NODE_W);
        result.set(m, {
          id: m,
          x,
          y: u.generation * (NODE_H + Y_GAP),
          generation: u.generation,
        });
      });
    }

    // shift component to xOffset
    const shift = xOffset - minX;
    for (const id of compIds) {
      const pos = result.get(id)!;
      pos.x += shift;
    }
    xOffset += maxX - minX + COMPONENT_GAP;
  }

  return result;
}
