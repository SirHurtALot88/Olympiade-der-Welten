import type { GameState, ScoutingWatchlistEntry } from "@/lib/data/olyDataTypes";
import { refreshScoutPipeline } from "@/lib/scouting/facility-scout-pipeline-service";

export function getScoutingWatchlistForTeam(gameState: GameState, teamId: string) {
  const seasonId = gameState.season.id;
  return (gameState.seasonState.scoutingWatchlist ?? []).filter(
    (entry) => entry.teamId === teamId && entry.seasonId === seasonId,
  );
}

export function addScoutingWatchlistEntry(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  note?: string | null;
}): GameState {
  const seasonId = input.gameState.season.id;
  const existing = getScoutingWatchlistForTeam(input.gameState, input.teamId);
  if (existing.some((entry) => entry.playerId === input.playerId)) {
    return input.gameState;
  }
  const entry: ScoutingWatchlistEntry = {
    playerId: input.playerId,
    teamId: input.teamId,
    seasonId,
    addedAt: new Date().toISOString(),
    source: "manual_scouting_hub",
    note: input.note ?? null,
  };
  const withWatchlist = {
    ...input.gameState,
    seasonState: {
      ...input.gameState.seasonState,
      scoutingWatchlist: [entry, ...(input.gameState.seasonState.scoutingWatchlist ?? [])],
    },
  };
  return refreshScoutPipeline(withWatchlist, input.teamId);
}

export function removeScoutingWatchlistEntry(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
}): GameState {
  const seasonId = input.gameState.season.id;
  const filtered = (input.gameState.seasonState.scoutingWatchlist ?? []).filter(
    (entry) =>
      !(
        entry.teamId === input.teamId &&
        entry.seasonId === seasonId &&
        entry.playerId === input.playerId
      ),
  );
  const withoutWatchlist = {
    ...input.gameState,
    seasonState: {
      ...input.gameState.seasonState,
      scoutingWatchlist: filtered,
    },
  };
  return refreshScoutPipeline(withoutWatchlist, input.teamId);
}

export function syncWishlistToScoutingWatchlist(gameState: GameState, teamId: string): GameState {
  const seasonId = gameState.season.id;
  const wishlist = (gameState.seasonState.transferWishlist ?? []).filter((entry) => entry.teamId === teamId);
  let next = gameState;
  for (const entry of wishlist) {
    next = addScoutingWatchlistEntry({
      gameState: next,
      teamId,
      playerId: entry.playerId,
      note: "Wishlist",
    });
  }
  const mirrored = (next.seasonState.scoutingWatchlist ?? []).map((entry) =>
    entry.teamId === teamId && wishlist.some((wish) => wish.playerId === entry.playerId)
      ? { ...entry, source: "transfer_wishlist_mirror" as const }
      : entry,
  );
  return {
    ...next,
    seasonState: {
      ...next.seasonState,
      scoutingWatchlist: mirrored,
    },
  };
}
