import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry, ScoutingWatchlistEntry } from "@/lib/data/olyDataTypes";
import { getScoutingWatchlistForTeam } from "@/lib/scouting/scouting-watchlist-service";

function entry(playerId: string, teamId = "C-C", seasonId = "season-1"): ScoutingWatchlistEntry {
  return { playerId, teamId, seasonId, addedAt: "2026-07-27T00:00:00.000Z", source: "manual_scouting_hub", note: null };
}

function roster(playerId: string, teamId: string): RosterEntry {
  return {
    id: `r-${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary: 3,
    upkeep: 3,
    roleTag: "starter",
    joinedSeasonId: "season-1",
  };
}

function state(input: { watchlist: ScoutingWatchlistEntry[]; rosters: RosterEntry[] }): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, scoutingWatchlist: input.watchlist },
    rosters: input.rosters,
  } as unknown as GameState;
}

/**
 * Die Watchlist ist eine Liste von TRANSFERZIELEN. Regression: gefiltert wurde
 * nur nach Team und Saison, ein gekaufter Spieler blieb also dauerhaft als Ziel
 * stehen — reproduziert mit einem echten Kauf gegen einen frischen Spielstand.
 */
describe("scouting watchlist", () => {
  it("drops a player once he is on any roster", () => {
    const gameState = state({
      watchlist: [entry("p-bought"), entry("p-free")],
      rosters: [roster("p-bought", "C-C")],
    });

    expect(getScoutingWatchlistForTeam(gameState, "C-C").map((row) => row.playerId)).toEqual(["p-free"]);
  });

  it("also drops a player another team signed away", () => {
    // Ein von der Konkurrenz weggeschnappter Spieler ist ebenso wenig ein Ziel.
    const gameState = state({
      watchlist: [entry("p-taken")],
      rosters: [roster("p-taken", "M-M")],
    });

    expect(getScoutingWatchlistForTeam(gameState, "C-C")).toEqual([]);
  });

  it("keeps the entry so the player returns as a target when his roster spot ends", () => {
    // Nicht löschen, nur ausblenden: ohne Kadereintrag ist er wieder sichtbar.
    const watchlist = [entry("p-bought")];
    expect(getScoutingWatchlistForTeam(state({ watchlist, rosters: [roster("p-bought", "C-C")] }), "C-C")).toEqual([]);
    expect(
      getScoutingWatchlistForTeam(state({ watchlist, rosters: [] }), "C-C").map((row) => row.playerId),
    ).toEqual(["p-bought"]);
  });

  it("still scopes to the asking team and the running season", () => {
    const gameState = state({
      watchlist: [entry("p-a", "C-C"), entry("p-b", "M-M"), entry("p-c", "C-C", "season-0")],
      rosters: [],
    });

    expect(getScoutingWatchlistForTeam(gameState, "C-C").map((row) => row.playerId)).toEqual(["p-a"]);
  });
});
