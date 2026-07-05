import { describe, expect, it } from "vitest";

import {
  getSeasonHoardCashSalaryCap,
  getTeamCashSalaryHardCap,
  getTeamCashSalarySoftTarget,
  isCashHoardingTeam,
  teamNeedsPostOptUpgradeDeploy,
  teamNeedsTransferBudgetDeploy,
} from "@/lib/ai/ai-budget-deploy-service";
import type { GameState } from "@/lib/data/olyDataTypes";

function minimalStrategyProfile(teamId: string, bias: Record<string, number>) {
  return {
    teamId,
    strategySummary: "Test profile",
    preferredArchetypes: [] as string[],
    secondaryArchetypes: [] as string[],
    bias: {
      cashPriority: 5,
      valuePriority: 5,
      starPriority: 5,
      riskTolerance: 5,
      wageSensitivity: 5,
      sellForProfitAggression: 5,
      shortContractPreference: 5,
      longContractPreference: 5,
      loyaltyBias: 5,
      harmonyStrictness: 5,
      rosterDepthPreference: 5,
      eliteSmallRosterPreference: 5,
      ...bias,
    },
  };
}

function buildRichOptTeamGameState(cash = 180): GameState {
  return {
    season: { id: "season-2" },
    teams: [{ teamId: "T-1", shortCode: "C-S", cash, name: "Team" }],
    teamIdentities: [{ teamId: "T-1", playerMin: 8, playerOpt: 12, playerMax: 14, finances: 9.5, ambition: 8 }],
    rosters: Array.from({ length: 12 }, (_, index) => ({
      id: `r${index}`,
      teamId: "T-1",
      playerId: `p${index}`,
      salary: 4.5,
      upkeep: 4.5,
      contractLength: 2,
      currentValue: 18,
    })),
    players: Array.from({ length: 12 }, (_, index) => ({
      id: `p${index}`,
      name: `P${index}`,
      marketValue: 18,
      displayMarketValue: 18,
      rating: 55,
      fatigue: 20,
      salary: 4.5,
    })),
    seasonState: {
      aiManagerBudgetReservations: {
        "T-1": {
          teamId: "T-1",
          seasonId: "season-2",
          sourcePlanId: "test",
          cashReserve: 5,
          salaryReserve: 10,
          transferBudget: 40,
          buildingBudget: 8,
          maintenanceBudget: 0,
          emergencyBudget: 5,
          updatedAt: new Date().toISOString(),
        },
      },
      seasonStrategyStates: {
        "T-1": { teamId: "T-1", seasonStrategy: "win_now_push", doctrineCompatibility: "green", updatedAt: "" },
      },
      teamStrategyProfiles: {
        "T-1": minimalStrategyProfile("T-1", { cashPriority: 4, valuePriority: 4 }),
      },
    },
    transferHistory: [],
    disciplines: [],
    disciplineSchedule: [],
  } as unknown as GameState;
}

describe("ai budget deploy service", () => {
  it("uses team-aware hard cap: S2–S3 planner buffer at 1.0× salary", () => {
    const rich = buildRichOptTeamGameState(180);
    expect(getTeamCashSalaryHardCap(rich, "T-1", "season-2")).toBe(1);
    expect(getTeamCashSalaryHardCap(rich, "T-1", "season-3")).toBe(1);
    expect(getTeamCashSalarySoftTarget(rich, "T-1")).toBeGreaterThan(0.7);
    expect(getSeasonHoardCashSalaryCap("season-3")).toBe(0.75);
  });

  it("treats S3 cash above team hard cap as hoarding", () => {
    const gameState = buildRichOptTeamGameState(180);
    expect(isCashHoardingTeam(gameState, "T-1", "season-3")).toBe(true);
  });

  it("does not treat team at 0.72x salary as hoarding", () => {
    const gameState = buildRichOptTeamGameState(39);
    expect(isCashHoardingTeam(gameState, "T-1", "season-3")).toBe(false);
  });

  it("flags full opt teams with excess cash for upgrade deploy", () => {
    const gameState = buildRichOptTeamGameState(180);
    expect(teamNeedsPostOptUpgradeDeploy(gameState, "T-1", "season-3")).toBe(true);
    expect(teamNeedsTransferBudgetDeploy(gameState, "T-1", "season-3")).toBe(true);
  });

  it("stops deploy demand once cash is at hoard cap", () => {
    const gameState = buildRichOptTeamGameState(54);
    expect(isCashHoardingTeam(gameState, "T-1", "season-3")).toBe(false);
    expect(teamNeedsPostOptUpgradeDeploy(gameState, "T-1", "season-3")).toBe(false);
  });

  it("runs deploy pass for below-opt teams with excess cash (>=1.15× salary)", () => {
    const gameState = {
      season: { id: "season-2" },
      teams: [{ teamId: "T-1", shortCode: "T1", cash: 80, name: "Team" }],
      teamIdentities: [{ teamId: "T-1", playerMin: 8, playerOpt: 12 }],
      rosters: Array.from({ length: 8 }, (_, index) => ({
        id: `r${index}`,
        teamId: "T-1",
        playerId: `p${index}`,
        salary: 3,
        upkeep: 3,
        contractLength: 2,
        currentValue: 15,
      })),
      players: Array.from({ length: 8 }, (_, index) => ({
        id: `p${index}`,
        name: `P${index}`,
        marketValue: 15,
        displayMarketValue: 15,
        rating: 55,
        fatigue: 20,
      })),
      seasonState: {
        seasonStrategyStates: {
          "T-1": { teamId: "T-1", seasonStrategy: "win_now_push", doctrineCompatibility: "green", updatedAt: "" },
        },
      },
      transferHistory: [],
    } as unknown as GameState;

    expect(teamNeedsTransferBudgetDeploy(gameState, "T-1", "season-2")).toBe(true);
  });

  it("does not run deploy pass while below opt with modest cash", () => {
    const gameState = {
      season: { id: "season-2" },
      teams: [{ teamId: "T-1", shortCode: "T1", cash: 30, name: "Team" }],
      teamIdentities: [{ teamId: "T-1", playerMin: 8, playerOpt: 12 }],
      rosters: Array.from({ length: 8 }, (_, index) => ({
        id: `r${index}`,
        teamId: "T-1",
        playerId: `p${index}`,
        salary: 3,
        upkeep: 3,
        contractLength: 2,
        currentValue: 15,
      })),
      players: Array.from({ length: 8 }, (_, index) => ({
        id: `p${index}`,
        name: `P${index}`,
        marketValue: 15,
        displayMarketValue: 15,
        rating: 55,
        fatigue: 20,
      })),
      seasonState: {
        seasonStrategyStates: {
          "T-1": { teamId: "T-1", seasonStrategy: "win_now_push", doctrineCompatibility: "green", updatedAt: "" },
        },
      },
      transferHistory: [],
    } as unknown as GameState;

    expect(teamNeedsTransferBudgetDeploy(gameState, "T-1", "season-2")).toBe(false);
  });
});
