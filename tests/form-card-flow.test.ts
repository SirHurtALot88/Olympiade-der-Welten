import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  activeTeamHasFormCardPool,
  activeTeamHasFormCardSelections,
  getFormCardFlowStatus,
} from "@/lib/foundation/form-card-flow";

function gameState(partial?: Partial<GameState>): GameState {
  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-2-md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams: [],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
    ...partial,
  };
}

describe("form card flow", () => {
  it("detects pool and selections separately", () => {
    const state = gameState({
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-2",
            matchdayId: "season-2-md-1",
            teamId: "M-M",
            status: "draft",
            entries: [{ disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" }],
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

    expect(activeTeamHasFormCardPool(state, "M-M")).toBe(true);
    expect(activeTeamHasFormCardSelections(state, "M-M")).toBe(true);
    expect(getFormCardFlowStatus(state, "M-M")).toEqual({
      hasPool: true,
      hasModifierSelections: true,
      hasPlanSelections: false,
      hasSelections: true,
      skipped: false,
      isReady: true,
      blocker: null,
    });
  });

  it("treats current-matchday form plans as ready selections", () => {
    const state = gameState({
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        formCardPlans: [
          {
            matchdayId: "season-2-md-1",
            teamId: "M-M",
            disciplineSide: "d1",
            disciplineId: "d1-id",
            primaryFormCardId: "card-1",
            secondaryFormCardId: null,
          },
        ],
      },
    });

    expect(getFormCardFlowStatus(state, "M-M")).toMatchObject({
      hasPlanSelections: true,
      hasSelections: true,
      isReady: true,
      blocker: null,
    });
  });

  it("allows skipping selections when only the pool exists", () => {
    const state = gameState({
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });

    expect(getFormCardFlowStatus(state, "M-M")).toMatchObject({
      hasPool: true,
      hasSelections: false,
      skipped: true,
      isReady: true,
      blocker: null,
    });
  });
});
