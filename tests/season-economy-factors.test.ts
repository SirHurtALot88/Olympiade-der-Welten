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
  });
});
