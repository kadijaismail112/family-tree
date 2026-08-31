import { describe, expect, it } from "vitest";
import { COUPLE_GAP, FAMILY_GAP, layoutTree, NODE_W, X_GAP } from "./layout";
import type { Person, RelationKind, Relationship, RelationType } from "./types";

let seq = 0;
const person = (id: string, name: string): Person => ({
  id,
  familyId: "f1",
  name,
  addedById: "u1",
  createdAt: "2026-01-01",
});
const rel = (
  fromPersonId: string,
  toPersonId: string,
  type: RelationType,
  kind?: RelationKind
): Relationship => ({
  id: `r${++seq}`,
  familyId: "f1",
  fromPersonId,
  toPersonId,
  type,
  kind,
  addedById: "u1",
  createdAt: "2026-01-01",
});

const gapBetween = (a: number, b: number) => Math.abs(a - b);

describe("unmarried co-parents sit together", () => {
  it("places two parents of a child within couple spacing even without SPOUSE_OF", () => {
    // A sibling on the same row used to land between them because each parent
    // was a separate unit ordered by insertion, not by the shared child.
    const people = [
      person("uncle", "Uncle"),
      person("dad", "Dad"),
      person("mom", "Mom"),
      person("kid", "Kid"),
    ];
    const rels = [
      rel("dad", "kid", "PARENT_OF"),
      rel("mom", "kid", "PARENT_OF"),
      rel("uncle", "dad", "SIBLING_OF"),
    ];
    const pos = layoutTree(people, rels);
    const dad = pos.get("dad")!;
    const mom = pos.get("mom")!;
    const uncle = pos.get("uncle")!;
    expect(gapBetween(dad.x, mom.x)).toBe(NODE_W + COUPLE_GAP);
    const left = Math.min(dad.x, mom.x);
    const right = Math.max(dad.x, mom.x);
    expect(uncle.x < left || uncle.x > right).toBe(true);
    expect(pos.get("kid")!.generation).toBeGreaterThan(dad.generation);
  });

  it("still packs a recorded couple at couple spacing", () => {
    const people = [
      person("dad", "Dad"),
      person("mom", "Mom"),
      person("kid", "Kid"),
    ];
    const rels = [
      rel("dad", "mom", "SPOUSE_OF", "married"),
      rel("dad", "kid", "PARENT_OF"),
      rel("mom", "kid", "PARENT_OF"),
    ];
    const pos = layoutTree(people, rels);
    expect(gapBetween(pos.get("dad")!.x, pos.get("mom")!.x)).toBe(NODE_W + COUPLE_GAP);
  });

  it("pins an unmarried co-parent beside a remarried parent, not across the row", () => {
    const people = [
      person("uncle", "Uncle"),
      person("other", "Other parent"),
      person("husband", "Husband"),
      person("mom", "Mom"),
      person("kid", "Kid"),
    ];
    const rels = [
      rel("husband", "mom", "SPOUSE_OF", "married"),
      rel("mom", "kid", "PARENT_OF"),
      rel("other", "kid", "PARENT_OF"),
      rel("uncle", "husband", "SIBLING_OF"),
    ];
    const pos = layoutTree(people, rels);
    const mom = pos.get("mom")!;
    const other = pos.get("other")!;
    const uncle = pos.get("uncle")!;
    const husband = pos.get("husband")!;
    const parentGap = gapBetween(mom.x, other.x);
    expect(parentGap).toBeLessThanOrEqual(NODE_W + X_GAP);
    const left = Math.min(mom.x, other.x);
    const right = Math.max(mom.x, other.x);
    expect(uncle.x > left && uncle.x < right).toBe(false);
    expect(husband.x > left && husband.x < right).toBe(false);
  });
});

describe("families get more air between them than siblings do", () => {
  /**
   * Two sets of cousins on one row. Before, every neighbour was X_GAP apart,
   * so a cousin sat exactly as close as a brother and a wide row read as one
   * undifferentiated line of children.
   */
  const people = [
    person("gpa", "Grandpa"),
    person("a", "Parent A"),
    person("b", "Parent B"),
    person("a1", "A one"),
    person("a2", "A two"),
    person("b1", "B one"),
    person("b2", "B two"),
  ];
  const rels = [
    rel("gpa", "a", "PARENT_OF", "biological"),
    rel("gpa", "b", "PARENT_OF", "biological"),
    rel("a", "a1", "PARENT_OF", "biological"),
    rel("a", "a2", "PARENT_OF", "biological"),
    rel("b", "b1", "PARENT_OF", "biological"),
    rel("b", "b2", "PARENT_OF", "biological"),
  ];
  const at = layoutTree(people, rels);
  const x = (id: string) => at.get(id)!.x;

  it("keeps siblings at the ordinary gap", () => {
    expect(gapBetween(x("a1"), x("a2"))).toBeCloseTo(NODE_W + X_GAP, 0);
    expect(gapBetween(x("b1"), x("b2"))).toBeCloseTo(NODE_W + X_GAP, 0);
  });

  it("opens a wider gap where one family ends and the next begins", () => {
    const inner = Math.min(
      gapBetween(x("a2"), x("b1")),
      gapBetween(x("a1"), x("b1")),
      gapBetween(x("a2"), x("b2"))
    );
    expect(inner).toBeGreaterThan(NODE_W + X_GAP);
    // and by the full family gap, not merely a little more
    expect(inner).toBeGreaterThanOrEqual(NODE_W + FAMILY_GAP - 1);
  });

  it("leaves the cousins' rows in the same order", () => {
    expect(x("a1")).toBeLessThan(x("b1"));
    expect(x("a2")).toBeLessThan(x("b1"));
  });
});
