import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import {
  buildPlayerProgressionForecast,
  PLAYER_PROGRESSION_XP_CONSTANTS,
} from "@/lib/training/player-progression-forecast";

function createPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "player-1",
    name: partial.name ?? "Player One",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 10000,
    salaryDemand: partial.salaryDemand ?? 1000,
    className: partial.className ?? "Runner",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { d1: 60 },
    previousDisciplineRatings: partial.previousDisciplineRatings,
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 0,
    currentXP: partial.currentXP,
    spentXP: partial.spentXP,
    lifetimeXP: partial.lifetimeXP,
    trainingMode: partial.trainingMode,
  };
}

function createGameState(player: Player): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [
        {
          id: "result-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
        },
      ],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [],
    teamIdentities: [],
    players: [player],
    disciplines: [{ id: "d1", name: "Diszi 1", category: "power", weight: 1 }],
    rosters: [],
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
      matchedRosterCount: 0,
      warnings: [],
    },
  } satisfies GameState;
}

function createRating(partial: Partial<PlayerRatingContractRow> = {}): PlayerRatingContractRow {
  return {
    playerId: partial.playerId ?? "player-1",
    rawOvrScore: partial.rawOvrScore ?? 60,
    ovrNormalized: partial.ovrNormalized ?? 60,
    ovrRank: partial.ovrRank ?? 1,
    ppsSeason: partial.ppsSeason ?? null,
    ppsSeasonRank: partial.ppsSeasonRank ?? null,
    ppPow: partial.ppPow ?? null,
    ppPowRank: partial.ppPowRank ?? null,
    ppSpe: partial.ppSpe ?? null,
    ppSpeRank: partial.ppSpeRank ?? null,
    ppMen: partial.ppMen ?? null,
    ppMenRank: partial.ppMenRank ?? null,
    ppSoc: partial.ppSoc ?? null,
    ppSocRank: partial.ppSocRank ?? null,
    ratingPps: partial.ratingPps ?? null,
    mvs: partial.mvs ?? null,
    mvsRank: partial.mvsRank ?? null,
    marketValue: partial.marketValue ?? null,
    sourceStatus: partial.sourceStatus ?? {
      rawOvr: "ready",
      normalizedOvr: "ready",
      ppsSeason: partial.ppsSeason == null ? "missing_source" : "ready",
      mvs: partial.mvs == null ? "missing_source" : "ready",
    },
    warnings: partial.warnings ?? [],
  };
}

function createSeasonPerformance(partial: Partial<PlayerSeasonPerformanceSummary> = {}): PlayerSeasonPerformanceSummary {
  return {
    seasonId: "season-1",
    seasonName: "Season 1",
    sourceLabel: "test",
    appearances: partial.appearances ?? 0,
    totalPoints: partial.totalPoints ?? null,
    pointsByArea: partial.pointsByArea ?? { pow: 0, spe: 0, men: 0, soc: 0 },
    averageContribution: partial.averageContribution ?? null,
    averageFinalScore: partial.averageFinalScore ?? null,
    top10Count: partial.top10Count ?? 0,
    mvpCount: partial.mvpCount ?? 0,
    bestDisciplineLabel: partial.bestDisciplineLabel ?? null,
    bestDisciplineScore: partial.bestDisciplineScore ?? null,
    weakestDisciplineLabel: partial.weakestDisciplineLabel ?? null,
    weakestDisciplineScore: partial.weakestDisciplineScore ?? null,
    latestDisciplineLabel: partial.latestDisciplineLabel ?? null,
    latestFinalScore: partial.latestFinalScore ?? null,
    latestContribution: partial.latestContribution ?? null,
    latestRankInDiscipline: partial.latestRankInDiscipline ?? null,
    latestMatchdayId: partial.latestMatchdayId ?? null,
    topDisciplineRows: partial.topDisciplineRows ?? [],
    matchdayBreakdown: partial.matchdayBreakdown ?? [],
    disciplineBreakdown: partial.disciplineBreakdown ?? [],
    warnings: partial.warnings ?? [],
  };
}

describe("player progression forecast", () => {
  it("uses the configured leicht/mittel/hart training XP", () => {
    const player = createPlayer();
    const gameState = createGameState(player);

    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "leicht" } }).baseTrainingXP).toBe(40);
    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "mittel" } }).baseTrainingXP).toBe(70);
    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "hart" } }).baseTrainingXP).toBe(110);
  });

  it("uses scout potential as a training-speed modifier without changing performance XP", () => {
    const player = createPlayer({ potential: 90 });
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ mvs: 5, ppsSeason: 20 }),
      seasonPerformance: createSeasonPerformance({ appearances: 2, totalPoints: 20 }),
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.baseTrainingXP).toBe(80);
    expect(forecast.potentialTrainingMultiplier).toBe(1.14);
    expect(forecast.scoutPotential?.starRating).toBe("4.5 Sterne");
    expect(forecast.performanceXP).toBe(190);
  });

  it("keeps hard training below a good lower-to-mid match performance bundle", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ mvs: 4, ppsSeason: 8 }),
      seasonPerformance: createSeasonPerformance({ appearances: 2, totalPoints: 8, top10Count: 1 }),
      trainingModeByPlayerId: { [player.id]: "hart" },
    });

    expect(forecast.baseTrainingXP).toBe(110);
    expect(forecast.performanceXP).toBeGreaterThan(forecast.baseTrainingXP);
  });

  it("gives unused players only training XP", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: null,
      seasonPerformance: null,
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.seasonProjectedXP).toBe(70);
    expect(forecast.performanceXP).toBe(0);
  });

  it("adds appearance XP and MVS XP, while PPs stay capped as a bonus", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ mvs: 10, ppsSeason: 100 }),
      seasonPerformance: createSeasonPerformance({ appearances: 3, totalPoints: 100 }),
      trainingModeByPlayerId: { [player.id]: "leicht" },
    });

    expect(forecast.appearanceXP).toBe(45);
    expect(forecast.mvsXP).toBe(200);
    expect(forecast.ppsBonusXP).toBe(70);
    expect(forecast.ppsBonusXP).toBeLessThan(forecast.mvsXP);
  });

  it("makes top player and highlight bonuses stronger than base light training", () => {
    const player = createPlayer();
    const gameState = createGameState(player);
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: player.id,
        activePlayerId: null,
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 70,
        finalPlayerScore: 90,
        scoreContribution: 20,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: null,
        createdAt: "2026-06-11T00:00:00.000Z",
      },
    ];

    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: null,
      seasonPerformance: createSeasonPerformance({ appearances: 1, top10Count: 1, mvpCount: 1 }),
      trainingModeByPlayerId: { [player.id]: "leicht" },
    });

    expect(forecast.topPlayerXP).toBeGreaterThan(PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.leicht);
    expect(forecast.highlightXP).toBeGreaterThan(PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode.leicht);
  });

  it("audits Diligent and Lazy trait modifiers", () => {
    const diligent = createPlayer({ id: "diligent", traitsPositive: ["Diligent"] });
    const lazy = createPlayer({ id: "lazy", traitsNegative: ["Lazy"] });

    const diligentForecast = buildPlayerProgressionForecast({
      gameState: createGameState(diligent),
      player: diligent,
      playerRating: null,
      seasonPerformance: null,
      trainingModeByPlayerId: { diligent: "mittel" },
    });
    const lazyForecast = buildPlayerProgressionForecast({
      gameState: createGameState(lazy),
      player: lazy,
      playerRating: null,
      seasonPerformance: null,
      trainingModeByPlayerId: { lazy: "mittel" },
    });

    expect(diligentForecast.traitModifierPct).toBe(10);
    expect(diligentForecast.seasonProjectedXP).toBeGreaterThan(70);
    expect(lazyForecast.traitModifierPct).toBe(-8);
    expect(lazyForecast.seasonProjectedXP).toBeLessThan(70);
  });

  it("exposes rating-tier costs and stays preview-only season-end-only", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: null,
      seasonPerformance: null,
    });

    expect(forecast.ratingTierCosts.F).toBeLessThan(forecast.ratingTierCosts.C ?? 0);
    expect(forecast.ratingTierCosts.S).toBeGreaterThan(forecast.ratingTierCosts.B ?? 0);
    expect(forecast.ratingTierCosts["99"]).toBeNull();
    expect(forecast.possibleUpgradeSummary).toContain("F/D-Upgrades");
    expect(forecast.audit.seasonEndOnly).toBe(true);
    expect(forecast.audit.productiveWrites).toBe(false);
    expect(forecast.sourceStatus.writes).toBe("preview_only");
  });
});
