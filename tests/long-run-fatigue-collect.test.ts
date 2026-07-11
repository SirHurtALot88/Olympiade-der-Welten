import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildPlayerAvailabilityByPlayerId,
  collectTeamFatigueInjuryMetrics,
  countSeasonInjuryEvents,
  listNonRosterAvailabilityEntries,
} from "@/lib/season/long-run-fatigue-collect";

function minimalGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-1", name: "S1", currentMatchday: 10, matchdayIds: ["md1"] },
    teams: [{ teamId: "t1", shortCode: "G-G", name: "G-G", budget: 310, cash: 50, rosterLimit: 32, humanControlled: false }],
    teamIdentities: [{ teamId: "t1", playerMin: 8, playerOpt: 12 }],
    players: [
      { id: "p1", name: "A", gender: "female", race: "human", rating: 40, potential: 50, trainingMode: "mittel", fatigue: 55 },
      { id: "p2", name: "B", gender: "female", race: "human", rating: 38, potential: 48, trainingMode: "mittel", fatigue: 72 },
      { id: "p3", name: "C", gender: "female", race: "human", rating: 36, potential: 46, trainingMode: "mittel", fatigue: 20 },
    ],
    rosters: [
      { id: "r1", teamId: "t1", playerId: "p1", contractLength: 2, salary: 10, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r2", teamId: "t1", playerId: "p2", contractLength: 2, salary: 12, upkeep: 0, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r3", teamId: "t1", playerId: "p3", contractLength: 2, salary: 9, upkeep: 0, roleTag: "depth", joinedSeasonId: "season-1" },
    ],
    transferHistory: [],
    contracts: [],
    transferListings: [],
    seasonState: {
      playerAvailabilityState: [
        { playerId: "p1", teamId: "t1", fatigue: 55, injuryStatus: "healthy" },
        { playerId: "p2", teamId: "t1", fatigue: 72, injuryStatus: "injured", injuryUntilMatchday: "md2" },
        { playerId: "p99", teamId: "t1", fatigue: 10, injuryStatus: "recovering" },
      ],
      injuryEvents: [
        {
          eventId: "e1",
          seasonId: "season-1",
          matchdayId: "md1",
          teamId: "t1",
          playerId: "p2",
          fatigueBefore: 70,
          riskPercent: 12,
          roll: 3,
          result: "injured",
          unavailableForMatchdays: 1,
          source: "fatigue_injury_risk_v1",
        },
      ],
    },
    matchdayState: { matchdayId: "md1" },
    ...overrides,
  } as unknown as GameState;
}

describe("long-run fatigue collect", () => {
  it("reads playerAvailabilityState array instead of map keys", () => {
    const gameState = minimalGameState();
    const team = gameState.teams[0]!;
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const playerById = new Map(gameState.players.map((player) => [player.id, player]));
    const metrics = collectTeamFatigueInjuryMetrics({
      gameState,
      team,
      roster,
      playerById,
      seasonId: "season-1",
      availabilityByPlayerId: buildPlayerAvailabilityByPlayerId(gameState),
    });

    expect(metrics.injuredNow).toBe(1);
    expect(metrics.recoveringNow).toBe(0);
    expect(metrics.injuries).toBe(1);
    expect(metrics.injuryEventsSeason).toBe(1);
    expect(metrics.fatigue70Plus).toBe(1);
    expect(metrics.fatigueMax).toBeGreaterThanOrEqual(72);
  });

  it("counts league injury events for season", () => {
    const gameState = minimalGameState();
    expect(countSeasonInjuryEvents(gameState, "season-1")).toBe(1);
    expect(countSeasonInjuryEvents(gameState, "season-2")).toBe(0);
  });

  it("lists availability entries for non-rostered players", () => {
    const gameState = minimalGameState();
    expect(listNonRosterAvailabilityEntries(gameState).map((entry) => entry.playerId)).toEqual(["p99"]);
  });
});
