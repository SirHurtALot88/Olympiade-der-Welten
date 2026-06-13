import { describe, expect, it } from "vitest";

import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import {
  calculateMarketValueBonuses,
  calculateMarketValueFromRankTable,
  deriveBaseMarketValueFromFinal,
  MARKET_VALUE_BASE_OFFSET,
} from "@/lib/player-formulas/market-value-engine";

const rankFixture = [
  { rank: 1, disciplineMarketValue: 6.5 },
  { rank: 2, disciplineMarketValue: 5.1 },
  { rank: 3, disciplineMarketValue: 4.4 },
] as const;

describe("player formula market value engine", () => {
  it("keeps the productive engine blocked while the repo has no rank-to-mw source", () => {
    const sources = loadPlayerFormulaSources();

    expect(sources.rankMarketValueStatus).toBe("ready");
    expect(sources.marketValueEngineStatus).toBe("ready");
  });

  it("calculates ranked discipline market values with the explicit +3.5 base offset from a test fixture", () => {
    const result = calculateMarketValueFromRankTable({
      rankToDisciplineMarketValue: [...rankFixture],
      players: [
        {
          playerId: "alpha",
          scores: {
            tdm: 95,
            staffel: 80,
          },
        },
        {
          playerId: "beta",
          scores: {
            tdm: 95,
            staffel: 60,
          },
          mwChangeFix: -20,
        },
        {
          playerId: "gamma",
          scores: {
            tdm: 40,
            staffel: 55,
          },
        },
      ],
    });

    expect(result.status).toBe("ready");
    expect(result.players).toEqual([
      {
        playerId: "alpha",
        disciplineRanks: {
          tdm: 1,
          staffel: 1,
        },
        disciplineMarketValues: {
          tdm: 6.5,
          staffel: 6.5,
        },
        rawDisciplineMarketValueSum: 13,
        adjustedRaw: 13,
        protectedRaw: 13,
        marketValueBaseOffset: MARKET_VALUE_BASE_OFFSET,
        calcWithoutBaseOffset: 13,
        marketValueNew: 16.5,
      },
      {
        playerId: "beta",
        disciplineRanks: {
          tdm: 1,
          staffel: 2,
        },
        disciplineMarketValues: {
          tdm: 6.5,
          staffel: 5.1,
        },
        rawDisciplineMarketValueSum: 11.6,
        adjustedRaw: -8.4,
        protectedRaw: 0,
        marketValueBaseOffset: MARKET_VALUE_BASE_OFFSET,
        calcWithoutBaseOffset: 0,
        marketValueNew: 3.5,
      },
      {
        playerId: "gamma",
        disciplineRanks: {
          tdm: 3,
          staffel: 3,
        },
        disciplineMarketValues: {
          tdm: 4.4,
          staffel: 4.4,
        },
        rawDisciplineMarketValueSum: 8.8,
        adjustedRaw: 8.8,
        protectedRaw: 8.8,
        marketValueBaseOffset: MARKET_VALUE_BASE_OFFSET,
        calcWithoutBaseOffset: 8.8,
        marketValueNew: 12.3,
      },
    ]);
  });

  it("matches the Tyrael benchmark for allrounder, specialist and final/base split", () => {
    const finalMarketValue = 124.13;
    const baseMarketValue = deriveBaseMarketValueFromFinal({
      finalMarketValue,
      coreStats: {
        pow: 76.73,
        spe: 78.12,
        men: 87.97,
        soc: 97.06,
      },
      disciplineRatings: {
        tennis: 79.6,
        "mini-dm": 55.4,
        showcase: 100,
        "time-trial": 62.16,
        spurt: 83.1,
        basketball: 96.69,
        tdm: 81.88,
        battlefield: 97.43,
        staffel: 98.53,
        football: 95.59,
        wettessen: 80.44,
        gewichtheben: 92.29,
        "speed-schach": 85.67,
        "takeshis-castle": 97.43,
        hockey: 85.67,
        eiskunstlauf: 95.59,
        climbing: 89.71,
        fechten: 57.11,
        "i-spy": 96.69,
        breaking: 68.4,
      },
    });
    const bonus = calculateMarketValueBonuses({
      baseMarketValue,
      coreStats: {
        pow: 76.73,
        spe: 78.12,
        men: 87.97,
        soc: 97.06,
      },
      disciplineRatings: {
        tennis: 79.6,
        "mini-dm": 55.4,
        showcase: 100,
        "time-trial": 62.16,
        spurt: 83.1,
        basketball: 96.69,
        tdm: 81.88,
        battlefield: 97.43,
        staffel: 98.53,
        football: 95.59,
        wettessen: 80.44,
        gewichtheben: 92.29,
        "speed-schach": 85.67,
        "takeshis-castle": 97.43,
        hockey: 85.67,
        eiskunstlauf: 95.59,
        climbing: 89.71,
        fechten: 57.11,
        "i-spy": 96.69,
        breaking: 68.4,
      },
    });

    expect(bonus.allrounderBonus).toBe(5.2);
    expect(bonus.over20).toBe(20);
    expect(bonus.over40).toBe(20);
    expect(bonus.over60).toBe(18);
    expect(bonus.over80).toBe(15);
    expect(bonus.specialistBonus).toBeCloseTo(12.57, 1);
    expect(baseMarketValue + bonus.allrounderBonus + bonus.specialistBonus).toBeCloseTo(124.1, 1);
  });
});
