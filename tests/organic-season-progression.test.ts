import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import {
  buildOrganicSeasonProgression,
  ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
  resolveOrganicRegressionCombinedTotal,
} from "@/lib/training/organic-season-progression";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";

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

function player(partial: Partial<Player> = {}): Player {
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
  };
}

function gameState(sourcePlayer: Player): GameState {
  return {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team", shortCode: "T", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players: [sourcePlayer],
    disciplines: [],
    rosters: [{ id: "r-1", teamId: "team-1", playerId: sourcePlayer.id, salary: 5, marketValue: sourcePlayer.marketValue, contractLength: 2 }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  };
}

function addStrongPowerPerformance(state: GameState, playerId: string) {
  state.seasonState.matchdayResults = [{ id: "result-1", seasonId: "season-1", matchdayId: "md-1", status: "preview_applied" }];
  state.seasonState.playerDisciplinePerformances = [
    {
      id: "perf-1",
      matchdayResultId: "result-1",
      teamId: "team-1",
      playerId,
      activePlayerId: null,
      disciplineId: "gewichtheben",
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 70,
      finalPlayerScore: 95,
      scoreContribution: 28,
      rankInTeam: 1,
      rankInDiscipline: 1,
      isTop10: true,
      isMvpCandidate: true,
      storyWeight: null,
      createdAt: "2026-06-11T00:00:00.000Z",
    },
  ];
}

function addPoorSeasonPerformances(state: GameState, playerId: string, count = 10) {
  state.seasonState.matchdayResults = Array.from({ length: count }, (_, index) => ({
    id: `result-${index + 1}`,
    seasonId: "season-1",
    matchdayId: `md-${index + 1}`,
    status: "preview_applied" as const,
  }));
  state.seasonState.playerDisciplinePerformances = Array.from({ length: count }, (_, index) => ({
    id: `perf-${index + 1}`,
    matchdayResultId: `result-${index + 1}`,
    teamId: "team-1",
    playerId,
    activePlayerId: null,
    disciplineId: "gewichtheben",
    disciplineSide: "d1",
    slotIndex: 0,
    baseValue: 35,
    finalPlayerScore: 32,
    scoreContribution: 7,
    rankInTeam: 12,
    rankInDiscipline: 24,
    isTop10: false,
    isMvpCandidate: false,
    storyWeight: null,
    createdAt: "2026-06-11T00:00:00.000Z",
  }));
}

describe("organic season progression", () => {
  it("turns market value into extra attribute maintenance pressure", () => {
    const cheap = player({ marketValue: 20 });
    const star = player({ marketValue: 100 });

    const cheapResult = buildOrganicSeasonProgression({ gameState: gameState(cheap), player: cheap });
    const starResult = buildOrganicSeasonProgression({ gameState: gameState(star), player: star });

    // 2026-07-04 balancing pass: ORGANIC_MARKET_VALUE_PRESSURE_RATE reduced 0.0104 -> 0.007
    // (top-20-MW regression check showed ~all expensive players net-negative even with a solid
    // season; see progress-log.md for the before/after distribution).
    expect(cheapResult.marketValuePressureTotal).toBeCloseTo(1.68, 1);
    expect(starResult.marketValuePressureTotal).toBeCloseTo(8.4, 1);
    expect(cheapResult.marketValuePressurePerAttribute).toBeCloseTo(0.14, 2);
    expect(starResult.marketValuePressurePerAttribute).toBeCloseTo(0.7, 2);
    expect(starResult.marketValuePressurePerAttribute).toBeGreaterThan(cheapResult.marketValuePressurePerAttribute);
    expect(starResult.netSetpoints).toBeLessThan(cheapResult.netSetpoints);
  });

  it("applies diligent and lazy only to training setpoints", () => {
    const diligent = player({ traitsPositive: ["Diligent"] });
    const lazy = player({ traitsNegative: ["Lazy"] });

    const diligentResult = buildOrganicSeasonProgression({ gameState: gameState(diligent), player: diligent });
    const lazyResult = buildOrganicSeasonProgression({ gameState: gameState(lazy), player: lazy });

    expect(diligentResult.traitModifierPct).toBeGreaterThan(0);
    expect(lazyResult.traitModifierPct).toBeLessThan(0);
    expect(diligentResult.trainingSetpoints).toBeGreaterThan(lazyResult.trainingSetpoints);
    expect(diligentResult.performanceSetpoints).toBe(lazyResult.performanceSetpoints);
  });

  it("uses player potential and star gap as training growth multipliers", () => {
    const lowPotential = player({ id: "low-potential", potential: 50 });
    const elitePotential = player({ id: "elite-potential", potential: 94 });
    const lowState = gameState(lowPotential);
    const eliteState = gameState(elitePotential);
    lowState.playerPotential = [
      {
        playerId: lowPotential.id,
        potentialBand: "low",
        hiddenPotentialScore: 52,
        confidence: 0,
        source: "generated",
      },
    ];
    eliteState.playerPotential = [
      {
        playerId: elitePotential.id,
        potentialBand: "elite",
        hiddenPotentialScore: 95,
        confidence: 0,
        source: "generated",
      },
    ];

    const lowResult = buildOrganicSeasonProgression({ gameState: lowState, player: lowPotential });
    const eliteResult = buildOrganicSeasonProgression({ gameState: eliteState, player: elitePotential });

    expect(lowResult.potentialTrainingMultiplier).toBeLessThan(eliteResult.potentialTrainingMultiplier);
    expect(eliteResult.potentialTrainingMultiplier).toBeGreaterThan(1);
    expect(eliteResult.trainingSetpoints).toBeGreaterThan(lowResult.trainingSetpoints);
  });

  it("uses an explicit training class when the player plan sets one", () => {
    const sourcePlayer = player({ trainingClass: "Mage" });
    const result = buildOrganicSeasonProgression({ gameState: gameState(sourcePlayer), player: sourcePlayer });

    expect(result.primaryTrainingClass).toBe("Mage");
  });

  it("adds discipline-weighted performance points for strong discipline results", () => {
    const sourcePlayer = player();
    const state = gameState(sourcePlayer);
    addStrongPowerPerformance(state, sourcePlayer.id);

    const result = buildOrganicSeasonProgression({ gameState: state, player: sourcePlayer });
    const power = result.attributeBreakdown.find((entry) => entry.attribute === "power")!;
    const intelligence = result.attributeBreakdown.find((entry) => entry.attribute === "intelligence")!;

    expect(result.performanceSetpoints).toBeGreaterThan(0);
    expect(power.performance).toBeGreaterThan(intelligence.performance);
  });

  it("reduces net setpoints after a weak season through lower performance gains", () => {
    const sourcePlayer = player({ rating: 46, marketValue: 12 });
    const averageState = gameState(sourcePlayer);
    const poorState = gameState(sourcePlayer);
    addStrongPowerPerformance(averageState, sourcePlayer.id);
    addPoorSeasonPerformances(poorState, sourcePlayer.id);
    averageState.seasonState.matchdayResults = Array.from({ length: 10 }, (_, index) => ({
      id: `avg-result-${index + 1}`,
      seasonId: "season-1",
      matchdayId: `avg-md-${index + 1}`,
      status: "preview_applied" as const,
    }));
    averageState.seasonState.playerDisciplinePerformances = Array.from({ length: 10 }, (_, index) => ({
      id: `avg-perf-${index + 1}`,
      matchdayResultId: `avg-result-${index + 1}`,
      teamId: "team-1",
      playerId: sourcePlayer.id,
      activePlayerId: null,
      disciplineId: "gewichtheben",
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 70,
      finalPlayerScore: 95,
      scoreContribution: 28,
      rankInTeam: 1,
      rankInDiscipline: 1,
      isTop10: true,
      isMvpCandidate: true,
      storyWeight: null,
      createdAt: "2026-06-11T00:00:00.000Z",
    }));

    const average = buildOrganicSeasonProgression({ gameState: averageState, player: sourcePlayer });
    const poor = buildOrganicSeasonProgression({ gameState: poorState, player: sourcePlayer });

    expect(poor.performanceSetpoints).toBeLessThan(average.performanceSetpoints);
    expect(poor.netSetpoints).toBeLessThan(average.netSetpoints);
  });

  it("lets signature attributes gain a little faster in organic progression", () => {
    const signaturePlayer = player({ id: "signature", className: "Badass" });
    const neutralPlayer = player({ id: "neutral", className: "Mage" });
    const signatureState = gameState(signaturePlayer);
    const neutralState = gameState(neutralPlayer);
    addStrongPowerPerformance(signatureState, signaturePlayer.id);
    addStrongPowerPerformance(neutralState, neutralPlayer.id);

    const signatureResult = buildOrganicSeasonProgression({ gameState: signatureState, player: signaturePlayer });
    const neutralResult = buildOrganicSeasonProgression({ gameState: neutralState, player: neutralPlayer });
    const signaturePower = signatureResult.attributeBreakdown.find((entry) => entry.attribute === "power")!;
    const neutralPower = neutralResult.attributeBreakdown.find((entry) => entry.attribute === "power")!;

    expect(signaturePower.affinity).toBe("signature");
    expect(neutralPower.affinity).toBe("neutral");
    expect(signaturePower.trainingGrowthMultiplier).toBeGreaterThan(1);
    expect(signaturePower.performance).toBeGreaterThan(neutralPower.performance);
    expect(signaturePower.training).toBeGreaterThan(neutralPower.training);
  });

  it("makes weak attributes gain slower without changing the base performance budget", () => {
    const weakAttributes: PlayerGeneratorAttributes = {
      power: 20,
      health: 55,
      stamina: 55,
      intelligence: 90,
      awareness: 55,
      determination: 55,
      speed: 55,
      dexterity: 55,
      charisma: 55,
      will: 90,
      spirit: 55,
      torment: 55,
    };
    const neutralAttributes: PlayerGeneratorAttributes = { ...weakAttributes, power: 55, charisma: 20 };
    const weakPlayer = player({ id: "weak", className: "Mage", attributeSheetStats: weakAttributes });
    const neutralPlayer = player({ id: "neutral", className: "Mage", attributeSheetStats: neutralAttributes });
    const weakState = gameState(weakPlayer);
    const neutralState = gameState(neutralPlayer);
    addStrongPowerPerformance(weakState, weakPlayer.id);
    addStrongPowerPerformance(neutralState, neutralPlayer.id);

    const weakResult = buildOrganicSeasonProgression({ gameState: weakState, player: weakPlayer });
    const neutralResult = buildOrganicSeasonProgression({ gameState: neutralState, player: neutralPlayer });
    const weakPower = weakResult.attributeBreakdown.find((entry) => entry.attribute === "power")!;
    const neutralPower = neutralResult.attributeBreakdown.find((entry) => entry.attribute === "power")!;

    expect(weakResult.performanceSetpoints).toBe(neutralResult.performanceSetpoints);
    expect(weakPower.affinity).toBe("weak");
    expect(neutralPower.affinity).toBe("neutral");
    expect(weakPower.trainingGrowthMultiplier).toBeLessThan(1);
    expect(weakPower.performance).toBeLessThan(neutralPower.performance);
  });

  it("boosts prospects with star gap and penalizes overpriced veterans", () => {
    const youth = player({
      id: "youth",
      rating: 58,
      potential: 85,
      marketValue: 12,
      coreStats: { pow: 58, spe: 60, men: 57, soc: 56 },
      attributeSheetStats: attrs,
      traitsPositive: ["Diligent", "Motivated"],
      trainingMode: "hart",
    });
    const overpaid = player({
      id: "vet",
      rating: 82,
      potential: 84,
      marketValue: 80,
      coreStats: { pow: 82, spe: 80, men: 78, soc: 76 },
      attributeSheetStats: {
        ...attrs,
        power: 82,
        speed: 80,
        intelligence: 78,
        charisma: 76,
      },
      trainingMode: "leicht",
    });
    const youthState = gameState(youth);
    const vetState = gameState(overpaid);
    youthState.playerPotential = [
      {
        playerId: youth.id,
        potentialBand: "high",
        hiddenPotentialScore: 88,
        hiddenPotentialOverallStars: 4,
        hiddenPotentialCeilingByAxis: { pow: 4, spe: 3.5, men: 3.5, soc: 3.5 },
        confidence: 0,
        source: "generated",
      },
    ];
    vetState.playerPotential = [
      {
        playerId: overpaid.id,
        potentialBand: "medium",
        hiddenPotentialScore: 84,
        hiddenPotentialOverallStars: 3.5,
        hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 3.5, men: 3.5, soc: 3.5 },
        confidence: 0,
        source: "generated",
      },
    ];
    const youthResult = buildOrganicSeasonProgression({ gameState: youthState, player: youth });
    const vetResult = buildOrganicSeasonProgression({ gameState: vetState, player: overpaid });
    expect(youthResult.netSetpoints).toBeGreaterThan(0);
    expect(vetResult.netSetpoints).toBeLessThan(youthResult.netSetpoints);
  });

  it("applies capped attribute growth multiplier near hidden ceiling", () => {
    const cappedPlayer = player({
      id: "capped",
      attributeSheetStats: {
        power: 72,
        health: 70,
        stamina: 68,
        speed: 40,
        dexterity: 38,
        awareness: 36,
        intelligence: 35,
        will: 34,
        charisma: 40,
        spirit: 38,
        determination: 42,
        torment: 45,
      },
    });
    const state = gameState(cappedPlayer);
    state.playerPotential = [
      {
        playerId: cappedPlayer.id,
        potentialBand: "medium",
        hiddenPotentialScore: 72,
        confidence: 0,
        source: "generated",
        hiddenPotentialCeilingByAxis: { pow: 3, spe: 4, men: 3.5, soc: 3.5 },
        hiddenPotentialOverallStars: 3.5,
        hiddenAttributeCeiling: {
          power: 72,
          health: 75,
          stamina: 70,
          speed: 80,
          dexterity: 78,
          awareness: 76,
          intelligence: 74,
          will: 72,
          charisma: 78,
          spirit: 76,
          determination: 80,
          torment: 73,
        },
      },
    ];

    const result = buildOrganicSeasonProgression({ gameState: state, player: cappedPlayer });
    const power = result.attributeBreakdown.find((entry) => entry.attribute === "power")!;
    const determination = result.attributeBreakdown.find((entry) => entry.attribute === "determination")!;

    expect(power.trainingGrowthMultiplier).toBeLessThanOrEqual(0.1);
    expect(determination.trainingGrowthMultiplier).toBeGreaterThan(power.trainingGrowthMultiplier);
  });

  it("does not reduce performance setpoints near hidden attribute ceiling", () => {
    const baseStats: PlayerGeneratorAttributes = {
      power: 52,
      health: 51,
      stamina: 50,
      speed: 51,
      dexterity: 50,
      intelligence: 49,
      awareness: 48,
      determination: 50,
      charisma: 49,
      will: 48,
      spirit: 47,
      torment: 48,
    };
    const openPlayer = player({
      id: "open-perf",
      rating: 52,
      marketValue: 27,
      attributeSheetStats: baseStats,
    });
    const cappedPlayer = player({
      id: "capped-perf",
      rating: 52,
      marketValue: 27,
      attributeSheetStats: baseStats,
    });
    const performanceRecords = Array.from({ length: 10 }, (_, index) => ({
      id: `cap-perf-${index + 1}`,
      matchdayResultId: `cap-result-${index + 1}`,
      teamId: "team-1",
      playerId: openPlayer.id,
      activePlayerId: null,
      disciplineId: "gewichtheben",
      disciplineSide: "d1" as const,
      slotIndex: 0,
      baseValue: 88,
      finalPlayerScore: 92,
      scoreContribution: 26,
      rankInTeam: 1,
      rankInDiscipline: 1,
      isTop10: true,
      isMvpCandidate: true,
      storyWeight: null,
      createdAt: "2026-06-11T00:00:00.000Z",
    }));

    // Performance-Records werden nur gezaehlt, wenn ihre matchdayResultId in den
    // matchdayResults der aktuellen Saison existiert (Filter in getPerformanceIndex).
    const matchdayResults = performanceRecords.map((entry) => ({
      id: entry.matchdayResultId,
      seasonId: "season-1",
    })) as unknown as GameState["seasonState"]["matchdayResults"];
    const openState = gameState(openPlayer);
    openState.seasonState.matchdayResults = matchdayResults;
    openState.seasonState.playerDisciplinePerformances = performanceRecords.map((entry) => ({
      ...entry,
      playerId: openPlayer.id,
    }));
    const cappedState = gameState(cappedPlayer);
    cappedState.seasonState.matchdayResults = matchdayResults;
    cappedState.seasonState.playerDisciplinePerformances = performanceRecords.map((entry) => ({
      ...entry,
      id: entry.id.replace("cap", "capped"),
      playerId: cappedPlayer.id,
    }));
    cappedState.playerPotential = [
      {
        playerId: cappedPlayer.id,
        potentialBand: "medium",
        hiddenPotentialScore: 68,
        confidence: 0.8,
        source: "generated",
        hiddenPotentialOverallStars: 2.5,
        hiddenPotentialCeilingByAxis: { pow: 3, spe: 3, men: 3, soc: 3 },
        hiddenAttributeCeiling: {
          power: 54,
          health: 53,
          stamina: 52,
          speed: 53,
          dexterity: 52,
          intelligence: 51,
          awareness: 50,
          determination: 52,
          charisma: 51,
          will: 50,
          spirit: 49,
          torment: 50,
        },
      },
    ];

    const openResult = buildOrganicSeasonProgression({ gameState: openState, player: openPlayer });
    const cappedResult = buildOrganicSeasonProgression({ gameState: cappedState, player: cappedPlayer });

    expect(cappedResult.performanceSetpoints).toBeCloseTo(openResult.performanceSetpoints, 1);
    expect(cappedResult.appliedPerformanceSetpoints).toBeLessThan(openResult.appliedPerformanceSetpoints);
    expect(cappedResult.appliedPerformanceSetpoints).toBeGreaterThan(openResult.appliedPerformanceSetpoints * 0.5);
    const openTrainingApplied = openResult.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0);
    const cappedTrainingApplied = cappedResult.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0);
    expect(cappedTrainingApplied).toBeLessThan(openTrainingApplied);
  });

  it("keeps net setpoints aligned with applied training, performance and full regression", () => {
    const subject = player({
      id: "net-math-player",
      className: "Berserker",
      trainingClass: "Tank",
      trainingMode: "mittel",
      rating: 84,
    });
    const state = gameState(subject);
    const result = buildOrganicSeasonProgression({ gameState: state, player: subject });

    expect(result.appliedTrainingSetpoints).toBeCloseTo(
      result.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0),
      2,
    );
    expect(result.appliedPerformanceSetpoints).toBeCloseTo(
      result.attributeBreakdown.reduce((sum, entry) => sum + entry.performance, 0),
      2,
    );
    expect(result.regressionBreakdown.combinedTotal).toBeCloseTo(
      result.attributeBreakdown.reduce((sum, entry) => sum + entry.regression, 0),
      2,
    );
    expect(result.netSetpoints).toBeCloseTo(
      result.attributeBreakdown.reduce((sum, entry) => sum + entry.delta, 0),
      2,
    );
  });
});

describe("resolveOrganicRegressionCombinedTotal", () => {
  it("prefers saved regressionCombinedTotal when present", () => {
    expect(
      resolveOrganicRegressionCombinedTotal({
        regressionCombinedTotal: -4.44,
        regressionBreakdown: { combinedTotal: -9.99 },
        marketValuePressureTotal: 1.68,
      }),
    ).toBe(-4.44);
  });

  it("falls back to regressionBreakdown.combinedTotal for legacy saves", () => {
    expect(
      resolveOrganicRegressionCombinedTotal({
        regressionBreakdown: { combinedTotal: -4.44 },
        marketValuePressureTotal: 1.68,
      }),
    ).toBe(-4.44);
  });

  it("reconstructs base flat regression plus market value pressure for oldest saves", () => {
    const marketValuePressureTotal = 1.68;
    const expected = Number(
      (-ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * PROGRESSION_ATTRIBUTE_ORDER.length - marketValuePressureTotal).toFixed(2),
    );

    expect(
      resolveOrganicRegressionCombinedTotal({
        marketValuePressureTotal,
      }),
    ).toBe(expected);
  });
});
