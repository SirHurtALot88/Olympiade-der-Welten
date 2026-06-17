import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PlayerProgressionForecast } from "@/lib/training/training-plan-types";
import {
  buildCoreStatsFromDisciplineRatings,
  buildSeasonEndProgressionPreview,
  formatSeasonEndProgressionDisciplineValue,
  getProgressionRatingTier,
} from "@/lib/training/season-end-progression-preview";

function createPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "player-1",
    name: partial.name ?? "Player One",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 10,
    salaryDemand: partial.salaryDemand ?? 1,
    displayMarketValue: partial.displayMarketValue,
    displaySalary: partial.displaySalary,
    className: partial.className ?? "Runner",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats:
      partial.attributeSheetStats ?? {
        power: 30,
        health: 30,
        stamina: 30,
        intelligence: 30,
        awareness: 30,
        determination: 30,
        speed: 30,
        dexterity: 30,
        charisma: 30,
        will: 30,
        spirit: 30,
        torment: 30,
      },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { tdm: 30, fechten: 30, "speed-schach": 30 },
    previousDisciplineRatings: partial.previousDisciplineRatings,
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 3, above40: 0, above60: 0, above80: 0 },
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
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, matchdayResults: [], playerDisciplinePerformances: [], disciplineHighlights: [] },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team One", shortCode: "T-O", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0, humanControlled: true }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "tdm", name: "TDM", category: "power", weight: 1 },
      { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      { id: "speed-schach", name: "Schach", category: "mental", weight: 1 },
    ],
    rosters: [{ id: "active-1", teamId: "team-1", playerId: player.id, salary: 1, marketValue: 10, contractLength: 1, roleTag: "core" }],
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
  } satisfies GameState;
}

function createForecast(partial: Partial<PlayerProgressionForecast> = {}): PlayerProgressionForecast {
  return {
    playerId: partial.playerId ?? "player-1",
    trainingMode: partial.trainingMode ?? "mittel",
    currentXP: partial.currentXP ?? 0,
    spentXP: partial.spentXP ?? 0,
    lifetimeXP: partial.lifetimeXP ?? null,
    seasonProjectedXP: partial.seasonProjectedXP ?? 100,
    earnedXP: partial.earnedXP ?? partial.seasonProjectedXP ?? 100,
    maintenanceXP: partial.maintenanceXP ?? 0,
    regressionPressure: partial.regressionPressure ?? 0,
    netDevelopmentXP: partial.netDevelopmentXP ?? partial.seasonProjectedXP ?? 100,
    trainingFormTier: partial.trainingFormTier ?? "B",
    xpTrend: partial.xpTrend ?? "positive",
    regressionRisk: partial.regressionRisk ?? "none",
    developmentRoute: partial.developmentRoute ?? "core_growth",
    currentAbilityRating: partial.currentAbilityRating ?? 50,
    currentAbilityTier: partial.currentAbilityTier ?? "C",
    currentAbilityStars: partial.currentAbilityStars ?? "2.5 Sterne",
    potentialRating: partial.potentialRating ?? 70,
    potentialTier: partial.potentialTier ?? "A",
    potentialStars: partial.potentialStars ?? "3.5 Sterne",
    developmentFactors: partial.developmentFactors ?? {
      playtimeFactor: 1,
      performanceFactor: 1,
      trainingFormFactor: 1,
      potentialGapFactor: 1,
      traitFactor: 1,
      routeFitFactor: 1,
    },
    maintenanceBreakdown: partial.maintenanceBreakdown ?? {
      leagueMedianRegression: 0,
      currentAbility: 0,
      role: 0,
      potentialProximity: 0,
      overPotential: 0,
    },
    regressionBreakdown: partial.regressionBreakdown ?? {
      lowPlaytime: 0,
      poorPerformance: 0,
      sharpness: 0,
      boardTrust: 0,
      negativeTraits: 0,
      routeConflict: 0,
      starUnderperformance: 0,
      highValueUnderperformance: 0,
      poorTrainingValuePressure: 0,
      potentialCeiling: 0,
      seasonGainSoftCeiling: 0,
      seasonGainHardCap: 0,
    },
    baseTrainingXP: partial.baseTrainingXP ?? 70,
    appearanceXP: partial.appearanceXP ?? 0,
    mvsXP: partial.mvsXP ?? 0,
    ppsBonusXP: partial.ppsBonusXP ?? 0,
    topPlayerXP: partial.topPlayerXP ?? 0,
    highlightXP: partial.highlightXP ?? 0,
    performanceXP: partial.performanceXP ?? 30,
    traitModifierPct: partial.traitModifierPct ?? 0,
    traitMultiplier: partial.traitMultiplier ?? 1,
    potentialTrainingMultiplier: partial.potentialTrainingMultiplier ?? 1,
    scoutPotential: partial.scoutPotential ?? null,
    xpBeforeTraits: partial.xpBeforeTraits ?? 100,
    xpAfterTraits: partial.xpAfterTraits ?? 100,
    xpEvents: partial.xpEvents ?? [],
    possibleUpgradeSummary: partial.possibleUpgradeSummary ?? "preview",
    ratingTierCosts: partial.ratingTierCosts ?? {
      F: 45,
      E: 55,
      D: 70,
      C: 95,
      B: 130,
      A: 180,
      S: 250,
      "S+": 360,
      "99": null,
    },
    fatigueStrain: partial.fatigueStrain ?? { label: "mittel", score: 30, warning: "ok" },
    sourceStatus: partial.sourceStatus ?? { appearances: "ready", mvs: "ready", pps: "ready", highlights: "ready", facilities: "future_source", writes: "preview_only" },
    audit: partial.audit ?? { mvsPpsCoupling: "test", seasonEndOnly: true, productiveWrites: false, warnings: [] },
  };
}

function previewFor(player: Player, forecast: PlayerProgressionForecast, attribute = "power" as const, facilities = {}) {
  return buildSeasonEndProgressionPreview({
    gameState: createGameState(player),
    teamId: "team-1",
    forecastsByPlayerId: new Map([[player.id, forecast]]),
    upgradeRequests: [{ playerId: player.id, attribute }],
    facilities,
  }).rows[0]!;
}

describe("season-end progression preview", () => {
  it("spends XP in preview without productive writes", () => {
    const row = previewFor(createPlayer(), createForecast({ seasonProjectedXP: 100 }), "power");

    expect(row.status).toBe("planned");
    expect(row.attributeBefore).toBe(30);
    expect(row.attributeAfter).toBe(31);
    expect(row.remainingXP).toBe(30);
    expect(row.confirmContract.productiveWrites).toBe(false);
  });

  it("blocks when XP is insufficient", () => {
    const row = previewFor(createPlayer(), createForecast({ baseTrainingXP: 10, performanceXP: 10, seasonProjectedXP: 20 }), "power");

    expect(row.status).toBe("blocked");
    expect(row.blockReason).toBe("xp_insufficient");
  });

  it("blocks attributes at 99", () => {
    const row = previewFor(createPlayer({ attributeSheetStats: { power: 99, health: 30, stamina: 30, intelligence: 30, awareness: 30, determination: 30, speed: 30, dexterity: 30, charisma: 30, will: 30, spirit: 30, torment: 30 } }), createForecast({ seasonProjectedXP: 999 }), "power");

    expect(row.status).toBe("blocked");
    expect(row.blockReason).toBe("attribute_at_99");
  });

  it("uses rating tier costs", () => {
    expect(getProgressionRatingTier(30)).toBe("D");
    expect(previewFor(createPlayer(), createForecast({ seasonProjectedXP: 100 }), "power").upgradeCost).toBe(70);
  });

  it("applies Academy only to low-tier costs", () => {
    const low = previewFor(createPlayer(), createForecast({ seasonProjectedXP: 100 }), "power", { academyLevel: 1 });
    const high = previewFor(createPlayer({ attributeSheetStats: { power: 70, health: 30, stamina: 30, intelligence: 30, awareness: 30, determination: 30, speed: 30, dexterity: 30, charisma: 30, will: 30, spirit: 30, torment: 30 } }), createForecast({ seasonProjectedXP: 250 }), "power", { academyLevel: 1 });

    expect(low.facilityEffects.facilityDiscountPct).toBe(3);
    expect(high.facilityEffects.facilityDiscountPct).toBe(0);
  });

  it("applies Specialist Wing only to matching attribute groups", () => {
    const power = previewFor(createPlayer(), createForecast({ seasonProjectedXP: 100 }), "power", { specialistWingLevel: 1 });
    const charisma = previewFor(createPlayer(), createForecast({ seasonProjectedXP: 100 }), "charisma", { specialistWingLevel: 1 });

    expect(power.facilityEffects.facilityDiscountPct).toBe(3);
    expect(charisma.facilityEffects.facilityDiscountPct).toBe(0);
  });

  it("applies training center only to base training XP", () => {
    const row = previewFor(createPlayer(), createForecast({ baseTrainingXP: 100, performanceXP: 50, seasonProjectedXP: 150 }), "power", { trainingCenterLevel: 2 });

    expect(row.facilityEffects.xpBeforeFacility).toBe(100);
    expect(row.facilityEffects.xpAfterFacility).toBe(110);
    expect(row.availableXP).toBe(160);
  });

  it("shows scouting and analytics quality without faking missing potential values", () => {
    const preview = buildSeasonEndProgressionPreview({
      gameState: createGameState(createPlayer()),
      teamId: "team-1",
      forecastsByPlayerId: new Map([["player-1", createForecast({ seasonProjectedXP: 100 })]]),
      upgradeRequests: [{ playerId: "player-1", attribute: "power" }],
      facilities: { scoutingOfficeLevel: 2, analyticsRoomLevel: 2 },
    });

    expect(preview.rows[0]?.facilityEffects.appliedEffects).toContain("scouting_office_potential_info_visible:potential_source_missing");
    expect(preview.rows[0]?.facilityEffects.appliedEffects).toContain("analytics_room_forecast_accuracy_visible:no_fake_values");
    expect(preview.warnings).toContain("facility_forecast:player-1:potential_source_missing");
    expect(preview.warnings).toContain("facility_forecast:player-1:no_fake_values");
  });

  it("shows discipline changes after an attribute preview", () => {
    const row = previewFor(createPlayer({ attributeSheetStats: { power: 98, health: 30, stamina: 30, intelligence: 30, awareness: 30, determination: 30, speed: 30, dexterity: 30, charisma: 30, will: 30, spirit: 30, torment: 30 } }), createForecast({ seasonProjectedXP: 500 }), "power");

    expect(row.disciplineDeltas.some((entry) => (entry.disciplineDelta ?? 0) > 0)).toBe(true);
  });

  it("does not rebase discipline deltas from stale imported values when one attribute increases", () => {
    const row = previewFor(
      createPlayer({
        attributeSheetStats: {
          power: 33,
          health: 35,
          stamina: 69,
          intelligence: 52,
          awareness: 32,
          determination: 59,
          speed: 46,
          dexterity: 47,
          charisma: 90,
          will: 40,
          spirit: 42,
          torment: 30,
        },
        disciplineRatings: { tdm: 46, fechten: 46, "speed-schach": 46, showcase: 46, climbing: 46 },
      }),
      createForecast({ seasonProjectedXP: 500 }),
      "stamina",
    );

    expect(Math.max(...row.disciplineDeltas.map((entry) => entry.disciplineDelta ?? 0))).toBeLessThanOrEqual(1);
  });

  it("derives POW SPE MEN SOC from the average current discipline values per category", () => {
    const coreStats = buildCoreStatsFromDisciplineRatings({
      disciplines: [
        { id: "tdm", name: "TDM", category: "power", weight: 1 },
        { id: "gewichtheben", name: "Gewichtheben", category: "power", weight: 1 },
        { id: "staffel", name: "Staffel", category: "speed", weight: 1 },
        { id: "schach", name: "Schach", category: "mental", weight: 1 },
        { id: "showcase", name: "Showcase", category: "social", weight: 1 },
      ],
      disciplineRatings: {
        tdm: 40,
        gewichtheben: 60,
        staffel: 70,
        schach: 80,
        showcase: 90,
      },
      fallback: { pow: 1, spe: 1, men: 1, soc: 1 },
    });

    expect(coreStats).toEqual({ pow: 50, spe: 70, men: 80, soc: 90 });
  });

  it("formats drawer discipline deltas only when positive", () => {
    expect(formatSeasonEndProgressionDisciplineValue(84, 2)).toBe("84 (+2)");
    expect(formatSeasonEndProgressionDisciplineValue(82, 0)).toBe("82");
  });

  it("audits market value and salary deviations", () => {
    const row = previewFor(createPlayer({ marketValue: 999, salaryDemand: 999 }), createForecast({ seasonProjectedXP: 100 }), "power");

    expect(row.economyAudit.warningLevel).not.toBe("none");
    expect(row.economyAudit.warnings.length).toBeGreaterThan(0);
    expect(row.economyAudit.marketValueWarnings).toContain("market_value_delta_high");
    expect(row.economyAudit.salaryWarnings).toContain("contract_salary_locked");
    expect(row.economyAudit.salaryWarnings).toContain("renewal_salary_preview_only");
    expect(row.economyAudit.renewalSalaryPreview).not.toBeUndefined();
    expect(row.economyAudit.mvsAfterPreview).toBe(row.economyAudit.mvsBefore);
  });
});
