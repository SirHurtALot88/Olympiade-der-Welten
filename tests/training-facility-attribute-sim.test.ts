import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes, PlayerPotentialRecord, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

function attrs(overrides: Partial<PlayerGeneratorAttributes>): PlayerGeneratorAttributes {
  return {
    power: 60,
    health: 58,
    stamina: 56,
    intelligence: 50,
    awareness: 48,
    determination: 52,
    speed: 55,
    dexterity: 52,
    charisma: 48,
    will: 50,
    spirit: 46,
    torment: 50,
    ...overrides,
  };
}

function makePlayer(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 4,
    className: partial.className ?? "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: partial.traitsPositive ?? ["Diligent"],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 60, spe: 55, men: 50, soc: 48 },
    attributeSheetStats: partial.attributeSheetStats ?? attrs({}),
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? { d_pow: 60, d_spe: 55, d_men: 50, d_soc: 48 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: null,
  };
}

function makeFacilities(trainingCenterLevel: number): TeamFacilityCollection {
  return {
    facilities: {
      training_center: {
        level: trainingCenterLevel,
        enabled: trainingCenterLevel > 0,
        conditionPct: 100,
      },
      recovery_center: { level: 0, enabled: false, conditionPct: 100 },
      scouting_office: { level: 0, enabled: false, conditionPct: 100 },
      analytics_room: { level: 0, enabled: false, conditionPct: 100 },
      fan_shop: { level: 0, enabled: false, conditionPct: 100 },
      arena_upgrade: { level: 0, enabled: false, conditionPct: 100 },
      academy: { level: 0, enabled: false, conditionPct: 100 },
    },
  };
}

function buildGameState(player: Player, potentialRecord: PlayerPotentialRecord): GameState {
  return {
    gamePhase: "player_development",
    season: { id: "season-sim", name: "Sim Season", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "season-sim",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-sim", name: "Sim Team", shortCode: "SIM", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
      { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 1 },
      { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 1 },
      { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 1 },
    ],
    rosters: [{ id: "r-sim", teamId: "team-sim", playerId: player.id, salary: 5, marketValue: player.marketValue, contractLength: 2 }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    playerPotential: [potentialRecord],
    mappingReport: {
      mappingSource: "sim",
      teamSource: "sim",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  };
}

describe("training facility attribute simulation", () => {
  it("increases net setpoints with higher training center level", () => {
    const target = makePlayer({
      id: "facility-check",
      rating: 70,
      trainingMode: "mittel",
      attributeSheetStats: attrs({ power: 70, speed: 68, health: 68, stamina: 66 }),
    });
    const record: PlayerPotentialRecord = {
      playerId: target.id,
      potentialBand: "high",
      hiddenPotentialScore: 84,
      confidence: 0,
      source: "generated",
    };
    const gameState = buildGameState(target, record);
    const level0 = buildOrganicSeasonProgression({ gameState, player: target, facilities: makeFacilities(0) });
    const level5 = buildOrganicSeasonProgression({ gameState, player: target, facilities: makeFacilities(5) });

    expect(level5.trainingSetpoints).toBeGreaterThan(level0.trainingSetpoints);
    expect(level5.netSetpoints).toBeGreaterThan(level0.netSetpoints);
    expect(level5.facilityModifierPct).toBe(50);
    expect(level0.facilityModifierPct).toBe(0);
    expect(level5.trainingSetpoints / level0.trainingSetpoints).toBeGreaterThan(1.45);
  });

  it("ranks profiles by training throughput at the same facility level", () => {
    const top = makePlayer({
      id: "top-check",
      rating: 82,
      marketValue: 85,
      className: "Berserker",
      trainingMode: "hart",
      coreStats: { pow: 84, spe: 72, men: 66, soc: 54 },
      attributeSheetStats: attrs({ power: 82, health: 80, stamina: 78, speed: 74, dexterity: 72 }),
    });
    const mid = makePlayer({
      id: "mid-check",
      rating: 60,
      marketValue: 22,
      className: "Hero",
      trainingMode: "mittel",
      coreStats: { pow: 60, spe: 58, men: 55, soc: 52 },
      attributeSheetStats: attrs({ power: 60, health: 58, stamina: 57, speed: 58, dexterity: 56 }),
    });
    const weak = makePlayer({
      id: "weak-check",
      rating: 32,
      marketValue: 8,
      className: "Berserker",
      trainingMode: "leicht",
      coreStats: { pow: 46, spe: 17, men: 19, soc: 29 },
      attributeSheetStats: attrs({ power: 58, health: 52, stamina: 50, speed: 28, dexterity: 24 }),
    });
    const topRecord: PlayerPotentialRecord = {
      playerId: top.id,
      potentialBand: "elite",
      hiddenPotentialScore: 95,
      confidence: 0,
      source: "generated",
    };
    const midRecord: PlayerPotentialRecord = {
      playerId: mid.id,
      potentialBand: "medium",
      hiddenPotentialScore: 72,
      confidence: 0,
      source: "generated",
    };
    const weakRecord: PlayerPotentialRecord = {
      playerId: weak.id,
      potentialBand: "low",
      hiddenPotentialScore: 52,
      confidence: 0,
      source: "generated",
      hiddenAttributeCeiling: {
        power: 58,
        health: 62,
        stamina: 60,
        speed: 55,
        dexterity: 52,
        awareness: 50,
        intelligence: 48,
        will: 46,
        charisma: 58,
        spirit: 56,
        determination: 60,
        torment: 58,
      },
    };
    const facilities = makeFacilities(3);
    const topResult = buildOrganicSeasonProgression({
      gameState: buildGameState(top, topRecord),
      player: top,
      facilities,
    });
    const midResult = buildOrganicSeasonProgression({
      gameState: buildGameState(mid, midRecord),
      player: mid,
      facilities,
    });
    const weakResult = buildOrganicSeasonProgression({
      gameState: buildGameState(weak, weakRecord),
      player: weak,
      facilities,
    });

    expect(topResult.trainingSetpoints).toBeGreaterThan(midResult.trainingSetpoints);
    expect(midResult.trainingSetpoints).toBeGreaterThan(weakResult.trainingSetpoints);
    expect(topResult.potentialTrainingMultiplier).toBeGreaterThan(weakResult.potentialTrainingMultiplier);
  });
});
