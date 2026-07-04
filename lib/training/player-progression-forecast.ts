import type { GameState, Player, PlayerDisciplinePerformanceRecord, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { applyTrainingXpFacilityModifiers, getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamDevelopmentTrainingBonusPct } from "@/lib/foundation/team-development-tendency";
import { getCombinedAttributeTrainingMultiplier, getPotentialGapXpFactor } from "@/lib/foundation/player-potential-display-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { resolvePlayerPotentialRecordFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { resolvePlayerPotentialRecordForProgression } from "@/lib/scouting/player-potential-ceiling-service";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { getEffectiveScoutingLevel } from "@/lib/scouting/facility-scout-pipeline-service";
import { buildPlayerScoutPotentialFromGameState } from "@/lib/progression/player-potential-service";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import type { PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import {
  DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON,
  DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN,
  getDevelopmentLevelProgress,
  getDevelopmentXpForLevelGain,
} from "@/lib/training/development-level-curve";
import { buildTrainingTraitSignal } from "@/lib/training/trait-training-signal";
import type {
  PlayerDevelopmentRoute,
  PlayerDevelopmentTrend,
  PlayerProgressionForecast,
  PlayerProgressionRatingTier,
  PlayerProgressionXpEvent,
  PlayerRegressionRisk,
  PlayerTrainingFormTier,
  PlayerTrainingMode,
} from "@/lib/training/training-plan-types";

// WeakMap caches keyed on gameState to avoid O(n²) rebuilds per player within the same state.
const matchdayResultSeasonCache = new WeakMap<GameState, Map<string, string>>();
const seasonPerformancesByPlayerCache = new WeakMap<GameState, Map<string, PlayerDisciplinePerformanceRecord[]>>();
// Cache for full forecast results: keyed on gameState → playerId. Only used when all inputs
// are derivable from gameState + player (i.e., no custom boardTrustScore or facilities override).
const forecastResultCache = new WeakMap<GameState, Map<string, PlayerProgressionForecast>>();

function getMatchdayResultSeasonIndex(gameState: GameState): Map<string, string> {
  const cached = matchdayResultSeasonCache.get(gameState);
  if (cached) return cached;
  const index = new Map<string, string>(
    (gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result.seasonId ?? gameState.season.id] as const),
  );
  matchdayResultSeasonCache.set(gameState, index);
  return index;
}

function getSeasonPerformancesByPlayer(gameState: GameState): Map<string, PlayerDisciplinePerformanceRecord[]> {
  const cached = seasonPerformancesByPlayerCache.get(gameState);
  if (cached) return cached;
  const seasonId = gameState.season.id;
  const resultSeasonIndex = getMatchdayResultSeasonIndex(gameState);
  const index = new Map<string, PlayerDisciplinePerformanceRecord[]>();
  for (const entry of (gameState.seasonState.playerDisciplinePerformances ?? [])) {
    const resultSeasonId = resultSeasonIndex.get(entry.matchdayResultId) ?? seasonId;
    if (resultSeasonId !== seasonId) continue;
    const existing = index.get(entry.playerId);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(entry.playerId, [entry]);
    }
  }
  seasonPerformancesByPlayerCache.set(gameState, index);
  return index;
}

export const PLAYER_PROGRESSION_XP_CONSTANTS = {
  trainingByMode: {
    leicht: 40,
    mittel: 70,
    hart: 110,
  } satisfies Record<PlayerTrainingMode, number>,
  appearanceXp: 20,
  mvsMultiplier: 4,
  ppsBonusMultiplier: 4,
  ppsBonusCapPctOfMvsXp: 0.35,
  ppsBonusNoMvsCap: 35,
  top10BonusMin: 10,
  top10BonusMax: 35,
  rank1BonusMin: 42,
  rank1BonusMax: 70,
  highlightBonusMin: 10,
  highlightBonusMax: 42,
  ratingTierUpgradeCost: {
    F: 45,
    E: 55,
    D: 70,
    C: 95,
    B: 130,
    A: 180,
    S: 250,
    "S+": 360,
    "99": null,
  } satisfies Record<PlayerProgressionRatingTier, number | null>,
} as const;

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function withTraits(value: number, multiplier: number) {
  return Math.max(0, roundValue(value * multiplier, 0));
}

function getTraitModifierPct(multiplier: number) {
  return roundValue((multiplier - 1) * 100, 1);
}

function getTrainingMode(player: Pick<Player, "id">, trainingModeByPlayerId?: Record<string, PlayerTrainingMode> | null) {
  return trainingModeByPlayerId?.[player.id] ?? "mittel";
}

function getRank1Count(performances: PlayerDisciplinePerformanceRecord[]) {
  return performances.filter((entry) => entry.rankInDiscipline === 1).length;
}

function getTop10Count(performances: PlayerDisciplinePerformanceRecord[], seasonPerformance: PlayerSeasonPerformanceSummary | null) {
  if (performances.length > 0) {
    return performances.filter((entry) => entry.isTop10).length;
  }
  return seasonPerformance?.top10Count ?? 0;
}

function getMvpCount(performances: PlayerDisciplinePerformanceRecord[], seasonPerformance: PlayerSeasonPerformanceSummary | null) {
  if (performances.length > 0) {
    return performances.filter((entry) => entry.isMvpCandidate).length;
  }
  return seasonPerformance?.mvpCount ?? 0;
}

function calculatePpsBonusXp(pps: number | null, mvsXp: number) {
  if (!isFiniteNumber(pps) || pps <= 0) {
    return 0;
  }
  const rawBonus = pps * PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusMultiplier;
  const cap =
    mvsXp > 0
      ? Math.max(PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusNoMvsCap, mvsXp * PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusCapPctOfMvsXp)
      : PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusNoMvsCap;
  return roundValue(Math.min(rawBonus, cap), 0);
}

function calculateTopPlayerXp(input: {
  top10Count: number;
  rank1Count: number;
}) {
  const top10Xp = input.top10Count * PLAYER_PROGRESSION_XP_CONSTANTS.top10BonusMin;
  const rank1Xp = input.rank1Count * PLAYER_PROGRESSION_XP_CONSTANTS.rank1BonusMin;
  return roundValue(top10Xp + rank1Xp, 0);
}

function calculateHighlightXp(input: {
  mvpCount: number;
  highlightCount: number;
}) {
  return roundValue(
    input.mvpCount * PLAYER_PROGRESSION_XP_CONSTANTS.highlightBonusMax +
      input.highlightCount * PLAYER_PROGRESSION_XP_CONSTANTS.highlightBonusMin,
    0,
  );
}

function buildFatigueStrain(input: {
  mode: PlayerTrainingMode;
  appearances: number;
  traitMultiplier: number;
  hasDisciplinedTrait: boolean;
}) {
  const modeBase = input.mode === "hart" ? 68 : input.mode === "mittel" ? 36 : 10;
  const appearanceLoad = Math.min(input.appearances * 5, 30);
  const traitRelief = input.hasDisciplinedTrait ? 8 : 0;
  const traitPressure = input.traitMultiplier > 1.08 ? 4 : 0;
  const score = roundValue(clamp(modeBase + appearanceLoad + traitPressure - traitRelief, 0, 100), 0);
  const label = score >= 68 ? "hoch" : score >= 36 ? "mittel" : "niedrig";
  const warning =
    label === "hoch"
      ? "Fatigue-/Strain-Belastung beobachten"
      : label === "mittel"
        ? "normale Trainingslast"
        : "erholungsfreundlich";
  return { label, score, warning } satisfies PlayerProgressionForecast["fatigueStrain"];
}

const TRAINING_FORM_POSITIVE_TRAITS: Record<string, number> = {
  Diligent: 16,
  Disciplined: 13,
  Motivated: 12,
  Ambitious: 10,
  Flexible: 8,
  Healthy: 8,
  Resourceful: 7,
  FiredUp: 6,
  Fearless: 5,
};

const TRAINING_FORM_NEGATIVE_TRAITS: Record<string, number> = {
  Lazy: -18,
  Diva: -11,
  FaintHearted: -12,
  Paranoid: -10,
  Obsessive: -9,
  Egomaniac: -10,
  Gambler: -8,
  Mercenary: -7,
  Renegade: -8,
  Scandalous: -7,
  Cruel: -5,
};

function getRatingTier(value: number | null | undefined): PlayerProgressionRatingTier | null {
  if (!isFiniteNumber(value)) return null;
  if (value >= 99) return "99";
  if (value >= 92) return "S+";
  if (value >= 82) return "S";
  if (value >= 72) return "A";
  if (value >= 60) return "B";
  if (value >= 48) return "C";
  if (value >= 36) return "D";
  if (value >= 24) return "E";
  return "F";
}

function getTrainingFormTier(score: number): PlayerTrainingFormTier {
  if (score >= 92) return "S+";
  if (score >= 82) return "S";
  if (score >= 72) return "A";
  if (score >= 60) return "B";
  if (score >= 48) return "C";
  if (score >= 36) return "D";
  if (score >= 24) return "E";
  return "F";
}

function getTierFactor(tier: PlayerTrainingFormTier) {
  return {
    "S+": 1.24,
    S: 1.16,
    A: 1.09,
    B: 1.02,
    C: 0.96,
    D: 0.88,
    E: 0.78,
    F: 0.64,
  }[tier];
}

function getTrainingFormPressure(tier: PlayerTrainingFormTier) {
  return {
    "S+": 0,
    S: 0,
    A: 0,
    B: 0,
    C: 6,
    D: 16,
    E: 28,
    F: 42,
  }[tier];
}

function getStarLabel(value: number | null) {
  if (!isFiniteNumber(value)) return null;
  const stars = clamp(Math.round((value / 20) * 2) / 2, 0.5, 5);
  return `${stars.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Sterne`;
}

function getCurrentAbility(input: { player: Player; playerRating: PlayerRatingContractRow | null }) {
  const coreValues = [input.player.coreStats.pow, input.player.coreStats.spe, input.player.coreStats.men, input.player.coreStats.soc].filter(isFiniteNumber);
  const coreAverage = coreValues.length > 0 ? coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length : null;
  return roundValue(input.playerRating?.ovrNormalized ?? input.player.rating ?? coreAverage ?? input.player.potential ?? null, 1);
}

function getDisplayMarketValue(player: Player) {
  const value =
    isFiniteNumber((player as { displayMarketValue?: number | null }).displayMarketValue)
      ? (player as { displayMarketValue?: number | null }).displayMarketValue
      : player.marketValue;
  if (!isFiniteNumber(value)) return null;
  return value > 1000 ? value / 1000 : value;
}

function getMarketValuePressureFactor(player: Player) {
  const marketValue = getDisplayMarketValue(player);
  if (marketValue == null) return 0;
  if (marketValue >= 70) return 1;
  if (marketValue >= 50) return 0.75;
  if (marketValue >= 35) return 0.5;
  if (marketValue >= 22) return 0.25;
  return 0;
}

function getPotentialSeasonLevelCap(potentialGap: number) {
  if (potentialGap <= -8) return 1.25;
  if (potentialGap <= 0) return DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN;
  if (potentialGap <= 4) return DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN;
  if (potentialGap <= 10) return DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN;
  return DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON;
}

function getEffectivePotentialForDevelopment(input: {
  currentAbility: number;
  scoutPotential: number;
}) {
  if (input.scoutPotential >= input.currentAbility) return input.scoutPotential;
  // Potential is a soft scouting signal, not a hard ceiling. A low scout read may
  // create regression risk, but it must not erase a productive player's whole season.
  return roundValue(Math.max(input.scoutPotential, input.currentAbility - 8), 1);
}

function getPerformanceExpectations(input: {
  currentAbility: number;
  marketValue: number | null;
  role: string;
}) {
  const abilityBand = clamp((input.currentAbility - 48) / 28, -0.45, 1.25);
  const valueBand = clamp(((input.marketValue ?? 18) - 18) / 38, -0.35, 1.35);
  const roleOffset = isStarOrCore(input.role) ? 0.18 : isProspect(input.role) ? -0.08 : 0;

  return {
    expectedMvs: roundValue(clamp(5.1 + abilityBand * 1.45 + valueBand * 0.85 + roleOffset, 4.2, 9.6), 2),
    expectedPps: roundValue(clamp(7.4 + abilityBand * 4.3 + valueBand * 3.4 + roleOffset * 5, 6, 18.5), 2),
  };
}

function getRelativePerformanceIndex(input: {
  mvs: number | null;
  pps: number | null;
  expectedMvs: number;
  expectedPps: number;
}) {
  const signals: number[] = [];
  if (isFiniteNumber(input.mvs)) {
    signals.push((input.mvs + 1.2) / (input.expectedMvs + 1.2));
  }
  if (isFiniteNumber(input.pps)) {
    signals.push((input.pps + 3) / (input.expectedPps + 3));
  }
  if (signals.length === 0) return 0.92;
  return roundValue(signals.reduce((sum, value) => sum + value, 0) / signals.length, 2);
}

function buildTrainingFormScore(player: Player, mode: PlayerTrainingMode) {
  const positive = player.traitsPositive.reduce((sum, trait) => sum + (TRAINING_FORM_POSITIVE_TRAITS[trait] ?? 0), 0);
  const negative = player.traitsNegative.reduce((sum, trait) => sum + (TRAINING_FORM_NEGATIVE_TRAITS[trait] ?? 0), 0);
  const modeSignal = mode === "hart" ? 3 : mode === "leicht" ? -2 : 0;
  const sharpnessSignal = isFiniteNumber(player.form) && player.form > 0 ? clamp((player.form - 50) / 4, -10, 10) : 0;
  return clamp(55 + positive + negative + modeSignal + sharpnessSignal, 5, 99);
}

function getRosterRole(gameState: GameState, playerId: string) {
  const rosterEntry = gameState.rosters.find((entry) => entry.playerId === playerId);
  const role = rosterEntry ? (rosterEntry as { role?: string | null; roleTag?: string | null }).role ?? rosterEntry.roleTag : null;
  return String(role ?? "").toLowerCase();
}

function isStarOrCore(role: string) {
  return role.includes("star") || role.includes("core") || role.includes("leader") || role.includes("starter");
}

function isProspect(role: string) {
  return role.includes("prospect") || role.includes("rookie") || role.includes("young");
}

function buildDevelopmentRoute(input: {
  role: string;
  potentialGap: number;
  netDevelopmentXP: number;
  isFreeAgent: boolean;
}): PlayerDevelopmentRoute {
  if (input.isFreeAgent) return "free_agent_ambient";
  if (input.netDevelopmentXP < -90) return "stagnation_watch";
  if (isProspect(input.role) && input.potentialGap > 8) return "prospect_growth";
  if (isStarOrCore(input.role) && input.potentialGap > 5) return input.role.includes("star") ? "star_growth" : "core_growth";
  if (input.potentialGap > 12) return "depth_growth";
  return "maintenance";
}

function getTrend(netDevelopmentXP: number): PlayerDevelopmentTrend {
  if (netDevelopmentXP >= 140) return "strong_positive";
  if (netDevelopmentXP >= 30) return "positive";
  if (netDevelopmentXP >= -30) return "neutral";
  if (netDevelopmentXP >= -110) return "negative";
  return "strong_negative";
}

function getRegressionRisk(input: { netDevelopmentXP: number; regressionPressure: number }): PlayerRegressionRisk {
  if (input.netDevelopmentXP <= -230 || input.regressionPressure >= 130) return "high";
  if (input.netDevelopmentXP < -130 || input.regressionPressure >= 90) return "medium";
  if (input.regressionPressure >= 65) return "low";
  return "none";
}

function buildNetDevelopment(input: {
  player: Player;
  gameState: GameState;
  currentAbility: number | null;
  potentialRating: number | null;
  potentialGapStars?: number | null;
  trainingFormTier: PlayerTrainingFormTier;
  traitMultiplier: number;
  appearances: number;
  mvs: number | null;
  pps: number | null;
  xpAfterTraits: number;
  boardTrustScore: number | null;
  currentDevelopmentLevel: number;
}) {
  const role = getRosterRole(input.gameState, input.player.id);
  const isFreeAgent = !input.gameState.rosters.some((entry) => entry.playerId === input.player.id);
  const ca = input.currentAbility ?? 50;
  const rawPo = input.potentialRating ?? Math.max(ca, 55);
  const po = getEffectivePotentialForDevelopment({ currentAbility: ca, scoutPotential: rawPo });
  const potentialGap = po - ca;
  const marketValue = getDisplayMarketValue(input.player);
  const performanceExpectations = getPerformanceExpectations({
    currentAbility: ca,
    marketValue,
    role,
  });
  const relativePerformanceIndex = getRelativePerformanceIndex({
    mvs: input.mvs,
    pps: input.pps,
    expectedMvs: performanceExpectations.expectedMvs,
    expectedPps: performanceExpectations.expectedPps,
  });
  const playtimeFactor = input.appearances >= 7 ? 1.1 : input.appearances >= 4 ? 1 : input.appearances >= 1 ? 0.9 : isFreeAgent ? 0.82 : 0.74;
  const bracketMomentum = clamp((58 - ca) / 100 + ((22 - (marketValue ?? 22)) / 140), -0.12, 0.14);
  const appearanceReliability = input.appearances >= 7 ? 0.03 : input.appearances >= 4 ? 0.01 : 0;
  const performanceFactor = clamp(
    0.9 +
      (relativePerformanceIndex - 1) * 0.55 +
      (relativePerformanceIndex > 1 ? Math.max(0, bracketMomentum) * 0.45 : 0) -
      (relativePerformanceIndex < 1 ? Math.max(0, -bracketMomentum) * 0.45 : 0) +
      appearanceReliability,
    0.62,
    1.38,
  );
  const trainingFormFactor = getTierFactor(input.trainingFormTier);
  const potentialGapFactor =
    input.potentialGapStars != null
      ? getPotentialGapXpFactor(input.potentialGapStars)
      : potentialGap >= 28
        ? 1.18
        : potentialGap >= 14
          ? 1.1
          : potentialGap >= 5
            ? 1.02
            : potentialGap >= -2
              ? 0.82
              : 0.62;
  const traitFactor = clamp(input.traitMultiplier, 0.9, 1.1);
  const routeConflict = input.player.traitsNegative.some((trait) => ["Mercenary", "Renegade", "Diva", "Egomaniac"].includes(trait));
  const routeFitFactor = routeConflict ? 0.92 : 1;
  const earnedXP = roundValue(input.xpAfterTraits * playtimeFactor * performanceFactor * trainingFormFactor * potentialGapFactor * traitFactor * routeFitFactor, 0);
  const roleMaintenance = isStarOrCore(role) ? (role.includes("star") ? 42 : 28) : isProspect(role) ? 8 : 16;
  const leagueMedianRegression = isProspect(role) ? 170 : isStarOrCore(role) ? (role.includes("star") ? 300 : 260) : 220;
  const potentialProximity = potentialGap <= -1 ? 28 + Math.abs(potentialGap) * 3 : potentialGap <= 4 ? 24 : potentialGap <= 10 ? 14 : 6;
  const marketValuePressureFactor = getMarketValuePressureFactor(input.player);
  const maintenanceRate = clamp(0.38 + marketValuePressureFactor * 0.1 + (isStarOrCore(role) ? 0.02 : 0) - (isProspect(role) ? 0.02 : 0), 0.36, 0.5);
  const currentAbilityMaintenance = ca * maintenanceRate;
  const overPotential = Math.max(0, ca - po) * 4;
  const maintenanceBreakdown = {
    leagueMedianRegression,
    currentAbility: roundValue(currentAbilityMaintenance, 0),
    role: roleMaintenance,
    potentialProximity: roundValue(potentialProximity, 0),
    overPotential: roundValue(overPotential, 0),
  };
  const maintenanceXP = roundValue(
    maintenanceBreakdown.leagueMedianRegression +
      maintenanceBreakdown.currentAbility +
      maintenanceBreakdown.role +
      maintenanceBreakdown.potentialProximity +
      maintenanceBreakdown.overPotential,
    0,
  );
  const lowPlaytime = input.appearances === 0 ? (isFreeAgent ? 8 : isStarOrCore(role) ? 42 : 24) : input.appearances <= 2 ? 14 : 0;
  const poorPerformance =
    input.appearances > 0 && relativePerformanceIndex < 0.72
      ? 30
      : input.appearances > 0 && relativePerformanceIndex < 0.88
        ? 14
        : 0;
  const sharpness = isFiniteNumber(input.player.form) && input.player.form > 0 && input.player.form < 38 ? 18 : 0;
  const boardTrust = input.boardTrustScore != null ? (input.boardTrustScore < 30 ? 28 : input.boardTrustScore < 50 ? 13 : 0) : 0;
  const negativeTraits = input.player.traitsNegative.reduce((sum, trait) => sum + Math.abs(TRAINING_FORM_NEGATIVE_TRAITS[trait] ?? 0) * 0.7, 0);
  const routeConflictPressure = routeConflict ? 14 : 0;
  const starUnderperformance =
    isStarOrCore(role) && input.appearances >= 4 && relativePerformanceIndex < 0.9
      ? roundValue(18 + Math.max(0, ca - 58) * 0.18, 0)
      : 0;
  const highValueUnderperformance =
    marketValuePressureFactor > 0 && input.appearances >= 3 && relativePerformanceIndex < 0.94
      ? roundValue((20 + ca * 0.14 + Math.max(0, 1 - relativePerformanceIndex) * 70) * marketValuePressureFactor, 0)
      : 0;
  const poorTrainingValuePressure =
    marketValuePressureFactor > 0
      ? roundValue((getTrainingFormPressure(input.trainingFormTier) + (input.appearances <= 2 && !isFreeAgent ? 10 : 0)) * marketValuePressureFactor, 0)
      : 0;
  const regressionBreakdown = {
    lowPlaytime: roundValue(lowPlaytime, 0),
    poorPerformance: roundValue(poorPerformance, 0),
    sharpness: roundValue(sharpness, 0),
    boardTrust: roundValue(boardTrust, 0),
    negativeTraits: roundValue(negativeTraits, 0),
    routeConflict: roundValue(routeConflictPressure, 0),
    starUnderperformance: roundValue(starUnderperformance, 0),
    highValueUnderperformance,
    poorTrainingValuePressure,
  };
  const baseRegressionPressure = roundValue(Object.values(regressionBreakdown).reduce((sum, value) => sum + value, 0), 0);
  const preSoftBalanceNetDevelopmentXP = roundValue(earnedXP - maintenanceXP - baseRegressionPressure, 0);
  const targetSeasonNetXP = getDevelopmentXpForLevelGain(input.currentDevelopmentLevel, DEVELOPMENT_TARGET_TOP_SEASON_LEVEL_GAIN);
  const hardMaxSeasonNetXP = getDevelopmentXpForLevelGain(input.currentDevelopmentLevel, DEVELOPMENT_MAX_LEVEL_UPS_PER_SEASON);
  const potentialMaxSeasonNetXP = getDevelopmentXpForLevelGain(input.currentDevelopmentLevel, getPotentialSeasonLevelCap(potentialGap));
  const softCeilingRegression =
    preSoftBalanceNetDevelopmentXP > targetSeasonNetXP
      ? roundValue(preSoftBalanceNetDevelopmentXP - targetSeasonNetXP, 0)
      : 0;
  const netAfterSoftCeiling = roundValue(earnedXP - maintenanceXP - baseRegressionPressure - softCeilingRegression, 0);
  const potentialCeilingRegression =
    netAfterSoftCeiling > potentialMaxSeasonNetXP ? roundValue(netAfterSoftCeiling - potentialMaxSeasonNetXP, 0) : 0;
  const netAfterPotentialCeiling = roundValue(netAfterSoftCeiling - potentialCeilingRegression, 0);
  const hardCapRegression =
    netAfterPotentialCeiling > hardMaxSeasonNetXP ? roundValue(netAfterPotentialCeiling - hardMaxSeasonNetXP, 0) : 0;
  const regressionPressure = roundValue(baseRegressionPressure + softCeilingRegression + potentialCeilingRegression + hardCapRegression, 0);
  const netDevelopmentXP = roundValue(earnedXP - maintenanceXP - regressionPressure, 0);
  const organicRegressionPressure = roundValue(baseRegressionPressure + potentialCeilingRegression, 0);
  return {
    role,
    isFreeAgent,
    potentialGap,
    earnedXP,
    maintenanceXP,
    regressionPressure,
    organicRegressionPressure,
    netDevelopmentXP,
    developmentFactors: {
      playtimeFactor: roundValue(playtimeFactor, 2),
      performanceFactor: roundValue(performanceFactor, 2),
      trainingFormFactor: roundValue(trainingFormFactor, 2),
      potentialGapFactor: roundValue(potentialGapFactor, 2),
      traitFactor: roundValue(traitFactor, 2),
      routeFitFactor: roundValue(routeFitFactor, 2),
    },
    maintenanceBreakdown,
    regressionBreakdown: {
      ...regressionBreakdown,
      potentialCeiling: potentialCeilingRegression,
      seasonGainSoftCeiling: softCeilingRegression,
      seasonGainHardCap: hardCapRegression,
    },
  };
}

function buildEvent(input: {
  type: PlayerProgressionXpEvent["type"];
  label: string;
  xpBeforeTraits: number;
  traitModifierPct: number;
  traitMultiplier: number;
  sourceStatus: PlayerProgressionXpEvent["sourceStatus"];
}) {
  return {
    type: input.type,
    label: input.label,
    xpBeforeTraits: roundValue(input.xpBeforeTraits, 0),
    traitModifierPct: input.traitModifierPct,
    xpAfterTraits: withTraits(input.xpBeforeTraits, input.traitMultiplier),
    sourceStatus: input.sourceStatus,
  } satisfies PlayerProgressionXpEvent;
}

export function buildPlayerProgressionForecast(input: {
  gameState: GameState;
  player: Player;
  playerRating: PlayerRatingContractRow | null;
  seasonPerformance: PlayerSeasonPerformanceSummary | null;
  trainingModeByPlayerId?: Record<string, PlayerTrainingMode> | null;
  currentXP?: number | null;
  spentXP?: number | null;
  lifetimeXP?: number | null;
  boardTrustScore?: number | null;
  facilities?: TeamFacilityCollection | null;
}): PlayerProgressionForecast {
  // Short-circuit with cached result when called repeatedly for the same player within the same
  // gameState (e.g. previewSeasonEndXpAvailability + previewSeasonEndXpSpend both call this).
  // Only cache when no custom overrides are in play.
  const canCache = input.boardTrustScore == null && input.facilities == null;

  const mode = getTrainingMode(input.player, input.trainingModeByPlayerId);
  const rosterEntry = input.gameState.rosters.find((entry) => entry.playerId === input.player.id);
  const facilities =
    input.facilities ??
    (rosterEntry ? getTeamFacilityState(input.gameState, rosterEntry.teamId) : null);
  const trainingCenterLevel = getFacilityLevel(facilities, "training_center");
  const traitSignal = buildTrainingTraitSignal({
    traitsPositive: input.player.traitsPositive,
    traitsNegative: input.player.traitsNegative,
  });
  const traitMultiplier = traitSignal.trainingTraitMultiplier;
  const traitModifierPct = getTraitModifierPct(traitMultiplier);
  const cacheKey = `${input.player.id}:${mode}`;
  if (canCache) {
    const perState = forecastResultCache.get(input.gameState);
    const hit = perState?.get(cacheKey);
    if (hit) return hit;
  }

  const scoutPotential = buildPlayerScoutPotentialFromGameState({
    gameState: input.gameState,
    player: input.player,
    saveId: input.gameState.season.id,
  });
  const potentialRecord =
    resolvePlayerPotentialRecordForProgression({
      gameState: input.gameState,
      player: input.player,
    }) ??
    resolvePlayerPotentialRecordFromGameState({
      gameState: input.gameState,
      playerId: input.player.id,
    });
  const axisStars = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player: input.player,
    disciplines: input.gameState.disciplines,
  });
  const axisPoStars = potentialRecord?.hiddenPotentialCeilingByAxis ?? null;
  const ceilingTrainingMultiplier =
    potentialRecord != null
      ? roundValue(
          playerGeneratorAttributeKeys.reduce((sum, attribute) => {
            return (
              sum +
              getCombinedAttributeTrainingMultiplier({
                player: input.player,
                attribute: attribute as PlayerGeneratorAttributeName,
                record: potentialRecord,
                axisCaStars: axisStars,
                axisPoStars,
              })
            );
          }, 0) / playerGeneratorAttributeKeys.length,
          3,
        )
      : 1;
  const potentialTrainingMultiplier = scoutPotential.trainingSpeedMultiplier * ceilingTrainingMultiplier;
  const performances = getSeasonPerformancesByPlayer(input.gameState).get(input.player.id) ?? [];
  const appearances = input.seasonPerformance?.appearances ?? performances.length;
  const mvs = input.playerRating?.mvs ?? null;
  const pps = input.playerRating?.ppsSeason ?? input.seasonPerformance?.totalPoints ?? null;
  const rank1Count = getRank1Count(performances);
  const top10Count = getTop10Count(performances, input.seasonPerformance);
  const mvpCount = getMvpCount(performances, input.seasonPerformance);
  const highlightCount = (input.gameState.seasonState.disciplineHighlights ?? []).filter(
    (entry) => entry.playerId === input.player.id,
  ).length;

  const baseTrainingXPBeforePotential = PLAYER_PROGRESSION_XP_CONSTANTS.trainingByMode[mode];
  const baseTrainingXP = roundValue(baseTrainingXPBeforePotential * potentialTrainingMultiplier, 0);
  const developmentTrainingBonusPct = rosterEntry
    ? getTeamDevelopmentTrainingBonusPct(input.gameState, rosterEntry.teamId)
    : 0;
  const facilityTrainingXp = applyTrainingXpFacilityModifiers(baseTrainingXP, facilities, {
    developmentTrainingBonusPct,
  });
  const facilityTrainingDelta = facilityTrainingXp.after - facilityTrainingXp.before;
  const appearanceXP = appearances * PLAYER_PROGRESSION_XP_CONSTANTS.appearanceXp;
  const mvsXP = isFiniteNumber(mvs) ? roundValue(mvs * PLAYER_PROGRESSION_XP_CONSTANTS.mvsMultiplier, 0) : 0;
  const ppsBonusXP = calculatePpsBonusXp(pps, mvsXP);
  const topPlayerXP = calculateTopPlayerXp({ top10Count, rank1Count });
  const highlightXP = calculateHighlightXp({ mvpCount, highlightCount });

  const events = [
    buildEvent({
      type: "base_training",
      label:
        potentialTrainingMultiplier === 1
          ? `${mode} Training`
          : `${mode} Training · Potential x${potentialTrainingMultiplier.toFixed(2)}`,
      xpBeforeTraits: baseTrainingXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: "ready",
    }),
    buildEvent({
      type: "potential_modifier",
      label: "Scout-Potential Trainingsspeed",
      xpBeforeTraits: baseTrainingXP - baseTrainingXPBeforePotential,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: scoutPotential.certainty === "missing_source" ? "missing_source" : "ready",
    }),
    buildEvent({
      type: "appearance",
      label: `${appearances} Einsaetze`,
      xpBeforeTraits: appearanceXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: appearances > 0 ? "ready" : "missing_source",
    }),
    buildEvent({
      type: "mvs",
      label: "MVS Performance",
      xpBeforeTraits: mvsXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: isFiniteNumber(mvs) ? "ready" : "missing_source",
    }),
    buildEvent({
      type: "pps_bonus",
      label: "PPs Bonus gedeckelt",
      xpBeforeTraits: ppsBonusXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: isFiniteNumber(pps) ? "ready" : "missing_source",
    }),
    buildEvent({
      type: "top10",
      label: `${top10Count} Top10 / ${rank1Count} Platz 1`,
      xpBeforeTraits: topPlayerXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: top10Count > 0 || rank1Count > 0 ? "ready" : "missing_source",
    }),
    buildEvent({
      type: "highlight",
      label: `${mvpCount + highlightCount} Highlight/Captain/Underdog`,
      xpBeforeTraits: highlightXP,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: mvpCount > 0 || highlightCount > 0 ? "ready" : "missing_source",
    }),
    buildEvent({
      type: "facility_modifier",
      label:
        facilityTrainingXp.modifierPct > 0
          ? `Training Center +${facilityTrainingXp.modifierPct}%`
          : "Kein Training-Center-Bonus",
      xpBeforeTraits: facilityTrainingDelta,
      traitModifierPct,
      traitMultiplier,
      sourceStatus: trainingCenterLevel > 0 ? "ready" : "missing_source",
    }),
  ];

  const xpBeforeTraits = roundValue(baseTrainingXP + appearanceXP + mvsXP + ppsBonusXP + topPlayerXP + highlightXP, 0);
  const xpAfterTraits = withTraits(xpBeforeTraits, traitMultiplier);
  const performanceXP = withTraits(appearanceXP + mvsXP + ppsBonusXP + topPlayerXP + highlightXP, traitMultiplier);
  const currentAbilityRating = getCurrentAbility({ player: input.player, playerRating: input.playerRating });
  const potentialRating =
    potentialRecord?.hiddenPotentialScore ??
    scoutPotential.scoutRating ??
    (input.player.potential > 0 ? input.player.potential : currentAbilityRating);
  const scoutingTeamId = rosterEntry?.teamId ?? null;
  const internalStarSnapshot =
    potentialRecord != null
      ? buildPlayerStarScoutingSnapshot({
          gameState: input.gameState,
          player: input.player,
          saveId: input.gameState.season.id,
          scoutingLevel: 5,
        })
      : null;
  const axisStarSnapshot =
    scoutingTeamId != null && getEffectiveScoutingLevel(input.gameState, scoutingTeamId, input.player.id) > 0
      ? buildPlayerStarScoutingSnapshot({
          gameState: input.gameState,
          player: input.player,
          saveId: input.gameState.season.id,
          scoutingLevel: getEffectiveScoutingLevel(input.gameState, scoutingTeamId, input.player.id),
        })
      : internalStarSnapshot;
  const potentialGapStars = internalStarSnapshot?.potentialGap ?? axisStarSnapshot?.potentialGap ?? null;
  const trainingFormTier = getTrainingFormTier(buildTrainingFormScore(input.player, mode));
  const developmentLevelProgress = getDevelopmentLevelProgress(
    input.lifetimeXP ?? input.player.lifetimeXP ?? (input.currentXP ?? input.player.currentXP ?? 0) + (input.spentXP ?? input.player.spentXP ?? 0),
  );
  const netDevelopment = buildNetDevelopment({
    player: input.player,
    gameState: input.gameState,
    currentAbility: currentAbilityRating,
    potentialRating,
    potentialGapStars: potentialRecord != null ? potentialGapStars : null,
    trainingFormTier,
    traitMultiplier,
    appearances,
    mvs,
    pps,
    xpAfterTraits,
    boardTrustScore: input.boardTrustScore ?? null,
    currentDevelopmentLevel: developmentLevelProgress.developmentLevel,
  });
  const developmentRoute = buildDevelopmentRoute({
    role: netDevelopment.role,
    potentialGap: netDevelopment.potentialGap,
    netDevelopmentXP: netDevelopment.netDevelopmentXP,
    isFreeAgent: netDevelopment.isFreeAgent,
  });
  const balancedNetDevelopmentXP = netDevelopment.netDevelopmentXP;
  const xpTrend = getTrend(balancedNetDevelopmentXP);
  const regressionRisk = getRegressionRisk({
    netDevelopmentXP: balancedNetDevelopmentXP,
    regressionPressure: netDevelopment.organicRegressionPressure,
  });
  const spendableProjectedXP = Math.max(0, balancedNetDevelopmentXP);

  const result: PlayerProgressionForecast = {
    playerId: input.player.id,
    trainingMode: mode,
    currentXP: input.currentXP ?? 0,
    spentXP: input.spentXP ?? 0,
    lifetimeXP: input.lifetimeXP ?? null,
    seasonProjectedXP: spendableProjectedXP,
    earnedXP: netDevelopment.earnedXP,
    maintenanceXP: netDevelopment.maintenanceXP,
    regressionPressure: netDevelopment.regressionPressure,
    netDevelopmentXP: balancedNetDevelopmentXP,
    trainingFormTier,
    xpTrend,
    regressionRisk,
    developmentRoute,
    currentAbilityRating,
    currentAbilityTier: getRatingTier(currentAbilityRating),
    currentAbilityStars: axisStarSnapshot?.revealedCurrentStars.displayLabel ?? getStarLabel(currentAbilityRating),
    potentialRating,
    potentialTier: getRatingTier(potentialRating),
    potentialStars: axisStarSnapshot?.revealedPotentialStars.displayLabel ?? getStarLabel(potentialRating),
    developmentFactors: netDevelopment.developmentFactors,
    maintenanceBreakdown: netDevelopment.maintenanceBreakdown,
    regressionBreakdown: netDevelopment.regressionBreakdown,
    baseTrainingXP: withTraits(baseTrainingXP, traitMultiplier),
    appearanceXP: withTraits(appearanceXP, traitMultiplier),
    mvsXP: withTraits(mvsXP, traitMultiplier),
    ppsBonusXP: withTraits(ppsBonusXP, traitMultiplier),
    topPlayerXP: withTraits(topPlayerXP, traitMultiplier),
    highlightXP: withTraits(highlightXP, traitMultiplier),
    performanceXP,
    traitModifierPct,
    traitMultiplier,
    potentialTrainingMultiplier,
    scoutPotential,
    xpBeforeTraits,
    xpAfterTraits,
    xpEvents: events,
    fatigueStrain: buildFatigueStrain({
      mode,
      appearances,
      traitMultiplier,
      hasDisciplinedTrait: input.player.traitsPositive.includes("Disciplined"),
    }),
    sourceStatus: {
      appearances: appearances > 0 ? "ready" : "missing_source",
      mvs: isFiniteNumber(mvs) ? "ready" : "missing_source",
      pps: isFiniteNumber(pps) ? "ready" : "missing_source",
      highlights: mvpCount > 0 || highlightCount > 0 ? "ready" : "missing_source",
      facilities: trainingCenterLevel > 0 ? "ready" : "missing_source",
      writes: "preview_only",
    },
	    audit: {
	      mvsPpsCoupling: `PPs-Bonus ist auf ${Math.round(PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusCapPctOfMvsXp * 100)}% der MVS-XP gedeckelt, mindestens ${PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusNoMvsCap} XP ohne MVS.`,
	      seasonEndOnly: true,
	      productiveWrites: false,
	      warnings: [
	        ...traitSignal.warnings,
	        ...scoutPotential.warnings,
	        ...(netDevelopment.regressionBreakdown.seasonGainSoftCeiling > 0
	          ? [`season_gain_soft_ceiling:${netDevelopment.regressionBreakdown.seasonGainSoftCeiling}:${developmentRoute}`]
	          : []),
	        ...(netDevelopment.regressionBreakdown.seasonGainHardCap > 0
	          ? [`season_gain_hard_cap:${netDevelopment.regressionBreakdown.seasonGainHardCap}:${developmentRoute}`]
	          : []),
	        ...(netDevelopment.regressionBreakdown.potentialCeiling > 0
	          ? [`potential_ceiling:${netDevelopment.regressionBreakdown.potentialCeiling}:${developmentRoute}`]
	          : []),
	        ...(netDevelopment.regressionBreakdown.highValueUnderperformance > 0
	          ? [`high_value_underperformance:${netDevelopment.regressionBreakdown.highValueUnderperformance}`]
	          : []),
	        ...(netDevelopment.netDevelopmentXP < 0 ? ["net_development_negative"] : []),
	        ...(regressionRisk === "high" ? ["regression_risk_high"] : []),
	      ],
    },
  };

  if (canCache) {
    let perState = forecastResultCache.get(input.gameState);
    if (!perState) {
      perState = new Map();
      forecastResultCache.set(input.gameState, perState);
    }
    perState.set(cacheKey, result);
  }
  return result;
}
