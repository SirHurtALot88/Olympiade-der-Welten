import rawPlayerStats from "@/data/generated/oly-player-stats.json";
import { attachPlayerPortraitPath } from "@/lib/data/mediaAssets";
import { normalizePlayerOvr } from "@/lib/data/player-ovr-scale";
import { hydratePlayerWithAttributeSheet } from "@/lib/data/playerAttributeSheetData";
import { repairImportedPlayerData } from "@/lib/data/playerImportRepairs";
import type { Player } from "@/lib/data/olyDataTypes";
import { getPlayerImportedRatingPps } from "@/lib/foundation/player-rating-contract";

type RawPlayerStat = Player;

export function enrichPlayerDerivedStats(player: Player): Player {
  return {
    ...player,
    // Imported player catalog keeps its own rating PPs for draft/scouting use.
    // Season PPs are derived separately from stored results via the player rating contract.
    pps: getPlayerImportedRatingPps(player),
    ovr: normalizePlayerOvr(player.rating),
  };
}

export function loadImportedPlayerStats(): Player[] {
  return repairImportedPlayerData(
    structuredClone(rawPlayerStats as RawPlayerStat[])
      .map(hydratePlayerWithAttributeSheet),
  )
    .map(attachPlayerPortraitPath)
    .map(enrichPlayerDerivedStats);
}

export function selectImportedPlayers(limit: number, offset = 0): Player[] {
  return loadImportedPlayerStats().slice(offset, offset + limit);
}
