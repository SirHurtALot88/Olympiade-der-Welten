import { describe, expect, it } from "vitest";

import {
  advanceSeasonEconomyFactorWindow,
  getSeasonEconomyFactorWindow,
  SEASON_ECONOMY_FACTOR_WINDOW_SIZE,
} from "@/lib/season/season-economy-factors";

describe("season economy factors", () => {
  it("builds the initial five-season factor window from seed values", () => {
    const window = getSeasonEconomyFactorWindow({
      saveId: "save-test",
      seasonId: "season-1",
    });

    expect(window).toHaveLength(SEASON_ECONOMY_FACTOR_WINDOW_SIZE);
    expect(window.map((entry) => entry.factor)).toEqual([1.09, 1.21, 1.16, 0.97, 0.9]);
    expect(window.map((entry) => entry.horizonIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("moves the five-season factor window forward and rolls a new S+4 value", () => {
    const advanced = advanceSeasonEconomyFactorWindow({
      saveId: "save-test",
      fromSeasonId: "season-1",
      toSeasonId: "season-2",
    });

    expect(advanced.nextWindow).toHaveLength(SEASON_ECONOMY_FACTOR_WINDOW_SIZE);
    expect(advanced.nextWindow.slice(0, 4).map((entry) => entry.factor)).toEqual([1.21, 1.16, 0.97, 0.9]);
    expect(advanced.rerolledSeasonPlus4.horizonIndex).toBe(4);
    expect(advanced.rerolledSeasonPlus4.factor).toBeGreaterThanOrEqual(0.82);
    expect(advanced.rerolledSeasonPlus4.factor).toBeLessThanOrEqual(1.24);
  });
});
