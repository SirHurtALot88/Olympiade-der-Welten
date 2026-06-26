/**
 * Zeigt Attribut-Rank-Upgrades und MW/Gehalts-Impact nach organischer Saison.
 * Usage: npx tsx scripts/organic-season-economy-impact.ts
 */
import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { buildPlayerEconomyCompareReport } from "@/lib/foundation/player-economy-compare-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { getCombinedAttributeTrainingMultiplier } from "@/lib/foundation/player-potential-display-service";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";
import { calculateMarketValueFromRankTable } from "@/lib/player-formulas/market-value-engine";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import { calculateSalaryFromMarketValue } from "@/lib/player-formulas/salary-engine";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import {
  buildCoreStatsFromDisciplineRatings,
  getProgressionRatingTier,
} from "@/lib/training/season-end-progression-preview";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildDisciplineRatingsFromAttributes(attributes: PlayerGeneratorAttributes) {
  const ratings: Record<string, number> = {};
  for (const disciplineId of officialDisciplineWeightOrder) {
    const weighted = Object.entries(officialDisciplineWeightTable).reduce((sum, [attribute, weights]) => {
      return sum + attributes[attribute as PlayerGeneratorAttributeName] * weights[disciplineId as OfficialDisciplineWeightId];
    }, 0);
    const weightSum = Object.values(officialDisciplineWeightTable).reduce(
      (sum, weights) => sum + weights[disciplineId as OfficialDisciplineWeightId],
      0,
    );
    if (weightSum > 0) {
      ratings[disciplineId] = roundValue(clamp(weighted / weightSum, 1, 99), 2);
    }
  }
  return ratings;
}

const ATTRIBUTE_NAMES: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

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
    trainingClass: partial.trainingClass ?? null,
  };
}

type Profile = { label: string; player: Player; potentialRecord: PlayerPotentialRecord };

const PROFILES: Profile[] = [
  {
    label: "Billo (MW 15, PO niedrig)",
    player: makePlayer({
      id: "impact-cheap",
      rating: 42,
      marketValue: 15,
      salaryDemand: 3,
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
      disciplineRatings: buildDisciplineRatingsFromAttributes(
        attrs({
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
      ),
    }),
    potentialRecord: {
      playerId: "impact-cheap",
      potentialBand: "low",
      hiddenPotentialScore: 58,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 2,
      hiddenPotentialCeilingByAxis: { pow: 3, spe: 3, men: 3, soc: 3 },
    },
  },
  {
    label: "Core capped (MW 27, nahe PO-Decke)",
    player: makePlayer({
      id: "impact-capped",
      rating: 52,
      marketValue: 27,
      salaryDemand: 6,
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
      disciplineRatings: buildDisciplineRatingsFromAttributes(
        attrs({
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
      ),
    }),
    potentialRecord: {
      playerId: "impact-capped",
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
  },
];

function buildStrongSeasonGameState(profile: Profile): GameState {
  const player = profile.player;
  const matchdayResults = Array.from({ length: 10 }, (_, index) => ({
    id: `result-md-${index + 1}`,
    seasonId: "impact-season",
    matchdayId: `md-${index + 1}`,
    status: "preview_applied" as const,
  }));
  const playerDisciplinePerformances: PlayerDisciplinePerformanceRecord[] = matchdayResults.map((result, index) => ({
    id: `perf-${player.id}-${index + 1}`,
    matchdayResultId: result.id,
    teamId: "team-impact",
    playerId: player.id,
    createdAt: new Date().toISOString(),
    activePlayerId: null,
    disciplineId: "gewichtheben",
    disciplineSide: "d1",
    slotIndex: 0,
    baseValue: 88,
    finalPlayerScore: 92 + (index % 2),
    scoreContribution: 26 + (index % 2) * 2,
    rankInTeam: 1,
    rankInDiscipline: 1,
    isTop10: true,
    isMvpCandidate: true,
    storyWeight: null,
  }));

  return {
    gamePhase: "player_development",
    season: { id: "impact-season", name: "Impact", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "impact-season",
      schedule: [],
      standings: {},
      matchdayResults,
      playerDisciplinePerformances,
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-impact", name: "Impact", shortCode: "IMP", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 35 },
      { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 35 },
      { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 35 },
      { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 35 },
    ],
    rosters: [
      {
        id: "r-impact",
        teamId: "team-impact",
        playerId: player.id,
        salary: player.salaryDemand ?? 5,
        marketValue: player.marketValue,
        contractLength: 2,
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    playerPotential: [profile.potentialRecord],
    mappingReport: {
      mappingSource: "sim",
      teamSource: "sim",
      generatedAt: new Date().toISOString(),
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  };
}

function makePeerPool(excludeId: string): Player[] {
  return Array.from({ length: 40 }, (_, index) => {
    const pow = 38 + ((index * 7 + 3) % 25);
    const attrsBefore = attrs({
      power: pow,
      health: pow - 1,
      stamina: pow - 2,
      speed: pow - 1,
      dexterity: pow - 2,
      intelligence: pow - 3,
      awareness: pow - 4,
      determination: pow - 2,
      charisma: pow - 3,
      will: pow - 4,
      spirit: pow - 5,
      torment: pow - 4,
    });
    return makePlayer({
      id: `peer-${index}`,
      rating: pow,
      marketValue: 10 + (index % 20),
      coreStats: { pow, spe: pow - 1, men: pow - 2, soc: pow - 3 },
      attributeSheetStats: attrsBefore,
      disciplineRatings: buildDisciplineRatingsFromAttributes(attrsBefore),
    });
  }).filter((peer) => peer.id !== excludeId);
}

const formulaSources = loadPlayerFormulaSources();

function calcRankBasedMarketValue(player: Player, peers: Player[]) {
  const pool = [player, ...peers.filter((peer) => peer.id !== player.id)];
  const result = calculateMarketValueFromRankTable({
    players: pool.map((entry) => ({ playerId: entry.id, scores: entry.disciplineRatings ?? {} })),
    rankToDisciplineMarketValue: formulaSources.rankToDisciplineMarketValue,
  });
  return result.players.find((entry) => entry.playerId === player.id)?.marketValueNew ?? null;
}

function calcSalary(player: Player, salaryMarketValue: number) {
  const attributes = player.attributeSheetStats;
  if (!attributes || !formulaSources.attributeSalaryModifiers || !formulaSources.traitSalaryFactors) {
    return null;
  }
  return calculateSalaryFromMarketValue({
    salaryMarketValue,
    attributes,
    traitsPositive: player.traitsPositive,
    traitsNegative: player.traitsNegative,
    attributeSalaryModifiers: formulaSources.attributeSalaryModifiers,
    traitSalaryFactors: formulaSources.traitSalaryFactors,
  }).finalSalary;
}

function countTransfermarktTierUpgrades(before: PlayerGeneratorAttributes, after: PlayerGeneratorAttributes) {
  const upgrades: Array<{ attribute: string; before: number; after: number; tierBefore: string; tierAfter: string }> = [];
  for (const attribute of ATTRIBUTE_NAMES) {
    const b = before[attribute] ?? 0;
    const a = after[attribute] ?? 0;
    const tierBefore = getTransfermarktTierFromPoints(b) ?? "F";
    const tierAfter = getTransfermarktTierFromPoints(a) ?? "F";
    if (tierBefore !== tierAfter) {
      upgrades.push({ attribute, before: b, after: a, tierBefore, tierAfter });
    }
  }
  return upgrades;
}

const facilities: TeamFacilityCollection = {
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

function countThresholdCrossings(before: PlayerGeneratorAttributes, after: PlayerGeneratorAttributes, thresholds: number[]) {
  let crossings = 0;
  for (const attribute of ATTRIBUTE_NAMES) {
    const b = before[attribute] ?? 0;
    const a = after[attribute] ?? 0;
    for (const threshold of thresholds) {
      if (b < threshold && a >= threshold) crossings += 1;
    }
  }
  return crossings;
}

function analyzeProfile(profile: Profile) {
  const peers = makePeerPool(profile.player.id);
  const gameState = buildStrongSeasonGameState(profile);
  gameState.players = [profile.player, ...peers];
  const progression = buildOrganicSeasonProgression({
    gameState,
    player: profile.player,
    potentialRecord: profile.potentialRecord,
    teamFacilities: facilities,
  });

  const attributesAfter = progression.attributesAfter;
  const disciplineRatingsBefore = buildDisciplineRatingsFromAttributes(progression.attributesBefore);
  const disciplineRatingsAfter = buildDisciplineRatingsFromAttributes(attributesAfter);
  const previewPlayer: Player = {
    ...profile.player,
    attributeSheetStats: attributesAfter,
    disciplineRatings: disciplineRatingsAfter,
    previousDisciplineRatings: disciplineRatingsBefore,
    rating: roundValue(
      Object.values(disciplineRatingsAfter).reduce((sum, value) => sum + value, 0) /
        Math.max(1, Object.values(disciplineRatingsAfter).length),
      1,
    ),
    coreStats: buildCoreStatsFromDisciplineRatings({
      disciplines: gameState.disciplines,
      disciplineRatings: disciplineRatingsAfter,
      fallback: profile.player.coreStats,
    }),
  };

  const beforePlayer: Player = { ...profile.player, disciplineRatings: disciplineRatingsBefore };
  const beforeGameState: GameState = { ...gameState, players: [beforePlayer, ...peers] };
  const afterGameState: GameState = { ...gameState, players: [previewPlayer, ...peers] };
  const beforeEconomy = buildPlayerEconomyCompareReport({ gameState: beforeGameState }).players[0]!;
  const afterEconomy = buildPlayerEconomyCompareReport({ gameState: afterGameState }).players[0]!;
  const rankMwBefore = calcRankBasedMarketValue(beforePlayer, peers);
  const rankMwAfter = calcRankBasedMarketValue(previewPlayer, peers);
  const salaryBase = profile.player.marketValue ?? 15;
  const salaryBefore = calcSalary(beforePlayer, salaryBase);
  const salaryAfter = calcSalary(previewPlayer, salaryBase);
  const tmTierUpgrades = countTransfermarktTierUpgrades(progression.attributesBefore, attributesAfter);
  const beforeRating = buildPlayerRatingContractMap(beforeGameState).get(profile.player.id);
  const afterRating = buildPlayerRatingContractMap(afterGameState).get(profile.player.id);

  const tierUpgrades = progression.attributeBreakdown
    .map((entry) => {
      const tierBefore = getProgressionRatingTier(entry.before);
      const tierAfter = getProgressionRatingTier(entry.after);
      return tierBefore !== tierAfter
        ? { attribute: entry.attribute, before: entry.before, after: entry.after, tierBefore, tierAfter, delta: entry.delta }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const avgPerfMult =
    progression.attributeBreakdown.reduce((sum, entry) => {
      const rawPerf = entry.performance;
      const budgetShare = progression.performanceBudget > 0 ? rawPerf / progression.performanceBudget : 0;
      return sum + budgetShare;
    }, 0) / ATTRIBUTE_NAMES.length;

  const sampleMult = getCombinedAttributeTrainingMultiplier({
    player: profile.player,
    attribute: "power",
    record: profile.potentialRecord,
    axisCaStars: { pow: 2, spe: 2, men: 2, soc: 2 },
    axisPoStars: profile.potentialRecord.hiddenPotentialCeilingByAxis,
  });

  const attributesBefore = progression.attributesBefore;
  const rankCrossings20 = countThresholdCrossings(attributesBefore, attributesAfter, [20, 40, 60, 80]);

  return {
    label: profile.label,
    organic: {
      trainDelta: progression.trainingSetpoints,
      perfDelta: progression.performanceSetpoints,
      regFlat: progression.regressionBreakdown.baseFlatTotal,
      regMW: progression.regressionBreakdown.marketValueTotal,
      net: progression.netSetpoints,
    },
    headroomMultiplierSample: sampleMult,
    tierUpgrades,
    tierUpgradeCount: tierUpgrades.length,
    thresholdCrossings: rankCrossings20,
    ovr: { before: beforeRating?.ovrNormalized ?? null, after: afterRating?.ovrNormalized ?? null },
    discipline: {
      gewichthebenBefore: disciplineRatingsBefore.gewichtheben ?? null,
      gewichthebenAfter: disciplineRatingsAfter.gewichtheben ?? null,
      topDisciplinesBefore: Object.entries(disciplineRatingsBefore)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, value]) => `${id}:${value}`),
      topDisciplinesAfter: Object.entries(disciplineRatingsAfter)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([id, value]) => `${id}:${value}`),
    },
    tmTierUpgrades,
    tmTierUpgradeCount: tmTierUpgrades.length,
    economy: {
      importedMw: profile.player.marketValue,
      rankMwBefore,
      rankMwAfter,
      rankMwDelta: (rankMwAfter ?? 0) - (rankMwBefore ?? 0),
      compareMwBefore: beforeEconomy.calculatedMarketValue,
      compareMwAfter: afterEconomy.calculatedMarketValue,
      salaryBefore,
      salaryAfter,
      salaryDelta: (salaryAfter ?? 0) - (salaryBefore ?? 0),
    },
    topAttributeGains: progression.attributeBreakdown
      .filter((entry) => entry.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5)
      .map((entry) => ({
        attribute: entry.attribute,
        before: entry.before,
        after: entry.after,
        delta: entry.delta,
        perf: entry.performance,
        train: entry.training,
        reg: entry.regression,
      })),
  };
}

for (const profile of PROFILES) {
  const result = analyzeProfile(profile);
  console.log("\n=== " + result.label + " (starke Saison) ===");
  console.log("Organisch:", result.organic);
  console.log("Headroom-Multiplikator (Beispiel power):", result.headroomMultiplierSample.toFixed(3));
  console.log("OVR:", result.ovr.before, "→", result.ovr.after, `(Δ ${((result.ovr.after ?? 0) - (result.ovr.before ?? 0)).toFixed(2)})`);
  console.log(
    "Gewichtheben:",
    result.discipline.gewichthebenBefore,
    "→",
    result.discipline.gewichthebenAfter,
    `(Δ ${((result.discipline.gewichthebenAfter ?? 0) - (result.discipline.gewichthebenBefore ?? 0)).toFixed(2)})`,
  );
  console.log("Top-3 Disziplinen vor:", result.discipline.topDisciplinesBefore.join(", "));
  console.log("Top-3 Disziplinen nach:", result.discipline.topDisciplinesAfter.join(", "));
  console.log("Attribut-Rank-Upgrades (F/E/D/C…):", result.tierUpgradeCount);
  for (const upgrade of result.tierUpgrades) {
    console.log(`  ${upgrade.attribute}: ${upgrade.before} (${upgrade.tierBefore}) → ${upgrade.after} (${upgrade.tierAfter})`);
  }
  console.log("Schwellen-Crossings (20/40/60/80):", result.thresholdCrossings);
  console.log("Transfermarkt-Rank-Upgrades (F→E→D…):", result.tmTierUpgradeCount);
  for (const upgrade of result.tmTierUpgrades) {
    console.log(`  ${upgrade.attribute}: ${upgrade.before} (${upgrade.tierBefore}) → ${upgrade.after} (${upgrade.tierAfter})`);
  }
  console.log(
    "MW (Rank-Tabelle, 40er Pool):",
    result.economy.rankMwBefore?.toFixed(2),
    "→",
    result.economy.rankMwAfter?.toFixed(2),
    `(Δ ${result.economy.rankMwDelta >= 0 ? "+" : ""}${result.economy.rankMwDelta.toFixed(2)})`,
  );
  console.log(
    "MW (importiert/Compare-UI):",
    result.economy.importedMw,
    "→ unverändert",
    result.economy.compareMwBefore,
  );
  console.log(
    "Gehalt (Attribut-Modifikatoren, Basis-MW",
    result.economy.importedMw,
    "):",
    result.economy.salaryBefore?.toFixed(2),
    "→",
    result.economy.salaryAfter?.toFixed(2),
    `(Δ ${result.economy.salaryDelta >= 0 ? "+" : ""}${result.economy.salaryDelta.toFixed(2)})`,
  );
  console.log("Top Attribut-Gewinne:");
  for (const gain of result.topAttributeGains) {
    console.log(
      `  ${gain.attribute}: ${gain.before} → ${gain.after} (net ${gain.delta >= 0 ? "+" : ""}${gain.delta}, perf +${gain.perf}, train +${gain.train}, reg ${gain.reg})`,
    );
  }
}
