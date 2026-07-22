import { afterEach, describe, expect, it } from "vitest";

import {
  advanceSeasonEconomyFactorWindow,
  getSeasonEconomyFactorWindow,
  parseSalaryFactorPatternEnv,
  SEASON_ECONOMY_FACTOR_WINDOW_SIZE,
} from "@/lib/season/season-economy-factors";

// Salary-factor roll span at the neutral shift (OLY_SALARY_FACTOR_SHIFT unset/0): [0.82, 1.24].
const ROLL_MIN = 0.82;
const ROLL_MAX = 0.82 + 0.42;

describe("season economy factors", () => {
  it("rolls every Season 1 horizon randomly within the salary-factor span (no fixed 1.09 seed)", () => {
    const window = getSeasonEconomyFactorWindow({
      saveId: "save-test",
      seasonId: "season-1",
    });

    expect(window).toHaveLength(SEASON_ECONOMY_FACTOR_WINDOW_SIZE);
    expect(window.map((entry) => entry.horizonIndex)).toEqual([0, 1, 2, 3, 4]);
    // Every season is a rolled draw within span — NOT the old fixed sheet pattern that pinned S1 to 1.09.
    expect(window.every((entry) => entry.source === "rolled")).toBe(true);
    for (const entry of window) {
      expect(entry.factor).toBeGreaterThanOrEqual(ROLL_MIN);
      expect(entry.factor).toBeLessThanOrEqual(ROLL_MAX);
    }
  });

  it("is deterministic per save but differs across saves (random per new game)", () => {
    const first = () => getSeasonEconomyFactorWindow({ saveId: "save-a", seasonId: "season-1" });
    // Same save → identical window (stable across reloads / prize re-reads within a season).
    expect(first().map((entry) => entry.factor)).toEqual(first().map((entry) => entry.factor));
    // Different save → a different opening factor (each new game gets its own random draw).
    const windowA = getSeasonEconomyFactorWindow({ saveId: "save-a", seasonId: "season-1" });
    const windowB = getSeasonEconomyFactorWindow({ saveId: "save-b", seasonId: "season-1" });
    expect(windowA[0].factor).not.toEqual(windowB[0].factor);
  });

  it("moves the five-season factor window forward and rolls a new S+4 value", () => {
    const seed = getSeasonEconomyFactorWindow({ saveId: "save-test", seasonId: "season-1" });
    const advanced = advanceSeasonEconomyFactorWindow({
      saveId: "save-test",
      fromSeasonId: "season-1",
      toSeasonId: "season-2",
    });

    expect(advanced.nextWindow).toHaveLength(SEASON_ECONOMY_FACTOR_WINDOW_SIZE);
    // The window shifts: the outgoing season drops off and horizons 1-4 of the seed carry forward.
    expect(advanced.nextWindow.slice(0, 4).map((entry) => entry.factor)).toEqual(
      seed.slice(1).map((entry) => entry.factor),
    );
    expect(advanced.rerolledSeasonPlus4.horizonIndex).toBe(4);
    expect(advanced.rerolledSeasonPlus4.factor).toBeGreaterThanOrEqual(ROLL_MIN);
    expect(advanced.rerolledSeasonPlus4.factor).toBeLessThanOrEqual(ROLL_MAX);
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

    it("feeds an explicit pattern into the initial window via patternFactors", () => {
      const pattern = [1.18, 1.15, 0.85, 0.85, 0.88];
      const window = getSeasonEconomyFactorWindow({
        saveId: "save-test",
        seasonId: "season-1",
        patternFactors: pattern,
      });
      expect(window.map((entry) => entry.factor)).toEqual([1.18, 1.15, 0.85, 0.85, 0.88]);
      expect(window.map((entry) => entry.source)).toEqual(["sheet_seed", "sheet_seed", "sheet_seed", "sheet_seed", "sheet_seed"]);
    });

    it("pins the initial window when OLY_LONG_RUN_SALARY_FACTOR_PATTERN is set (env fallback)", () => {
      process.env.OLY_LONG_RUN_SALARY_FACTOR_PATTERN = "1.18,1.15,0.85,0.85,0.88";
      const window = getSeasonEconomyFactorWindow({
        saveId: "save-test",
        seasonId: "season-1",
      });
      expect(window.map((entry) => entry.factor)).toEqual([1.18, 1.15, 0.85, 0.85, 0.88]);
      expect(window.every((entry) => entry.source === "sheet_seed")).toBe(true);
    });

    it("keeps a >5-season pattern in effect beyond the initial window (regression: values past index 4 used to be silently dropped)", () => {
      // Season 1 window only ever sees indices 0-4; season 6-10's values only become visible once
      // advanceSeasonEconomyFactorWindow rolls the horizon+4 slot into view on each later advance.
      const pattern = [1.18, 1.15, 0.85, 0.85, 0.88, 1.1, 1.2, 0.8, 0.9, 1.0];
      let window = getSeasonEconomyFactorWindow({
        saveId: "save-test",
        seasonId: "season-1",
        patternFactors: pattern,
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
