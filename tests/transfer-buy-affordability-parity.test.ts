import { describe, expect, it } from "vitest";

import { resolveSimulatedPlannerSpendableCash } from "@/lib/ai/ai-market-slot-plan-service";
import { resolveTransferBuyAffordabilityCash } from "@/lib/market/transfermarkt-local-service";
import type { GameState, Team } from "@/lib/data/olyDataTypes";

function createGameState(team: Team, rosterCount: number): GameState {
  return {
    gamePhase: "preseason_management",
    season: { id: "season-2", name: "Season 2", year: 2026, currentMatchday: 10, matchdayIds: [] },
    seasonState: { seasonId: "season-2", schedule: [], standings: { [team.teamId]: { points: 0 } } },
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team],
    teamIdentities: [{ teamId: team.teamId, playerMin: 8, playerOpt: 10, playerMax: 14 }],
    players: [],
    disciplines: [],
    rosters: Array.from({ length: rosterCount }, (_, index) => ({
      id: `r-${index}`,
      teamId: team.teamId,
      playerId: `p-${index}`,
      contractLength: 2,
      salary: 4,
      upkeep: 4,
      roleTag: "rotation" as const,
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: rosterCount,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("transfer buy affordability parity", () => {
  it("planner spendable matches execute buy gate when roster is under min", () => {
    const team: Team = {
      teamId: "V-W",
      shortCode: "V-W",
      name: "V-W Theme",
      budget: 100,
      cash: 42,
      identityId: "V-W",
      humanControlled: false,
      rosterLimit: 14,
      logoPath: null,
    };
    const gameState = createGameState(team, 5);
    const plannerSpendable = resolveSimulatedPlannerSpendableCash({
      gameState,
      teamId: team.teamId,
      teamCash: team.cash,
      simulatedRosterCount: 5,
    });
    const executeAffordability = resolveTransferBuyAffordabilityCash({
      gameState,
      teamId: team.teamId,
      teamCash: team.cash,
      rosterBefore: 5,
      playerMin: 8,
      seasonId: gameState.season.id,
      transferSource: "ai_roster_fill",
    });
    expect(plannerSpendable).toBe(executeAffordability);
    expect(executeAffordability).toBeGreaterThan(20);
  });
});
