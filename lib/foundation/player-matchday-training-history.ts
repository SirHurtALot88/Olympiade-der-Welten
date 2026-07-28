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
 * Kumulierte Trainings-Prognose der laufenden Saison (ein Wert pro Attribut, kein Spieltag-Verlauf).
 *
 * WICHTIG zur Mechanik: Attribute werden weiterhin NUR am Saisonende real gebucht
 * (`season-end-xp-apply-service` → `attributeSheetStats`). Bis dahin wächst lediglich das
 * Trainings-BUDGET (Modus-Zähler in `player.seasonTrainingAccumulator.modeByMatchday`) und der
 * Performance-Anteil (`playerDisciplinePerformances`) — beide bereits pro Spieltag persistiert.
 *
 * Diese Funktion projiziert daraus die aktuell PROGNOSTIZIERTE kumulierte Attributänderung seit
 * Saisonstart: `buildOrganicSeasonProgression` wird EINMAL mit dem bis heute gesammelten
 * Trainings-Budget + Performance-Fenster aufgerufen. Rein lesend, keine neue Persistenz, keine
 * Balancing-Änderung. Funktioniert rückwirkend auf bestehende Saves (die Rohdaten liegen vor).
 */

export type PlayerSeasonTrainingForecastCell = {
  attribute: PlayerGeneratorAttributeName;
  /** Projizierte kumulierte Änderung seit Saisonstart. */
  cumulative: number;
  /** Projizierter Attributwert (Saisonstart-Wert + kumulierte Änderung). */
  projectedValue: number;
};

export type PlayerSeasonTrainingForecast = {
  seasonId: string;
  /** Anzahl bereits ins Trainings-Budget eingeflossener Spieltage. */
  matchdaysPlayed: number;
  /** Volle Saisonlänge — Bezugsgröße für „nach N von M Spieltagen". */
  totalMatchdays: number;
  /** Summe der kumulierten Attributänderungen (das „kumulierte Plus" der Saison). */
  netCumulative: number;
  /**
   * Aufteilung des kumulierten Plus nach HERKUNFT, aufsummiert über alle
   * Attribute: was aus dem Trainings-Budget kommt (inkl. Spillover auf
   * Nebenstats) und was aus der Spieltags-Leistung. `regression` ist der
   * Gegenposten, der beides wieder abträgt.
   *
   * Die drei Zahlen stammen unverändert aus `attributeBreakdown` der
   * Organic-Projektion — dieselbe Quelle wie `netCumulative`, nur nicht
   * saldiert. So ist ablesbar, ob ein Spieler durch TRAINING wächst oder
   * weil er spielt.
   */
  trainingTotal: number;
  spilloverTotal: number;
  performanceTotal: number;
  regressionTotal: number;
  attributes: PlayerSeasonTrainingForecastCell[];
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildPlayerSeasonTrainingForecast(input: {
  gameState: GameState;
  player: Player;
  facilities?: TeamFacilityCollection | null;
}): PlayerSeasonTrainingForecast | null {
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
  const lastCanonicalIndex =
    orderIndex.get(playedMatchdayIds[playedMatchdayIds.length - 1]) ?? playedMatchdayIds.length - 1;

  // Performance-Fenster: nur Records dieses Spielers bis einschließlich des letzten gespielten
  // Spieltags. Records anderer Spieler bleiben unangetastet (sie beeinflussen die Prognose nicht).
  const resultIdToCanonicalIndex = new Map<string, number>();
  for (const result of gameState.seasonState.matchdayResults ?? []) {
    if ((result.seasonId ?? seasonId) !== seasonId) continue;
    const idx = orderIndex.get(result.matchdayId);
    if (idx != null) resultIdToCanonicalIndex.set(result.id, idx);
  }
  const allPerformances = gameState.seasonState.playerDisciplinePerformances ?? [];
  const truncatedPerformances = allPerformances.filter((entry) => {
    if (entry.playerId !== player.id) return true;
    const idx = resultIdToCanonicalIndex.get(entry.matchdayResultId);
    return idx != null && idx <= lastCanonicalIndex;
  });
  const truncatedGameState: GameState = {
    ...gameState,
    seasonState: { ...gameState.seasonState, playerDisciplinePerformances: truncatedPerformances },
  };

  // Trainings-Budget aus den Modi aller gespielten Spieltage (Nenner bleibt die volle Saisonlänge)
  // — exakt dieselbe Ableitung wie im Saisonende-Apply.
  const subsetModes: Record<string, PlayerTrainingMode> = {};
  for (const id of playedMatchdayIds) subsetModes[id] = modeByMatchday[id];
  const accInputs = resolveSeasonTrainingAccumulatorInputs({
    accumulator: {
      seasonId,
      matchdaysCounted: playedMatchdayIds.length,
      modeByMatchday: subsetModes,
      accumulatedTrainingFatigue: 0,
      updatedAt: accumulator.updatedAt,
    },
    seasonId,
    totalMatchdays,
  });

  const projection = buildOrganicSeasonProgression({
    gameState: truncatedGameState,
    player,
    facilities: input.facilities ?? undefined,
    accumulatedBaseTrainingBudget: accInputs?.accumulatedBaseTrainingBudget,
    performanceWeightMultiplier: accInputs?.performanceWeightMultiplier,
    // Ursache des früheren Schiefstands: Training (anteiliges Budget) und Performance (nur
    // Records bis heute) waren bereits auf die gespielten Spieltage beschnitten, die Regression
    // wurde aber als VOLLER Saisonbetrag abgezogen — nach 3 von N Spieltagen wirkte die Prognose
    // dadurch unrealistisch negativ. Die Regression skaliert jetzt im selben Spieltag-Takt
    // (gespielt / gesamt); am Saisonende ist der Faktor 1 und deckt sich exakt mit dem Apply.
    regressionMatchdayScale: totalMatchdays > 0 ? playedMatchdayIds.length / totalMatchdays : 1,
  });

  const cumulativeByAttr = Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0]),
  ) as Record<PlayerGeneratorAttributeName, number>;
  for (const entry of projection.attributeBreakdown) {
    cumulativeByAttr[entry.attribute] = entry.delta;
  }

  const baseline = player.attributeSheetStats ?? null;
  const attributes = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
    const cumulative = round1(cumulativeByAttr[attribute]);
    const baseValue = baseline?.[attribute];
    const projectedValue = typeof baseValue === "number" ? round1(baseValue + cumulative) : cumulative;
    return { attribute, cumulative, projectedValue };
  });
  const netCumulative = round1(attributes.reduce((sum, cell) => sum + cell.cumulative, 0));

  // Herkunft des kumulierten Plus, aufsummiert über alle Attribute. Rein additiv
  // aus derselben Projektion — es wird nichts zusätzlich gerechnet.
  let trainingTotal = 0;
  let spilloverTotal = 0;
  let performanceTotal = 0;
  let regressionTotal = 0;
  for (const entry of projection.attributeBreakdown) {
    trainingTotal += entry.training ?? 0;
    spilloverTotal += entry.spillover ?? 0;
    performanceTotal += entry.performance ?? 0;
    regressionTotal += entry.regression ?? 0;
  }

  return {
    seasonId,
    matchdaysPlayed: playedMatchdayIds.length,
    totalMatchdays,
    netCumulative,
    trainingTotal: round1(trainingTotal),
    spilloverTotal: round1(spilloverTotal),
    performanceTotal: round1(performanceTotal),
    regressionTotal: round1(regressionTotal),
    attributes,
  };
}
