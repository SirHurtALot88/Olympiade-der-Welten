import { describe, expect, it } from "vitest";

import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

const SEASON_ID = "season-perf-test";
const TEAM_ID = "team-test";
const DISCIPLINE_ID = "gewichtheben";

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

function makeMidPlayer(): Player {
  return {
    id: "perf-mid",
    name: "Perf Mid",
    rating: 46,
    marketValue: 27,
    salaryDemand: 4,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: ["Diligent"],
    traitsNegative: [],
    coreStats: { pow: 46, spe: 45, men: 44, soc: 43 },
    attributeSheetStats: attrs({
      power: 46,
      health: 45,
      stamina: 44,
      speed: 45,
      dexterity: 44,
      intelligence: 43,
      awareness: 42,
      determination: 44,
      charisma: 43,
      will: 42,
      spirit: 41,
      torment: 42,
    }),
    preferredDisciplineIds: [],
    disciplineRatings: { d_pow: 46, d_spe: 45, d_men: 44, d_soc: 43 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: 70,
    trainingMode: "mittel",
    trainingClass: "Hero",
  };
}

function makeFacilities(): TeamFacilityCollection {
  return {
    facilities: {
      training_center: { level: 3, enabled: true, conditionPct: 100 },
      recovery_center: { level: 0, enabled: false, conditionPct: 100 },
      scouting_office: { level: 0, enabled: false, conditionPct: 100 },
      analytics_room: { level: 0, enabled: false, conditionPct: 100 },
      fan_shop: { level: 0, enabled: false, conditionPct: 100 },
      arena_upgrade: { level: 0, enabled: false, conditionPct: 100 },
      academy: { level: 0, enabled: false, conditionPct: 100 },
    },
  };
}

function makePotentialRecord(playerId: string): PlayerPotentialRecord {
  return {
    playerId,
    potentialBand: "medium",
    hiddenPotentialScore: 72,
    confidence: 0,
    source: "generated",
    hiddenPotentialOverallStars: 2.5,
    hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 3.5, men: 3.5, soc: 3.5 },
  };
}

function buildGameState(player: Player, performances: PlayerDisciplinePerformanceRecord[]): GameState {
  const matchdayResults = performances.map((entry, index) => ({
    id: entry.matchdayResultId,
    seasonId: SEASON_ID,
    matchdayId: `md-${index + 1}`,
    status: "preview_applied" as const,
  }));

  return {
    gamePhase: "player_development",
    season: { id: SEASON_ID, name: "Perf Test", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: {},
      matchdayResults,
      playerDisciplinePerformances: performances,
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: TEAM_ID, name: "Team", shortCode: "T", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
    ],
    rosters: [{ id: "r-1", teamId: TEAM_ID, playerId: player.id, salary: 5, marketValue: player.marketValue, contractLength: 2 }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    playerPotential: [makePotentialRecord(player.id)],
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

function makePerformanceRecords(
  playerId: string,
  count: number,
  profile: "poor" | "strong",
): PlayerDisciplinePerformanceRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `perf-${playerId}-${index + 1}`,
    matchdayResultId: `result-${index + 1}`,
    teamId: TEAM_ID,
    playerId,
    activePlayerId: null,
    disciplineId: DISCIPLINE_ID,
    disciplineSide: "d1",
    slotIndex: 0,
    baseValue: profile === "strong" ? 88 : 35,
    finalPlayerScore: profile === "strong" ? 94 : 34,
    scoreContribution: profile === "strong" ? 28 : 7,
    rankInTeam: profile === "strong" ? 1 : 12,
    rankInDiscipline: profile === "strong" ? 1 : 25,
    isTop10: profile === "strong",
    isMvpCandidate: profile === "strong",
    storyWeight: null,
    createdAt: "2026-06-11T00:00:00.000Z",
  }));
}

function makeCorePlayer(id: string): Player {
  return {
    id,
    name: "Core Player",
    rating: 52,
    marketValue: 27,
    salaryDemand: 6,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: ["Diligent"],
    traitsNegative: [],
    coreStats: { pow: 52, spe: 51, men: 50, soc: 49 },
    attributeSheetStats: attrs({
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
    }),
    preferredDisciplineIds: [],
    disciplineRatings: { d_pow: 52, d_spe: 51, d_men: 50, d_soc: 49 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: 70,
    trainingMode: "mittel",
    trainingClass: "Hero",
  };
}

function makeBilloPlayer(): Player {
  return {
    id: "perf-billo",
    name: "Billo",
    rating: 42,
    marketValue: 15,
    salaryDemand: 3,
    className: "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: ["Diligent"],
    traitsNegative: [],
    coreStats: { pow: 42, spe: 41, men: 40, soc: 39 },
    attributeSheetStats: attrs({
      power: 42,
      health: 41,
      stamina: 40,
      speed: 41,
      dexterity: 40,
      intelligence: 39,
      awareness: 38,
      determination: 40,
      charisma: 39,
      will: 38,
      spirit: 37,
      torment: 38,
    }),
    preferredDisciplineIds: [],
    disciplineRatings: { d_pow: 42, d_spe: 41, d_men: 40, d_soc: 39 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: 58,
    trainingMode: "mittel",
    trainingClass: "Hero",
  };
}

function buildGameStateWithPotential(
  player: Player,
  performances: PlayerDisciplinePerformanceRecord[],
  potentialRecord: PlayerPotentialRecord,
): GameState {
  return {
    ...buildGameState(player, performances),
    playerPotential: [potentialRecord],
  };
}

describe("training performance season simulation", () => {
  it("rewards strong discipline performance with more performance setpoints than poor play", () => {
    const player = makeMidPlayer();
    const facilities = makeFacilities();
    const poor = buildOrganicSeasonProgression({
      gameState: buildGameState(player, makePerformanceRecords(player.id, 10, "poor")),
      player,
      facilities,
    });
    const strong = buildOrganicSeasonProgression({
      gameState: buildGameState(player, makePerformanceRecords(player.id, 10, "strong")),
      player,
      facilities,
    });

    expect(strong.performanceSetpoints).toBeGreaterThan(poor.performanceSetpoints);
    expect(poor.netSetpoints).toBeLessThan(strong.netSetpoints);
  });

  it("lands mid-tier players with a poor season in negative net setpoints", () => {
    const player = makeMidPlayer();
    const facilities = makeFacilities();
    const poor = buildOrganicSeasonProgression({
      gameState: buildGameState(player, makePerformanceRecords(player.id, 10, "poor")),
      player,
      facilities,
    });
    const strong = buildOrganicSeasonProgression({
      gameState: buildGameState(player, makePerformanceRecords(player.id, 10, "strong")),
      player,
      facilities,
    });

    expect(poor.netSetpoints).toBeLessThan(strong.netSetpoints);
  });

  it("lets elite players hold or grow after a strong season", () => {
    const player = makeMidPlayer();
    const topPlayer: Player = {
      ...player,
      id: "perf-top",
      name: "Perf Top",
      rating: 78,
      marketValue: 55,
      className: "Berserker",
      trainingClass: "Berserker",
      trainingMode: "hart",
      traitsPositive: ["Diligent", "Motivated"],
      coreStats: { pow: 84, spe: 72, men: 66, soc: 54 },
      attributeSheetStats: attrs({
        power: 78,
        health: 76,
        stamina: 74,
        speed: 70,
        dexterity: 68,
        intelligence: 54,
        awareness: 56,
        determination: 58,
        charisma: 48,
        will: 54,
        spirit: 50,
        torment: 62,
      }),
      disciplineRatings: { d_pow: 78, d_spe: 70, d_men: 58, d_soc: 48 },
    };
    const facilities = makeFacilities();
    const strong = buildOrganicSeasonProgression({
      gameState: {
        ...buildGameState(topPlayer, makePerformanceRecords(topPlayer.id, 10, "strong")),
        playerPotential: [
          {
            playerId: topPlayer.id,
            potentialBand: "elite",
            hiddenPotentialScore: 95,
            confidence: 0,
            source: "generated",
            hiddenPotentialOverallStars: 3.5,
            hiddenPotentialCeilingByAxis: { pow: 5, spe: 4, men: 3.5, soc: 3.5 },
          },
        ],
      },
      player: topPlayer,
      facilities,
    });

    expect(strong.netSetpoints).toBeGreaterThanOrEqual(0);
  });

  it("lets core players grow after a strong season with full performance credit", () => {
    const billo = makeBilloPlayer();
    const core = makeCorePlayer("perf-core");
    const facilities = makeFacilities();
    const billoStrong = buildOrganicSeasonProgression({
      gameState: buildGameState(billo, makePerformanceRecords(billo.id, 10, "strong")),
      player: billo,
      facilities,
    });
    const coreStrong = buildOrganicSeasonProgression({
      gameState: buildGameState(core, makePerformanceRecords(core.id, 10, "strong")),
      player: core,
      facilities,
    });

    expect(coreStrong.netSetpoints).toBeGreaterThan(0);
    expect(coreStrong.appliedPerformanceSetpoints).toBeCloseTo(billoStrong.appliedPerformanceSetpoints, 1);
  });

  it("applies full performance but less training when core player is near attribute ceiling", () => {
    const openCore = makeCorePlayer("perf-core-open");
    const cappedCore = makeCorePlayer("perf-core-capped");
    const facilities = makeFacilities();
    const performances = makePerformanceRecords(openCore.id, 10, "strong");
    const openResult = buildOrganicSeasonProgression({
      gameState: buildGameState(openCore, performances.map((entry) => ({ ...entry, playerId: openCore.id }))),
      player: openCore,
      facilities,
    });
    const cappedResult = buildOrganicSeasonProgression({
      gameState: buildGameStateWithPotential(
        cappedCore,
        performances.map((entry, index) => ({
          ...entry,
          id: `perf-capped-${index + 1}`,
          playerId: cappedCore.id,
        })),
        {
          playerId: cappedCore.id,
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
      ),
      player: cappedCore,
      facilities,
    });

    expect(cappedResult.appliedPerformanceSetpoints).toBeLessThan(openResult.appliedPerformanceSetpoints);
    expect(cappedResult.appliedPerformanceSetpoints).toBeGreaterThan(openResult.appliedPerformanceSetpoints * 0.5);
    const openTraining = openResult.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0);
    const cappedTraining = cappedResult.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0);
    expect(cappedTraining).toBeLessThan(openTraining);
  });
});
