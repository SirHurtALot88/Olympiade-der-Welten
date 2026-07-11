import type { GameState, ScoutingWatchlistEntry } from "@/lib/data/olyDataTypes";
import { refreshScoutPipeline } from "@/lib/scouting/facility-scout-pipeline-service";
import {
  canAddManualScoutingWatchEntry,
  getActiveScoutingWishlistEntries,
  getScoutingWishlistSlotMessage,
} from "@/lib/scouting/scouting-wishlist-slots";

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
  const slotCheck = canAddManualScoutingWatchEntry(input.gameState, input.teamId);
  if (!slotCheck.ok) {
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
  const activeWishlist = getActiveScoutingWishlistEntries(gameState, teamId);
  const activeWishlistIds = new Set(activeWishlist.map((entry) => entry.playerId));
  const existing = (gameState.seasonState.scoutingWatchlist ?? []).filter(
    (entry) => !(entry.teamId === teamId && entry.seasonId === seasonId && entry.source === "transfer_wishlist_mirror"),
  );
  const mirrored: ScoutingWatchlistEntry[] = activeWishlist.map((entry) => ({
    playerId: entry.playerId,
    teamId,
    seasonId,
    addedAt: entry.createdAt,
    source: "transfer_wishlist_mirror",
    note: "Wishlist",
  }));
  const manualEntries = existing.filter(
    (entry) => entry.teamId === teamId && entry.seasonId === seasonId && entry.source !== "transfer_wishlist_mirror",
  );
  const otherEntries = existing.filter((entry) => entry.teamId !== teamId || entry.seasonId !== seasonId);
  const dedupedManual = manualEntries.filter((entry) => !activeWishlistIds.has(entry.playerId));
  return refreshScoutPipeline(
    {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        scoutingWatchlist: [...mirrored, ...dedupedManual, ...otherEntries],
      },
    },
    teamId,
  );
}

export function getScoutingWatchSlotLimitMessage(gameState: GameState, teamId: string) {
  return getScoutingWishlistSlotMessage(canAddManualScoutingWatchEntry(gameState, teamId));
}
