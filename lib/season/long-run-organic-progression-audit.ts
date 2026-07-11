import type { GameState, PlayerProgressionSpendEventRecord } from "@/lib/data/olyDataTypes";

/** Liga-Δ Ø pro Spieler: min −0.4 (max. Regression), max +0.4 (max. Wachstum). */
export const ORGANIC_LEAGUE_NET_AVG_MIN = -0.4;
export const ORGANIC_LEAGUE_NET_AVG_MAX = 0.4;
export const ORGANIC_PEAK_NET_MIN = 4.5;
export const ORGANIC_PEAK_NET_MAX = 8;

export type SeasonOrganicProgressionMetrics = {
  seasonId: string;
  leagueNetDelta: number;
  leagueNetAverage: number;
  playerCount: number;
  top10NetValues: number[];
  peakP90: number;
  peakMedianTop10: number;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function computeNetSetpointsFromEvent(event: PlayerProgressionSpendEventRecord): number {
  const fromMeta = event.organicMeta?.netSetpoints;
  if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) {
    return fromMeta;
  }
  return (event.upgrades ?? [])
    .filter((upgrade) => upgrade.source === "organic_season_progression" || upgrade.source !== "manual_xp_spend_preview")
    .filter((upgrade) => upgrade.source !== "manual_xp_spend_preview")
    .reduce((sum, upgrade) => sum + (upgrade.toValue - upgrade.fromValue), 0);
}

export function computeSeasonOrganicProgressionMetrics(
  gameState: GameState,
  seasonId: string,
): SeasonOrganicProgressionMetrics {
  const organicEvents = (gameState.playerProgressionEvents ?? []).filter(
    (event) =>
      event.seasonId === seasonId &&
      (event.source === "organic_season_progression" ||
        (event.upgrades ?? []).some((upgrade) => upgrade.source === "organic_season_progression")),
  );

  const netByPlayer = new Map<string, number>();
  for (const event of organicEvents) {
    const net = computeNetSetpointsFromEvent(event);
    netByPlayer.set(event.playerId, (netByPlayer.get(event.playerId) ?? 0) + net);
  }

  const netValues = [...netByPlayer.values()];
  const leagueNetDelta = round(netValues.reduce((sum, value) => sum + value, 0));
  const leagueNetAverage = netValues.length > 0 ? round(leagueNetDelta / netValues.length, 3) : 0;
  const sortedDesc = [...netValues].sort((left, right) => right - left);
  const top10 = sortedDesc.slice(0, 10);
  const peakCandidates = top10.filter((value) => value > 0);
  const peakSample = peakCandidates.length > 0 ? peakCandidates : top10;
  const peakSortedAsc = [...peakSample].sort((left, right) => left - right);
  const peakMedianTop10 =
    top10.length > 0 ? round(top10.reduce((sum, value) => sum + value, 0) / top10.length) : 0;
  const peakP90 =
    peakSortedAsc.length > 0
      ? round(peakSortedAsc[Math.min(peakSortedAsc.length - 1, Math.ceil(peakSortedAsc.length * 0.9) - 1)]!)
      : 0;

  return {
    seasonId,
    leagueNetDelta,
    leagueNetAverage,
    playerCount: netByPlayer.size,
    top10NetValues: top10.map((value) => round(value)),
    peakP90,
    peakMedianTop10,
  };
}

export function isPeakNetOutsideCorridor(peakP90: number, playerCount: number) {
  if (playerCount < 5) return false;
  return peakP90 < ORGANIC_PEAK_NET_MIN || peakP90 > ORGANIC_PEAK_NET_MAX;
}

export function isLeagueNetDeltaOutsideCorridor(leagueNetAverage: number, playerCount: number) {
  if (playerCount < 10) return false;
  return leagueNetAverage < ORGANIC_LEAGUE_NET_AVG_MIN || leagueNetAverage > ORGANIC_LEAGUE_NET_AVG_MAX;
}

export function computeOrganicTrainingScaleFactor(peakP90: number) {
  const target = (ORGANIC_PEAK_NET_MIN + ORGANIC_PEAK_NET_MAX) / 2;
  if (peakP90 <= 0) return 1.15;
  return round(Math.min(1.25, Math.max(0.85, target / peakP90)), 3);
}

/** Scale >1 increases organic regression when league net average is too high. */
export function computeOrganicRegressionScaleFactor(leagueNetAverage: number) {
  if (leagueNetAverage > ORGANIC_LEAGUE_NET_AVG_MAX) {
    return round(Math.min(1.15, Math.max(1.03, leagueNetAverage / ORGANIC_LEAGUE_NET_AVG_MAX)), 3);
  }
  if (leagueNetAverage < ORGANIC_LEAGUE_NET_AVG_MIN) {
    const ratio = leagueNetAverage / ORGANIC_LEAGUE_NET_AVG_MIN;
    return round(Math.max(0.85, Math.min(0.98, ratio || 0.85)), 3);
  }
  return 1;
}
