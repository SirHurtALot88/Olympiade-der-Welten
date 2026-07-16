import type { GameState, SeasonSnapshotRecord, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

/**
 * Defensive season-clamping for career/history builders.
 *
 * Season snapshots and transfer history live in the save and can, in some
 * contaminated/leftover saves, contain rows for seasons that are NEWER than the
 * live season (e.g. a fresh Season-1 save that still carries a Season-3
 * snapshot). Those future rows must never surface in any career/history table.
 *
 * The comparison is by the canonical season number (the trailing `season-<n>`
 * index, matching {@link getCanonicalSeasonLabel}). It is intentionally
 * conservative: when either side's season number can't be parsed we KEEP the
 * row rather than risk dropping legitimate data.
 */

type SeasonIdentity = {
  seasonId?: string | null;
  seasonName?: string | null;
};

export function extractSeasonNumber(input: SeasonIdentity): number | null {
  const idMatch = String(input.seasonId ?? "").match(/season-(\d+)/i);
  if (idMatch) {
    return Number(idMatch[1]);
  }
  const nameMatch = String(input.seasonName ?? "").match(/\bseason\s+(\d+)\b/i);
  if (nameMatch) {
    return Number(nameMatch[1]);
  }
  return null;
}

/** The live season's canonical number, derived from `gameState.season`. */
export function getCurrentSeasonNumber(gameState: GameState): number | null {
  return extractSeasonNumber({ seasonId: gameState.season?.id, seasonName: gameState.season?.name });
}

/**
 * True when `season` is strictly newer (in the future) than the live season.
 * Returns false when either season number is unknown (fail-open, keep the row).
 */
export function isFutureSeasonRelativeToCurrent(gameState: GameState, season: SeasonIdentity): boolean {
  const current = getCurrentSeasonNumber(gameState);
  if (current == null) {
    return false;
  }
  const target = extractSeasonNumber(season);
  if (target == null) {
    return false;
  }
  return target > current;
}

/**
 * Season snapshots with any future-season snapshot dropped. Defaults to the
 * save's `seasonState.seasonSnapshots` but accepts an explicit array so callers
 * can clamp a pre-collected list.
 */
export function clampSeasonSnapshotsToCurrentSeason(
  gameState: GameState,
  snapshots: readonly SeasonSnapshotRecord[] | null | undefined = gameState.seasonState?.seasonSnapshots,
): SeasonSnapshotRecord[] {
  return (snapshots ?? []).filter(
    (snapshot) =>
      !isFutureSeasonRelativeToCurrent(gameState, {
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
      }),
  );
}

/**
 * Transfer history with any future-season transfer dropped. Defaults to the
 * save's `transferHistory` but accepts an explicit array.
 */
export function clampTransferHistoryToCurrentSeason(
  gameState: GameState,
  transfers: readonly TransferHistoryEntry[] | null | undefined = gameState.transferHistory,
): TransferHistoryEntry[] {
  return (transfers ?? []).filter(
    (transfer) =>
      !isFutureSeasonRelativeToCurrent(gameState, {
        seasonId: transfer.seasonId,
        seasonName: transfer.seasonLabel,
      }),
  );
}
