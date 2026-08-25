import { describe, expect, it } from "vitest";
import {
  buildHouseholds,
  doorsAcross,
  doorsDown,
  doorsUp,
  homeHouseholdFor,
  householdId,
  lineageRootFor,
  marriedInHeadId,
  natalHouseholdFor,
} from "./household";
import type { Person, RelationKind, Relationship, RelationType } from "../types";

let seq = 0;
const person = (id: string, name: string, birthYear?: string): Person => ({
  id,
  familyId: "f1",
  name,
  birthYear,
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

/**
 * The shape that has to hold up: a couple with eight children, one of whom
 * marries somebody who arrives with eight siblings of their own, and has
 * children in turn. Four generations, three bloodlines, thirty-odd people.
 */
const people: Person[] = [
  person("gpa", "Grandpa", "1930"),
  person("gma", "Grandma", "1932"),
  person("dad", "Dad", "1955"),
  person("mum", "Mum", "1957"),
];
const rels: Relationship[] = [
  rel("gpa", "gma", "SPOUSE_OF", "married"),
  rel("gpa", "dad", "PARENT_OF", "biological"),
  rel("gma", "dad", "PARENT_OF", "biological"),
  rel("dad", "mum", "SPOUSE_OF", "married"),
];
// dad's seven siblings
for (let i = 0; i < 7; i++) {
  people.push(person(`unc${i}`, `Uncle ${i}`, `${1958 + i}`));
  rels.push(rel("gpa", `unc${i}`, "PARENT_OF", "biological"));
  rels.push(rel("gma", `unc${i}`, "PARENT_OF", "biological"));
}
// dad and mum's eight children, me among them
people.push(person("me", "Me", "1988"));
rels.push(rel("dad", "me", "PARENT_OF", "biological"));
rels.push(rel("mum", "me", "PARENT_OF", "biological"));
for (let i = 0; i < 7; i++) {
  people.push(person(`sib${i}`, `Sibling ${i}`, `${1990 + i}`));
  rels.push(rel("dad", `sib${i}`, "PARENT_OF", "biological"));
  rels.push(rel("mum", `sib${i}`, "PARENT_OF", "biological"));
}
// I marry someone who arrives with eight siblings and two parents
people.push(person("wife", "Wife", "1989"));
people.push(person("wpa", "Her father", "1960"));
people.push(person("wma", "Her mother", "1962"));
rels.push(rel("me", "wife", "SPOUSE_OF", "married"));
rels.push(rel("wpa", "wma", "SPOUSE_OF", "married"));
rels.push(rel("wpa", "wife", "PARENT_OF", "biological"));
rels.push(rel("wma", "wife", "PARENT_OF", "biological"));
for (let i = 0; i < 8; i++) {
  people.push(person(`wsib${i}`, `Her sibling ${i}`, `${1991 + i}`));
  rels.push(rel("wpa", `wsib${i}`, "PARENT_OF", "biological"));
  rels.push(rel("wma", `wsib${i}`, "PARENT_OF", "biological"));
}
// and we have two of our own
for (const [id, name, year] of [["kid1", "Kid one", "2015"], ["kid2", "Kid two", "2018"]]) {
  people.push(person(id, name, year));
  rels.push(rel("me", id, "PARENT_OF", "biological"));
  rels.push(rel("wife", id, "PARENT_OF", "biological"));
}

const houses = buildHouseholds(people, rels);
const H = (...heads: string[]) => houses.byId.get(householdId(heads))!;

describe("a household is one couple and their children", () => {
  it("gathers eight children under the couple who had them", () => {
    const home = H("dad", "mum");
    expect(home.headIds.sort()).toEqual(["dad", "mum"]);
    expect(home.childIds).toHaveLength(8);
  });

  it("never grows past the couple and their children, however big the tree", () => {
    for (const house of Array.from(houses.byId.values())) {
      expect(house.headIds.length).toBeLessThanOrEqual(2);
    }
  });

  it("puts the children in the order they were born", () => {
    const kids = H("dad", "mum").childIds;
    expect(kids[0]).toBe("me"); // 1988, ahead of the siblings born from 1990
  });

  it("keeps the in-laws in their own house, not in this one", () => {
    const home = H("dad", "mum");
    expect(home.childIds).not.toContain("wife");
    expect(home.headIds).not.toContain("wife");
  });

  it("counts a marriage with no children as a household of its own", () => {
    expect(H("gpa", "gma")).toBeTruthy();
  });
});

describe("where somebody's own page opens", () => {
  it("opens on the house they keep", () => {
    expect(homeHouseholdFor("me", houses)).toBe(householdId(["me", "wife"]));
  });

  it("opens a child on the house they grew up in", () => {
    expect(homeHouseholdFor("kid1", houses)).toBe(householdId(["me", "wife"]));
    expect(homeHouseholdFor("sib0", houses)).toBe(householdId(["dad", "mum"]));
  });

  it("prefers the union that actually has children", () => {
    // a second, childless marriage should not become somebody's home
    const withSecond = [...people, person("late", "Late partner", "1965")];
    const relsToo = [...rels, rel("dad", "late", "SPOUSE_OF", "married")];
    const two = buildHouseholds(withSecond, relsToo);
    expect(homeHouseholdFor("dad", two)).toBe(householdId(["dad", "mum"]));
  });
});

describe("the natal house is not the one they keep", () => {
  it("opens a spouse on the house they grew up in, with their siblings", () => {
    expect(natalHouseholdFor("wife", houses)).toBe(householdId(["wpa", "wma"]));
    expect(houses.byId.get(natalHouseholdFor("wife", houses)!)!.childIds).toHaveLength(9);
  });

  it("opens me on my parents' house, not the one I keep with my wife", () => {
    expect(natalHouseholdFor("me", houses)).toBe(householdId(["dad", "mum"]));
    expect(homeHouseholdFor("me", houses)).toBe(householdId(["me", "wife"]));
  });

  it("has no natal house for someone whose parents were never recorded", () => {
    expect(natalHouseholdFor("gpa", houses)).toBeNull();
  });
});

describe("who married into the household you are looking at", () => {
  it("marks the other head as married-in when you are a head", () => {
    const mine = H("me", "wife");
    expect(lineageRootFor(mine, undefined, "me")).toBe("me");
    expect(marriedInHeadId(mine, "me")).toBe("wife");
  });

  it("follows the person you walked through, even if that inverts who married in", () => {
    const mine = H("me", "wife");
    expect(lineageRootFor(mine, "wife", "me")).toBe("wife");
    expect(marriedInHeadId(mine, "wife")).toBe("me");
  });

  it("marks neither parent as married-in when you are a child of the house", () => {
    const home = H("dad", "mum");
    expect(lineageRootFor(home, undefined, "me")).toBe("me");
    expect(marriedInHeadId(home, "me")).toBeNull();
  });

  it("marks neither head when there is no lineage root in the house", () => {
    const hers = H("wpa", "wma");
    expect(lineageRootFor(hers, undefined, "me")).toBeNull();
    expect(marriedInHeadId(hers, null)).toBeNull();
  });
});

describe("the doors out of a household", () => {
  const home = H("dad", "mum");

  it("leads up through each parent to the house they grew up in", () => {
    const up = doorsUp(home, houses);
    expect(up).toHaveLength(1); // only Dad's parents are recorded
    expect(up[0].throughId).toBe("dad");
    expect(up[0].householdId).toBe(householdId(["gpa", "gma"]));
  });

  it("shows the aunts and uncles as the children of the house above", () => {
    const up = doorsUp(home, houses)[0];
    // seven uncles plus Dad himself
    expect(houses.byId.get(up.householdId)!.childIds).toHaveLength(8);
  });

  it("leads down through a child to the house that child keeps", () => {
    const down = doorsDown(home, houses);
    expect(down).toHaveLength(1);
    expect(down[0].throughId).toBe("me");
    expect(down[0].householdId).toBe(householdId(["me", "wife"]));
  });

  it("reaches the family somebody married into, and their eight siblings", () => {
    const mine = H("me", "wife");
    const up = doorsUp(mine, houses);
    const hers = up.find((d) => d.throughId === "wife")!;
    expect(hers).toBeTruthy();
    expect(houses.byId.get(hers.householdId)!.childIds).toHaveLength(9);
  });

  it("offers a second marriage sideways rather than up or down", () => {
    const withSecond = [...people, person("late", "Late partner", "1965")];
    const relsToo = [...rels, rel("dad", "late", "SPOUSE_OF", "married")];
    const two = buildHouseholds(withSecond, relsToo);
    const home2 = two.byId.get(householdId(["dad", "mum"]))!;
    const across = doorsAcross(home2, two);
    expect(across.map((d) => d.householdId)).toContain(householdId(["dad", "late"]));
    expect(doorsUp(home2, two).map((d) => d.householdId)).not.toContain(
      householdId(["dad", "late"])
    );
  });
});

describe("half-siblings are not invented into one family", () => {
  it("keeps two mothers' children in two households", () => {
    const ppl = [
      person("f", "Father"),
      person("m1", "First wife"),
      person("m2", "Second wife"),
      person("a", "Child A"),
      person("b", "Child B"),
    ];
    const rs = [
      rel("f", "a", "PARENT_OF", "biological"),
      rel("m1", "a", "PARENT_OF", "biological"),
      rel("f", "b", "PARENT_OF", "biological"),
      rel("m2", "b", "PARENT_OF", "biological"),
    ];
    const h = buildHouseholds(ppl, rs);
    expect(h.byId.get(householdId(["f", "m1"]))!.childIds).toEqual(["a"]);
    expect(h.byId.get(householdId(["f", "m2"]))!.childIds).toEqual(["b"]);
  });
});

describe("it stays bounded on a tree that is far too big to draw", () => {
  it("never shows more than a couple and their children", () => {
    // 4 generations, 8 children each: over four thousand people
    const many: Person[] = [];
    const links: Relationship[] = [];
    let n = 0;
    const spawn = (parentA: string, parentB: string, depth: number) => {
      if (depth === 0) return;
      for (let i = 0; i < 8; i++) {
        const kid = `p${n++}`;
        many.push(person(kid, `Person ${kid}`, `${1900 + depth * 25 + i}`));
        links.push(rel(parentA, kid, "PARENT_OF", "biological"));
        links.push(rel(parentB, kid, "PARENT_OF", "biological"));
        if (depth > 1) {
          const inLaw = `s${n++}`;
          many.push(person(inLaw, `Spouse ${inLaw}`));
          links.push(rel(kid, inLaw, "SPOUSE_OF", "married"));
          spawn(kid, inLaw, depth - 1);
        }
      }
    };
    many.push(person("rootA", "Root A"), person("rootB", "Root B"));
    links.push(rel("rootA", "rootB", "SPOUSE_OF", "married"));
    spawn("rootA", "rootB", 4);

    expect(many.length).toBeGreaterThan(4000);
    const big = buildHouseholds(many, links);
    let largest = 0;
    for (const house of Array.from(big.byId.values())) {
      largest = Math.max(largest, house.headIds.length + house.childIds.length);
    }
    expect(largest).toBeLessThanOrEqual(10);
  });
});
