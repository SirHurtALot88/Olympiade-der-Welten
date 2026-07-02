import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getTeamPlannerRosterTarget,
  projectExpectedSalaryAtPlannerTarget,
  resolveHoardMultiplier,
  resolveTeamCashRunwayReserve,
} from "@/lib/ai/ai-team-cash-reserve-service";

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

function buildGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: {},
      disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "C-S", name: "C-S", shortCode: "C-S", cash: 180, humanControlled: false }],
    teamIdentities: [
      {
        teamId: "C-S",
        playerMin: 10,
        playerOpt: 12,
        finances: 9.5,
        ambition: 7,
      },
    ],
    rosters: Array.from({ length: 10 }, (_, index) => ({
      id: `r-cs-${index}`,
      teamId: "C-S",
      playerId: `p-cs-${index}`,
      slot: index,
      salary: 4.8,
    })),
    players: Array.from({ length: 10 }, (_, index) => ({
      id: `p-cs-${index}`,
      name: `P${index}`,
      marketValue: 15,
      displayMarketValue: 15,
      rating: 55,
      salary: 4.8,
    })),
    disciplines: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
}

describe("ai team cash reserve service", () => {
  it("uses a high hoard multiplier for finance-strong hoarder teams", () => {
    const gameState = buildGameState({
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    expect(resolveHoardMultiplier(gameState, "C-S")).toBeGreaterThan(0.55);
    expect(resolveHoardMultiplier(gameState, "C-S")).toBeLessThanOrEqual(0.7);
  });

  it("projects expected salary at planner target and reserves at most 0.70x salary for C-S", () => {
    const gameState = buildGameState({
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    const projected = projectExpectedSalaryAtPlannerTarget(gameState, "C-S", 12);
    const reserve = resolveTeamCashRunwayReserve(gameState, "C-S", { expectedSalaryAfterPlan: projected });
    expect(projected).toBeGreaterThan(45);
    expect(reserve / projected).toBeLessThanOrEqual(0.7);
    expect(reserve).toBeGreaterThan(5);
  });

  it("keeps planner target at playerOpt while roster is below opt", () => {
    const gameState = buildGameState({
      teams: [{ teamId: "C-S", name: "C-S", shortCode: "C-S", cash: 20, humanControlled: false }],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        seasonStrategyStates: {
          "C-S": {
            teamId: "C-S",
            seasonId: "season-2",
            seasonStrategy: "balanced_growth",
            doctrineCompatibility: "green",
            updatedAt: "",
          },
        },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    expect(getTeamPlannerRosterTarget(gameState, "C-S")).toBe(12);
  });

  it("lowers planner target by one only after opt is reached and cash is tight", () => {
    const gameState = buildGameState({
      teams: [{ teamId: "C-S", name: "C-S", shortCode: "C-S", cash: 20, humanControlled: false }],
      rosters: Array.from({ length: 12 }, (_, index) => ({
        id: `r-cs-${index}`,
        teamId: "C-S",
        playerId: `p-cs-${index}`,
        salary: 4.8,
      })),
      players: Array.from({ length: 12 }, (_, index) => ({
        id: `p-cs-${index}`,
        name: `P${index}`,
        marketValue: 15,
        displayMarketValue: 15,
        rating: 55,
        salary: 4.8,
      })),
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        seasonStrategyStates: {
          "C-S": {
            teamId: "C-S",
            seasonId: "season-2",
            seasonStrategy: "balanced_growth",
            doctrineCompatibility: "green",
            updatedAt: "",
          },
        },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    expect(getTeamPlannerRosterTarget(gameState, "C-S")).toBe(11);
  });

  it("uses a smaller reserve multiplier for spender profiles", () => {
    const gameState = buildGameState({
      teamIdentities: [{ teamId: "C-S", playerMin: 10, playerOpt: 12, finances: 3, ambition: 8 }],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 1, starPriority: 9, riskTolerance: 8 }),
        },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    const projected = projectExpectedSalaryAtPlannerTarget(gameState, "C-S", 12);
    const reserve = resolveTeamCashRunwayReserve(gameState, "C-S", { expectedSalaryAfterPlan: projected });
    expect(resolveHoardMultiplier(gameState, "C-S")).toBeLessThan(0.45);
    expect(reserve).toBeLessThan(projected * 0.55);
  });
});
