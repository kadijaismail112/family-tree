import { describe, expect, it } from "vitest";
import { buildGraph, buildWorld } from "./world";
import type { Person, RelationKind, Relationship, RelationType } from "../types";

let seq = 0;
const person = (id: string, name: string, birthYear?: string): Person => ({
  id,
  familyId: "f1",
  name,
  birthYear,
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

/**
 * Two families joined by one marriage — the shape the whole idea rests on.
 * Ana's side runs gran → mum → ana → kid → grandkid; Ben marries in and
 * brings a mother and a brother of his own.
 */
const people = [
  person("gran", "Gran", "1930"),
  person("gramps", "Gramps", "1928"),
  person("mum", "Mum", "1955"),
  person("dad", "Dad", "1953"),
  person("ana", "Ana", "1980"),
  person("aunt", "Aunt", "1958"),
  person("uncle", "Uncle", "1957"),
  person("ben", "Ben", "1979"),
  person("kid", "Kid", "2010"),
  person("grandkid", "Grandkid", "2038"),
  person("bensmum", "Ben's mum", "1950"),
  person("bensbro", "Ben's brother", "1976"),
  person("cousin", "Cousin", "1982"),
  person("outsider", "Nobody", "1990"),
];
const rels = [
  rel("gran", "mum", "PARENT_OF", "biological"),
  rel("gramps", "mum", "PARENT_OF", "biological"),
  rel("gran", "aunt", "PARENT_OF", "biological"),
  rel("gramps", "aunt", "PARENT_OF", "biological"),
  rel("gran", "gramps", "SPOUSE_OF", "married"),
  rel("mum", "ana", "PARENT_OF", "biological"),
  rel("dad", "ana", "PARENT_OF", "biological"),
  rel("mum", "dad", "SPOUSE_OF", "married"),
  rel("aunt", "uncle", "SPOUSE_OF", "married"),
  rel("ana", "ben", "SPOUSE_OF", "married"),
  rel("ana", "kid", "PARENT_OF", "biological"),
  rel("ben", "kid", "PARENT_OF", "biological"),
  rel("kid", "grandkid", "PARENT_OF", "biological"),
  rel("bensmum", "ben", "PARENT_OF", "biological"),
  rel("bensmum", "bensbro", "PARENT_OF", "biological"),
  rel("aunt", "cousin", "PARENT_OF", "biological"),
];

const graph = buildGraph(people, rels);
const at = (world: ReturnType<typeof buildWorld>, id: string) =>
  world.members.find((m) => m.personId === id);

describe("a world reaches grandparents to grandchildren", () => {
  const world = buildWorld("ana", people, rels, graph);

  it("holds every generation in scope", () => {
    expect(at(world, "gran")?.generation).toBe(-2);
    expect(at(world, "mum")?.generation).toBe(-1);
    expect(at(world, "ana")?.generation).toBe(0);
    expect(at(world, "kid")?.generation).toBe(1);
    expect(at(world, "grandkid")?.generation).toBe(2);
  });

  it("stops there — no great-grandchildren, nobody unconnected", () => {
    expect(world.ids.has("outsider")).toBe(false);
  });

  it("keeps the people who married in, at their partner's level", () => {
    expect(at(world, "ben")?.role).toBe("spouse");
    expect(at(world, "ben")?.generation).toBe(0);
    expect(at(world, "uncle")?.role).toBe("spouse");
    expect(at(world, "uncle")?.generation).toBe(-1);
  });

  it("counts both of the anchor's own parents as blood, not as married in", () => {
    // Dad married into the bloodline, but he is still Ana's father
    expect(at(world, "dad")?.role).toBe("blood");
  });

  it("brings in the aunts and uncles, so the grandparents aren't childless", () => {
    expect(at(world, "aunt")?.generation).toBe(-1);
  });

  it("does not drag in the spouse's own family", () => {
    expect(world.ids.has("bensmum")).toBe(false);
    expect(world.ids.has("bensbro")).toBe(false);
  });
});

describe("spouses are the doors between worlds", () => {
  const world = buildWorld("ana", people, rels, graph);

  it("marks a spouse with a family of their own as a portal", () => {
    expect(at(world, "ben")?.portal).toBe(true);
    // his mother and his brother are through that door
    expect(at(world, "ben")?.beyond).toBeGreaterThanOrEqual(2);
  });

  it("does not mark one whose family is already on screen", () => {
    // gramps married gran, and everyone his world would add is here already
    const gpWorld = buildWorld("gran", people, rels, graph);
    expect(at(gpWorld, "gramps")?.portal).toBe(false);
  });

  it("leads to a world rooted on the person you stepped through", () => {
    const bens = buildWorld("ben", people, rels, graph);
    expect(bens.ids.has("bensmum")).toBe(true);
    expect(bens.ids.has("bensbro")).toBe(true);
    // and Ana is now the one who married in
    expect(at(bens, "ana")?.role).toBe("spouse");
    expect(at(bens, "ana")?.portal).toBe(true);
  });

  it("keeps the shared child in both worlds", () => {
    const bens = buildWorld("ben", people, rels, graph);
    expect(bens.ids.has("kid")).toBe(true);
    expect(buildWorld("ana", people, rels, graph).ids.has("kid")).toBe(true);
  });
});

describe("rows come out in a readable order", () => {
  const world = buildWorld("ana", people, rels, graph);

  it("leads the anchor's row with the anchor", () => {
    const row = world.rows.find((r) => r.generation === 0)!;
    expect(row.members[0].personId).toBe("ana");
  });

  it("seats a spouse straight after the person they married", () => {
    const row = world.rows.find((r) => r.generation === -1)!;
    const ids = row.members.map((m) => m.personId);
    expect(ids.indexOf("uncle")).toBe(ids.indexOf("aunt") + 1);
  });

  it("never splits a couple, even when someone is born between them", () => {
    // Dad (1953) and Mum (1955) are both blood here, with Uncle born 1957
    const row = world.rows.find((r) => r.generation === -1)!;
    const ids = row.members.map((m) => m.personId);
    expect(Math.abs(ids.indexOf("dad") - ids.indexOf("mum"))).toBe(1);
  });

  it("sorts brothers and sisters by birth year", () => {
    const row = world.rows.find((r) => r.generation === -1)!;
    const ids = row.members.map((m) => m.personId);
    expect(ids.indexOf("mum")).toBeLessThan(ids.indexOf("aunt"));
  });

  it("stops short of cousins, where a world becomes the whole tree", () => {
    expect(world.ids.has("cousin")).toBe(false);
  });
});

describe("blood standing beats married-in standing", () => {
  it("keeps a relative who also married a relative as a relative", () => {
    const ppl = [person("a", "A"), person("b", "B"), person("m", "M")];
    const rs = [
      rel("m", "a", "PARENT_OF", "biological"),
      rel("m", "b", "PARENT_OF", "biological"),
      rel("a", "b", "SPOUSE_OF", "married"),
    ];
    const w = buildWorld("a", ppl, rs);
    expect(w.members.find((x) => x.personId === "b")?.role).toBe("blood");
  });
});
