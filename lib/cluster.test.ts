import { describe, expect, it } from "vitest";
import { layoutClusters, peopleInCluster, canonicalClusterValue } from "./cluster";
import type { Person } from "./types";

const person = (
  id: string,
  name: string,
  details?: Person["details"]
): Person => ({
  id,
  familyId: "f1",
  name,
  details,
  addedById: "u1",
  createdAt: "x",
});

describe("clusters omit people with nothing to group by", () => {
  it("does not draw a catch-all for the unassigned", () => {
    const people = [
      person("a", "Naomi", { currentCity: "New York" }),
      person("b", "Yosief", { currentCity: "San Francisco" }),
      person("c", "Placeholder"),
      person("d", "Biscuit"),
    ];
    const layout = layoutClusters(people, "currentCity");
    expect(layout.bubbles.map((b) => b.label).sort()).toEqual([
      "New York",
      "San Francisco",
    ]);
    expect(layout.positions.has("a")).toBe(true);
    expect(layout.positions.has("b")).toBe(true);
    expect(layout.positions.has("c")).toBe(false);
    expect(layout.positions.has("d")).toBe(false);
    expect(layout.bubbles.some((b) => b.muted)).toBe(false);
  });

  it("returns an empty layout when nobody has the field", () => {
    const layout = layoutClusters(
      [person("a", "A"), person("b", "B")],
      "currentCity"
    );
    expect(layout.bubbles).toHaveLength(0);
    expect(layout.positions.size).toBe(0);
  });

  it("treats San Diego and San Diego, CA as one cluster", () => {
    const people = [
      person("a", "A", { currentCity: "San Diego, CA" }),
      person("b", "B", { currentCity: "San Diego" }),
    ];
    const layout = layoutClusters(people, "currentCity");
    expect(layout.bubbles).toHaveLength(1);
    expect(peopleInCluster(people, "currentCity", "San Diego")).toHaveLength(2);
    expect(canonicalClusterValue(people, "currentCity", "San Diego")).toBe(
      "San Diego, CA"
    );
  });

  it("keeps named groups separate from cities", () => {
    const people = [
      person("a", "A", { currentCity: "Frankfurt", clusterGroup: "Cousins" }),
      person("b", "B", { clusterGroup: "Cousins" }),
    ];
    expect(layoutClusters(people, "clusterGroup").bubbles.map((b) => b.label)).toEqual([
      "Cousins",
    ]);
    expect(layoutClusters(people, "currentCity").bubbles.map((b) => b.label)).toEqual([
      "Frankfurt",
    ]);
  });
});
