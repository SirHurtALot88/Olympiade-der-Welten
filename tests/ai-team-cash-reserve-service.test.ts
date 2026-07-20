import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getTeamPlannerRosterTarget,
  isTeamRosterBelowOpt,
  projectExpectedSalaryAtPlannerTarget,
  resolveHoardMultiplier,
  resolveMarketPlannerCashBuffer,
  resolveTeamCashRunwayReserve,
} from "@/lib/ai/ai-team-cash-reserve-service";
import {
  makePlayer,
  makeRosterEntry,
  makeScheduleEntry,
  makeScheduleSlot,
  makeTeam,
  makeTeamIdentity,
  makeTeamStrategyProfile,
} from "./_fixtures/game-entity-fixtures";

function minimalStrategyProfile(teamId: string, bias: Record<string, number>) {
  return makeTeamStrategyProfile(teamId, {
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
  });
}

function defaultDisciplineSchedule() {
  return [
    makeScheduleEntry({
      seasonId: "season-2",
      matchdayId: "md-1",
      discipline1: makeScheduleSlot({ disciplineId: "d1", playerCount: 4 }),
      discipline2: makeScheduleSlot({ disciplineId: "d2", playerCount: 4 }),
    }),
  ];
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
      disciplineSchedule: defaultDisciplineSchedule(),
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [makeTeam({ teamId: "C-S", cash: 180 })],
    teamIdentities: [
      makeTeamIdentity({
        teamId: "C-S",
        playerMin: 10,
        playerOpt: 12,
        finances: 9.5,
        ambition: 7,
      }),
    ],
    rosters: Array.from({ length: 10 }, (_, index) =>
      makeRosterEntry({
        id: `r-cs-${index}`,
        teamId: "C-S",
        playerId: `p-cs-${index}`,
        salary: 4.8,
      }),
    ),
    players: Array.from({ length: 10 }, (_, index) =>
      makePlayer({
        id: `p-cs-${index}`,
        name: `P${index}`,
        marketValue: 15,
        displayMarketValue: 15,
        rating: 55,
        salaryDemand: 4.8,
      }),
    ),
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
        disciplineSchedule: defaultDisciplineSchedule(),
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
        disciplineSchedule: defaultDisciplineSchedule(),
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
      teams: [makeTeam({ teamId: "C-S", cash: 20 })],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        disciplineSchedule: defaultDisciplineSchedule(),
      },
    });
    expect(getTeamPlannerRosterTarget(gameState, "C-S")).toBe(12);
  });

  it("lowers planner target by one only after opt is reached and cash is tight", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "C-S", cash: 8 })],
      rosters: Array.from({ length: 12 }, (_, index) =>
        makeRosterEntry({
          id: `r-cs-${index}`,
          teamId: "C-S",
          playerId: `p-cs-${index}`,
          salary: 4.8,
        }),
      ),
      players: Array.from({ length: 12 }, (_, index) =>
        makePlayer({
          id: `p-cs-${index}`,
          name: `P${index}`,
          marketValue: 15,
          displayMarketValue: 15,
          rating: 55,
          salaryDemand: 4.8,
        }),
      ),
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 8, valuePriority: 8, wageSensitivity: 8 }),
        },
        disciplineSchedule: defaultDisciplineSchedule(),
      },
    });
    expect(getTeamPlannerRosterTarget(gameState, "C-S")).toBe(11);
  });

  it("zeros market planner cash buffer while roster is below Opt", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "C-S", cash: 45 })],
      rosters: Array.from({ length: 5 }, (_, index) =>
        makeRosterEntry({
          id: `r-cs-${index}`,
          teamId: "C-S",
          playerId: `p-cs-${index}`,
          salary: 4.8,
        }),
      ),
      players: Array.from({ length: 5 }, (_, index) =>
        makePlayer({
          id: `p-cs-${index}`,
          name: `P${index}`,
          marketValue: 15,
          displayMarketValue: 15,
          rating: 55,
          salaryDemand: 4.8,
        }),
      ),
    });
    expect(isTeamRosterBelowOpt(gameState, "C-S")).toBe(true);
    expect(resolveMarketPlannerCashBuffer(gameState, "C-S")).toBe(0);
    expect(resolveTeamCashRunwayReserve(gameState, "C-S")).toBeGreaterThan(0);
  });

  it("restores market planner cash buffer once roster reaches Opt", () => {
    const gameState = buildGameState({
      teams: [makeTeam({ teamId: "C-S", cash: 45 })],
      rosters: Array.from({ length: 12 }, (_, index) =>
        makeRosterEntry({
          id: `r-cs-${index}`,
          teamId: "C-S",
          playerId: `p-cs-${index}`,
          salary: 4.8,
        }),
      ),
      players: Array.from({ length: 12 }, (_, index) =>
        makePlayer({
          id: `p-cs-${index}`,
          name: `P${index}`,
          marketValue: 15,
          displayMarketValue: 15,
          rating: 55,
          salaryDemand: 4.8,
        }),
      ),
    });
    expect(isTeamRosterBelowOpt(gameState, "C-S")).toBe(false);
    expect(resolveMarketPlannerCashBuffer(gameState, "C-S")).toBeGreaterThan(0);
  });

  it("uses a smaller reserve multiplier for spender profiles", () => {
    const gameState = buildGameState({
      teamIdentities: [makeTeamIdentity({ teamId: "C-S", playerMin: 10, playerOpt: 12, finances: 3, ambition: 8 })],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: {
          "C-S": minimalStrategyProfile("C-S", { cashPriority: 1, starPriority: 9, riskTolerance: 8 }),
        },
        disciplineSchedule: defaultDisciplineSchedule(),
      },
    });
    const projected = projectExpectedSalaryAtPlannerTarget(gameState, "C-S", 12);
    const reserve = resolveTeamCashRunwayReserve(gameState, "C-S", { expectedSalaryAfterPlan: projected });
    expect(resolveHoardMultiplier(gameState, "C-S")).toBeLessThan(0.45);
    expect(reserve).toBeLessThan(projected * 0.55);
  });
});
