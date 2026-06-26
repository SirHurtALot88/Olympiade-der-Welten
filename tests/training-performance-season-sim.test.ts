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
    marketValue: 12,
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
    expect(poor.performanceRegressionTotal).toBeGreaterThan(0);
    expect(strong.performanceRegressionTotal).toBeLessThanOrEqual(0);
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

    expect(poor.netSetpoints).toBeLessThanOrEqual(-1);
    expect(strong.netSetpoints).toBeGreaterThan(poor.netSetpoints);
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
    expect(strong.performanceRegressionTotal).toBeLessThan(0);
  });
});
