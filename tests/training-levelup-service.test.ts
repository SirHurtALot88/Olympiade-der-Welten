import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributeName, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { PlayerProgressionForecast } from "@/lib/training/training-plan-types";
import {
  DEVELOPMENT_MAX_ATTRIBUTE_VALUE,
  DEVELOPMENT_POINTS_PER_LEVEL,
  buildAiTrainingPointAllocation,
  buildDevelopmentLevelSummary,
  buildPlayerDevelopmentLevelupModel,
  buildSignatureShiftPreview,
  deriveAttributeAffinityProfile,
  getAttributeTrainingPointBaseCost,
  getAttributeTrainingPointCost,
} from "@/lib/training/training-levelup-service";

function attributes(overrides: Partial<PlayerGeneratorAttributes> = {}): PlayerGeneratorAttributes {
  return {
    power: 55,
    health: 40,
    stamina: 45,
    intelligence: 62,
    awareness: 50,
    determination: 28,
    speed: 73,
    dexterity: 68,
    charisma: 31,
    will: 58,
    spirit: 36,
    torment: 87,
    ...overrides,
  };
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-test",
    name: "Test Hero",
    rating: 55,
    marketValue: 30,
    salaryDemand: 6,
    className: "Hero",
    race: "Human",
    alignment: "Good",
    gender: "unknown",
    subclasses: ["Knight"],
    traitsPositive: ["Diligent", "Ambitious"],
    traitsNegative: [],
    coreStats: { pow: 55, spe: 70, men: 60, soc: 50 },
    attributeSheetStats: attributes(),
    attributeSheetRatings: {},
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 60,
    potential: 70,
    ...overrides,
  };
}

function forecast(overrides: Partial<PlayerProgressionForecast> = {}): PlayerProgressionForecast {
  return {
    playerId: "player-test",
    trainingMode: "mittel",
    currentXP: 360,
    spentXP: 0,
    lifetimeXP: 360,
    seasonProjectedXP: 120,
    earnedXP: 160,
    maintenanceXP: 40,
    regressionPressure: 0,
    netDevelopmentXP: 120,
    trainingFormTier: "B",
    xpTrend: "positive",
    regressionRisk: "low",
    developmentRoute: "core_growth",
    currentAbilityRating: 55,
    currentAbilityTier: "C",
    currentAbilityStars: null,
    potentialRating: 70,
    potentialTier: "B",
    potentialStars: null,
    developmentFactors: {
      playtimeFactor: 1,
      performanceFactor: 1,
      trainingFormFactor: 1,
      potentialGapFactor: 1,
      traitFactor: 1,
      routeFitFactor: 1,
    },
    maintenanceBreakdown: {
      leagueMedianRegression: 0,
      currentAbility: 0,
      role: 0,
      potentialProximity: 0,
      overPotential: 0,
    },
    regressionBreakdown: {
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
    baseTrainingXP: 0,
    appearanceXP: 0,
    mvsXP: 0,
    ppsBonusXP: 0,
    topPlayerXP: 0,
    highlightXP: 0,
    performanceXP: 0,
    traitModifierPct: 0,
    traitMultiplier: 1,
    potentialTrainingMultiplier: 1,
    scoutPotential: null,
    xpBeforeTraits: 0,
    xpAfterTraits: 0,
    xpEvents: [],
    possibleUpgradeSummary: "test",
    ratingTierCosts: { F: 1, E: 1, D: 1, C: 1, B: 1, A: 1, S: 1, "S+": 1, "99": null },
    fatigueStrain: { label: "niedrig", score: 0, warning: "" },
    sourceStatus: {
      appearances: "missing_source",
      mvs: "missing_source",
      pps: "missing_source",
      highlights: "missing_source",
      facilities: "future_source",
      writes: "preview_only",
    },
    audit: {
      mvsPpsCoupling: "test",
      seasonEndOnly: true,
      productiveWrites: false,
      warnings: [],
    },
    ...overrides,
  };
}

function gameState(seasonId: string): GameState {
  return {
    season: {
      id: seasonId,
      name: seasonId,
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    },
    rosters: [],
  } as unknown as GameState;
}

describe("training-levelup-service", () => {
  it("gibt pro Development-Level-Up 5 Trainingspunkte und deckelt bei 2 Leveln pro Saison", () => {
    const model = buildDevelopmentLevelSummary({
      player: player({ currentXP: 999, spentXP: 0, lifetimeXP: 0 }),
      forecast: null,
      currentXP: 999,
      spentXP: 0,
      lifetimeXP: 0,
    });

    expect(DEVELOPMENT_POINTS_PER_LEVEL).toBe(5);
    expect(model.rawLevelUpsAvailable).toBeGreaterThan(2);
    expect(model.levelUpsAvailable).toBe(2);
    expect(model.trainingPointsAvailable).toBe(10);
    expect(model.xpForCurrentLevel).toBeGreaterThan(0);
  });

  it("nutzt die einfachen Attributkosten-Baender", () => {
    expect(getAttributeTrainingPointBaseCost(28)).toBe(1);
    expect(getAttributeTrainingPointBaseCost(55)).toBe(2);
    expect(getAttributeTrainingPointBaseCost(82)).toBe(3);
    expect(getAttributeTrainingPointBaseCost(87)).toBe(4);
  });

  it("reduziert Signature-Kosten um 1 bis Minimum 1 und erhoeht Weak um 1", () => {
    const affinity = {
      playerId: "p",
      signatureAttributes: ["power", "speed"] as [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName],
      weakAttribute: "torment" as PlayerGeneratorAttributeName,
      reasons: [],
    };

    expect(getAttributeTrainingPointCost({ attribute: "power", value: 55, affinity }).finalCost).toBe(1);
    expect(getAttributeTrainingPointCost({ attribute: "speed", value: 28, affinity }).finalCost).toBe(1);
    expect(getAttributeTrainingPointCost({ attribute: "torment", value: 87, affinity }).finalCost).toBe(5);
    expect(getAttributeTrainingPointCost({ attribute: "health", value: 55, affinity }).finalCost).toBe(2);
  });

  it("blockiert Attribute ueber 99 und erzeugt genau 2 Signatures plus 1 Weak", () => {
    const testPlayer = player({ attributeSheetStats: attributes({ power: DEVELOPMENT_MAX_ATTRIBUTE_VALUE }) });
    const affinity = deriveAttributeAffinityProfile(testPlayer);
    const model = buildPlayerDevelopmentLevelupModel({ player: testPlayer });

    expect(affinity.signatureAttributes).toHaveLength(2);
    expect(affinity.weakAttribute).toBeTruthy();
    expect(model.costs.find((row) => row.attribute === "power")?.blocked).toBe(true);
  });

  it("Signature muss nicht das aktuell hoechste Attribut sein", () => {
    const testPlayer = player({
      className: "Mage",
      attributeSheetStats: attributes({ power: 95, intelligence: 40, will: 42 }),
      traitsPositive: [],
    });
    const affinity = deriveAttributeAffinityProfile(testPlayer);

    expect(affinity.signatureAttributes).toContain("intelligence");
    expect(affinity.signatureAttributes).toContain("will");
  });

  it("kann einen Signature-Shift mit Zentrale-Notification previewen", () => {
    const testPlayer = player();
    const affinity = {
      playerId: testPlayer.id,
      signatureAttributes: ["power", "speed"] as [PlayerGeneratorAttributeName, PlayerGeneratorAttributeName],
      weakAttribute: "torment" as PlayerGeneratorAttributeName,
      reasons: [],
    };

    const shift = buildSignatureShiftPreview({
      player: testPlayer,
      currentProfile: affinity,
      route: "core_growth",
    });

    expect(shift.canShift).toBe(true);
    expect(shift.newSignatureAttributes).toContain("awareness");
    expect(shift.notification).toContain("Development Shift");
  });

  it("rotiert den zweiten Signature-Fokus deterministisch ueber Seasons", () => {
    const testPlayer = player();
    const affinity = deriveAttributeAffinityProfile(testPlayer);
    const signaturesBySeason = ["season-1", "season-2", "season-3"].map((seasonId) =>
      buildSignatureShiftPreview({
        player: testPlayer,
        currentProfile: affinity,
        route: "core_growth",
        seasonId,
      }).newSignatureAttributes.join("|"),
    );

    expect(new Set(signaturesBySeason).size).toBeGreaterThan(1);
  });

  it("nutzt den saisonal rotierten Signature-Fokus fuer echte Kosten und Badges", () => {
    const testPlayer = player();
    const model = buildPlayerDevelopmentLevelupModel({
      gameState: gameState("season-2"),
      player: testPlayer,
      forecast: forecast({ developmentRoute: "core_growth" }),
    });

    expect(model.signatureShift.canShift).toBe(true);
    expect(model.affinity.signatureAttributes).toEqual(model.signatureShift.newSignatureAttributes);
    expect(model.costs.find((row) => row.attribute === model.signatureShift.newSignatureAttributes[1])?.affinity).toBe("signature");
  });

  it("AI verteilt Trainingspunkte nach Route, Strategy und Affinity und meidet Weak ohne Need", () => {
    const testPlayer = player({ currentXP: 360, spentXP: 0, lifetimeXP: 360 });
    const model = buildPlayerDevelopmentLevelupModel({ player: testPlayer });
    const allocation = buildAiTrainingPointAllocation({
      player: testPlayer,
      teamId: "W-W",
      profile: {
        teamId: "W-W",
        teamName: "Wicked Wizards",
        strategySummary: "Mental mage development",
        buyStyle: "",
        sellStyle: "",
        contractStyle: "",
        rosterStyle: "",
        preferredArchetypes: [],
        avoidedArchetypes: [],
        preferredRaces: [],
        avoidedRaces: [],
        preferredClasses: [],
        avoidedClasses: [],
        hardNoGos: [],
        powBias: 0,
        speBias: 0,
        menBias: 9,
        socBias: 0,
        bias: {
          cashPriority: 5,
          valuePriority: 5,
          starPriority: 5,
          riskTolerance: 5,
          wageSensitivity: 5,
          sellForProfitAggression: 5,
          shortContractPreference: 5,
          longContractPreference: 5,
          loyaltyBias: 5,
          harmonyStrictness: 5,
          rosterDepthPreference: 5,
          eliteSmallRosterPreference: 5,
        },
      },
      level: model.level,
      affinity: model.affinity,
      preview: model.upgradePreview,
    });

    expect(allocation.pointsSpent).toBeGreaterThan(0);
    expect(allocation.recommendedAttributes).toContain("intelligence");
    expect(allocation.spendPlan[0]?.attribute).not.toBe(model.affinity.weakAttribute);
  });

  it("AI fokussiert GM- und Teamachsen statt alle kleinen Bias-Werte gleich zu behandeln", () => {
    const testPlayer = player({ currentXP: 360, spentXP: 0, lifetimeXP: 360 });
    const model = buildPlayerDevelopmentLevelupModel({ player: testPlayer });
    const allocation = buildAiTrainingPointAllocation({
      player: testPlayer,
      teamId: "S-C",
      profile: {
        teamId: "S-C",
        teamName: "Social Climbers",
        strategySummary: "Social closer development",
        buyStyle: "",
        sellStyle: "",
        contractStyle: "",
        rosterStyle: "",
        preferredArchetypes: [],
        avoidedArchetypes: [],
        preferredRaces: [],
        avoidedRaces: [],
        preferredClasses: [],
        avoidedClasses: [],
        hardNoGos: [],
        powBias: 18,
        speBias: 17,
        menBias: 16,
        socBias: 50,
        bias: {
          cashPriority: 5,
          valuePriority: 5,
          starPriority: 5,
          riskTolerance: 5,
          wageSensitivity: 5,
          sellForProfitAggression: 5,
          shortContractPreference: 5,
          longContractPreference: 5,
          loyaltyBias: 5,
          harmonyStrictness: 5,
          rosterDepthPreference: 5,
          eliteSmallRosterPreference: 5,
        },
      },
      level: model.level,
      affinity: model.affinity,
      preview: model.upgradePreview,
    });

    expect(allocation.recommendedAttributes.slice(0, 3)).toEqual(["charisma", "spirit", "determination"]);
    expect(allocation.recommendedAttributes).not.toContain("intelligence");
  });

  it("Preview laesst contractSalary stabil, aber MW/expectedSalary koennen sich bewegen", () => {
    const model = buildPlayerDevelopmentLevelupModel({
      player: player({ currentXP: 360, spentXP: 0, lifetimeXP: 360, marketValue: 100, salaryDemand: 20 }),
    });
    const firstImprovement = model.upgradePreview.find((row) => row.attributeDelta > 0);

    expect(firstImprovement?.contractSalaryStable).toBe(true);
    expect(firstImprovement?.marketValuePreviewDelta).not.toBeNull();
    expect(firstImprovement?.expectedSalaryPreviewDelta).not.toBeNull();
  });
});
