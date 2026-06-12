import { describe, expect, it } from "vitest";

import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateMarketValueFromRankTable, MARKET_VALUE_BASE_OFFSET } from "@/lib/player-formulas/market-value-engine";

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
});
