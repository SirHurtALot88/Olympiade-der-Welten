import { afterEach, describe, expect, it } from "vitest";

import {
  advanceSeasonEconomyFactorWindow,
  getSeasonEconomyFactorWindow,
  parseSalaryFactorPatternEnv,
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

  describe("OLY_LONG_RUN_SALARY_FACTOR_PATTERN override", () => {
    afterEach(() => {
      delete process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN;
    });

    it("parses a comma-separated pattern into rounded floats", () => {
      process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN = "1.18,1.15,0.85,0.85,0.88";
      expect(parseSalaryFactorPatternEnv()).toEqual([1.18, 1.15, 0.85, 0.85, 0.88]);
    });

    it("returns null when unset or invalid", () => {
      delete process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN;
      expect(parseSalaryFactorPatternEnv()).toBeNull();
      process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN = "not,a,number";
      expect(parseSalaryFactorPatternEnv()).toBeNull();
    });

    it("feeds the pattern into the initial window via sheetFactors", () => {
      process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN = "1.18,1.15,0.85,0.85,0.88";
      const pattern = parseSalaryFactorPatternEnv();
      const window = getSeasonEconomyFactorWindow({
        saveId: "save-test",
        seasonId: "season-1",
        sheetFactors: pattern?.map((factor) => ({ seasonLabel: "", factor })),
      });
      expect(window.map((entry) => entry.factor)).toEqual([1.18, 1.15, 0.85, 0.85, 0.88]);
      expect(window.map((entry) => entry.source)).toEqual(["sheet_seed", "sheet_seed", "sheet_seed", "sheet_seed", "sheet_seed"]);
    });

    it("keeps a >5-season pattern in effect beyond the initial window (regression: values past index 4 used to be silently dropped)", () => {
      // Season 1 window only ever sees indices 0-4; season 6-10's values only become visible once
      // advanceSeasonEconomyFactorWindow rolls the horizon+4 slot into view on each later advance.
      const pattern = [1.18, 1.15, 0.85, 0.85, 0.88, 1.1, 1.2, 0.8, 0.9, 1.0];
      let window = getSeasonEconomyFactorWindow({
        saveId: "save-test",
        seasonId: "season-1",
        sheetFactors: pattern.map((factor) => ({ seasonLabel: "", factor })),
      });
      let seasonState = { seasonEconomyFactors: window };
      const seasonIds = ["season-2", "season-3", "season-4", "season-5", "season-6", "season-7"];
      let fromSeasonId = "season-1";
      for (const toSeasonId of seasonIds) {
        const advanced = advanceSeasonEconomyFactorWindow({
          saveId: "save-test",
          fromSeasonId,
          toSeasonId,
          seasonState,
          patternFactors: pattern,
        });
        window = advanced.nextWindow;
        seasonState = { seasonEconomyFactors: window };
        fromSeasonId = toSeasonId;
      }
      // After advancing to season-7, horizonIndex 0-3 are season-7..season-10 (pattern indices
      // 6-9 -> 1.2/0.8/0.9/1.0) — still the scripted values, not random rolls, because every
      // advance call was fed the same 10-value pattern. horizonIndex 4 (season-11) is beyond the
      // 10-value pattern and correctly falls back to a random roll.
      expect(window.slice(0, 4).map((entry) => entry.factor)).toEqual([1.2, 0.8, 0.9, 1]);
      expect(window.slice(0, 4).every((entry) => entry.source === "sheet_seed" || entry.source === "carried")).toBe(true);
      expect(window[4].source).toBe("rolled");
    });
  });
});
