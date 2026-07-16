import rawPlayerStats from "@/data/generated/oly-player-stats.json";
import type { Player } from "@/lib/data/olyDataTypes";

type RawPlayerStat = Player;

const importedRatings = (rawPlayerStats as RawPlayerStat[])
  .map((player) => player.rating)
  .filter((value): value is number => Number.isFinite(value));

const importedRatingMin = importedRatings.length > 0 ? Math.min(...importedRatings) : 0;
const importedRatingMax = importedRatings.length > 0 ? Math.max(...importedRatings) : 100;

export function getImportedPlayerOvrScale() {
  return {
    min: importedRatingMin,
    max: importedRatingMax,
  };
}

export function normalizePlayerOvr(rawOverall: number | null | undefined) {
  if (rawOverall == null || !Number.isFinite(rawOverall)) {
    return null;
  }

  if (importedRatingMax <= importedRatingMin) {
    return 50;
  }

  const normalized = 1 + ((rawOverall - importedRatingMin) / (importedRatingMax - importedRatingMin)) * 99;
  return Math.min(100, Math.max(1, Number(normalized.toFixed(2))));
}

