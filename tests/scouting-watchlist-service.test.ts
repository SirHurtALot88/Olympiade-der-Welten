import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  addScoutingWatchlistEntry,
  getScoutingWatchlistForTeam,
  removeScoutingWatchlistEntry,
  syncWishlistToScoutingWatchlist,
} from "@/lib/scouting/scouting-watchlist-service";

function createGameState(partial?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      transferWishlist: [{ teamId: "M-M", playerId: "p-wish", createdAt: "2026-06-25T00:00:00.000Z" }],
      teamFacilities: {
        "M-M": {
          facilities: {
            scouting_office: { level: 3, enabled: true },
          },
        },
      },
      ...partial?.seasonState,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", cash: 50, rosterLimit: 14, humanControlled: true }],
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-25T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
    },
    disciplines: [],
    ...partial,
  } as GameState;
}

describe("scouting watchlist service", () => {
  it("adds and removes watchlist entries per team and season", () => {
    let gameState = createGameState();
    gameState = addScoutingWatchlistEntry({ gameState, teamId: "M-M", playerId: "p-1", note: "Target" });
    expect(getScoutingWatchlistForTeam(gameState, "M-M")).toHaveLength(1);
    gameState = addScoutingWatchlistEntry({ gameState, teamId: "M-M", playerId: "p-1" });
    expect(getScoutingWatchlistForTeam(gameState, "M-M")).toHaveLength(1);
    gameState = removeScoutingWatchlistEntry({ gameState, teamId: "M-M", playerId: "p-1" });
    expect(getScoutingWatchlistForTeam(gameState, "M-M")).toHaveLength(0);
  });

  it("mirrors transfer wishlist entries into scouting watchlist", () => {
    const synced = syncWishlistToScoutingWatchlist(createGameState(), "M-M");
    const entries = getScoutingWatchlistForTeam(synced, "M-M");
    expect(entries.some((entry) => entry.playerId === "p-wish")).toBe(true);
    expect(entries.find((entry) => entry.playerId === "p-wish")?.source).toBe("transfer_wishlist_mirror");
  });
});
