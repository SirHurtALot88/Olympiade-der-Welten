import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import {
  buildOrganicSeasonProgression,
  resolveSeasonTrainingAccumulatorInputs,
} from "@/lib/training/organic-season-progression";
import { buildPlayerSeasonTrainingForecast } from "@/lib/foundation/player-matchday-training-history";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

/**
 * Punkt 1 der Historie-Überarbeitung: Der Saison-Forecast in der Trainingshistorie skalierte
 * Training (anteiliges Budget) und Performance (nur Records bis heute) bereits auf die
 * gespielten Spieltage — die Regression wurde aber als VOLLER Saisonbetrag abgezogen.
 * Nach 3 von 10 Spieltagen stand damit 3/10 Wachstum gegen 10/10 Regression und die
 * Prognose sah unrealistisch negativ aus. Fix: `regressionMatchdayScale` (gespielt/gesamt)
 * skaliert NUR die Prognose-Regression; der Saisonende-Apply setzt den Parameter nicht
 * und bleibt bitgenau unverändert.
 */

const attrs: PlayerGeneratorAttributes = {
  power: 70,
  health: 70,
  stamina: 70,
  intelligence: 40,
  awareness: 40,
  determination: 50,
  speed: 72,
  dexterity: 55,
  charisma: 40,
  will: 40,
  spirit: 40,
  torment: 50,
};

function makePlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test Player",
    rating: partial.rating ?? 70,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 5,
    className: partial.className ?? "Charger",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 70, spe: 70, men: 40, soc: 40 },
    attributeSheetStats: partial.attributeSheetStats ?? attrs,
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: partial.trainingClass ?? null,
    seasonTrainingAccumulator: partial.seasonTrainingAccumulator,
  };
}

const TOTAL_MATCHDAYS = 10;
const MATCHDAY_IDS = Array.from({ length: TOTAL_MATCHDAYS }, (_, index) => `md-${index + 1}`);

function makeGameState(sourcePlayer: Player): GameState {
  return {
    gamePhase: "player_development",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 3,
      totalMatchdays: TOTAL_MATCHDAYS,
      matchdayIds: MATCHDAY_IDS,
      isCompleted: false,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "md-3", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      {
        teamId: "team-1",
        name: "Team",
        shortCode: "T",
        budget: 100,
        cash: 100,
        identityId: "identity-1",
        humanControlled: true,
        rosterLimit: 20,
      },
    ],
    teamIdentities: [],
    players: [sourcePlayer],
    disciplines: [],
    rosters: [
      {
        id: "r-1",
        teamId: "team-1",
        playerId: sourcePlayer.id,
        salary: 5,
        upkeep: 0,
        roleTag: "starter",
        joinedSeasonId: "season-1",
        contractLength: 2,
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-07-28T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function accumulatorForMatchdays(count: number, mode: PlayerTrainingMode = "mittel") {
  const modeByMatchday: Record<string, PlayerTrainingMode> = {};
  for (let index = 0; index < count; index += 1) {
    modeByMatchday[MATCHDAY_IDS[index]] = mode;
  }
  return {
    seasonId: "season-1",
    matchdaysCounted: count,
    modeByMatchday,
    accumulatedTrainingFatigue: 0,
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
}

describe("Saison-Forecast: Regression skaliert anteilig zu den gespielten Spieltagen", () => {
  it("skaliert die Regression pro Attribut mit regressionMatchdayScale (3 von 10 Spieltagen → 3/10)", () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const full = buildOrganicSeasonProgression({ gameState: state, player });
    const scaled = buildOrganicSeasonProgression({ gameState: state, player, regressionMatchdayScale: 3 / 10 });

    expect(full.attributeBreakdown.length).toBeGreaterThan(0);
    for (let index = 0; index < full.attributeBreakdown.length; index += 1) {
      const fullEntry = full.attributeBreakdown[index];
      const scaledEntry = scaled.attributeBreakdown[index];
      expect(scaledEntry.attribute).toBe(fullEntry.attribute);
      // Regression exakt anteilig (Rundung auf 2 Nachkommastellen toleriert).
      expect(scaledEntry.regression).toBeCloseTo(fullEntry.regression * 0.3, 1);
      expect(Math.abs(scaledEntry.regression)).toBeLessThan(Math.abs(fullEntry.regression));
      // Training/Performance bleiben von der Skala unberührt.
      expect(scaledEntry.training).toBeCloseTo(fullEntry.training, 5);
      expect(scaledEntry.performance).toBeCloseTo(fullEntry.performance, 5);
    }
    // Weniger Regression bei gleichem Wachstum → Netto strikt besser.
    expect(scaled.netSetpoints).toBeGreaterThan(full.netSetpoints);
    // Der ausgewiesene Regression-Breakdown zieht im gleichen Takt mit.
    expect(scaled.regressionBreakdown.combinedTotal).toBeCloseTo(full.regressionBreakdown.combinedTotal * 0.3, 1);
  });

  it("ohne Parameter (Saisonende-Apply-Pfad) bleibt die Rechnung bitgenau unverändert (Skala 1)", () => {
    const player = makePlayer();
    const state = makeGameState(player);
    const implicit = buildOrganicSeasonProgression({ gameState: state, player });
    const explicitOne = buildOrganicSeasonProgression({ gameState: state, player, regressionMatchdayScale: 1 });
    // Ungültige Werte fallen ebenfalls auf 1 zurück (defensive Absicherung des Apply-Pfads).
    const invalid = buildOrganicSeasonProgression({ gameState: state, player, regressionMatchdayScale: Number.NaN });

    expect(explicitOne.attributeBreakdown).toEqual(implicit.attributeBreakdown);
    expect(explicitOne.netSetpoints).toBe(implicit.netSetpoints);
    expect(explicitOne.regressionBreakdown).toEqual(implicit.regressionBreakdown);
    expect(invalid.attributeBreakdown).toEqual(implicit.attributeBreakdown);
  });

  it("buildPlayerSeasonTrainingForecast: nach 3 von 10 Spieltagen entspricht die Prognose der anteilig skalierten Regression", () => {
    const player = makePlayer({ seasonTrainingAccumulator: accumulatorForMatchdays(3) });
    const state = makeGameState(player);
    const forecast = buildPlayerSeasonTrainingForecast({ gameState: state, player });
    expect(forecast).not.toBeNull();
    expect(forecast?.matchdaysPlayed).toBe(3);

    // Erwartung: exakt dieselbe Engine-Rechnung mit anteiligem Budget UND anteiliger Regression.
    const accInputs = resolveSeasonTrainingAccumulatorInputs({
      accumulator: player.seasonTrainingAccumulator,
      seasonId: "season-1",
      totalMatchdays: TOTAL_MATCHDAYS,
    });
    expect(accInputs).not.toBeNull();
    const expected = buildOrganicSeasonProgression({
      gameState: state,
      player,
      accumulatedBaseTrainingBudget: accInputs?.accumulatedBaseTrainingBudget,
      performanceWeightMultiplier: accInputs?.performanceWeightMultiplier,
      regressionMatchdayScale: 3 / TOTAL_MATCHDAYS,
    });
    const expectedByAttribute = new Map(expected.attributeBreakdown.map((entry) => [entry.attribute, entry.delta]));
    for (const cell of forecast?.attributes ?? []) {
      expect(cell.cumulative).toBeCloseTo(expectedByAttribute.get(cell.attribute) ?? Number.NaN, 1);
    }

    // Kernaussage des Bugs: die alte Rechnung (volle Saison-Regression gegen 3/10-Training)
    // war strikt negativer als die anteilige Prognose.
    const legacy = buildOrganicSeasonProgression({
      gameState: state,
      player,
      accumulatedBaseTrainingBudget: accInputs?.accumulatedBaseTrainingBudget,
      performanceWeightMultiplier: accInputs?.performanceWeightMultiplier,
    });
    expect(forecast?.netCumulative ?? 0).toBeGreaterThan(legacy.netSetpoints);
  });

  it("am Saisonende (10 von 10 Spieltagen) ist die Prognose identisch mit der vollen Saison-Rechnung des Apply", () => {
    const player = makePlayer({ seasonTrainingAccumulator: accumulatorForMatchdays(TOTAL_MATCHDAYS) });
    const state = makeGameState(player);
    const forecast = buildPlayerSeasonTrainingForecast({ gameState: state, player });
    expect(forecast?.matchdaysPlayed).toBe(TOTAL_MATCHDAYS);

    // Referenz: Rechnung OHNE regressionMatchdayScale — exakt das, was der Saisonende-Apply
    // (season-end-xp-apply-service, setzt den Parameter nicht) mit denselben Accumulator-Inputs bucht.
    const accInputs = resolveSeasonTrainingAccumulatorInputs({
      accumulator: player.seasonTrainingAccumulator,
      seasonId: "season-1",
      totalMatchdays: TOTAL_MATCHDAYS,
    });
    const applyEquivalent = buildOrganicSeasonProgression({
      gameState: state,
      player,
      accumulatedBaseTrainingBudget: accInputs?.accumulatedBaseTrainingBudget,
      performanceWeightMultiplier: accInputs?.performanceWeightMultiplier,
    });
    const applyByAttribute = new Map(applyEquivalent.attributeBreakdown.map((entry) => [entry.attribute, entry.delta]));
    for (const cell of forecast?.attributes ?? []) {
      expect(cell.cumulative).toBeCloseTo(applyByAttribute.get(cell.attribute) ?? Number.NaN, 5);
    }
  });
});
