import { describe, expect, it } from "vitest";

import {
  PLANNER_LIQUIDITY_BUFFER_MW_RATIO,
  resolveTeamLiquidityBufferTarget,
  resolveTeamRosterMarketValue,
  resolveTeamSpendableCashForPlanning,
  usesSingleCashPlanningPolicy,
} from "@/lib/ai/planner-cash-buffer-policy";
import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";

function player(id: string, marketValue: number): Player {
  return {
    id,
    name: id,
    className: "Fighter",
    race: "Human",
    marketValue,
    displayMarketValue: marketValue,
    salaryDemand: 5,
    displaySalary: 5,
  } as Player;
}

function gameState(seasonId: string, teamCash: number, rosterMw: number): GameState {
  const teamId = "T-1";
  const playerId = "p1";
  return {
    gamePhase: "season_active",
    season: { id: seasonId, name: seasonId, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId, schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, name: "Team", shortCode: "T-1", budget: teamCash, cash: teamCash } as Team],
    teamIdentities: [],
    players: [player(playerId, rosterMw)],
    rosters: [{ id: "r1", teamId, playerId, salary: 5, contractLength: 2 }],
    disciplines: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: { mappingSource: "test", teamSource: "test", generatedAt: "", processedMappingRows: 0, importedPlayerCount: 1, matchedRosterCount: 1, warnings: [] },
  };
}

describe("planner-cash-buffer-policy", () => {
  it("uses salary cap as S2+ buffer (max 1x salary)", () => {
    const gs = gameState("season-2", 100, 200);
    gs.rosters[0]!.salary = 5;
    expect(usesSingleCashPlanningPolicy(gs)).toBe(true);
    expect(resolveTeamRosterMarketValue(gs, "T-1")).toBe(200);
    expect(resolveTeamLiquidityBufferTarget(gs, "T-1")).toBe(5);
    expect(resolveTeamSpendableCashForPlanning(gs, "T-1", 100)).toBe(95);
  });

  it("enforces minimum buffer of 3 when salary is tiny", () => {
    const gs = gameState("season-2", 20, 10);
    gs.rosters[0]!.salary = 1;
    expect(resolveTeamLiquidityBufferTarget(gs, "T-1")).toBe(3);
    expect(resolveTeamSpendableCashForPlanning(gs, "T-1", 20)).toBe(17);
  });

  it("flags season-1 as bucket/draft policy season", () => {
    expect(usesSingleCashPlanningPolicy(gameState("season-1", 50, 100))).toBe(false);
    expect(PLANNER_LIQUIDITY_BUFFER_MW_RATIO).toBe(0.1);
  });
});
