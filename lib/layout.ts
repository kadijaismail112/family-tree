import type { Person, Relationship } from "./types";

export const NODE_W = 190;
export const NODE_H = 82;
export const X_GAP = 60; // between siblings — units sharing a parent
/**
 * Between two units in the same row that do not share a parent.
 *
 * One gap for everybody meant a cousin sat exactly as close to you as your
 * own brother, and by the third generation down a row is mostly cousins:
 * twenty cards in an even line with nothing saying where one family stops
 * and the next begins. Spacing the gap by relationship puts the whitespace
 * where the meaning already is.
 */
export const FAMILY_GAP = 168;
export const COUPLE_GAP = 24; // between spouses (or co-parents) in a unit
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
 *  3. Group spouses into "couple units". Unmarried co-parents of the same
 *     child become a matching unit so they sit together without a marriage
 *     bar; a co-parent of someone already in a couple is pinned beside that
 *     couple. Order units in each row by the average x of their parents
 *     (barycenter), then lay rows out with collision-free spacing, centered
 *     per row.
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
    const makeUnit = (members: string[]): Unit => ({
      members,
      generation: gen.get(members[0])!,
      x: 0,
      width: members.length * NODE_W + (members.length - 1) * COUPLE_GAP,
    });
    const addUnit = (u: Unit) => {
      units.push(u);
      u.members.forEach((m) => unitOf.set(m, u));
    };
    const dropUnit = (u: Unit) => {
      const i = units.indexOf(u);
      if (i >= 0) units.splice(i, 1);
    };

    for (const id of compIds) {
      if (unitOf.has(id)) continue;
      const partner = spouseOf.get(id);
      const members =
        partner && gen.get(partner) === gen.get(id) && !unitOf.has(partner)
          ? [id, partner]
          : [id];
      addUnit(makeUnit(members));
    }

    // Unmarried co-parents of the same child would otherwise be separate
    // units, ordered by their own ancestors, and end up on opposite sides of
    // the row. Pair them the same way spouses are paired — the canvas still
    // draws two parent lines, not a marriage bar, because there is no
    // SPOUSE_OF edge.
    const coparents = new Map<string, string[]>();
    compIds.forEach((id) => coparents.set(id, []));
    const giveCoparent = (a: string, b: string) => {
      if (a === b) return;
      if (gen.get(a) !== gen.get(b)) return;
      const list = coparents.get(a);
      if (list && !list.includes(b)) list.push(b);
    };
    {
      const parentsByChild = new Map<string, string[]>();
      for (const r of compRels) {
        if (r.type !== "PARENT_OF") continue;
        const list = parentsByChild.get(r.toPersonId);
        if (list) list.push(r.fromPersonId);
        else parentsByChild.set(r.toPersonId, [r.fromPersonId]);
      }
      for (const pars of Array.from(parentsByChild.values())) {
        for (let i = 0; i < pars.length; i++) {
          for (let j = i + 1; j < pars.length; j++) {
            giveCoparent(pars[i], pars[j]);
            giveCoparent(pars[j], pars[i]);
          }
        }
      }
    }
    for (const id of compIds) {
      const u = unitOf.get(id);
      if (!u || u.members.length > 1) continue;
      const other = (coparents.get(id) ?? []).find((oid) => {
        const ou = unitOf.get(oid);
        return ou && ou !== u && ou.members.length === 1 && gen.get(oid) === gen.get(id);
      });
      if (!other) continue;
      const otherUnit = unitOf.get(other)!;
      dropUnit(u);
      dropUnit(otherUnit);
      addUnit(makeUnit([id, other]));
    }

    // A co-parent of someone already in a couple (remarried) stays their own
    // unit, pinned to that couple's side so they are not shoved across the row.
    const satelliteOf = new Map<Unit, { hub: Unit; side: "left" | "right" }>();
    for (const id of compIds) {
      const u = unitOf.get(id);
      if (!u || u.members.length > 1 || satelliteOf.has(u)) continue;
      const hubMember = (coparents.get(id) ?? []).find((oid) => {
        const ou = unitOf.get(oid);
        return ou && ou.members.length > 1 && ou.generation === u.generation;
      });
      if (!hubMember) continue;
      const hub = unitOf.get(hubMember)!;
      const idx = hub.members.indexOf(hubMember);
      satelliteOf.set(u, { hub, side: idx <= 0 ? "left" : "right" });
    }

    const parentsOf = new Map<string, string[]>();
    compIds.forEach((id) => parentsOf.set(id, []));
    for (const r of compRels) {
      if (r.type === "PARENT_OF") parentsOf.get(r.toPersonId)!.push(r.fromPersonId);
    }

    /**
     * How much air to leave between two neighbours in a row: the ordinary
     * gap for siblings, a wider one for people from different families.
     * Units hold one person or a couple, so a unit's "family" is every
     * parent its members have between them.
     */
    const familyOf = new Map<Unit, string[]>();
    const parentsOfUnit = (u: Unit) => {
      let ps = familyOf.get(u);
      if (!ps) {
        ps = u.members.flatMap((m) => parentsOf.get(m) ?? []);
        familyOf.set(u, ps);
      }
      return ps;
    };
    const gapBetween = (a: Unit, b: Unit) => {
      // A co-parent pinned to a couple is deliberately held at that couple's
      // side; widening this would undo the pinning it exists to do.
      if (satelliteOf.get(a)?.hub === b || satelliteOf.get(b)?.hub === a) {
        return X_GAP;
      }
      const pa = parentsOfUnit(a);
      if (!pa.length) return FAMILY_GAP;
      const pb = parentsOfUnit(b);
      if (!pb.length) return FAMILY_GAP;
      return pa.some((p) => pb.includes(p)) ? X_GAP : FAMILY_GAP;
    };

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

    // order each row by where its parents sit, then pack left to right.
    // Co-parent units and a couple-plus-satellite block score as one target
    // so other people on the row cannot sit between the child's parents.
    for (let g = 0; g < rows.length; g++) {
      const row = rows[g];
      const hubs = row.filter((u) => !satelliteOf.has(u));
      const scored = hubs.map((hub, i) => {
        const left = row.filter(
          (u) => satelliteOf.get(u)?.hub === hub && satelliteOf.get(u)!.side === "left"
        );
        const right = row.filter(
          (u) => satelliteOf.get(u)?.hub === hub && satelliteOf.get(u)!.side === "right"
        );
        const block = [...left, hub, ...right];
        const xs: number[] = [];
        for (const u of block) {
          const s = baryOf(u, parentsOf, (pg) => pg < g);
          if (s !== null) xs.push(s);
        }
        return {
          block,
          i,
          s: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null,
        };
      });
      scored.sort(
        (a, b) => (a.s ?? a.i * 1e4) - (b.s ?? b.i * 1e4) || a.i - b.i
      );
      rows[g] = scored.flatMap((x) => x.block);
      let cursor = 0;
      rows[g].forEach((u, i) => {
        u.x = cursor + u.width / 2;
        cursor = u.x + u.width / 2 + (i + 1 < rows[g].length ? gapBetween(u, rows[g][i + 1]) : 0);
      });
    }

    // Pull each unit toward the people it's connected to, keeping row order
    // and minimum spacing, then slide the whole row so its centre lands where
    // the connections wanted it. Alternating up/down passes settles parents
    // over their children and children under their parents.
    const rightOf = (left: Unit, u: Unit) =>
      left.x + left.width / 2 + gapBetween(left, u) + u.width / 2;
    const leftOf = (right: Unit, u: Unit) =>
      right.x - right.width / 2 - gapBetween(right, u) - u.width / 2;
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
