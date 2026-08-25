import { describe, expect, it } from "vitest";
import { buildGalaxy, focusBand, ROW_H } from "./galaxy";
import type { Person, RelationKind, Relationship, RelationType } from "../types";

let seq = 0;
const person = (id: string, name: string): Person => ({
  id,
  familyId: "f1",
  name,
  addedById: "u1",
  createdAt: "x",
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
  createdAt: "x",
});

/** two bloodlines, joined by one marriage in the middle generation */
const people = [
  person("gran", "Gran"),
  person("mum", "Mum"),
  person("aunt", "Aunt"),
  person("me", "Me"),
  person("kid", "Kid"),
  person("grandkid", "Grandkid"),
  // the family married into
  person("inlaw_gran", "In-law Gran"),
  person("spouse", "Spouse"),
  person("spouse_bro", "Spouse's brother"),
  person("loner", "Unconnected"),
];
const rels = [
  rel("gran", "mum", "PARENT_OF", "biological"),
  rel("gran", "aunt", "PARENT_OF", "biological"),
  rel("mum", "me", "PARENT_OF", "biological"),
  rel("me", "kid", "PARENT_OF", "biological"),
  rel("kid", "grandkid", "PARENT_OF", "biological"),
  rel("me", "spouse", "SPOUSE_OF", "married"),
  rel("spouse", "kid", "PARENT_OF", "biological"),
  rel("inlaw_gran", "spouse", "PARENT_OF", "biological"),
  rel("inlaw_gran", "spouse_bro", "PARENT_OF", "biological"),
];

const galaxy = buildGalaxy(people, rels);
const node = (id: string) => galaxy.nodes.get(id)!;

describe("everybody gets a place, once", () => {
  it("places every person exactly once", () => {
    expect(galaxy.nodes.size).toBe(people.length);
  });

  it("finds somewhere for someone with no connections at all", () => {
    expect(node("loner")).toBeTruthy();
  });
});

describe("height is generation", () => {
  it("puts each generation one row below the last", () => {
    expect(node("mum").generation).toBe(node("gran").generation + 1);
    expect(node("me").generation).toBe(node("mum").generation + 1);
    expect(node("grandkid").generation).toBe(node("kid").generation + 1);
  });

  it("keeps brothers and sisters level", () => {
    expect(node("aunt").generation).toBe(node("mum").generation);
  });

  it("keeps a married couple level, across two bloodlines", () => {
    expect(node("spouse").generation).toBe(node("me").generation);
  });

  it("sits an in-law's parents directly above them, not at the top of the tree", () => {
    // Marriage drags the spouse down to their partner's level. Their own
    // parents have nothing below them pushing, so they used to stay stranded
    // at the root with three empty rows in between.
    expect(node("inlaw_gran").generation).toBe(node("spouse").generation - 1);
  });

  it("keeps the in-law's other children level with them", () => {
    expect(node("spouse_bro").generation).toBe(node("spouse").generation);
  });

  it("turns generation into a y coordinate", () => {
    expect(node("me").y).toBe(node("me").generation * ROW_H);
  });
});

describe("bloodlines are islands, marriages are bridges", () => {
  it("keeps a bloodline together on one island", () => {
    expect(node("mum").islandId).toBe(node("gran").islandId);
    expect(node("grandkid").islandId).toBe(node("gran").islandId);
  });

  it("marks the marriage link as a bridge between two families", () => {
    const marriage = galaxy.links.find((l) => l.kind === "spouse")!;
    expect(marriage.bridge).toBe(true);
  });

  it("does not call an ordinary parent link a bridge", () => {
    const within = galaxy.links.find(
      (l) => l.kind === "parent" && l.a === "gran" && l.b === "mum"
    )!;
    expect(within.bridge).toBe(false);
  });

  it("separates the two bloodlines in space", () => {
    const a = node("gran");
    const b = node("inlaw_gran");
    const apart = Math.hypot(a.x - b.x, a.z - b.z);
    expect(apart).toBeGreaterThan(0);
  });

  it("draws each pair of people only once, however it was recorded", () => {
    const ids = galaxy.links.map((l) => `${l.kind}:${[l.a, l.b].sort().join(">")}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the band you are reading", () => {
  const myGen = node("me").generation;

  it("holds grandparents down to grandchildren", () => {
    const band = focusBand("me", myGen, galaxy);
    expect(band.has("gran")).toBe(true);
    expect(band.has("mum")).toBe(true);
    expect(band.has("me")).toBe(true);
    expect(band.has("kid")).toBe(true);
    expect(band.has("grandkid")).toBe(true);
  });

  it("leaves out people you are not related to", () => {
    expect(focusBand("me", myGen, galaxy).has("loner")).toBe(false);
  });

  it("moves up a generation when the cursor does", () => {
    const up = focusBand("me", myGen - 1, galaxy);
    // your own grandchildren fall out of the top of the window
    expect(up.has("grandkid")).toBe(false);
    expect(up.has("gran")).toBe(true);
  });

  it("moves down a generation too", () => {
    const down = focusBand("me", myGen + 1, galaxy);
    expect(down.has("gran")).toBe(false);
    expect(down.has("grandkid")).toBe(true);
  });

  it("reaches across a marriage into the family that married in", () => {
    const band = focusBand("me", myGen, galaxy);
    expect(band.has("spouse")).toBe(true);
    expect(band.has("spouse_bro")).toBe(true);
  });
});
