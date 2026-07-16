import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  applyRankTableMarketValuesToGameState,
  syncRosterMarketValuesWithPlayerEconomy,
} from "@/lib/player-formulas/market-value-apply";
import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";

function buildGameState(input: {
  playerMarketValue: number;
  rosterCurrentValue: number;
}): GameState {
  const teamId = "H-R";
  const playerId = "player-1";
  const player: Player = {
    id: playerId,
    name: "Volcanoth",
    className: "Fighter",
    race: "Human",
    marketValue: input.playerMarketValue,
    displayMarketValue: input.playerMarketValue,
    salaryDemand: 5,
    displaySalary: 5,
    disciplineRatings: { football: 50 },
  } as Player;
  const roster: RosterEntry = {
    id: "r1",
    teamId,
    playerId,
    salary: 5,
    contractLength: 2,
    currentValue: input.rosterCurrentValue,
    marketValue: input.rosterCurrentValue,
  } as RosterEntry;
  return {
    gamePhase: "season_active",
    season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: ["md-10"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, name: "H-R", shortCode: "H-R", budget: 100, cash: 118.51 } as Team],
    teamIdentities: [],
    players: [player],
    rosters: [roster],
    disciplines: [{ id: "football", name: "Football", category: "pow" }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  };
}

describe("market-value-apply", () => {
  it("syncRosterMarketValuesWithPlayerEconomy aligns stale roster book values with player MV", () => {
    const gameState = buildGameState({ playerMarketValue: 30.51, rosterCurrentValue: 35.82 });
    expect(resolveTeamRosterMarketValue(gameState, "H-R")).toBe(30.51);

    const synced = syncRosterMarketValuesWithPlayerEconomy(gameState);
    expect(synced.rosters[0]?.currentValue).toBe(30.51);
    expect(synced.rosters[0]?.marketValue).toBe(30.51);
    expect(resolveTeamRosterMarketValue(synced, "H-R")).toBe(30.51);
  });

  it("sale factor uses canonical economy MV not stale roster currentValue", async () => {
    const { buildTransfermarktSaleFactorBreakdown } = await import("@/lib/market/transfermarkt-sale-factor");
    const gameState = buildGameState({ playerMarketValue: 30.51, rosterCurrentValue: 35.82 });
    const player = gameState.players[0]!;
    const roster = gameState.rosters[0]!;
    const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, roster);
    expect(breakdown.baseMarketValue).toBe(30.51);
  });
});
