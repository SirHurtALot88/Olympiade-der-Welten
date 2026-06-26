import type { GameState } from "@/lib/data/olyDataTypes";
import { buildScoutPipelineSummary, getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import { getActiveScoutingWishlistEntries, getTeamTransferWishlistEntries } from "@/lib/scouting/scouting-wishlist-slots";
import { syncWishlistToScoutingWatchlist } from "@/lib/scouting/scouting-watchlist-service";

export type ScoutingHubTargetDraft = {
  playerId: string;
  playerName: string;
  className: string;
  marketValue: string;
  baseInfoSummary: string;
  pow?: number | null;
  spe?: number | null;
  men?: number | null;
  soc?: number | null;
  scoutStatus: "active" | "bookmarked";
  scoutCertainty?: number | null;
  scoutSourceLabel?: string | null;
  scoutMilestone?: string | null;
};

export function getScoutingIntelMilestone(certainty: number) {
  if (certainty < 25) return "Nächster Schritt: Achsen-Band";
  if (certainty < 50) return "Nächster Schritt: Achsen-Sterne";
  if (certainty < 75) return "Nächster Schritt: Potential-Band";
  return "Nächster Schritt: enge Potential-Range";
}

function formatScoutSourceLabel(source: string | null | undefined) {
  if (source === "wishlist_mirror") return "Wishlist";
  if (source === "watchlist") return "Beobachtet";
  if (source === "passive_need") return "Passiv";
  return null;
}

export function buildScoutingHubTargetSections(input: {
  gameState: GameState;
  teamId: string;
  resolveMarketEntry: (playerId: string) => {
    playerName: string;
    className: string;
    marketValue: string;
    pow?: number | null;
    spe?: number | null;
    men?: number | null;
    soc?: number | null;
    salary?: number | null;
  } | null;
}) {
  const syncedState = syncWishlistToScoutingWatchlist(input.gameState, input.teamId);
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const pipeline = buildScoutPipelineSummary(syncedState, input.teamId);
  const activePlayerIds = new Set(pipeline.records.map((record) => record.playerId));
  const certaintyByPlayerId = new Map(pipeline.records.map((record) => [record.playerId, record.certainty] as const));
  const sourceByPlayerId = new Map(pipeline.records.map((record) => [record.playerId, record.source] as const));

  const buildDraft = (playerId: string, scoutStatus: "active" | "bookmarked"): ScoutingHubTargetDraft | null => {
    const player = playerById.get(playerId) ?? null;
    const marketEntry = input.resolveMarketEntry(playerId);
    if (!player && !marketEntry) {
      return null;
    }
    const certainty = certaintyByPlayerId.get(playerId) ?? null;
    return {
      playerId,
      playerName: player?.name ?? marketEntry?.playerName ?? playerId,
      className: player?.className ?? marketEntry?.className ?? "—",
      marketValue: marketEntry?.marketValue ?? (player?.marketValue != null ? String(player.marketValue) : "—"),
      baseInfoSummary:
        scoutStatus === "active"
          ? certainty != null
            ? `Intel ${certainty}%`
            : "In aktiver Pipeline"
          : "Nur gemerkt — kein Scout-Slot",
      pow: player?.coreStats.pow ?? marketEntry?.pow ?? null,
      spe: player?.coreStats.spe ?? marketEntry?.spe ?? null,
      men: player?.coreStats.men ?? marketEntry?.men ?? null,
      soc: player?.coreStats.soc ?? marketEntry?.soc ?? null,
      scoutStatus,
      scoutCertainty: certainty,
      scoutSourceLabel: formatScoutSourceLabel(sourceByPlayerId.get(playerId)),
      scoutMilestone: certainty != null ? getScoutingIntelMilestone(certainty) : null,
    };
  };

  const activeTargets = pipeline.records
    .map((record) => buildDraft(record.playerId, "active"))
    .filter((entry): entry is ScoutingHubTargetDraft => Boolean(entry));

  const activeWishlistIds = new Set(getActiveScoutingWishlistEntries(syncedState, input.teamId).map((entry) => entry.playerId));
  const bookmarkedTargets = getTeamTransferWishlistEntries(syncedState, input.teamId)
    .filter((entry) => !activePlayerIds.has(entry.playerId) && !activeWishlistIds.has(entry.playerId))
    .map((entry) => buildDraft(entry.playerId, "bookmarked"))
    .filter((entry): entry is ScoutingHubTargetDraft => Boolean(entry));

  return {
    syncedState,
    pipeline,
    activeTargets,
    bookmarkedTargets,
    getScoutingLevelForPlayer: (playerId: string, facilityLevel: number) =>
      Math.max(facilityLevel, getEffectiveScoutingLevel(syncedState, input.teamId, playerId)),
  };
}
