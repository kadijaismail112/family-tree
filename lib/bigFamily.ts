import type { DetailKey, Person, Relationship } from "./types";

/**
 * A seven-generation family (~60 people) used to stress-test the layout,
 * the suggestion engine and cluster mode at a size real families reach.
 * Names follow the patronymic convention: a child's surname is their
 * father's given name.
 */

interface Spec {
  id: string;
  name: string;
  b?: string;
  d?: string;
  details?: Partial<Record<DetailKey, string>>;
}

const PEOPLE: Spec[] = [
  // ── Generation 1 ──────────────────────────────────────────────────
  { id: "a1", name: "Ghebre Selassie", b: "1835", d: "1901", details: { birthCity: "Adi Keyh" } },
  { id: "a2", name: "Aster Woldu", b: "1840", d: "1912", details: { birthCity: "Adi Keyh" } },

  // ── Generation 2 ──────────────────────────────────────────────────
  { id: "b1", name: "Tewolde Ghebre", b: "1862", d: "1934", details: { jobs: "Grain trader" } },
  { id: "b1s", name: "Lemlem Kidane", b: "1866", d: "1940" },
  { id: "b2", name: "Berhane Ghebre", b: "1866", d: "1929" },
  { id: "b2s", name: "Medhin Araya", b: "1870", d: "1945" },
  { id: "b3", name: "Almaz Ghebre", b: "1870", d: "1901" },

  // ── Generation 3 ──────────────────────────────────────────────────
  { id: "c1", name: "Measho Tewolde", b: "1890", d: "1962", details: { jobs: "Built the family mill" } },
  { id: "c1s", name: "Alganesh Berhe", b: "1894", d: "1971" },
  { id: "c2", name: "Kidane Tewolde", b: "1894", d: "1958" },
  { id: "c2s", name: "Tsehaynesh Gebru", b: "1898", d: "1980" },
  { id: "c3", name: "Haile Berhane", b: "1892", d: "1969" },
  { id: "c3s", name: "Abrehet Tesfay", b: "1896", d: "1975" },
  { id: "c4", name: "Nigisti Berhane", b: "1899", d: "1983" },

  // ── Generation 4 ──────────────────────────────────────────────────
  { id: "d1", name: "Abraham Measho", b: "1918", d: "1994", details: { birthCity: "Asmara" } },
  { id: "d1s", name: "Zewditu Haile", b: "1922", d: "2001" },
  { id: "d2", name: "Letebrhan Measho", b: "1922", d: "2005" },
  { id: "d2s", name: "Gebremedhin Solomon", b: "1918", d: "1989" },
  { id: "d3", name: "Yohannes Kidane", b: "1920", d: "1997" },
  { id: "d3s", name: "Mulu Asfaha", b: "1925", d: "2010" },
  { id: "d4", name: "Tsegay Haile", b: "1919", d: "1988" },
  { id: "d4s", name: "Weini Ghirmay", b: "1924", d: "2003" },
  { id: "d5", name: "Selam Haile", b: "1927", d: "2011" },

  // ── Generation 5 ──────────────────────────────────────────────────
  { id: "e1", name: "Fetur Abraham", b: "1942", d: "2018", details: { birthCity: "Asmara", jobs: "Schoolteacher" } },
  { id: "e1s", name: "Genet Tekle", b: "1946", details: { currentCity: "Asmara" } },
  { id: "e2", name: "Rahwa Abraham", b: "1946", details: { currentCity: "Frankfurt" } },
  { id: "e2s", name: "Daniel Okbay", b: "1942", d: "2016" },
  { id: "e3", name: "Samuel Gebremedhin", b: "1944", details: { currentCity: "Toronto" } },
  { id: "e3s", name: "Hiwet Bahta", b: "1948", details: { currentCity: "Toronto" } },
  { id: "e4", name: "Tesfay Yohannes", b: "1947", d: "2020" },
  { id: "e4s", name: "Askalu Negash", b: "1951", details: { currentCity: "Asmara" } },
  { id: "e5", name: "Amanuel Tsegay", b: "1944", details: { currentCity: "Oakland, CA" } },
  { id: "e5s", name: "Freweini Habte", b: "1948", details: { currentCity: "Oakland, CA" } },
  { id: "e6", name: "Rigbe Tsegay", b: "1950" },
  // married in — mother of Sara and Stefanos
  { id: "x1", name: "Adey Zewdit", b: "1938", details: { currentCity: "Asmara" } },

  // ── Generation 6 ──────────────────────────────────────────────────
  { id: "f1", name: "Haile Fetur", b: "1968", details: { currentCity: "San Diego, CA", college: "University of Asmara", jobs: "Civil engineer" } },
  { id: "f1s", name: "Sara Measho", b: "1966", details: { currentCity: "San Diego, CA", jobs: "Nurse" } },
  { id: "f2", name: "Yodit Fetur", b: "1972", details: { currentCity: "Seattle, WA", college: "University of Washington" } },
  { id: "f2s", name: "Robel Estifanos", b: "1969", details: { currentCity: "Seattle, WA" } },
  { id: "f3", name: "Nardos Daniel", b: "1970", details: { currentCity: "Frankfurt" } },
  { id: "f3s", name: "Kibrom Tesfu", b: "1967", details: { currentCity: "Frankfurt" } },
  { id: "f4", name: "Meron Samuel", b: "1971", details: { currentCity: "Toronto", college: "University of Toronto" } },
  { id: "f4s", name: "Filmon Kahsay", b: "1968", details: { currentCity: "Toronto" } },
  { id: "f5", name: "Simon Tesfay", b: "1973", details: { currentCity: "Oakland, CA" } },
  { id: "f5s", name: "Winta Yemane", b: "1976", details: { currentCity: "Oakland, CA" } },
  { id: "f6", name: "Dawit Amanuel", b: "1970", details: { currentCity: "Oakland, CA" } },
  { id: "f7", name: "Senait Amanuel", b: "1974", details: { currentCity: "San Diego, CA" } },
  { id: "f7s", name: "Ermias Gide", b: "1971" },
  { id: "f8", name: "Stefanos Measho", b: "1962", details: { currentCity: "Asmara" } },
  { id: "f8s", name: "Eden Girmay", b: "1965", details: { currentCity: "Asmara" } },

  // ── Generation 7 ──────────────────────────────────────────────────
  { id: "g1", name: "Yosief Haile", b: "2002", details: { currentCity: "San Diego, CA", college: "UC San Diego" } },
  { id: "g2", name: "Michael Haile", b: "1998", details: { currentCity: "San Diego, CA", college: "UC San Diego" } },
  { id: "g3", name: "Naomi Haile", b: "2000", details: { currentCity: "Seattle, WA", college: "University of Washington" } },
  { id: "g4", name: "Liya Robel", b: "2001", details: { currentCity: "Seattle, WA" } },
  { id: "g5", name: "Nahom Robel", b: "2004" },
  { id: "g6", name: "Abel Kibrom", b: "2003", details: { currentCity: "Frankfurt" } },
  { id: "g7", name: "Hermon Simon", b: "2005", details: { currentCity: "Oakland, CA" } },
  { id: "g8", name: "Yonas Simon", b: "2008" },
  { id: "g9", name: "Meron Stefanos", b: "1995", details: { currentCity: "Asmara" } },
  { id: "g10", name: "Jasmine Stefanos", b: "1998", details: { currentCity: "Toronto" } },
  { id: "g11", name: "Araya Stefanos", b: "2001" },
];

const COUPLES: [string, string][] = [
  ["a1", "a2"],
  ["b1", "b1s"],
  ["b2", "b2s"],
  ["c1", "c1s"],
  ["c2", "c2s"],
  ["c3", "c3s"],
  ["d1", "d1s"],
  ["d2", "d2s"],
  ["d3", "d3s"],
  ["d4", "d4s"],
  ["e1", "e1s"],
  ["e2", "e2s"],
  ["e3", "e3s"],
  ["e4", "e4s"],
  ["e5", "e5s"],
  ["f1", "f1s"],
  ["f2", "f2s"],
  ["f3", "f3s"],
  ["f4", "f4s"],
  ["f5", "f5s"],
  ["f7", "f7s"],
  ["f8", "f8s"],
];

const FAMILIES: { parents: string[]; children: string[] }[] = [
  { parents: ["a1", "a2"], children: ["b1", "b2", "b3"] },
  { parents: ["b1", "b1s"], children: ["c1", "c2"] },
  { parents: ["b2", "b2s"], children: ["c3", "c4"] },
  { parents: ["c1", "c1s"], children: ["d1", "d2"] },
  { parents: ["c2", "c2s"], children: ["d3"] },
  { parents: ["c3", "c3s"], children: ["d4", "d5"] },
  { parents: ["d1", "d1s"], children: ["e1", "e2"] },
  { parents: ["d2", "d2s"], children: ["e3"] },
  { parents: ["d3", "d3s"], children: ["e4"] },
  { parents: ["d4", "d4s"], children: ["e5", "e6"] },
  { parents: ["e1", "e1s"], children: ["f1", "f2"] },
  { parents: ["e2", "e2s"], children: ["f3"] },
  { parents: ["e3", "e3s"], children: ["f4"] },
  { parents: ["e4", "e4s"], children: ["f5"] },
  { parents: ["e5", "e5s"], children: ["f6", "f7"] },
  // Sara and Stefanos married in — their own mother anchors that branch
  { parents: ["x1"], children: ["f1s", "f8"] },
  { parents: ["f1", "f1s"], children: ["g1", "g2", "g3"] },
  { parents: ["f2", "f2s"], children: ["g4", "g5"] },
  { parents: ["f3", "f3s"], children: ["g6"] },
  { parents: ["f5", "f5s"], children: ["g7", "g8"] },
  { parents: ["f8", "f8s"], children: ["g9", "g10", "g11"] },
];

// A few sibling links are asserted directly; the rest are left for the
// suggestion engine to propose, which is the point of the demo.
const SIBLINGS: [string, string][] = [
  ["b1", "b2"],
  ["f1s", "f8"],
  ["g1", "g2"],
];

export function buildBigFamily(
  familyId: string,
  addedById: string,
  createdAt: string
): { people: Person[]; relationships: Relationship[] } {
  const pid = (id: string) => `${familyId}-${id}`;

  const people: Person[] = PEOPLE.map((s) => ({
    id: pid(s.id),
    familyId,
    name: s.name,
    birthYear: s.b,
    deathYear: s.d,
    details: s.details,
    addedById,
    createdAt,
  }));

  const relationships: Relationship[] = [];
  let n = 0;
  const rel = (from: string, to: string, type: Relationship["type"]) => {
    relationships.push({
      id: `${familyId}-r${n++}`,
      familyId,
      fromPersonId: pid(from),
      toPersonId: pid(to),
      type,
      addedById,
      createdAt,
    });
  };

  COUPLES.forEach(([a, b]) => rel(a, b, "SPOUSE_OF"));
  FAMILIES.forEach(({ parents, children }) =>
    parents.forEach((p) => children.forEach((c) => rel(p, c, "PARENT_OF")))
  );
  SIBLINGS.forEach(([a, b]) => rel(a, b, "SIBLING_OF"));

  return { people, relationships };
}
