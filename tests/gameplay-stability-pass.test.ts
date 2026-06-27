import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import { getMatchdayArenaReadiness } from "@/lib/foundation/matchday-arena-readiness";

describe("gameplay stability pass", () => {
  it("treats skipped form card selections as arena-ready when the pool exists", () => {
    const gameState = {
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
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    } as GameState;

    expect(getFormCardFlowStatus(gameState, "H-R")).toMatchObject({
      hasPool: true,
      hasSelections: false,
      skipped: true,
      isReady: true,
      blocker: null,
    });
    expect(getMatchdayArenaReadiness(gameState, "H-R").isReady).toBe(true);
  });
});
