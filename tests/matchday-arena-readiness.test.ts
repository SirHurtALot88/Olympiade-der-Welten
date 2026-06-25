import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  getMatchdayArenaReadiness,
  mergeFormCardPlansIntoGameState,
} from "@/lib/foundation/matchday-arena-readiness";

function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-1", matchdayIds: ["season-1-md-1"], currentMatchday: 1 },
    matchdayState: { matchdayId: "season-1-md-1", status: "open", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "H-R", name: "H-R", shortCode: "HR", cash: 1000, humanControlled: true }],
    rosters: [{ teamId: "H-R", playerId: "p-1", activePlayerId: "r-1" }],
    players: [{ playerId: "p-1", name: "Player 1", teamId: "H-R" }],
    gamePhase: "season_active",
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          discipline1: { disciplineId: "d1", playerCount: 1 },
          discipline2: null,
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
    ...overrides,
  } as GameState;
}

describe("matchday-arena-readiness", () => {
  it("blocks arena when lineup is submitted but side counts are incomplete", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
        disciplineSchedule: [
          {
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            discipline1: { disciplineId: "d1", playerCount: 4 },
            discipline2: { disciplineId: "d2", playerCount: 6 },
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
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 1, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 2, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 3, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 1, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 2, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 3, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 4, playerId: "p-1", activePlayerId: "r-1" },
            ],
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBe("incomplete_lineup");
    expect(readiness.openLineupSlots).toBe(1);
    expect(readiness.lineupSubmitted).toBe(true);
    expect(readiness.isReady).toBe(false);
  });

  it("blocks arena when lineup is complete but not submitted", () => {
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
            status: "draft",
            entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }],
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBe("lineup_not_submitted");
    expect(readiness.isReady).toBe(false);
  });

  it("opens arena when form card plans are stored but lineup modifiers are empty", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
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
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBeNull();
    expect(readiness.isReady).toBe(true);
  });

  it("does not require form cards when lineup is still incomplete", () => {
    const state = gameState({
      seasonState: {
        ...gameState().seasonState,
        formCards: [],
        lineupDrafts: [],
      },
    });

    const readiness = getMatchdayArenaReadiness(state, "H-R");
    expect(readiness.blocker).toBe("missing_lineup");
    expect(readiness.formCardsRequired).toBe(false);
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
    expect(merged.seasonState.formCardPlans?.some((plan) => plan.teamId === "H-R" && plan.primaryFormCardId === "card-1")).toBe(true);
    expect(merged.seasonState.formCardPlans?.some((plan) => plan.teamId === "OTHER")).toBe(true);
  });
});
