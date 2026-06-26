import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getMatchdayArenaReadiness,
  mergeFormCardPlansIntoGameState,
} from "@/lib/foundation/matchday-arena-readiness";
import {
  isTeamAllRosterPlayersDeployedInLineup,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
} from "@/lib/foundation/matchday-lineup-readiness";

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1", matchdayIds: ["season-1-md-1"], currentMatchday: 1 },
    matchdayState: { matchdayId: "season-1-md-1", status: "open", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "H-R", name: "H-R", shortCode: "HR", cash: 1000, humanControlled: true }],
    rosters: [
      { teamId: "H-R", playerId: "p-1", activePlayerId: "r-1" },
      { teamId: "H-R", playerId: "p-2", activePlayerId: "r-2" },
      { teamId: "H-R", playerId: "p-3", activePlayerId: "r-3" },
    ],
    players: [
      { playerId: "p-1", name: "Player 1", teamId: "H-R" },
      { playerId: "p-2", name: "Player 2", teamId: "H-R" },
      { playerId: "p-3", name: "Player 3", teamId: "H-R" },
    ],
    gamePhase: "season_active",
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          discipline1: { disciplineId: "d1", playerCount: 2 },
          discipline2: { disciplineId: "d2", playerCount: 2 },
        },
      ],
      formCards: [
        {
          id: "card-1",
          saveId: "save-1",
          seasonId: "season-1",
          teamId: "H-R",
          playerId: "p-1",
          playerName: "Player 1",
          cardColor: "red",
          cardValue: 4,
          createdAt: "2026-06-12T00:00:00.000Z",
        },
      ],
      lineupDrafts: [],
    },
    ...overrides,
  } as GameState;
}

describe("matchday-arena-readiness", () => {
  it("allows arena when all roster players are deployed even with open slots", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-1",
            teamId: "H-R",
            playerId: "p-1",
            playerName: "Player 1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        formCardPlans: [
          {
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            disciplineSide: "d1",
            disciplineId: "d1",
            primaryFormCardId: "card-1",
            secondaryFormCardId: null,
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            status: "submitted",
            entries: [
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 1, playerId: "p-2", activePlayerId: "r-2" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 0, playerId: "p-3", activePlayerId: "r-3" },
            ],
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    expect(isTeamMatchdayLineupComplete(state, "H-R")).toBe(false);
    expect(isTeamAllRosterPlayersDeployedInLineup(state, "H-R")).toBe(true);
    expect(isTeamMatchdayLineupOperationallyReady(state, "H-R")).toBe(true);

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBeNull();
    expect(readiness.isReady).toBe(true);
    expect(readiness.openLineupSlots).toBe(1);
  });

  it("blocks arena when slots are open and roster players remain unused", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            status: "submitted",
            entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }],
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBe("incomplete_lineup");
    expect(readiness.isReady).toBe(false);
  });

  it("blocks arena when lineup is complete but not submitted", () => {
    const flow = gameState({
      seasonState: {
        ...gameState().seasonState,
        formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-1", teamId: "H-R", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            status: "draft",
            entries: [
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 1, playerId: "p-2", activePlayerId: "r-2" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 0, playerId: "p-3", activePlayerId: "r-3" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 1, playerId: "p-1", activePlayerId: "r-1" },
            ],
            modifiers: {
              d1: { primaryFormCardId: "card-1", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null },
              d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null },
            },
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    const readiness = getMatchdayArenaReadiness(flow, "H-R");
    expect(readiness.blocker).toBe("lineup_not_submitted");
  });

  it("opens arena once lineup and form cards are ready", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
        formCards: [{ id: "card-1", saveId: "save-1", seasonId: "season-1", teamId: "H-R", playerId: "p-1", playerName: "p-1", cardColor: "red", cardValue: 1, createdAt: "2026-06-12T00:00:00.000Z" }],
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            status: "submitted",
            entries: [
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 1, playerId: "p-2", activePlayerId: "r-2" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 0, playerId: "p-3", activePlayerId: "r-3" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 1, playerId: "p-1", activePlayerId: "r-1" },
            ],
            modifiers: {
              d1: { primaryFormCardId: "card-1", secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null },
              d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null, intensity: "normal", teamPowerId: null },
            },
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.isReady).toBe(true);
  });

  it("merges form card plans for the active team without dropping other teams", () => {
    const merged = mergeFormCardPlansIntoGameState(
      gameState({
        seasonState: {
          ...gameState().seasonState,
          formCardPlans: [
            {
              saveId: "save-1",
              seasonId: "season-1",
              matchdayId: "season-1-md-1",
              teamId: "OTHER",
              disciplineSide: "d1",
              disciplineId: "d1",
              primaryFormCardId: "card-x",
              secondaryFormCardId: null,
              createdAt: "2026-06-12T00:00:00.000Z",
              updatedAt: "2026-06-12T00:00:00.000Z",
            },
          ],
        },
      }),
      [
        {
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          teamId: "H-R",
          disciplineSide: "d1",
          disciplineId: "d1",
          primaryFormCardId: "card-1",
          secondaryFormCardId: null,
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
        },
      ],
      { seasonId: "season-1", teamId: "H-R" },
    );

    expect(merged.seasonState.formCardPlans).toHaveLength(2);
  });
});
