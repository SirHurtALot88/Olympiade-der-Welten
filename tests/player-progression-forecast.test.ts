import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
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
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [
        {
          id: "result-1",
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 0,
          teamsReady: 0,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-06-11T00:00:00.000Z",
          updatedAt: "2026-06-11T00:00:00.000Z",
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
      teamCount: 0,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
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

function pinNeutralPotential(gameState: GameState, playerId: string) {
  const openCeiling = Object.fromEntries(playerGeneratorAttributeKeys.map((attribute) => [attribute, 99]));
  gameState.playerPotential = [
    {
      playerId,
      potentialBand: "medium",
      hiddenPotentialScore: 58,
      hiddenPotentialOverallStars: 5,
      hiddenPotentialCeilingByAxis: { pow: 5, spe: 5, men: 5, soc: 5 },
      hiddenAttributeCeiling: openCeiling,
      confidence: 0,
      source: "generated",
    },
  ];
}

describe("player progression forecast", () => {
  it("uses the configured leicht/mittel/hart training XP", () => {
    const player = createPlayer();
    const gameState = createGameState(player);
    pinNeutralPotential(gameState, player.id);

    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "leicht" } }).baseTrainingXP).toBe(40);
    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "mittel" } }).baseTrainingXP).toBe(70);
    expect(buildPlayerProgressionForecast({ gameState, player, playerRating: null, seasonPerformance: null, trainingModeByPlayerId: { [player.id]: "hart" } }).baseTrainingXP).toBe(110);
  });

  it("uses scout potential as a training-speed modifier without changing performance XP", () => {
    const player = createPlayer({ potential: 90 });
    const gameState = createGameState(player);
    gameState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 90,
        confidence: 0,
        source: "generated",
      },
    ];
    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: createRating({ mvs: 5, ppsSeason: 20 }),
      seasonPerformance: createSeasonPerformance({ appearances: 2, totalPoints: 20 }),
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.baseTrainingXP).toBe(80);
    expect(forecast.potentialTrainingMultiplier).toBe(1.14);
    expect(forecast.scoutPotential?.starRating).toBe("4.0 Sterne");
    expect(forecast.performanceXP).toBe(95);
  });

  it("keeps lower-to-mid match performance visible beside hard training", () => {
    const player = createPlayer();
    const gameState = createGameState(player);
    pinNeutralPotential(gameState, player.id);
    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: createRating({ mvs: 4, ppsSeason: 8 }),
      seasonPerformance: createSeasonPerformance({ appearances: 2, totalPoints: 8, top10Count: 1 }),
      trainingModeByPlayerId: { [player.id]: "hart" },
    });

    expect(forecast.baseTrainingXP).toBe(110);
    expect(forecast.performanceXP).toBeGreaterThan(0);
  });

  it("lets unused players stagnate instead of auto-growing", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: null,
      seasonPerformance: null,
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.earnedXP).toBeGreaterThan(0);
    expect(forecast.netDevelopmentXP).toBeLessThanOrEqual(0);
    expect(forecast.seasonProjectedXP).toBe(0);
    expect(["negative", "strong_negative", "neutral"]).toContain(forecast.xpTrend);
    expect(forecast.performanceXP).toBe(0);
  });

  it("gives weaker players more growth credit when they outperform their bracket", () => {
    const underdog = createPlayer({
      id: "player-underdog",
      rating: 42,
      marketValue: 8,
      coreStats: { pow: 42, spe: 40, men: 39, soc: 37 },
    });
    const favorite = createPlayer({
      id: "player-favorite",
      rating: 82,
      marketValue: 75,
      coreStats: { pow: 82, spe: 80, men: 79, soc: 78 },
    });

    const underdogForecast = buildPlayerProgressionForecast({
      gameState: createGameState(underdog),
      player: underdog,
      playerRating: createRating({ playerId: underdog.id, ovrNormalized: 42, mvs: 6, ppsSeason: 10 }),
      seasonPerformance: createSeasonPerformance({ appearances: 5, totalPoints: 10 }),
      trainingModeByPlayerId: { [underdog.id]: "mittel" },
    });
    const favoriteForecast = buildPlayerProgressionForecast({
      gameState: createGameState(favorite),
      player: favorite,
      playerRating: createRating({ playerId: favorite.id, ovrNormalized: 82, mvs: 6, ppsSeason: 10 }),
      seasonPerformance: createSeasonPerformance({ appearances: 5, totalPoints: 10 }),
      trainingModeByPlayerId: { [favorite.id]: "mittel" },
    });

    expect(underdogForecast.developmentFactors.performanceFactor).toBeGreaterThan(favoriteForecast.developmentFactors.performanceFactor);
    expect(underdogForecast.netDevelopmentXP).toBeGreaterThan(favoriteForecast.netDevelopmentXP);
  });

  it("still lets weak players slip backwards after a really bad season", () => {
    const player = createPlayer({
      rating: 40,
      marketValue: 7,
      coreStats: { pow: 39, spe: 37, men: 36, soc: 35 },
    });
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ ovrNormalized: 40, mvs: 2.5, ppsSeason: 3 }),
      seasonPerformance: createSeasonPerformance({ appearances: 5, totalPoints: 3 }),
      trainingModeByPlayerId: { [player.id]: "leicht" },
    });

    expect(forecast.regressionBreakdown.poorPerformance).toBeGreaterThan(0);
    expect(forecast.netDevelopmentXP).toBeLessThan(0);
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

    expect(forecast.appearanceXP).toBe(60);
    expect(forecast.mvsXP).toBe(40);
    expect(forecast.ppsBonusXP).toBe(35);
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
    expect(forecast.highlightXP).toBeGreaterThan(0);
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
    expect(diligentForecast.trainingFormTier).toBe("B");
    expect(lazyForecast.trainingFormTier).toBe("D");
    expect(diligentForecast.earnedXP).toBeGreaterThan(lazyForecast.earnedXP);
    expect(lazyForecast.traitModifierPct).toBe(-8);
    expect(lazyForecast.regressionPressure).toBeGreaterThan(diligentForecast.regressionPressure);
  });

  it("stays preview-only season-end-only", () => {
    const player = createPlayer();
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: null,
      seasonPerformance: null,
    });

    expect(forecast.audit.seasonEndOnly).toBe(true);
    expect(forecast.audit.productiveWrites).toBe(false);
    expect(forecast.sourceStatus.writes).toBe("preview_only");
    expect(forecast.sourceStatus.facilities).toBe("missing_source");
  });

  it("reads training center facility bonus from the player roster team", () => {
    const player = createPlayer();
    const gameState = createGameState(player);
    gameState.teams = [{ teamId: "team-1", name: "Team One", shortCode: "T-1", cash: 100, rosterLimit: 14 } as never];
    gameState.rosters = [{ teamId: "team-1", playerId: player.id, roleTag: "starter", joinedSeasonId: "season-1" } as never];
    gameState.seasonState.teamFacilities = {
      "team-1": {
        facilities: {
          training_center: { level: 2, enabled: true, conditionPct: 100, activeVariant: null },
        },
      },
    };

    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: null,
      seasonPerformance: null,
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });
    const facilityEvent = forecast.xpEvents.find((event) => event.type === "facility_modifier");

    expect(forecast.sourceStatus.facilities).toBe("ready");
    expect(facilityEvent?.sourceStatus).toBe("ready");
    expect(facilityEvent?.label).toContain("Training Center");
    expect(facilityEvent?.xpBeforeTraits).toBeGreaterThan(0);
  });

  it("moves top performers into positive net development", () => {
    const player = createPlayer({ potential: 92, traitsPositive: ["Diligent", "Motivated", "Disciplined"] });
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ ovrNormalized: 68, mvs: 16, ppsSeason: 42 }),
      seasonPerformance: createSeasonPerformance({ appearances: 8, totalPoints: 42, top10Count: 2, mvpCount: 1 }),
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.netDevelopmentXP).toBeGreaterThan(0);
    expect(forecast.netDevelopmentXP).toBeLessThanOrEqual(260);
    expect(["positive", "strong_positive"]).toContain(forecast.xpTrend);
    expect(forecast.regressionRisk).not.toBe("high");
    expect(forecast.regressionBreakdown.seasonGainSoftCeiling).toBeGreaterThan(0);
  });

  it("pushes underperforming starter-level players into regression", () => {
    const player = createPlayer({ potential: 63, rating: 60 });
    const gameState = createGameState(player);
    gameState.rosters = [{ teamId: "team-1", playerId: player.id, roleTag: "starter", joinedSeasonId: "season-1" } as never];
    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: createRating({ ovrNormalized: 60, mvs: 2, ppsSeason: 4 }),
      seasonPerformance: createSeasonPerformance({ appearances: 4, totalPoints: 4 }),
      trainingModeByPlayerId: { [player.id]: "mittel" },
    });

    expect(forecast.netDevelopmentXP).toBeLessThan(0);
    expect(["negative", "strong_negative"]).toContain(forecast.xpTrend);
  });

  it("pushes low-playtime underperformers into negative development", () => {
    const player = createPlayer({ traitsNegative: ["Lazy", "Diva"], potential: 58, rating: 62 });
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ ovrNormalized: 62, mvs: 1, ppsSeason: 1 }),
      seasonPerformance: createSeasonPerformance({ appearances: 1, totalPoints: 1 }),
      trainingModeByPlayerId: { [player.id]: "leicht" },
    });

    expect(forecast.netDevelopmentXP).toBeLessThan(0);
    expect(["negative", "strong_negative"]).toContain(forecast.xpTrend);
    expect(forecast.regressionPressure).toBeGreaterThan(0);
  });

  it("warns expensive stars with bad performance through regression pressure", () => {
    const player = createPlayer({ marketValue: 90000, salaryDemand: 20000, potential: 80, rating: 78 });
    const gameState = createGameState(player);
    gameState.rosters = [{ teamId: "team-1", playerId: player.id, roleTag: "star", joinedSeasonId: "season-1" } as never];
    const forecast = buildPlayerProgressionForecast({
      gameState,
      player,
      playerRating: createRating({ ovrNormalized: 78, mvs: 2, ppsSeason: 5 }),
      seasonPerformance: createSeasonPerformance({ appearances: 7, totalPoints: 5 }),
      boardTrustScore: 24,
    });

    expect(forecast.regressionBreakdown.boardTrust).toBeGreaterThan(0);
    expect(forecast.regressionBreakdown.starUnderperformance).toBeGreaterThan(0);
    expect(forecast.regressionBreakdown.highValueUnderperformance).toBeGreaterThan(0);
    expect(forecast.regressionRisk).not.toBe("none");
  });

  it("charges more maintenance for high CA and small CA-PO gaps", () => {
    const lowCa = createPlayer({ id: "low", rating: 45, potential: 90 });
    const highCa = createPlayer({ id: "high", rating: 88, potential: 90 });
    const lowForecast = buildPlayerProgressionForecast({ gameState: createGameState(lowCa), player: lowCa, playerRating: createRating({ ovrNormalized: 45 }), seasonPerformance: null });
    const highForecast = buildPlayerProgressionForecast({ gameState: createGameState(highCa), player: highCa, playerRating: createRating({ ovrNormalized: 88 }), seasonPerformance: null });

    expect(highForecast.maintenanceXP).toBeGreaterThan(lowForecast.maintenanceXP);
    expect(highForecast.developmentFactors.potentialGapFactor).toBeLessThan(lowForecast.developmentFactors.potentialGapFactor);
  });

  it("gives free agents an ambient development/decay pass", () => {
    const player = createPlayer({ traitsNegative: ["Mercenary"], potential: 50, rating: 60 });
    const forecast = buildPlayerProgressionForecast({
      gameState: createGameState(player),
      player,
      playerRating: createRating({ ovrNormalized: 60 }),
      seasonPerformance: null,
    });

    expect(forecast.developmentRoute).toBe("free_agent_ambient");
    expect(forecast.netDevelopmentXP).not.toBe(0);
  });

  it("reduces training multiplier when primary route axis is capped", () => {
    const player = createPlayer({
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
    const openState = createGameState(player);
    openState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 84,
        confidence: 0,
        source: "generated",
        hiddenPotentialCeilingByAxis: { pow: 4.5, spe: 4, men: 3.5, soc: 3.5 },
        hiddenPotentialOverallStars: 4,
        hiddenAttributeCeiling: {
          power: 80,
          health: 82,
          stamina: 78,
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
    const cappedState = createGameState(player);
    cappedState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "medium",
        hiddenPotentialScore: 72,
        confidence: 0,
        source: "generated",
        hiddenPotentialCeilingByAxis: { pow: 2.5, spe: 4, men: 3.5, soc: 3.5 },
        hiddenPotentialOverallStars: 3,
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

    const openForecast = buildPlayerProgressionForecast({
      gameState: openState,
      player,
      playerRating: createRating({ ovrNormalized: 60 }),
      seasonPerformance: null,
    });
    const cappedForecast = buildPlayerProgressionForecast({
      gameState: cappedState,
      player,
      playerRating: createRating({ ovrNormalized: 60 }),
      seasonPerformance: null,
    });

    expect(cappedForecast.potentialTrainingMultiplier).toBeLessThan(openForecast.potentialTrainingMultiplier);
    expect(cappedForecast.baseTrainingXP).toBeLessThan(openForecast.baseTrainingXP);
  });

  it("keeps discipline performance XP independent of potential but scales net XP with PO gap", () => {
    const player = createPlayer({
      rating: 55,
      coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    });
    const seasonPerformance = createSeasonPerformance({ appearances: 5, totalPoints: 40, top10Count: 1 });
    const playerRating = createRating({ ovrNormalized: 55, mvs: 8, ppsSeason: 40 });

    const lowPoState = createGameState(player);
    lowPoState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "low",
        hiddenPotentialScore: 52,
        confidence: 0,
        source: "generated",
        hiddenPotentialOverallStars: 2,
        hiddenPotentialCeilingByAxis: { pow: 2, spe: 2, men: 2, soc: 2 },
      },
    ];
    const highPoState = createGameState(player);
    highPoState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 88,
        confidence: 0,
        source: "generated",
        hiddenPotentialOverallStars: 4.5,
        hiddenPotentialCeilingByAxis: { pow: 4.5, spe: 4, men: 3.5, soc: 3.5 },
      },
    ];

    const lowForecast = buildPlayerProgressionForecast({
      gameState: lowPoState,
      player,
      playerRating,
      seasonPerformance,
    });
    const highForecast = buildPlayerProgressionForecast({
      gameState: highPoState,
      player,
      playerRating,
      seasonPerformance,
    });

    expect(highForecast.performanceXP).toBe(lowForecast.performanceXP);
    expect(highForecast.performanceXP).toBeGreaterThan(0);
    expect(highForecast.netDevelopmentXP).toBeGreaterThan(lowForecast.netDevelopmentXP);
    expect(highForecast.baseTrainingXP).toBeGreaterThan(lowForecast.baseTrainingXP);
  });

  it("lowers net XP from capped routes without changing discipline performance XP", () => {
    const player = createPlayer({
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
    const seasonPerformance = createSeasonPerformance({ appearances: 4, totalPoints: 32, top10Count: 1 });
    const playerRating = createRating({ ovrNormalized: 60, mvs: 6, ppsSeason: 32 });

    const openState = createGameState(player);
    openState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 84,
        confidence: 0,
        source: "generated",
        hiddenPotentialCeilingByAxis: { pow: 4.5, spe: 4, men: 3.5, soc: 3.5 },
        hiddenPotentialOverallStars: 4,
        hiddenAttributeCeiling: {
          power: 80,
          health: 82,
          stamina: 78,
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
    const cappedState = createGameState(player);
    cappedState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "medium",
        hiddenPotentialScore: 72,
        confidence: 0,
        source: "generated",
        hiddenPotentialCeilingByAxis: { pow: 2.5, spe: 4, men: 3.5, soc: 3.5 },
        hiddenPotentialOverallStars: 3,
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

    const openForecast = buildPlayerProgressionForecast({
      gameState: openState,
      player,
      playerRating,
      seasonPerformance,
    });
    const cappedForecast = buildPlayerProgressionForecast({
      gameState: cappedState,
      player,
      playerRating,
      seasonPerformance,
    });

    expect(cappedForecast.performanceXP).toBe(openForecast.performanceXP);
    expect(cappedForecast.baseTrainingXP).toBeLessThan(openForecast.baseTrainingXP);
    expect(cappedForecast.netDevelopmentXP).toBeLessThan(openForecast.netDevelopmentXP);
  });
});
