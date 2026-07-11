import { describe, expect, it } from "vitest";

import {
  formatScoutedImpactDelta,
  getScoutingTierWindow,
  isScoutedImpactExact,
  resolveScoutingConfidenceFromLevel,
} from "@/lib/market/transfermarkt-scouting";

const formatDe = (value: number, digits = 1) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);

describe("transfermarkt scouting display", () => {
  it("shows a tier range when scouting confidence is low", () => {
    expect(getScoutingTierWindow("B", 20)).toBe("B-C");
    expect(getScoutingTierWindow("B", 80)).toBe("B");
  });

  it("maps scouting level to confidence bands", () => {
    expect(resolveScoutingConfidenceFromLevel(0)).toBe(15);
    expect(resolveScoutingConfidenceFromLevel(5)).toBe(80);
  });

  it("shows impact delta ranges when scouting confidence is low", () => {
    expect(isScoutedImpactExact(80)).toBe(true);
    expect(formatScoutedImpactDelta(1, 80, formatDe)).toBe("+1");
    expect(formatScoutedImpactDelta(1, 20, formatDe)).toMatch(/–/);
  });
});
