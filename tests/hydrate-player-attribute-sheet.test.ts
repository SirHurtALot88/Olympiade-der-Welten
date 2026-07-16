import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  gameStateNeedsPlayerAttributeSheetHydration,
  mergePlayerAttributeSheetIntoGameState,
} from "@/lib/foundation/hydrate-player-attribute-sheet";

function createGameState(playerId: string, withStats: boolean): GameState {
  return {
    season: { id: "season-1", name: "Season 1", currentMatchday: 1, totalMatchdays: 10, isCompleted: false },
    seasonState: { seasonId: "season-1", schedule: [], standings: {} },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
    teamIdentities: [],
    players: [
      {
        id: playerId,
        name: "Test Player",
        attributeSheetStats: withStats
          ? {
              power: 44,
              health: 50,
              stamina: 50,
              intelligence: 50,
              awareness: 50,
              determination: 50,
              speed: 50,
              dexterity: 50,
              charisma: 50,
              will: 50,
              spirit: 50,
              torment: 50,
            }
          : undefined,
      },
    ],
    disciplines: [],
    rosters: [],
    transferHistory: [],
  } as unknown as GameState;
}

describe("hydrate-player-attribute-sheet", () => {
  it("detects missing attribute sheets in compact client state", () => {
    expect(gameStateNeedsPlayerAttributeSheetHydration(createGameState("player-1", false), "player-1")).toBe(true);
    expect(gameStateNeedsPlayerAttributeSheetHydration(createGameState("player-1", true), "player-1")).toBe(false);
  });

  it("merges fetched attribute sheets into the in-memory game state", () => {
    const gameState = createGameState("player-1", false);
    const merged = mergePlayerAttributeSheetIntoGameState(gameState, "player-1", {
      attributeSheetStats: {
        power: 33.9,
        health: 42.6,
        stamina: 54,
        intelligence: 79.6,
        awareness: 78.3,
        determination: 45,
        speed: 59.8,
        dexterity: 86,
        charisma: 43.6,
        will: 20.6,
        spirit: 55.9,
        torment: 41.6,
      },
      attributeSheetRatings: {
        powerRating: "D",
      },
    });

    expect(merged.players[0]?.attributeSheetStats?.power).toBe(33.9);
    expect(merged.players[0]?.attributeSheetRatings?.powerRating).toBe("D");
  });
});
