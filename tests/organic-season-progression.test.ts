import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

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

describe("organic season progression", () => {
  it("turns market value into extra attribute maintenance pressure", () => {
    const cheap = player({ marketValue: 20 });
    const star = player({ marketValue: 100 });

    const cheapResult = buildOrganicSeasonProgression({ gameState: gameState(cheap), player: cheap });
    const starResult = buildOrganicSeasonProgression({ gameState: gameState(star), player: star });

    expect(cheapResult.marketValuePressureTotal).toBe(0.6);
    expect(starResult.marketValuePressureTotal).toBe(3);
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
    expect(signaturePower.growthMultiplier).toBeGreaterThan(1);
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
    expect(weakPower.growthMultiplier).toBeLessThan(1);
    expect(weakPower.performance).toBeLessThan(neutralPower.performance);
  });
});
