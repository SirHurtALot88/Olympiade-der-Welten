import { describe, expect, it } from "vitest";

import {
  PLANNER_LIQUIDITY_BUFFER_MW_RATIO,
  resolveTeamLiquidityBufferTarget,
  resolveTeamRosterMarketValue,
  resolveTeamSpendableCashForPlanning,
  usesSingleCashPlanningPolicy,
} from "@/lib/ai/planner-cash-buffer-policy";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

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

function gameState(seasonId: string, teamCash: number, rosterMw: number, teamIdentities: TeamIdentity[] = []): GameState {
  const teamId = "T-1";
  const playerId = "p1";
  return {
    gamePhase: "season_active",
    season: { id: seasonId, name: seasonId, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId, schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId, name: "Team", shortCode: "T-1", budget: teamCash, cash: teamCash } as Team],
    teamIdentities,
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

function teamIdentity(finances: number): TeamIdentity {
  return {
    teamId: "T-1",
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 5,
    finances,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 8,
    playerOpt: 12,
  };
}

describe("planner-cash-buffer-policy", () => {
  it("uses finance-scaled salary buffer for S2+ (0.25–0.75× salary, min 3)", () => {
    const gs = gameState("season-2", 100, 200);
    gs.rosters[0]!.salary = 5;
    expect(usesSingleCashPlanningPolicy(gs)).toBe(true);
    expect(resolveTeamRosterMarketValue(gs, "T-1")).toBe(200);
    expect(resolveTeamLiquidityBufferTarget(gs, "T-1")).toBe(3);
    expect(resolveTeamSpendableCashForPlanning(gs, "T-1", 100)).toBe(97);
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

  it("keeps the S1 MW buffer unchanged for a neutral team (finances=5 → same as no identity)", () => {
    // Default/no-identity behaviour must not shift: the fallback inside getTeamCashSalarySoftTarget
    // is finances=5 too, so the explicit neutral identity must reproduce the historic 0.1× ratio.
    const noIdentity = gameState("season-1", 50, 500);
    const neutralIdentity = gameState("season-1", 50, 500, [teamIdentity(5)]);
    expect(resolveTeamLiquidityBufferTarget(noIdentity, "T-1")).toBe(50);
    expect(resolveTeamLiquidityBufferTarget(neutralIdentity, "T-1")).toBe(50);
  });

  describe("Bug #106: S1-Kader-Rücklage muss den Finanz-Vorsicht-Trait (identity.finances) einbeziehen", () => {
    it("REGRESSION: a cash-cautious team (finances=10) must hold a LARGER S1 buffer than a cash-careless team (finances=0) at the same roster market value", () => {
      const cautious = gameState("season-1", 200, 500, [teamIdentity(10)]);
      const careless = gameState("season-1", 200, 500, [teamIdentity(0)]);

      const cautiousBuffer = resolveTeamLiquidityBufferTarget(cautious, "T-1");
      const carelessBuffer = resolveTeamLiquidityBufferTarget(careless, "T-1");

      // Before the fix, both ignored `finances` entirely for S1 and were IDENTICAL (50 === 50).
      // The trait must actually move the number: cautious > neutral > careless.
      expect(cautiousBuffer).toBe(75); // 500 * (0.1 * (0.75/0.5)) = 500 * 0.15
      expect(carelessBuffer).toBe(25); // 500 * (0.1 * (0.25/0.5)) = 500 * 0.05
      expect(cautiousBuffer).toBeGreaterThan(carelessBuffer);
    });

    it("spendable cash for planning shrinks for the cautious team accordingly", () => {
      const cautious = gameState("season-1", 200, 500, [teamIdentity(10)]);
      const careless = gameState("season-1", 200, 500, [teamIdentity(0)]);

      expect(resolveTeamSpendableCashForPlanning(cautious, "T-1", 200)).toBe(125); // 200 - 75
      expect(resolveTeamSpendableCashForPlanning(careless, "T-1", 200)).toBe(175); // 200 - 25
    });
  });
});
