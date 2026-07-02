import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getAllTeamsBelowMinIds, resolveEmergencyRepairTeamIds } from "@/lib/season/long-run-canonical";

function buildGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: { "team-a": { seasonStrategy: "roster_repair" } },
      disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 100, humanControlled: false },
      { teamId: "team-b", name: "Team B", shortCode: "TMB", cash: 100, humanControlled: false },
    ],
    teamIdentities: [
      { teamId: "team-a", identityId: "team-a", playerMin: 8, playerMax: 14, playerOpt: 10 },
      { teamId: "team-b", identityId: "team-b", playerMin: 8, playerMax: 14, playerOpt: 10 },
    ],
    rosters: [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: `r-a-${index}`,
        teamId: "team-a",
        playerId: `p-a-${index}`,
        slot: index,
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `r-b-${index}`,
        teamId: "team-b",
        playerId: `p-b-${index}`,
        slot: index,
      })),
    ],
    players: [],
    transferHistory: [],
    ...overrides,
  } as GameState;
}

describe("resolveEmergencyRepairTeamIds", () => {
  it("always includes hardMin teams and planner-delegated coverage-risk teams", () => {
    const gameState = buildGameState();
    expect(getAllTeamsBelowMinIds(gameState)).toEqual(["team-a"]);
    expect(resolveEmergencyRepairTeamIds(gameState, ["team-c"])).toEqual(["team-a", "team-c"]);
    expect(resolveEmergencyRepairTeamIds(gameState, [])).toEqual(["team-a"]);
  });

  it("does not include coverage-risk teams unless planner-delegated", () => {
    const gameState = buildGameState({
      rosters: [
        ...Array.from({ length: 9 }, (_, index) => ({
          id: `r-a-${index}`,
          teamId: "team-a",
          playerId: `p-a-${index}`,
          slot: index,
        })),
        ...Array.from({ length: 10 }, (_, index) => ({
          id: `r-b-${index}`,
          teamId: "team-b",
          playerId: `p-b-${index}`,
          slot: index,
        })),
      ],
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        teamControlSettings: {},
        teamStrategyProfiles: { "team-a": { seasonStrategy: "roster_repair" } },
        disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
      },
    });
    expect(getAllTeamsBelowMinIds(gameState)).toEqual([]);
    expect(resolveEmergencyRepairTeamIds(gameState, [])).toEqual([]);
    expect(resolveEmergencyRepairTeamIds(gameState, ["team-a"])).toEqual(["team-a"]);
  });
});
