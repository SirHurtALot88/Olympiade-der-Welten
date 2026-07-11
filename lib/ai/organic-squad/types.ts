/**
 * Organic marginal-utility squad builder — shared contracts (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. This module holds PURE domain types,
 * constants, and the function contracts the utility model is composed from. NOTHING here is wired
 * into the game/AI yet (P1 = pure functions + tests, no behaviour change). The composition
 * (buy/sell/stop utility) lives in ./utility.ts; the leaf functions live in their own files.
 *
 * North star (docs): team identity must be visible in "save vs. spend" AND in the picks;
 * composition emerges from these terms under only two hard blockers (roster ∈ [8,14], cash ≥ buffer).
 *
 * Quality is derived PURELY from stats — POW/SPE/MEN/SOC + discipline skill counts. `mvs`/`ovr` are
 * null/unreliable at draft time and MUST NOT be used as quality. Market value is PRICE only.
 */

/** The four core attributes, each 0–100. */
export type CoreAxis = "pow" | "spe" | "men" | "soc";

/** Discipline categories map 1:1 onto core axes: power→pow, speed→spe, mental→men, social→soc. */
export type DisciplineCategory = "power" | "speed" | "mental" | "social";

export const CORE_AXES: readonly CoreAxis[] = ["pow", "spe", "men", "soc"];

/** power→pow, speed→spe, mental→men, social→soc. */
export const CATEGORY_TO_AXIS: Record<DisciplineCategory, CoreAxis> = {
  power: "pow",
  speed: "spe",
  mental: "men",
  social: "soc",
};

/** Discipline skill strictly above this counts as "solide" coverage. */
export const SOLIDE_THRESHOLD = 60;
/** Discipline skill strictly above this counts as a "specialist". */
export const SPECIALIST_THRESHOLD = 80;

/** Hard roster blockers (the only ones). */
export const ROSTER_MIN = 8;
export const ROSTER_MAX = 14;

/**
 * Minimal player view the utility model needs. Sourced from the domain `Player`
 * (coreStats + disciplineRatings) — NOT from the transfer-market item's mvs/ovr.
 */
export type OrganicPlayerView = {
  playerId: string;
  /** 0–100 core attributes. */
  pow: number;
  spe: number;
  men: number;
  soc: number;
  /** disciplineId → skill 0–100 (from player.disciplineRatings). */
  disciplineRatings: Record<string, number>;
  /** Transfer PRICE only — never used as a quality signal. */
  marketValue: number;
  /** Per-season salary. */
  salary: number;
  /** Build-for-future signal (potential; there is NO age dimension in this game). Null if unknown. */
  potential?: number | null;
};

/** A discipline definition (id + which core axis it loads on). */
export type OrganicDiscipline = {
  id: string;
  category: DisciplineCategory;
};

/**
 * Per-discipline need for a team: how much it wants this discipline and how covered it already is.
 * Feeds both quality weighting (which axes matter) and the coverage curve (diminishing returns).
 */
export type DisciplineNeed = {
  disciplineId: string;
  category: DisciplineCategory;
  /** 0–1: identity/roster-gap driven importance of this discipline for this team. */
  needWeight: number;
  /** Players currently in the squad with skill > SOLIDE_THRESHOLD in this discipline. */
  coveredCount: number;
};

/**
 * Utility weights derived from identity (base character) + GM (handwriting on top).
 * All weights ≥ 0. `optTarget` is the soft, GM-modulated roster target within [ROSTER_MIN, ROSTER_MAX].
 */
export type OrganicUtilityWeights = {
  /** Appetite for marginal squad strength (spend-to-win). */
  wWin: number;
  /** Cost aversion (value/thrift) — the systemic value-tilt. */
  wThrift: number;
  /** Sensitivity to wage/cash-flow sustainability. */
  wSustain: number;
  /** Appetite for potential/future value. */
  wAsset: number;
  /** Value of holding cash (patience/saving). */
  wPatience: number;
  /** Soft roster target (STOP grows attractive as roster approaches it), clamped to [8,14]. */
  optTarget: number;
};

/** Identity fields the weight derivation reads (0–100 management scale). */
export type OrganicIdentityInput = {
  ambition: number;
  finances: number;
  boardConfidence: number;
  harmony: number;
  playerOpt: number;
};

/** GM bias fields the weight derivation reads (1–10 scale, neutral 5). All optional. */
export type OrganicGmBiasInput = Partial<{
  starPriority: number;
  valuePriority: number;
  cashPriority: number;
  riskTolerance: number;
  rosterDepthPreference: number;
  eliteSmallRosterPreference: number;
  loyaltyBias: number;
  wageSensitivity: number;
  sellForProfitAggression: number;
}>;

/** Rolling cash-flow forecast for sustainability + cash option value. */
export type CashFlowForecast = {
  /** cash − salary + expectedPrize + sponsor + facilityNet + netTransfer. */
  projectedSeasonEndCash: number;
  /** projectedSeasonEndCash − cashBuffer; negative = bleeding cash. */
  sustainabilityMargin: number;
};

/** Team economic state snapshot the utility model reads. */
export type OrganicTeamState = {
  cash: number;
  cashBuffer: number;
  salaryTotal: number;
  rosterSize: number;
  /** 0–1: board pressure (1 − normalized boardConfidence); higher → cash is more precious. */
  boardRisk: number;
  forecast: CashFlowForecast;
  weights: OrganicUtilityWeights;
  /** Per-discipline need + coverage for the current squad. */
  disciplineNeeds: DisciplineNeed[];
  /** Need weight per core axis (0–1), derived from disciplineNeeds; used by quality scoring. */
  needAxisWeights: Record<CoreAxis, number>;
};

/** Utility-model helper: count disciplines in a player's ratings strictly above a threshold. */
export function countDisciplinesAbove(
  disciplineRatings: Record<string, number>,
  threshold: number,
): number {
  let count = 0;
  for (const value of Object.values(disciplineRatings)) {
    if (value > threshold) count += 1;
  }
  return count;
}
