import { describe, expect, it } from "vitest";
import { describeRelationship } from "./relationship";
import { computeKinship } from "./kinship";
import type { Person, RelationKind, Relationship, RelationType } from "./types";

/**
 * These cover the bug where a great-aunt read as "related by marriage".
 *
 * Three things went wrong together, which is why it looked like it depended
 * on how you added someone: the naming logic never read sibling edges, its
 * catch-all branch called every unnamed tie a marriage, and the "does this
 * carry a bloodline" check was asking a parent's question ("biological"?) of
 * a sibling's answer ("full"). The Add-member flow writes no kind at all and
 * slipped through; the Connect form writes "full" and did not.
 */

let seq = 0;
const person = (id: string, name: string, gender?: Person["gender"]): Person => ({
  id,
  familyId: "f1",
  name,
  gender,
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

/** what the panel prints under "Related to you" */
const termOf = (a: string, b: string, people: Person[], rels: Relationship[]) => {
  const r = describeRelationship(a, b, people, rels);
  return r.aTerm ?? r.label;
};

describe("a sibling link is a claim about parents", () => {
  // me → dad → grandma, and grandma's siblings hang off her by a sibling edge
  const people = [
    person("me", "Yosief", "male"),
    person("dad", "Dad", "male"),
    person("gma", "Grandma", "female"),
    person("gu", "Great Uncle", "male"),
    person("ga", "Great Aunt", "female"),
  ];
  const rels = [
    rel("dad", "me", "PARENT_OF", "biological"),
    rel("gma", "dad", "PARENT_OF", "biological"),
    rel("gma", "gu", "SIBLING_OF", "full"),
    rel("gma", "ga", "SIBLING_OF", "full"),
  ];

  it("names grandma's brother a great-uncle, not a relation by marriage", () => {
    expect(termOf("gu", "me", people, rels)).toBe("great-uncle");
  });

  it("names grandma's sister a great-aunt", () => {
    expect(termOf("ga", "me", people, rels)).toBe("great-aunt");
  });

  it("mirrors it from the other end", () => {
    expect(termOf("me", "gu", people, rels)).toBe("great-nephew");
  });

  it("keeps the nearer ties right too", () => {
    expect(termOf("gu", "dad", people, rels)).toBe("uncle");
    expect(termOf("gu", "gma", people, rels)).toBe("brother");
  });

  it("colours all of them as blood rather than married in", () => {
    const claimed = people.map((p) =>
      p.id === "me" ? { ...p, accountUserId: "u1" } : p
    );
    const { bloodIds } = computeKinship(claimed, rels, "u1");
    for (const id of ["me", "dad", "gma", "gu", "ga"]) {
      expect(bloodIds.has(id), `${id} should be blood`).toBe(true);
    }
  });

  it("works the same when the edge carries no kind at all", () => {
    // the Add-member flow writes the edge without one
    const bare = [
      rel("dad", "me", "PARENT_OF"),
      rel("gma", "dad", "PARENT_OF"),
      rel("gma", "gu", "SIBLING_OF"),
    ];
    expect(termOf("gu", "me", people, bare)).toBe("great-uncle");
  });

  it("never puts a stand-in forebear on screen", () => {
    const r = describeRelationship("gu", "me", people, rels);
    // the shared parent is inferred, so there is no node to offer
    expect(r.commonAncestorIds).toEqual([]);
    expect(r.via).not.toContain("Unknown");
  });
});

describe("ties that run through a sibling link", () => {
  it("reaches cousins", () => {
    const people = [
      person("me", "Me", "male"),
      person("mum", "Mum", "female"),
      person("aunt", "Aunt", "female"),
      person("cuz", "Cousin", "female"),
    ];
    const rels = [
      rel("mum", "me", "PARENT_OF", "biological"),
      rel("mum", "aunt", "SIBLING_OF", "full"),
      rel("aunt", "cuz", "PARENT_OF", "biological"),
    ];
    expect(termOf("aunt", "me", people, rels)).toBe("aunt");
    expect(termOf("cuz", "me", people, rels)).toBe("1st cousin");
  });

  it("treats siblings of the same person as siblings of each other", () => {
    const people = [person("a", "A", "male"), person("b", "B", "female"), person("c", "C", "male")];
    const rels = [
      rel("a", "b", "SIBLING_OF", "full"),
      rel("b", "c", "SIBLING_OF", "full"),
    ];
    expect(termOf("a", "c", people, rels)).toBe("brother");
  });

  it("lets a sibling inherit the parents the other one has recorded", () => {
    const people = [
      person("gma", "Grandma", "female"),
      person("gu", "Great Uncle", "male"),
      person("ggpa", "Great-Grandpa", "male"),
    ];
    const rels = [
      rel("ggpa", "gma", "PARENT_OF", "biological"),
      rel("gma", "gu", "SIBLING_OF", "full"),
    ];
    // the brother has no parents of his own recorded — he takes hers
    const r = describeRelationship("ggpa", "gu", people, rels);
    expect(r.aTerm).toBe("father");
    // a real, nameable forebear, so he is offered as a node to jump to
    expect(r.commonAncestorIds).toEqual(["ggpa"]);
  });
});

describe("the kinds that mean different things", () => {
  it("keeps half siblings half", () => {
    const people = [person("a", "A", "male"), person("b", "B", "female")];
    expect(termOf("a", "b", people, [rel("a", "b", "SIBLING_OF", "half")])).toBe(
      "half-brother"
    );
  });

  it("still works out half from one shared recorded parent", () => {
    const people = [
      person("a", "A", "male"),
      person("b", "B", "female"),
      person("dad", "Dad", "male"),
      person("m1", "Mum One", "female"),
      person("m2", "Mum Two", "female"),
    ];
    const rels = [
      rel("dad", "a", "PARENT_OF", "biological"),
      rel("dad", "b", "PARENT_OF", "biological"),
      rel("m1", "a", "PARENT_OF", "biological"),
      rel("m2", "b", "PARENT_OF", "biological"),
    ];
    expect(termOf("a", "b", people, rels)).toBe("half-brother");
  });

  it("does not give step siblings a bloodline", () => {
    const people = [person("a", "A", "male"), person("b", "B", "female")];
    const r = describeRelationship("a", "b", people, [
      rel("a", "b", "SIBLING_OF", "step"),
    ]);
    expect(r.kind).not.toBe("blood");
  });

  it("does not give a step-parent one either", () => {
    const people = [person("me", "Me", "male"), person("sd", "Step-dad", "male")];
    const r = describeRelationship("sd", "me", people, [
      rel("sd", "me", "PARENT_OF", "step"),
    ]);
    expect(r.kind).not.toBe("blood");
  });
});

describe("only an actual marriage is called one", () => {
  it("still names real in-laws", () => {
    const people = [
      person("me", "Me", "male"),
      person("sis", "Sister", "female"),
      person("bil", "Her husband", "male"),
      person("mum", "Mum", "female"),
    ];
    const rels = [
      rel("mum", "me", "PARENT_OF", "biological"),
      rel("mum", "sis", "PARENT_OF", "biological"),
      rel("sis", "bil", "SPOUSE_OF", "married"),
    ];
    expect(termOf("bil", "me", people, rels)).toBe("brother-in-law");
  });

  it("still names a parent-in-law", () => {
    const people = [
      person("me", "Me", "male"),
      person("w", "Wife", "female"),
      person("wm", "Her mother", "female"),
    ];
    const rels = [
      rel("me", "w", "SPOUSE_OF", "married"),
      rel("wm", "w", "PARENT_OF", "biological"),
    ];
    expect(termOf("wm", "me", people, rels)).toBe("mother-in-law");
  });

  it("says so when a marriage really is what connects them", () => {
    const people = [
      person("me", "Me", "male"),
      person("w", "Wife", "female"),
      person("wb", "Her brother", "male"),
      person("wbw", "His wife", "female"),
      person("x", "Her father", "male"),
    ];
    const rels = [
      rel("me", "w", "SPOUSE_OF", "married"),
      rel("wb", "w", "SIBLING_OF", "full"),
      rel("wb", "wbw", "SPOUSE_OF", "married"),
      rel("x", "wbw", "PARENT_OF", "biological"),
    ];
    expect(describeRelationship("x", "me", people, rels).label).toBe(
      "Related by marriage"
    );
  });

  it("does not, when no marriage is in the chain", () => {
    const people = [person("a", "A", "male"), person("b", "B", "female")];
    const r = describeRelationship("a", "b", people, [
      rel("a", "b", "SIBLING_OF", "step"),
    ]);
    expect(r.kind).toBe("distant");
    expect(r.label).toBe("Related through the family");
  });
});

describe("the plain cases are untouched", () => {
  const people = [person("me", "Me", "male"), person("dad", "Dad", "male")];
  const rels = [rel("dad", "me", "PARENT_OF", "biological")];

  it("names a parent and a child", () => {
    expect(termOf("dad", "me", people, rels)).toBe("father");
    expect(termOf("me", "dad", people, rels)).toBe("son");
  });

  it("says nothing is recorded when nothing is", () => {
    const strangers = [person("a", "A"), person("b", "B")];
    expect(describeRelationship("a", "b", strangers, []).kind).toBe("none");
  });

  it("keeps both sentences when the two terms differ", () => {
    const r = describeRelationship("dad", "me", people, rels);
    expect(r.aToB).toBe("Dad is a father of Me.");
    expect(r.bToA).toBe("Me is a son of Dad.");
  });
});

describe("a symmetric tie is only said once", () => {
  it("drops the inverse for cousins once removed", () => {
    const people = [
      person("anc", "Placeholder"),
      person("a", "A"),
      person("b", "B"),
      person("c", "C"),
      person("d", "D"),
      person("e", "E"),
      person("emilia", "Emilia", "female"),
      person("elileta", "Elileta", "female"),
    ];
    const rels = [
      rel("anc", "a", "PARENT_OF", "biological"),
      rel("anc", "b", "PARENT_OF", "biological"),
      rel("a", "c", "PARENT_OF", "biological"),
      rel("b", "d", "PARENT_OF", "biological"),
      rel("c", "emilia", "PARENT_OF", "biological"),
      rel("d", "e", "PARENT_OF", "biological"),
      rel("e", "elileta", "PARENT_OF", "biological"),
    ];
    const r = describeRelationship("emilia", "elileta", people, rels);
    expect(r.label).toBe("2nd cousins once removed");
    expect(r.aTerm).toBe(r.bTerm);
    expect(r.aToB).toBe("Emilia is a 2nd cousin once removed of Elileta.");
    expect(r.bToA).toBe("");
  });

  it("still names both directions for an uncle and a niece", () => {
    const people = [
      person("mum", "Mum", "female"),
      person("unc", "Uncle", "male"),
      person("me", "Me", "female"),
    ];
    const rels = [
      rel("mum", "unc", "SIBLING_OF", "full"),
      rel("mum", "me", "PARENT_OF", "biological"),
    ];
    const r = describeRelationship("unc", "me", people, rels);
    expect(r.aToB).toBe("Uncle is an uncle of Me.");
    expect(r.bToA).toBe("Me is a niece of Uncle.");
  });
});

/**
 * A tree grown from one side of the family often records the other parent
 * only as a spouse. For the claimed person, that spouse is still a parent:
 * their parents are grandparents, their siblings aunts and uncles. For
 * relatives on the first side, the other line is still by marriage.
 */
describe("both parents' families are blood of the child", () => {
  const people = [
    person("me", "Me", "male"),
    person("mum", "Mum", "female"),
    person("dad", "Dad", "male"),
    person("mgf", "Maternal grandpa", "male"),
    person("aunt", "Maternal aunt", "female"),
    person("pgf", "Paternal grandpa", "male"),
    person("unc", "Paternal uncle", "male"),
  ];
  const rels = [
    rel("mum", "me", "PARENT_OF", "biological"),
    rel("mum", "dad", "SPOUSE_OF", "married"),
    rel("mgf", "mum", "PARENT_OF", "biological"),
    rel("mgf", "aunt", "PARENT_OF", "biological"),
    rel("pgf", "dad", "PARENT_OF", "biological"),
    rel("pgf", "unc", "PARENT_OF", "biological"),
  ];

  it("names the spouse-only father a father, not a step-father", () => {
    expect(termOf("dad", "me", people, rels)).toBe("father");
    expect(describeRelationship("dad", "me", people, rels).kind).toBe("blood");
  });

  it("names his parents and siblings as grandparents and uncles", () => {
    expect(termOf("pgf", "me", people, rels)).toBe("grandfather");
    expect(termOf("unc", "me", people, rels)).toBe("uncle");
  });

  it("keeps the mother's side blood too", () => {
    expect(termOf("mum", "me", people, rels)).toBe("mother");
    expect(termOf("mgf", "me", people, rels)).toBe("grandfather");
    expect(termOf("aunt", "me", people, rels)).toBe("aunt");
  });

  it("colours both lines blood for the claimed child", () => {
    const claimed = people.map((p) =>
      p.id === "me" ? { ...p, accountUserId: "u1" } : p
    );
    const { bloodIds } = computeKinship(claimed, rels, "u1");
    for (const id of ["me", "mum", "dad", "mgf", "pgf", "aunt", "unc"]) {
      expect(bloodIds.has(id), `${id} should be blood of me`).toBe(true);
    }
  });

  it("still calls the father's family in-laws of the mother's sister", () => {
    const r = describeRelationship("unc", "aunt", people, rels);
    expect(r.kind).not.toBe("blood");
    expect(r.kind === "marriage" || r.label === "Related by marriage").toBe(true);
  });

  it("colours the father's line as married-in of a maternal relative", () => {
    const claimed = people.map((p) =>
      p.id === "aunt" ? { ...p, accountUserId: "u1" } : p
    );
    const { bloodIds } = computeKinship(claimed, rels, "u1");
    for (const id of ["aunt", "mum", "me", "mgf"]) {
      expect(bloodIds.has(id), `${id} should be blood of the aunt`).toBe(true);
    }
    for (const id of ["dad", "pgf", "unc"]) {
      expect(bloodIds.has(id), `${id} should be married into the aunt's line`).toBe(
        false
      );
    }
    expect(termOf("dad", "aunt", people, rels)).toMatch(/in-law|marriage/i);
  });

  it("works the same when the recorded parent is the father", () => {
    const people = [
      person("me", "Me", "female"),
      person("mum", "Mum", "female"),
      person("dad", "Dad", "male"),
      person("pgf", "Paternal grandpa", "male"),
    ];
    const rels = [
      rel("dad", "me", "PARENT_OF", "biological"),
      rel("mum", "dad", "SPOUSE_OF", "married"),
      rel("pgf", "dad", "PARENT_OF", "biological"),
    ];
    expect(termOf("mum", "me", people, rels)).toBe("mother");
    expect(termOf("pgf", "me", people, rels)).toBe("grandfather");
  });

  it("does not promote a recorded step-parent into a blood parent", () => {
    const ppl = [
      person("me", "Me", "male"),
      person("mum", "Mum", "female"),
      person("sd", "Step-dad", "male"),
    ];
    const rs = [
      rel("mum", "me", "PARENT_OF", "biological"),
      rel("mum", "sd", "SPOUSE_OF", "married"),
      rel("sd", "me", "PARENT_OF", "step"),
    ];
    expect(describeRelationship("sd", "me", ppl, rs).kind).not.toBe("blood");
    expect(termOf("sd", "me", ppl, rs)).toBe("step-father");
  });
});
