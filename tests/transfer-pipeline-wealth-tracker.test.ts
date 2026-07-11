import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  collectSeasonWealthSnapshot,
  resolveWealthCorridorBounds,
} from "@/lib/season/transfer-pipeline-wealth-tracker";

function buildMinimalGameState(input: {
  teams: Array<{ teamId: string; shortCode: string; budget: number; cash: number }>;
  rosters: Array<{ teamId: string; playerId: string; salary: number; currentValue: number }>;
}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", currentMatchday: 0 },
    seasonState: { seasonEconomyFactors: [] },
    teams: input.teams.map((team) => ({
      teamId: team.teamId,
      shortCode: team.shortCode,
      name: team.shortCode,
      budget: team.budget,
      cash: team.cash,
      identityId: team.teamId,
      humanControlled: false,
      rosterLimit: 14,
    })),
    rosters: input.rosters.map((entry, index) => ({
      id: `roster-${index}`,
      teamId: entry.teamId,
      playerId: entry.playerId,
      activePlayerId: entry.playerId,
      salary: entry.salary,
      currentValue: entry.currentValue,
      contractLength: 1,
    })),
    players: input.rosters.map((entry, index) => ({
      id: entry.playerId,
      name: `Player ${index}`,
      rating: 50,
      marketValue: entry.currentValue,
      displayMarketValue: entry.currentValue,
      coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
      disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      preferredDisciplineIds: [],
    })),
  } as unknown as GameState;
}

describe("transfer pipeline wealth tracker", () => {
  it("flags under-deployed S1 draft wealth", () => {
    const gameState = buildMinimalGameState({
      teams: [{ teamId: "R-R", shortCode: "R-R", budget: 170, cash: 80 }],
      rosters: [{ teamId: "R-R", playerId: "p1", salary: 3, currentValue: 40 }],
    });
    const snapshot = collectSeasonWealthSnapshot({
      gameState,
      saveId: "save-1",
      seasonId: "season-1",
      phase: "draft",
    });
    expect(snapshot.mwPctOfStartBudget).toBeLessThan(0.5);
    expect(snapshot.corridor.overallStatus).not.toBe("green");
  });

  it("widens corridor when salary factors are positive", () => {
    const low = resolveWealthCorridorBounds({
      seasonNumber: 5,
      phase: "preseason",
      salaryFactorsThroughSeason: [1, 1, 1, 1, 1],
    });
    const high = resolveWealthCorridorBounds({
      seasonNumber: 5,
      phase: "preseason",
      salaryFactorsThroughSeason: [1.1, 1.15, 1.12, 1.08, 1.05],
    });
    expect(high.mwPctMin).toBeGreaterThan(low.mwPctMin);
  });
});
