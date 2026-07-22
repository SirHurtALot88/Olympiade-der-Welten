import { describe, expect, it } from "vitest";

import {
  TRANSFERMARKT_ATTRIBUTE_KEYS,
  countActiveAttributeTierFilters,
  passesAttributeTierFilters,
  tierMeetsMinimum,
} from "@/lib/market/transfermarkt-attribute-filter";

describe("transfermarkt-attribute-filter", () => {
  it("covers all 12 fine attributes exactly once", () => {
    expect(TRANSFERMARKT_ATTRIBUTE_KEYS).toHaveLength(12);
    expect(new Set(TRANSFERMARKT_ATTRIBUTE_KEYS).size).toBe(12);
  });

  it("treats a selected tier as 'that tier and higher'", () => {
    // A und höher: A/S/S+ passen, B fällt raus.
    expect(tierMeetsMinimum("A", "A")).toBe(true);
    expect(tierMeetsMinimum("S", "A")).toBe(true);
    expect(tierMeetsMinimum("S+", "A")).toBe(true);
    expect(tierMeetsMinimum("B", "A")).toBe(false);
    expect(tierMeetsMinimum("F", "A")).toBe(false);
  });

  it("excludes candidates with an unknown/null rating on an active filter", () => {
    expect(tierMeetsMinimum(null, "C")).toBe(false);
    expect(tierMeetsMinimum(undefined, "F")).toBe(false);
  });

  it("passes only candidates meeting every active per-attribute minimum", () => {
    const ratings = { power: "S" as const, speed: "B" as const, charisma: "D" as const };
    // Kein Filter → immer true.
    expect(passesAttributeTierFilters(ratings, {})).toBe(true);
    // power ≥ A erfüllt (S), speed ≥ A NICHT (B) → false.
    expect(passesAttributeTierFilters(ratings, { power: "A", speed: "A" })).toBe(false);
    // power ≥ A und speed ≥ C → beide erfüllt.
    expect(passesAttributeTierFilters(ratings, { power: "A", speed: "C" })).toBe(true);
  });

  it("counts active filters", () => {
    expect(countActiveAttributeTierFilters({})).toBe(0);
    expect(countActiveAttributeTierFilters({ power: "A", torment: "F" })).toBe(2);
  });
});
