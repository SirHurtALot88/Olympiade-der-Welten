import type { GameState, Player, PlayerDisciplinePerformanceRecord } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { buildPlayerScoutPotential } from "@/lib/progression/player-potential-service";
import { buildTrainingTraitSignal } from "@/lib/training/trait-training-signal";
import type {
  PlayerProgressionForecast,
  PlayerProgressionRatingTier,
  PlayerProgressionXpEvent,
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
}) {
  const mode = getTrainingMode(input.player, input.trainingModeByPlayerId);
  const traitSignal = buildTrainingTraitSignal({
    traitsPositive: input.player.traitsPositive,
    traitsNegative: input.player.traitsNegative,
  });
  const traitMultiplier = traitSignal.trainingTraitMultiplier;
  const traitModifierPct = getTraitModifierPct(traitMultiplier);
  const scoutPotential = buildPlayerScoutPotential({ player: input.player });
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

  return {
    playerId: input.player.id,
    trainingMode: mode,
    currentXP: input.currentXP ?? 0,
    spentXP: input.spentXP ?? 0,
    lifetimeXP: input.lifetimeXP ?? null,
    seasonProjectedXP: xpAfterTraits,
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
    possibleUpgradeSummary: buildUpgradeSummary(xpAfterTraits),
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
      warnings: [...traitSignal.warnings, ...scoutPotential.warnings],
    },
  } satisfies PlayerProgressionForecast;
}
