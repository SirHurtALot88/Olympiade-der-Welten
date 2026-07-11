import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getAllTeamsBelowMinIds } from "@/lib/season/long-run-canonical";

function seasonOneGameState(rosterCounts: Record<string, number>): GameState {
  const teams = Object.entries(rosterCounts).map(([teamId, _count], index) => ({
    teamId,
    name: `Team ${teamId}`,
    shortCode: teamId.toUpperCase(),
    cash: 100,
    humanControlled: false,
  }));
  const teamIdentities = teams.map((team) => ({
    teamId: team.teamId,
    identityId: team.teamId,
    playerMin: 8,
    playerMax: 14,
    playerOpt: 12,
  }));
  const rosters = Object.entries(rosterCounts).flatMap(([teamId, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `r-${teamId}-${index}`,
      teamId,
      playerId: `p-${teamId}-${index}`,
      slot: index,
    })),
  );
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities,
    rosters,
    players: [],
    transferHistory: [],
  } as GameState;
}

describe("S1 draft policy (no bonus picks)", () => {
  it("does not treat below-opt teams as hard-min repair targets", () => {
    const gameState = seasonOneGameState({ "t-a": 10, "t-b": 12 });
    expect(getAllTeamsBelowMinIds(gameState)).toEqual([]);
  });

  it("only flags teams below playerMin for S1-end repair", () => {
    const gameState = seasonOneGameState({ "t-a": 7, "t-b": 11 });
    expect(getAllTeamsBelowMinIds(gameState)).toEqual(["t-a"]);
  });
});
