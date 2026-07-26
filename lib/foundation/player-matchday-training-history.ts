import type {
  GameState,
  Player,
  PlayerGeneratorAttributeName,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import {
  buildOrganicSeasonProgression,
  resolveSeasonTrainingAccumulatorInputs,
} from "@/lib/training/organic-season-progression";
import { resolveSeasonTotalMatchdays } from "@/lib/training/matchday-training-accumulator";

/**
 * Spieltag-genaue Trainings-Historie (Forecast-Verlauf).
 *
 * WICHTIG zur Mechanik: Attribute werden weiterhin NUR am Saisonende real gebucht
 * (`season-end-xp-apply-service` → `attributeSheetStats`). Pro Spieltag wächst lediglich
 * das Trainings-BUDGET (Modus-Zähler in `player.seasonTrainingAccumulator.modeByMatchday`)
 * und der Performance-Anteil (`playerDisciplinePerformances`). Beide sind bereits pro
 * Spieltag persistiert.
 *
 * Diese Funktion REKONSTRUIERT daraus für EINEN Spieler den projizierten Verlauf: für jeden
 * bereits gespielten Spieltag k wird `buildOrganicSeasonProgression` mit einem auf die
 * Spieltage ≤ k beschnittenen Trainings-Budget + Performance-Fenster aufgerufen. Das Ergebnis
 * ist die zu diesem Zeitpunkt PROGNOSTIZIERTE kumulierte Attributänderung. Die marginale
 * Änderung eines Spieltags = Prognose(k) − Prognose(k−1).
 *
 * Rein lesend, keine neue Persistenz, keine Balancing-Änderung. Läuft nur beim Öffnen des
 * Spielers und funktioniert rückwirkend auf bestehende Saves (die Rohdaten liegen ja vor).
 */

export type PlayerMatchdayTrainingAttributeCell = {
  attribute: PlayerGeneratorAttributeName;
  /** Projizierte Änderung dieses Spieltags (ggü. Vorspieltag-Prognose). */
  marginal: number;
  /** Projizierte kumulierte Änderung seit Saisonstart bis zu diesem Spieltag. */
  cumulative: number;
  /** Projizierter Attributwert (Saisonstart-Wert + kumulierte Änderung). */
  projectedValue: number;
};

export type PlayerMatchdayTrainingRow = {
  matchdayId: string;
  /** 1-basierte Position im Saison-Spielplan. */
  matchdayIndex: number;
  matchdayLabel: string;
  trainingMode: PlayerTrainingMode | null;
  /** Summe der marginalen Attributänderungen dieses Spieltags. */
  netMarginal: number;
  /** Summe der kumulierten Attributänderungen bis zu diesem Spieltag. */
  cumulativeNet: number;
  attributes: PlayerMatchdayTrainingAttributeCell[];
};

export type PlayerMatchdayTrainingHistory = {
  /** Neuester Spieltag zuerst. */
  rows: PlayerMatchdayTrainingRow[];
  /** Größter Betrag einer marginalen Änderung über alle Zellen — für die Farb-Intensitäts-Skala. */
  maxAbsMarginal: number;
  seasonId: string;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildPlayerMatchdayTrainingHistory(input: {
  gameState: GameState;
  player: Player;
  facilities?: TeamFacilityCollection | null;
}): PlayerMatchdayTrainingHistory | null {
  const { gameState, player } = input;
  const seasonId = gameState.season.id;
  const accumulator = player.seasonTrainingAccumulator;
  if (!accumulator || accumulator.seasonId !== seasonId) return null;

  const modeByMatchday = accumulator.modeByMatchday ?? {};
  const canonicalOrder = gameState.season.matchdayIds ?? [];
  const orderIndex = new Map<string, number>();
  canonicalOrder.forEach((id, index) => orderIndex.set(id, index));

  const playedMatchdayIds = Object.keys(modeByMatchday)
    .filter((id) => orderIndex.has(id))
    .sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0));
  if (playedMatchdayIds.length === 0) return null;

  const totalMatchdays = resolveSeasonTotalMatchdays(gameState);

  // matchdayResultId → kanonischer Spieltag-Index (zum Beschneiden der Performance auf ≤ k).
  const resultIdToCanonicalIndex = new Map<string, number>();
  for (const result of gameState.seasonState.matchdayResults ?? []) {
    if ((result.seasonId ?? seasonId) !== seasonId) continue;
    const idx = orderIndex.get(result.matchdayId);
    if (idx != null) resultIdToCanonicalIndex.set(result.id, idx);
  }
  const allPerformances = gameState.seasonState.playerDisciplinePerformances ?? [];
  const baseline = player.attributeSheetStats ?? null;

  const rowsOldestFirst: PlayerMatchdayTrainingRow[] = [];
  let previousCumulative: Record<PlayerGeneratorAttributeName, number> | null = null;
  let maxAbsMarginal = 0;

  for (let k = 0; k < playedMatchdayIds.length; k++) {
    const matchdayId = playedMatchdayIds[k];
    const canonicalIndex = orderIndex.get(matchdayId) ?? k;

    // Trainings-Budget aus den Modi der Spieltage 0..k (Nenner bleibt die volle Saisonlänge,
    // daher wächst das Budget spieltagweise) — exakt dieselbe Ableitung wie im Saisonende-Apply.
    const subsetModes: Record<string, PlayerTrainingMode> = {};
    for (let j = 0; j <= k; j++) {
      subsetModes[playedMatchdayIds[j]] = modeByMatchday[playedMatchdayIds[j]];
    }
    const accInputs = resolveSeasonTrainingAccumulatorInputs({
      accumulator: {
        seasonId,
        matchdaysCounted: k + 1,
        modeByMatchday: subsetModes,
        accumulatedTrainingFatigue: 0,
        updatedAt: accumulator.updatedAt,
      },
      seasonId,
      totalMatchdays,
    });

    // Performance-Fenster: nur Records dieses Spielers bis einschließlich Spieltag k. Records
    // anderer Spieler bleiben unangetastet (sie beeinflussen die Prognose dieses Spielers nicht).
    const truncatedPerformances = allPerformances.filter((entry) => {
      if (entry.playerId !== player.id) return true;
      const idx = resultIdToCanonicalIndex.get(entry.matchdayResultId);
      return idx != null && idx <= canonicalIndex;
    });
    const truncatedGameState: GameState = {
      ...gameState,
      seasonState: { ...gameState.seasonState, playerDisciplinePerformances: truncatedPerformances },
    };

    const projection = buildOrganicSeasonProgression({
      gameState: truncatedGameState,
      player,
      facilities: input.facilities ?? undefined,
      accumulatedBaseTrainingBudget: accInputs?.accumulatedBaseTrainingBudget,
      performanceWeightMultiplier: accInputs?.performanceWeightMultiplier,
    });

    const cumulative = Object.fromEntries(
      PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0]),
    ) as Record<PlayerGeneratorAttributeName, number>;
    for (const entry of projection.attributeBreakdown) {
      cumulative[entry.attribute] = entry.delta;
    }

    const cells = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
      const cum = round1(cumulative[attribute]);
      const prev = previousCumulative ? round1(previousCumulative[attribute]) : 0;
      const marginal = round1(cum - prev);
      if (Math.abs(marginal) > maxAbsMarginal) maxAbsMarginal = Math.abs(marginal);
      const baseValue = baseline?.[attribute];
      const projectedValue = typeof baseValue === "number" ? round1(baseValue + cum) : cum;
      return { attribute, marginal, cumulative: cum, projectedValue };
    });

    rowsOldestFirst.push({
      matchdayId,
      matchdayIndex: canonicalIndex + 1,
      matchdayLabel: `MD ${canonicalIndex + 1}`,
      trainingMode: modeByMatchday[matchdayId] ?? null,
      netMarginal: round1(cells.reduce((sum, cell) => sum + cell.marginal, 0)),
      cumulativeNet: round1(cells.reduce((sum, cell) => sum + cell.cumulative, 0)),
      attributes: cells,
    });
    previousCumulative = cumulative;
  }

  rowsOldestFirst.reverse();
  return { rows: rowsOldestFirst, maxAbsMarginal, seasonId };
}
