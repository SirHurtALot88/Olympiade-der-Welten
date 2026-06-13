import type { GameState, Player, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { buildPlayerScoutPotentialFromGameState } from "@/lib/progression/player-potential-service";
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

export const PLAYER_PROGRESSION_XP_CONSTANTS = {
  trainingByMode: {
    leicht: 40,
    mittel: 70,
    hart: 110,
  } satisfies Record<PlayerTrainingMode, number>,
  appearanceXp: 15,
  mvsMultiplier: 20,
  ppsBonusMultiplier: 12,
  ppsBonusCapPctOfMvsXp: 0.35,
  ppsBonusNoMvsCap: 60,
  top10BonusMin: 25,
  top10BonusMax: 100,
  rank1BonusMin: 150,
  rank1BonusMax: 250,
  highlightBonusMin: 25,
  highlightBonusMax: 100,
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

function buildUpgradeSummary(totalXp: number) {
  const costs = PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost;
  const fd = costs.D ?? 70;
  const cb = costs.B ?? 130;
  const as = costs.S ?? 250;
  const low = Math.max(1, Math.floor(totalXp / fd));
  const mid = Math.max(0, Math.floor(totalXp / cb));
  const high = Math.max(0, Math.floor(totalXp / as));
  if (totalXp < (costs.F ?? 45)) {
    return "unter 1 niedriges Upgrade";
  }
  return `ca. ${low} F/D-Upgrades, ${mid} C/B-Upgrades oder ${high} A/S-Upgrades`;
}

function buildFatigueStrain(input: {
  mode: PlayerTrainingMode;
  appearances: number;
  traitMultiplier: number;
  hasDisciplinedTrait: boolean;
}) {
  const modeBase = input.mode === "hart" ? 62 : input.mode === "mittel" ? 38 : 18;
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
  if (input.netDevelopmentXP < -30) return "stagnation_watch";
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
  if (input.netDevelopmentXP <= -110 || input.regressionPressure >= 95) return "high";
  if (input.netDevelopmentXP < -30 || input.regressionPressure >= 60) return "medium";
  if (input.regressionPressure >= 25) return "low";
  return "none";
}

function buildNetDevelopment(input: {
  player: Player;
  gameState: GameState;
  currentAbility: number | null;
  potentialRating: number | null;
  trainingFormTier: PlayerTrainingFormTier;
  traitMultiplier: number;
  appearances: number;
  mvs: number | null;
  pps: number | null;
  xpAfterTraits: number;
  boardTrustScore: number | null;
}) {
  const role = getRosterRole(input.gameState, input.player.id);
  const isFreeAgent = !input.gameState.rosters.some((entry) => entry.playerId === input.player.id);
  const ca = input.currentAbility ?? 50;
  const po = input.potentialRating ?? Math.max(ca, 55);
  const potentialGap = po - ca;
  const playtimeFactor = input.appearances >= 7 ? 1.1 : input.appearances >= 4 ? 1 : input.appearances >= 1 ? 0.9 : isFreeAgent ? 0.82 : 0.74;
  const performanceFactor =
    isFiniteNumber(input.mvs) || isFiniteNumber(input.pps)
      ? clamp(0.8 + ((input.mvs ?? 0) / 40) + ((input.pps ?? 0) / 120), 0.72, 1.28)
      : 0.92;
  const trainingFormFactor = getTierFactor(input.trainingFormTier);
  const potentialGapFactor = potentialGap >= 28 ? 1.18 : potentialGap >= 14 ? 1.1 : potentialGap >= 5 ? 1.02 : potentialGap >= -2 ? 0.82 : 0.62;
  const traitFactor = clamp(input.traitMultiplier, 0.9, 1.1);
  const routeConflict = input.player.traitsNegative.some((trait) => ["Mercenary", "Renegade", "Diva", "Egomaniac"].includes(trait));
  const routeFitFactor = routeConflict ? 0.92 : 1;
  const earnedXP = roundValue(input.xpAfterTraits * playtimeFactor * performanceFactor * trainingFormFactor * potentialGapFactor * traitFactor * routeFitFactor, 0);
  const roleMaintenance = isStarOrCore(role) ? (role.includes("star") ? 42 : 28) : isProspect(role) ? 8 : 16;
  const potentialProximity = potentialGap <= -1 ? 45 + Math.abs(potentialGap) * 4 : potentialGap <= 4 ? 36 : potentialGap <= 10 ? 20 : 8;
  const currentAbilityMaintenance = ca * 0.65;
  const overPotential = Math.max(0, ca - po) * 8;
  const maintenanceBreakdown = {
    currentAbility: roundValue(currentAbilityMaintenance, 0),
    role: roleMaintenance,
    potentialProximity: roundValue(potentialProximity, 0),
    overPotential: roundValue(overPotential, 0),
  };
  const maintenanceXP = roundValue(
    maintenanceBreakdown.currentAbility + maintenanceBreakdown.role + maintenanceBreakdown.potentialProximity + maintenanceBreakdown.overPotential,
    0,
  );
  const lowPlaytime = input.appearances === 0 ? (isFreeAgent ? 8 : isStarOrCore(role) ? 42 : 24) : input.appearances <= 2 ? 14 : 0;
  const poorPerformance = input.appearances > 0 && (input.mvs ?? 0) < 4 && (input.pps ?? 0) < 8 ? 28 : input.appearances > 0 && (input.mvs ?? 0) < 8 ? 12 : 0;
  const sharpness = isFiniteNumber(input.player.form) && input.player.form > 0 && input.player.form < 38 ? 18 : 0;
  const boardTrust = input.boardTrustScore != null ? (input.boardTrustScore < 30 ? 28 : input.boardTrustScore < 50 ? 13 : 0) : 0;
  const negativeTraits = input.player.traitsNegative.reduce((sum, trait) => sum + Math.abs(TRAINING_FORM_NEGATIVE_TRAITS[trait] ?? 0) * 0.7, 0);
  const routeConflictPressure = routeConflict ? 14 : 0;
  const starUnderperformance = isStarOrCore(role) && input.appearances >= 4 && ((input.mvs ?? 0) < 8 || (input.pps ?? 0) < 12) ? 24 : 0;
  const regressionBreakdown = {
    lowPlaytime: roundValue(lowPlaytime, 0),
    poorPerformance: roundValue(poorPerformance, 0),
    sharpness: roundValue(sharpness, 0),
    boardTrust: roundValue(boardTrust, 0),
    negativeTraits: roundValue(negativeTraits, 0),
    routeConflict: roundValue(routeConflictPressure, 0),
    starUnderperformance: roundValue(starUnderperformance, 0),
  };
  const regressionPressure = roundValue(Object.values(regressionBreakdown).reduce((sum, value) => sum + value, 0), 0);
  const netDevelopmentXP = roundValue(earnedXP - maintenanceXP - regressionPressure, 0);
  return {
    role,
    isFreeAgent,
    potentialGap,
    earnedXP,
    maintenanceXP,
    regressionPressure,
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
    regressionBreakdown,
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
}) {
  const mode = getTrainingMode(input.player, input.trainingModeByPlayerId);
  const traitSignal = buildTrainingTraitSignal({
    traitsPositive: input.player.traitsPositive,
    traitsNegative: input.player.traitsNegative,
  });
  const traitMultiplier = traitSignal.trainingTraitMultiplier;
  const traitModifierPct = getTraitModifierPct(traitMultiplier);
  const scoutPotential = buildPlayerScoutPotentialFromGameState({
    gameState: input.gameState,
    player: input.player,
    saveId: input.gameState.season.id,
  });
  const potentialTrainingMultiplier = scoutPotential.trainingSpeedMultiplier;
  const performances = (input.gameState.seasonState.playerDisciplinePerformances ?? []).filter((entry) => {
    const result = (input.gameState.seasonState.matchdayResults ?? []).find((candidate) => candidate.id === entry.matchdayResultId);
    return entry.playerId === input.player.id && (result?.seasonId ?? input.gameState.season.id) === input.gameState.season.id;
  });
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
          : `${mode} Training · Scout Potential x${potentialTrainingMultiplier.toFixed(2)}`,
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
      label: "Facility-Modifikatoren",
      xpBeforeTraits: 0,
      traitModifierPct: 0,
      traitMultiplier: 1,
      sourceStatus: "future_source",
    }),
  ];

  const xpBeforeTraits = roundValue(baseTrainingXP + appearanceXP + mvsXP + ppsBonusXP + topPlayerXP + highlightXP, 0);
  const xpAfterTraits = withTraits(xpBeforeTraits, traitMultiplier);
  const performanceXP = withTraits(appearanceXP + mvsXP + ppsBonusXP + topPlayerXP + highlightXP, traitMultiplier);
  const currentAbilityRating = getCurrentAbility({ player: input.player, playerRating: input.playerRating });
  const potentialRating = scoutPotential.scoutRating ?? (input.player.potential > 0 ? input.player.potential : currentAbilityRating);
  const trainingFormTier = getTrainingFormTier(buildTrainingFormScore(input.player, mode));
  const netDevelopment = buildNetDevelopment({
    player: input.player,
    gameState: input.gameState,
    currentAbility: currentAbilityRating,
    potentialRating,
    trainingFormTier,
    traitMultiplier,
    appearances,
    mvs,
    pps,
    xpAfterTraits,
    boardTrustScore: input.boardTrustScore ?? null,
  });
  const xpTrend = getTrend(netDevelopment.netDevelopmentXP);
  const regressionRisk = getRegressionRisk({
    netDevelopmentXP: netDevelopment.netDevelopmentXP,
    regressionPressure: netDevelopment.regressionPressure,
  });
  const developmentRoute = buildDevelopmentRoute({
    role: netDevelopment.role,
    potentialGap: netDevelopment.potentialGap,
    netDevelopmentXP: netDevelopment.netDevelopmentXP,
    isFreeAgent: netDevelopment.isFreeAgent,
  });
  const spendableProjectedXP = Math.max(0, netDevelopment.netDevelopmentXP);

  return {
    playerId: input.player.id,
    trainingMode: mode,
    currentXP: input.currentXP ?? 0,
    spentXP: input.spentXP ?? 0,
    lifetimeXP: input.lifetimeXP ?? null,
    seasonProjectedXP: spendableProjectedXP,
    earnedXP: netDevelopment.earnedXP,
    maintenanceXP: netDevelopment.maintenanceXP,
    regressionPressure: netDevelopment.regressionPressure,
    netDevelopmentXP: netDevelopment.netDevelopmentXP,
    trainingFormTier,
    xpTrend,
    regressionRisk,
    developmentRoute,
    currentAbilityRating,
    currentAbilityTier: getRatingTier(currentAbilityRating),
    currentAbilityStars: getStarLabel(currentAbilityRating),
    potentialRating,
    potentialTier: getRatingTier(potentialRating),
    potentialStars: getStarLabel(potentialRating),
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
    possibleUpgradeSummary: buildUpgradeSummary(spendableProjectedXP),
    ratingTierCosts: PLAYER_PROGRESSION_XP_CONSTANTS.ratingTierUpgradeCost,
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
      facilities: "future_source",
      writes: "preview_only",
    },
    audit: {
      mvsPpsCoupling: `PPs-Bonus ist auf ${Math.round(PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusCapPctOfMvsXp * 100)}% der MVS-XP gedeckelt, mindestens ${PLAYER_PROGRESSION_XP_CONSTANTS.ppsBonusNoMvsCap} XP ohne MVS.`,
      seasonEndOnly: true,
      productiveWrites: false,
      warnings: [
        ...traitSignal.warnings,
        ...scoutPotential.warnings,
        ...(netDevelopment.netDevelopmentXP < 0 ? ["net_development_negative"] : []),
        ...(regressionRisk === "high" ? ["regression_risk_high"] : []),
      ],
    },
  } satisfies PlayerProgressionForecast;
}
