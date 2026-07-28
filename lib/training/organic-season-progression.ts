import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributeName,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import {
  getAcademyDevelopmentBoostPct,
  getFacilityEfficiency,
  getFacilityLevel,
  getRecoveryTrainingFatigueReductionPct,
} from "@/lib/facilities/facility-effects";
import { getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import {
  getAttributeAffinityKind,
  resolveSeasonalAffinityProfile,
  type AttributeAffinityKind,
  type AttributeAffinityProfile,
} from "@/lib/training/training-levelup-service";
import type { PlayerDevelopmentRoute } from "@/lib/training/training-plan-types";
import {
  getCombinedAttributeTrainingMultiplier,
} from "@/lib/foundation/player-potential-display-service";
import {
  getAttributeHeadroom,
  getPerformanceHeadroomGrowthMultiplier,
  resolvePlayerPotentialRecordFromGameState,
  type AttributeHeadroomState,
} from "@/lib/scouting/player-attribute-ceiling-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { resolvePlayerPotentialRecordForProgression } from "@/lib/scouting/player-potential-ceiling-service";
import {
  calculateDynamicClassName,
  getClassTrainingProfile,
  getClassTrainingSignals,
  normalizeProgressionClassName,
  PROGRESSION_ATTRIBUTE_ORDER,
  type ProgressionClassName,
} from "@/lib/training/class-progression-config";
import { buildTrainingTraitSignal } from "@/lib/training/trait-training-signal";
import { buildPlayerStarScoutingSnapshot } from "@/lib/scouting/player-star-scouting-bridge";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import type { PlayerProgressionRatingTier, PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { FATIGUE_LOAD_BY_MODE, TRAINING_SETPOINTS_BY_MODE } from "@/lib/training/training-mode-presentation";
import { getDevelopmentRouteBonusMultiplier } from "@/lib/training/development-route-bonus";
import type { PlayerDevelopmentRouteSuggestion } from "@/lib/progression/player-potential-service";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";

export type OrganicProgressionAttributeBreakdown = {
  attribute: PlayerGeneratorAttributeName;
  before: number;
  after: number;
  delta: number;
  regression: number;
  training: number;
  performance: number;
  /**
   * Spillover-Trainingsanteil (Nebenstat-Hilfe): Ein Teil des Budgets, den die Fokus-Stats
   * wegen Attribut-Decke/Potenzialraum nicht aufnehmen konnten, wird zu einem kleinen Anteil
   * (`TRAINING_SPILLOVER_SHARE`) gleichmäßig auf die NICHT-fokussierten, noch nicht gecappten
   * Attribute verteilt (mit deterministischem ±`TRAINING_SPILLOVER_JITTER`-Jitter). Bremst dort
   * die Regression leicht. Getrennt von `training` ausgewiesen, damit die UI es eigenständig zeigen kann.
   */
  spillover: number;
  affinity: AttributeAffinityKind;
  trainingGrowthMultiplier: number;
  performanceGrowthMultiplier: number;
};

export type OrganicSeasonProgressionResult = {
  playerId: string;
  seasonId: string;
  classBefore: string;
  classAfter: ProgressionClassName;
  classChanged: boolean;
  primaryTrainingClass: ProgressionClassName;
  secondaryTrainingClass: ProgressionClassName | null;
  trainingMode: PlayerTrainingMode;
  fatigueLoad: number;
  potentialRating: number | null;
  potentialTrainingMultiplier: number;
  /**
   * Gedämpfter Anteil des Potenzial-Gap-Beschleunigers, der zusätzlich auf die
   * Performance-SPs wirkt (>= 1). Siehe `getPerformanceGapAccelerator`.
   */
  performanceGapAccelerator: number;
  traitTrainingMultiplier: number;
  traitModifierPct: number;
  traitBreakdown: Array<{
    trait: string;
    legacyTraitTrainingFactorPct: number | null;
    known: boolean;
    tone: "positive" | "negative" | "neutral";
  }>;
  facilityModifierPct: number;
  baseRegressionPerAttribute: number;
  marketValuePressureTotal: number;
  marketValuePressurePerAttribute: number;
  marketValueMaintenanceReliefPct: number;
  trainingSetpoints: number;
  /** Sum of applied training deltas on the focus (class-profile) attributes after distribution and multipliers. */
  appliedTrainingSetpoints: number;
  /**
   * Sum of the spillover training deltas redistributed onto non-focus, non-capped attributes
   * (`TRAINING_SPILLOVER_SHARE` of the budget the focus stats could not absorb). Separate from
   * `appliedTrainingSetpoints` so the forecast breakdown can surface it as its own line.
   */
  spilloverSetpoints: number;
  /** Raw performance budget before affinity multipliers. */
  performanceSetpoints: number;
  /** Sum of applied performance deltas after affinity multipliers. */
  appliedPerformanceSetpoints: number;
  performanceRegressionTotal: number;
  performanceRegressionPerAttribute: number;
  regressionBreakdown: OrganicRegressionBreakdown;
  netSetpoints: number;
  topTrainingAttributes: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
  negativeTrainingRisks: Array<{ attribute: PlayerGeneratorAttributeName; weight: number }>;
  attributeAffinity: {
    signatureAttributes: AttributeAffinityProfile["signatureAttributes"];
    weakAttribute: PlayerGeneratorAttributeName;
    signatureGrowthMultiplier: number;
    weakGrowthMultiplier: number;
  };
  attributeBreakdown: OrganicProgressionAttributeBreakdown[];
  attributeDeltas: Partial<Record<PlayerGeneratorAttributeName, number>>;
  attributesBefore: PlayerGeneratorAttributes;
  attributesAfter: PlayerGeneratorAttributes;
  warnings: string[];
};

export type OrganicRegressionBreakdown = {
  /** Basis-Flat-Regression: 0,25 × 12 Attribute (negativ). */
  baseFlatTotal: number;
  /** Marktwert-Druck gesamt: Marktwert × 0,6 % × 12 Attribute (negativ). */
  marketValueTotal: number;
  /** Verwendeter Marktwert (nicht MVS/displayMarketValue). */
  marktwertBase: number;
  /** Angewandte MW-Rate in Prozent (0,6 = 0,6 % vom Marktwert pro Attribut). */
  marketValuePressureRatePct: number;
  /** Summe: regFlat + regMW. */
  combinedTotal: number;
};

/** Tunable via scripts/long-run-auto-tune-organic.ts (--apply regression scale). */
// 0,28 → 0,30: flacher Standard-Verlust leicht angehoben (+0,02/Attr × 12 ≈ +0,24 Verlust/Spieler/Saison),
// damit der gap-getriebene Beschleuniger den Liga-Ø-Netto nicht über die Zieldecke drückt — der Peak-
// Korridor (Talente) bleibt im Band, aber der Durchschnittsspieler sinkt zurück auf ~0,25 (Ziel −0,4…0,4).
export const ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE = 0.3;
/** 1,02 % vom Marktwert pro Attribut (nicht MVS). Tunable via auto-tune (letzter Balancing-Pass). */
export const ORGANIC_MARKET_VALUE_PRESSURE_RATE = 0.0102;
/**
 * Financial/value discipline (B): the market-value regression term scaled linearly and UNBOUNDED, so a
 * near-ceiling high-value star was guaranteed a large negative net — regression fired at full strength
 * while training growth was throttled to 5-45% at the cap. Two organic softeners (no removal of
 * regression for ordinary developing players):
 *  - B2: soft-knee the market value that DRIVES regression, so extreme-value stars aren't penalized
 *    without bound (above the knee, only a fraction of the excess counts).
 *  - B1: make regression HEADROOM-AWARE (mirror of the growth throttle, but gentle) — a capped/closing
 *    attribute plateaus instead of eroding at full speed. Net: a well-managed top star holds/slightly
 *    grows instead of crashing. Open (still-developing) attributes keep full regression (multiplier 1).
 */
export const ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE = 55;
export const ORGANIC_MARKET_VALUE_REGRESSION_KNEE_SLOPE = 0.35;
const ORGANIC_REGRESSION_HEADROOM_MULTIPLIER: Record<"open" | "closing" | "capped", number> = {
  open: 1,
  closing: 0.7,
  capped: 0.45,
};
/**
 * Normiert den optionalen Regression-Spieltag-Anteil auf [0,1]. Ungültige Werte (NaN, ∞, null)
 * fallen auf 1 zurück — d. h. volle Saison-Regression, exakt das bisherige Verhalten.
 */
function normalizeRegressionScale(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return clamp(value, 0, 1);
}

function softKneeMarketValueForRegression(marktwertBase: number): number {
  if (marktwertBase <= ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE) return marktwertBase;
  return (
    ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE +
    (marktwertBase - ORGANIC_MARKET_VALUE_REGRESSION_SOFT_KNEE) * ORGANIC_MARKET_VALUE_REGRESSION_KNEE_SLOPE
  );
}
const NEGATIVE_TRAINING_SIDE_EFFECT_SHARE = 0.14;
/** Performance budget scale — boosts peak P90 vs league median. Tunable via auto-tune. */
export const ORGANIC_PERFORMANCE_SETPOINT_SCALE = 1.05;
const PERFORMANCE_SEASON_SOFT_KNEE = 5.5;
/**
 * 2026-07-04 design correction: growth floors must derive from the player's own
 * potential-cap gap (per the organic design principle — "weit vom Cap = schnell,
 * nah am Cap = automatisch langsamer"), NOT from a global rating>=72 "isStar" gate.
 * A rating-gated floor rewarded players who "already made it" instead of players who
 * are genuinely far from their individual attribute/axis ceiling, which is exactly why
 * high-potential-but-currently-low-rated players (e.g. many Top-20-MW prospects) fell
 * through the cracks. See progress-log.md for the before/after distribution.
 * These floors only ever apply to attributes that are NOT already "capped" per
 * getAttributeHeadroom — a genuinely maxed-out attribute never gets bailed out, no
 * matter how large the player's overall potential gap or how good their performance.
 */
const HIGH_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR = 0.78;
const MID_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR = 0.55;
const HIGH_POTENTIAL_GAP_TRAINING_GROWTH_FLOOR = 0.35;
/** Star-gap thresholds (same scale as getPotentialGapXpFactor's tiers). */
const HIGH_POTENTIAL_GAP_STARS_THRESHOLD = 1.5;
const MID_POTENTIAL_GAP_STARS_THRESHOLD = 0.75;
const SIGNATURE_ORGANIC_GROWTH_MULTIPLIER = 1.15;
const WEAK_ORGANIC_GROWTH_MULTIPLIER = 0.8;
/**
 * Spillover-Nebenstat-Hilfe: Ein Teil des Trainingsbudgets, den die Fokus-Attribute der
 * gewählten Klasse wegen Attribut-Decke/Potenzialraum NICHT aufnehmen konnten, wird zu diesem
 * Anteil auf die nicht-fokussierten (und noch nicht gecappten) Attribute umverteilt — eine milde
 * Hilfe, damit "nebenbei trainierte" Stats etwas Regression abfangen, ohne den Fokus zu ersetzen.
 * Bewusst klein gehalten (30%), damit die Klassenwahl weiter das Wichtigste bleibt.
 */
const TRAINING_SPILLOVER_SHARE = 0.3;
/** Deterministische ±-Variation je Empfänger-Attribut, damit sich die Streuung leicht unterscheidet. */
const TRAINING_SPILLOVER_JITTER = 0.1;

/**
 * Deterministischer 0..1-Hash (FNV-1a) aus Spieler+Saison+Attribut. Ersetzt Math.random(), damit
 * der Forecast bei jedem Rendern stabil bleibt (und in Resume-/Cron-Läufen reproduzierbar ist).
 */
function deterministicUnitNoise(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
/**
 * 2026-07-04 balancing pass: shift weight from pure training towards match performance,
 * concentrated on "mittel" (the default/most-used intensity) so solid performers — not just
 * players with a high potential-gap growth floor — see more of their good match results
 * reflected in progression. "leicht"/"hart" stay at their prior balance. Small and
 * graduated on purpose (+12%); see progress-log.md for the pre/post comparison.
 */
export const PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE: Record<PlayerTrainingMode, number> = {
  leicht: 1.0,
  mittel: 1.12,
  hart: 1.0,
};

const TRAINING_MODES: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];

/**
 * Anti-cheese: derive the season-end training budget and performance-weight multiplier from the
 * player's per-matchday mode accumulator (see `Player["seasonTrainingAccumulator"]`) instead of the
 * single `trainingMode` that happens to be set at season end.
 *
 * Both terms are computed from the EXACT integer per-mode matchday COUNTS — no per-matchday iterative
 * float sum (that would drift). Each term is a share-weighted sum over the ≤3 modes, which is bit-exact
 * for a single-mode full season (e.g. 10× "hart" → `SETPOINTS.hart * (10/10)` === `SETPOINTS.hart`):
 *
 *  - accumulatedBaseTrainingBudget = Σ_m SETPOINTS[m] · (count(m) / totalMatchdays)
 *      denominator = full season length, so a partial/cheesed season yields a proportionally lower
 *      budget (a "hart"-only run over 1 of 10 matchdays does NOT get the full hart budget).
 *  - performanceWeightMultiplier   = Σ_m WEIGHT[m] · (count(m) / matchdaysCounted)
 *      arithmetic mean of the per-matchday multipliers (NOT the multiplier of the "average mode" —
 *      `mittel` is the maximum here, so an average-mode lookup would be wrong; see B.2).
 *
 * Returns null when there is no usable accumulator (→ caller falls back to mode-at-season-end).
 */
/**
 * Geteilte Kernrechnung: aus per-Modus-Zählungen die Anti-Cheese-Overrides ableiten. `budget` mittelt
 * über ALLE Saison-Spieltage (`totalMatchdays`), `performanceWeightMultiplier` über die GEZÄHLTEN
 * Spieltage. Single Source für den echten Accumulator (`resolveSeasonTrainingAccumulatorInputs`) und
 * die Anzeige-Projektion (`buildProjectedSeasonTrainingAccumulatorOverrides`).
 */
function computeAccumulatorOverridesFromCounts(
  counts: Record<PlayerTrainingMode, number>,
  totalMatchdaysInput: number,
): { accumulatedBaseTrainingBudget: number; performanceWeightMultiplier: number } | null {
  const countedMatchdays = counts.leicht + counts.mittel + counts.hart;
  if (countedMatchdays <= 0) return null;
  const totalMatchdays = Math.max(1, Math.floor(totalMatchdaysInput) || 0);
  let accumulatedBaseTrainingBudget = 0;
  let performanceWeightMultiplier = 0;
  for (const mode of TRAINING_MODES) {
    if (counts[mode] === 0) continue;
    accumulatedBaseTrainingBudget += TRAINING_SETPOINTS_BY_MODE[mode] * (counts[mode] / totalMatchdays);
    performanceWeightMultiplier += PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[mode] * (counts[mode] / countedMatchdays);
  }
  return { accumulatedBaseTrainingBudget, performanceWeightMultiplier };
}

function countAccumulatorModes(
  accumulator: Player["seasonTrainingAccumulator"] | undefined,
  seasonId: string,
): Record<PlayerTrainingMode, number> {
  const counts: Record<PlayerTrainingMode, number> = { leicht: 0, mittel: 0, hart: 0 };
  if (!accumulator || accumulator.seasonId !== seasonId) return counts;
  for (const matchdayId of Object.keys(accumulator.modeByMatchday)) {
    const mode = accumulator.modeByMatchday[matchdayId];
    if (mode === "leicht" || mode === "mittel" || mode === "hart") counts[mode] += 1;
  }
  return counts;
}

export function resolveSeasonTrainingAccumulatorInputs(input: {
  accumulator: Player["seasonTrainingAccumulator"] | undefined;
  seasonId: string;
  totalMatchdays: number;
}): { accumulatedBaseTrainingBudget: number; performanceWeightMultiplier: number } | null {
  return computeAccumulatorOverridesFromCounts(
    countAccumulatorModes(input.accumulator, input.seasonId),
    input.totalMatchdays,
  );
}

/** Total-Spieltag-Auflösung wie der Apply (`season-end-xp-apply-service`): deklariert → matchdayIds → 10. */
export function resolveSeasonTotalMatchdaysForProgression(gameState: GameState): number {
  const declared = gameState.season.totalMatchdays;
  if (typeof declared === "number" && Number.isFinite(declared) && declared > 0) return Math.floor(declared);
  const fromIds = gameState.season.matchdayIds?.length ?? 0;
  return fromIds > 0 ? fromIds : 10;
}

/**
 * Anzeige-Projektion der Accumulator-Overrides (Audit #6): die Trainings-Budget-Karte soll den real am
 * Saisonende ANGEWENDETEN Wert vorhersagen, nicht „ganze Saison im aktuellen Modus". Dafür werden die
 * bereits gespielten Ist-Modi (gelockt) mit dem aktuell GEDRAFTETEN Modus für die Rest-Spieltage
 * aufgefüllt → volle Saison-Projektion. Eigenschaften:
 *  - Leerer Accumulator (Vorsaison): alle Spieltage = Draft-Modus ⇒ numerisch identisch zum bisherigen
 *    Legacy-Verhalten (mode-at-season-end), also KEINE Regression ohne Historie.
 *  - Am Saisonende (Rest = 0) ⇒ projiziert == roher Accumulator ⇒ deckt sich mit dem Apply.
 * Rückgabe direkt in `buildOrganicSeasonProgression` spreizen (`{}` = keine Overrides).
 */
export function buildProjectedSeasonTrainingAccumulatorOverrides(input: {
  gameState: GameState;
  player: Player;
  draftMode: PlayerTrainingMode;
}): { accumulatedBaseTrainingBudget?: number; performanceWeightMultiplier?: number } {
  const totalMatchdays = resolveSeasonTotalMatchdaysForProgression(input.gameState);
  const counts = countAccumulatorModes(input.player.seasonTrainingAccumulator, input.gameState.season.id);
  const countedPast = counts.leicht + counts.mittel + counts.hart;
  const remaining = Math.max(0, Math.floor(totalMatchdays) - countedPast);
  if (input.draftMode === "leicht" || input.draftMode === "mittel" || input.draftMode === "hart") {
    counts[input.draftMode] += remaining;
  }
  return computeAccumulatorOverridesFromCounts(counts, totalMatchdays) ?? {};
}

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getFacilityTrainingModifierPct(
  facilities: TeamFacilityCollection | null | undefined,
  developmentTendencyScore = 0,
) {
  const level = getFacilityLevel(facilities, "training_center");
  const efficiencyPct = getFacilityEfficiency(facilities, "training_center").efficiencyPct;
  // Single Source of Truth: der real angewandte Level-Modifier stammt AUSSCHLIESSLICH aus dem
  // Facility-Katalog (getFacilityLevelDefinition) — kein hartkodiertes Zweit-Array mehr, damit
  // Anzeige (applyTrainingXpFacilityModifiers/Forecasts/UI) und hier angewandter Wert nie divergieren.
  // Level 0 (nicht gebaut/kaputt) → 0 %; Katalog-Level 1..5 = [14,28,42,56,70] %.
  const levelModifier = level <= 0 ? 0 : getFacilityLevelDefinition("training_center", level)?.modifierPct ?? 0;
  const developmentBonus = roundValue(developmentTendencyScore * 15, 2);
  return roundValue((levelModifier * efficiencyPct) / 100 + developmentBonus, 2);
}

/**
 * F/E/D = Low-Tier-Einstufung eines Spielers (Rating < 45; C beginnt bei 45, siehe
 * getProgressionRatingTier in season-end-progression-preview.ts). Bewusst inline gehalten, um keinen
 * Laufzeit-Import auf das schwere season-end-progression-preview-Modul (potenzieller Zyklus) zu ziehen
 * — nur die stabile Grade-Grenze wird gespiegelt. Grundlage für den Academy-Youth-Dev-Boost (Fix C).
 */
function resolveLowTierGrade(rating: number): PlayerProgressionRatingTier {
  if (!isFiniteNumber(rating)) return "F";
  if (rating < 15) return "F";
  if (rating < 30) return "E";
  if (rating < 45) return "D";
  return "C";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeTrainingMode(value: Player["trainingMode"]): PlayerTrainingMode {
  return value === "leicht" || value === "mittel" || value === "hart" ? value : "mittel";
}

export function classNameToDevelopmentRoute(className: ProgressionClassName): PlayerDevelopmentRouteSuggestion {
  if (className === "Berserker" || className === "Warlord" || className === "Tank" || className === "Badass") return "POW";
  if (className === "Sprinter" || className === "Rogue" || className === "Charger") return "SPE";
  if (className === "Mage" || className === "Overseer" || className === "Tactician") return "MEN";
  if (className === "Bard" || className === "Hero" || className === "Templar") return "SOC";
  return "BALANCED";
}

export function resolveTeamTrainingFocusAxis(gameState: GameState, playerId: string) {
  const rosterEntry = gameState.rosters.find((entry) => entry.playerId === playerId);
  if (!rosterEntry) return null;
  const focus = gameState.seasonState.aiManagerTrainingSettings?.[rosterEntry.teamId]?.trainingFocus;
  if (focus === "POW") return "pow" as const;
  if (focus === "SPE") return "spe" as const;
  if (focus === "MEN") return "men" as const;
  if (focus === "SOC") return "soc" as const;
  return null;
}

/** Marktwert für organische Regression — bewusst ohne MVS/displayMarketValue. */
export function getMarktwertForRegression(player: Player) {
  const value = player.marketValue;
  if (!isFiniteNumber(value)) return 0;
  return value > 1000 ? value / 1000 : value;
}

// Gap-getriebener Entwicklungs-BESCHLEUNIGER (ersetzt das frühere MAX-PO-Band). Die Entwicklungs-
// GESCHWINDIGKEIT hängt an der LÜCKE (Potenzial − aktuelle Stärke), NICHT am maximalen Potenzial:
// ein Spieler mit CA 15 / PO 66 (Lücke 51) entwickelt sich schneller als CA 50 / PO 75 (Lücke 25).
// Das behebt die frühere Inversion, bei der ein niedriges PO-Band (0,72/0,92) den großen-Lücke-Talenten
// die Entwicklung ausbremste, obwohl sie den meisten Headroom haben.
//
// WICHTIG (User-Vorgabe): NUR Beschleuniger, NIE Bremse — der Rückgabewert ist ≥ 1,0. Das Abbremsen nahe
// der Potenzialgrenze übernimmt AUSSCHLIESSLICH das Erreichen der MAX-Attribute (die per-Attribut-Headroom-
// Drossel getAttributeGrowthMultiplier + der Ceiling-Clamp weiter unten), damit es KEINE doppelte Bremse gibt.
//  - gapAccel: bleibt bis zur neutralen Lücke (GAP_NEUTRAL) bei 1,0 → typische Spieler unverändert, Liga-Ø
//    stabil; darüber linear mit der Lücke, gedeckelt bei GAP_ACCEL_CAP.
//  - poSteep: bei GLEICHER Lücke pusht ein höheres Potenzial zusätzlich ("je höher das PO desto mehr", ab
//    PO 70), ebenfalls nur nach oben.
export const ORGANIC_GAP_ACCEL_NEUTRAL = Number(process.env.OLY_ORGANIC_GAP_ACCEL_NEUTRAL ?? 10) || 10;
export const ORGANIC_GAP_ACCEL_SLOPE = Number(process.env.OLY_ORGANIC_GAP_ACCEL_SLOPE ?? 0.03) || 0.03;
export const ORGANIC_GAP_ACCEL_CAP = Number(process.env.OLY_ORGANIC_GAP_ACCEL_CAP ?? 2.6) || 2.6;
export const ORGANIC_PO_STEEP_DIVISOR = Number(process.env.OLY_ORGANIC_PO_STEEP_DIVISOR ?? 110) || 110;

/**
 * Der Gap-Beschleuniger (`getPotentialTrainingMultiplierFromRecord`) hat bislang AUSSCHLIESSLICH
 * das Trainingsbudget skaliert. Spieler weit unter ihrem Potenzial entwickelten sich also nur über
 * das Training schneller — ihre im Wettkampf verdienten Performance-SPs liefen ohne jede
 * Beschleunigung durch. Auf der Performance-Seite gab es lediglich UNTERGRENZEN
 * (`*_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR`, max. 0,78), die nur verhindern, dass die
 * Decken-Drossel zu stark bremst — sie können nie über 1,0 hinaus beschleunigen.
 *
 * Jetzt wirkt derselbe Beschleuniger auch auf die Performance-SPs, aber bewusst GEDÄMPFT:
 * die Performance ist inzwischen der größere der beiden Kanäle (s. PERFORMANCE_WEIGHT_*),
 * ein 1:1-Durchreichen des bis zu ~3,3-fachen Trainings-Beschleunigers würde den Liga-Median
 * und damit die Marktwert-Ökonomie kippen. Deshalb nur der halbe Aufschlag, hart gedeckelt.
 * Beides über ENV nachjustierbar wie die übrigen Organic-Konstanten.
 */
export const ORGANIC_PERFORMANCE_GAP_ACCEL_SHARE =
  Number(process.env.OLY_ORGANIC_PERFORMANCE_GAP_ACCEL_SHARE ?? 0.5) || 0.5;
export const ORGANIC_PERFORMANCE_GAP_ACCEL_CAP =
  Number(process.env.OLY_ORGANIC_PERFORMANCE_GAP_ACCEL_CAP ?? 1.8) || 1.8;

/**
 * Trainings-Beschleuniger → gedämpfter Performance-Beschleuniger. Immer >= 1 (nie eine Bremse),
 * und bei Spielern ohne Potenzial-Lücke exakt 1 — für die ändert sich also gar nichts.
 */
export function getPerformanceGapAccelerator(potentialTrainingMultiplier: number): number {
  if (!isFiniteNumber(potentialTrainingMultiplier) || potentialTrainingMultiplier <= 1) {
    return 1;
  }
  return roundValue(
    Math.min(
      ORGANIC_PERFORMANCE_GAP_ACCEL_CAP,
      1 + (potentialTrainingMultiplier - 1) * ORGANIC_PERFORMANCE_GAP_ACCEL_SHARE,
    ),
    3,
  );
}

function getPotentialTrainingMultiplierFromRecord(gameState: GameState, player: Player) {
  const record = resolvePlayerPotentialRecordFromGameState({ gameState, playerId: player.id });
  const potential =
    record?.hiddenPotentialScore ??
    (isFiniteNumber(player.potential) && player.potential > 0 ? player.potential : null);
  if (potential == null) return 1;
  const currentAbility = isFiniteNumber(player.rating) ? player.rating : potential;
  const gap = Math.max(0, potential - currentAbility);
  // Reiner Beschleuniger: 1,0 bis zur neutralen Lücke, danach linear mit der Lücke, gedeckelt. Nie < 1,0.
  const gapAccel = Math.min(
    ORGANIC_GAP_ACCEL_CAP,
    1 + ORGANIC_GAP_ACCEL_SLOPE * Math.max(0, gap - ORGANIC_GAP_ACCEL_NEUTRAL),
  );
  // Höheres Potenzial pusht bei gleicher Lücke zusätzlich (ab PO 70) — auch das nur nach oben (≥ 1,0).
  const poSteep = 1 + Math.max(0, potential - 70) / ORGANIC_PO_STEEP_DIVISOR;
  return roundValue(gapAccel * poSteep, 3);
}

/**
 * Jedes Feinattribut → seine Achse (pow/spe/men/soc). Fallback-Quelle, wenn das
 * Feinattribut-Sheet (`attributeSheetStats`) fehlt oder unvollständig ist —
 * dann wird der Achswert aus `coreStats` als Attributwert genutzt, damit die
 * Trainings-Prognose nie stumm auf 0 kollabiert (siehe normalizePlayerAttributes).
 */
const ATTRIBUTE_FALLBACK_AXIS: Record<PlayerGeneratorAttributeName, "pow" | "spe" | "men" | "soc"> = {
  power: "pow",
  health: "pow",
  stamina: "pow",
  torment: "pow",
  speed: "spe",
  dexterity: "spe",
  awareness: "spe",
  intelligence: "men",
  will: "men",
  determination: "men",
  charisma: "soc",
  spirit: "soc",
};

export function normalizePlayerAttributes(player: Player): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  const attributes = Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, stats?.[attribute]]),
  ) as Partial<Record<PlayerGeneratorAttributeName, number | null>>;
  if (PROGRESSION_ATTRIBUTE_ORDER.every((attribute) => isFiniteNumber(attributes[attribute]))) {
    return attributes as PlayerGeneratorAttributes;
  }
  // Fallback: fehlt das Feinattribut-Sheet (oder ist es lückenhaft), leite die
  // fehlenden Werte aus den Achsen-Corestats ab (POW/SPE/MEN/SOC). So bekommen
  // z. B. per New-Game-Setup erstellte Kader eine echte Trainings-Prognose statt
  // überall 0 (attribute_source_missing → trainingSetpoints 0 → „-100 %"-Anzeige).
  // Vorhandene Sheet-Werte bleiben unangetastet; nur Lücken werden gefüllt.
  const core = player.coreStats;
  if (!core) return null;
  const filled = { ...attributes } as Record<PlayerGeneratorAttributeName, number>;
  for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
    if (isFiniteNumber(filled[attribute])) continue;
    const axisValue = core[ATTRIBUTE_FALLBACK_AXIS[attribute]];
    if (!isFiniteNumber(axisValue)) return null;
    filled[attribute] = axisValue;
  }
  return filled;
}

function normalizeWeights(weights: Partial<Record<PlayerGeneratorAttributeName, number>>) {
  const total = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, attribute) => sum + Math.max(0, weights[attribute] ?? 0), 0);
  if (total <= 0) return Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;
  return Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, Math.max(0, weights[attribute] ?? 0) / total]),
  ) as Record<PlayerGeneratorAttributeName, number>;
}

function distributeByClassProfile(input: {
  className: string | null | undefined;
  budget: number;
  share: number;
  adminConfig?: GameState["seasonState"]["adminBalancingConfig"];
}) {
  const profile = getClassTrainingProfile(input.className, input.adminConfig);
  const positiveWeights = normalizeWeights(profile);
  const negativeWeightTotal = PROGRESSION_ATTRIBUTE_ORDER.reduce((sum, attribute) => sum + Math.abs(Math.min(0, profile[attribute])), 0);
  const deltas = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;

  for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
    deltas[attribute] += input.budget * input.share * positiveWeights[attribute];
  }

  if (negativeWeightTotal > 0) {
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      const negativeWeight = Math.abs(Math.min(0, profile[attribute]));
      if (negativeWeight <= 0) continue;
      deltas[attribute] -= input.budget * input.share * NEGATIVE_TRAINING_SIDE_EFFECT_SHARE * (negativeWeight / negativeWeightTotal);
    }
  }

  return deltas;
}

function getSecondaryTrainingClass(player: Player, facilities: TeamFacilityCollection | null | undefined) {
  if (getFacilityLevel(facilities, "training_center") < 4) return null;
  const explicit = (player as { secondaryTrainingClass?: string | null }).secondaryTrainingClass;
  return normalizeProgressionClassName(explicit);
}

type PerformanceIndex = {
  byPlayerId: Map<string, PlayerDisciplinePerformanceRecord[]>;
};

const performanceIndexCache = new WeakMap<GameState, PerformanceIndex>();

function getPerformanceIndex(gameState: GameState): PerformanceIndex {
  const cached = performanceIndexCache.get(gameState);
  if (cached) return cached;
  const seasonId = gameState.season.id;
  const validResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => (r.seasonId ?? seasonId) === seasonId)
      .map((r) => r.id),
  );
  const byPlayerId = new Map<string, PlayerDisciplinePerformanceRecord[]>();
  for (const entry of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (!validResultIds.has(entry.matchdayResultId)) continue;
    const existing = byPlayerId.get(entry.playerId);
    if (existing) {
      existing.push(entry);
    } else {
      byPlayerId.set(entry.playerId, [entry]);
    }
  }
  const index: PerformanceIndex = { byPlayerId };
  performanceIndexCache.set(gameState, index);
  return index;
}

function getPerformanceRecords(gameState: GameState, playerId: string): PlayerDisciplinePerformanceRecord[] {
  return getPerformanceIndex(gameState).byPlayerId.get(playerId) ?? [];
}

function getDisciplineWeightDistribution(disciplineId: string) {
  if (!officialDisciplineWeightOrder.includes(disciplineId as OfficialDisciplineWeightId)) {
    return null;
  }
  const id = disciplineId as OfficialDisciplineWeightId;
  const raw = Object.fromEntries(
    PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, officialDisciplineWeightTable[attribute][id] ?? 0]),
  ) as Record<PlayerGeneratorAttributeName, number>;
  return normalizeWeights(raw);
}

function getPerformanceSetpoints(record: PlayerDisciplinePerformanceRecord) {
  const scoreSignal = clamp((record.finalPlayerScore ?? 0) / 100, 0, 1.25) * 0.28;
  const rankSignal = record.rankInDiscipline === 1 ? 0.72 : record.isTop10 ? 0.42 : record.rankInDiscipline <= 16 ? 0.18 : 0.08;
  const contributionSignal = clamp((record.scoreContribution ?? 0) / 30, 0, 1.2) * 0.22;
  return roundValue((scoreSignal + rankSignal + contributionSignal) * ORGANIC_PERFORMANCE_SETPOINT_SCALE, 3);
}

export type SeasonPerformanceSignals = {
  appearances: number;
  avgPerformanceBudget: number;
  avgFinalScore: number;
  relativePerformanceIndex: number;
  isRostered: boolean;
};

export function buildSeasonPerformanceSignals(input: {
  gameState: GameState;
  playerId: string;
  playerRating: number;
}): SeasonPerformanceSignals {
  const records = getPerformanceRecords(input.gameState, input.playerId);
  const appearances = records.length;
  const isRostered = input.gameState.rosters.some((entry) => entry.playerId === input.playerId);
  if (appearances === 0) {
    return {
      appearances: 0,
      avgPerformanceBudget: 0,
      avgFinalScore: 0,
      relativePerformanceIndex: 0.92,
      isRostered,
    };
  }

  let totalBudget = 0;
  let totalScore = 0;
  for (const record of records) {
    totalBudget += getPerformanceSetpoints(record);
    totalScore += record.finalPlayerScore ?? 0;
  }

  const avgPerformanceBudget = roundValue(totalBudget / appearances, 3);
  const avgFinalScore = roundValue(totalScore / appearances, 1);
  const relativePerformanceIndex = roundValue(avgFinalScore / Math.max(input.playerRating, 40), 2);
  return {
    appearances,
    avgPerformanceBudget,
    avgFinalScore,
    relativePerformanceIndex,
    isRostered,
  };
}

function buildPerformanceDeltas(gameState: GameState, playerId: string) {
  const deltas = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>;
  let totalBudget = 0;

  for (const record of getPerformanceRecords(gameState, playerId)) {
    const distribution = getDisciplineWeightDistribution(record.disciplineId);
    if (!distribution) continue;
    const budget = getPerformanceSetpoints(record);
    totalBudget += budget;
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      deltas[attribute] += budget * distribution[attribute];
    }
  }

  if (totalBudget <= 0) {
    return { deltas, totalBudget: 0 };
  }

  const curvedTotal = roundValue(
    totalBudget <= PERFORMANCE_SEASON_SOFT_KNEE
      ? totalBudget
      : PERFORMANCE_SEASON_SOFT_KNEE + Math.sqrt(totalBudget - PERFORMANCE_SEASON_SOFT_KNEE) * 1.25,
    2,
  );
  if (curvedTotal < totalBudget) {
    const scale = curvedTotal / totalBudget;
    for (const attribute of PROGRESSION_ATTRIBUTE_ORDER) {
      deltas[attribute] *= scale;
    }
    totalBudget = curvedTotal;
  }

  return {
    deltas,
    totalBudget: roundValue(totalBudget, 2),
  };
}


function buildOrganicRegressionBreakdown(input: {
  marktwertBase: number;
  marketValuePressurePerAttribute: number;
  /** Anteilige Spieltag-Skalierung der Regression (0..1, Default 1 = volle Saison). */
  regressionScale?: number;
}): OrganicRegressionBreakdown {
  const attributeCount = PROGRESSION_ATTRIBUTE_ORDER.length;
  const scale = normalizeRegressionScale(input.regressionScale);
  const baseFlatTotal = roundValue(-ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * attributeCount * scale, 2);
  const marketValueTotal = roundValue(-input.marketValuePressurePerAttribute * attributeCount * scale, 2);
  return {
    baseFlatTotal,
    marketValueTotal,
    marktwertBase: roundValue(input.marktwertBase, 2),
    marketValuePressureRatePct: roundValue(ORGANIC_MARKET_VALUE_PRESSURE_RATE * 100, 2),
    combinedTotal: roundValue(baseFlatTotal + marketValueTotal, 2),
  };
}

export function resolveOrganicRegressionCombinedTotal(input: {
  regressionCombinedTotal?: number | null;
  regressionBreakdown?: Pick<OrganicRegressionBreakdown, "combinedTotal" | "baseFlatTotal" | "marketValueTotal"> | null;
  marketValuePressureTotal?: number | null;
}) {
  if (input.regressionCombinedTotal != null && Number.isFinite(input.regressionCombinedTotal)) {
    return input.regressionCombinedTotal;
  }
  if (input.regressionBreakdown?.combinedTotal != null && Number.isFinite(input.regressionBreakdown.combinedTotal)) {
    return input.regressionBreakdown.combinedTotal;
  }
  if (
    input.regressionBreakdown?.baseFlatTotal != null &&
    input.regressionBreakdown?.marketValueTotal != null &&
    Number.isFinite(input.regressionBreakdown.baseFlatTotal) &&
    Number.isFinite(input.regressionBreakdown.marketValueTotal)
  ) {
    return roundValue(input.regressionBreakdown.baseFlatTotal + input.regressionBreakdown.marketValueTotal, 2);
  }
  if (input.marketValuePressureTotal != null && Number.isFinite(input.marketValuePressureTotal)) {
    const attributeCount = PROGRESSION_ATTRIBUTE_ORDER.length;
    return roundValue(
      -ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE * attributeCount - input.marketValuePressureTotal,
      2,
    );
  }
  return null;
}

export function getOrganicGrowthMultiplier(affinity: AttributeAffinityKind) {
  if (affinity === "signature") return SIGNATURE_ORGANIC_GROWTH_MULTIPLIER;
  if (affinity === "weak") return WEAK_ORGANIC_GROWTH_MULTIPLIER;
  return 1;
}

function getOrganicPerformanceGrowthMultiplier(input: {
  player: Player;
  attribute: PlayerGeneratorAttributeName;
  record?: PlayerPotentialRecord | null;
  affinityProfile: AttributeAffinityProfile;
  signals: SeasonPerformanceSignals;
  potentialGapStars: number;
  /** Gedämpfter Potenzial-Gap-Beschleuniger (>= 1), s. getPerformanceGapAccelerator. */
  gapAccelerator: number;
}) {
  const affinity = getAttributeAffinityKind(input.attribute, input.affinityProfile);
  const headroom = getAttributeHeadroom({
    player: input.player,
    attribute: input.attribute,
    record: input.record,
  });
  const base = getOrganicGrowthMultiplier(affinity) * getPerformanceHeadroomGrowthMultiplier(headroom.headroom);
  // A genuinely capped attribute never gets a bailout — the individual cap always wins.
  // Das gilt auch für den Gap-Beschleuniger: an der eigenen Decke wird nichts beschleunigt.
  if (headroom.state === "capped") return base;
  // Der Beschleuniger greift unabhängig von der Einsatzzahl: er skaliert nur tatsächlich
  // erspielte SPs, ist also — anders als die Untergrenzen unten — nicht cheese-anfällig.
  const multiplier = base * input.gapAccelerator;
  if (input.signals.appearances < 4) return multiplier;

  const avgBudget = input.signals.avgPerformanceBudget;
  const gapStars = input.potentialGapStars;

  if (gapStars >= HIGH_POTENTIAL_GAP_STARS_THRESHOLD && avgBudget >= 0.55) {
    return Math.max(multiplier, HIGH_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR);
  }
  if (gapStars >= MID_POTENTIAL_GAP_STARS_THRESHOLD && avgBudget >= 0.38) {
    return Math.max(multiplier, MID_POTENTIAL_GAP_PERFORMANCE_GROWTH_FLOOR);
  }
  return multiplier;
}

function getOrganicTrainingGrowthMultiplier(
  growthMultiplier: number,
  headroomState: AttributeHeadroomState,
  potentialGapStars: number,
  signals: SeasonPerformanceSignals,
) {
  if (
    headroomState === "capped" ||
    potentialGapStars < MID_POTENTIAL_GAP_STARS_THRESHOLD ||
    signals.appearances < 4 ||
    signals.avgPerformanceBudget < 0.38
  ) {
    return growthMultiplier;
  }
  return Math.max(growthMultiplier, HIGH_POTENTIAL_GAP_TRAINING_GROWTH_FLOOR);
}

function applyTrainingGrowthMultiplier(value: number, multiplier: number) {
  if (value === 0) return 0;
  return value * multiplier;
}

function applyPositiveGrowthMultiplier(value: number, multiplier: number) {
  if (value <= 0) return value;
  return value * multiplier;
}

export function buildOrganicSeasonProgression(input: {
  gameState: GameState;
  player: Player;
  facilities?: TeamFacilityCollection | null;
  /**
   * Anti-cheese override: base training budget derived from the per-matchday mode accumulator
   * (see `resolveSeasonTrainingAccumulatorInputs`). When provided, REPLACES the mode-at-season-end
   * `TRAINING_SETPOINTS_BY_MODE[trainingMode]` lookup. Absent → legacy behaviour.
   */
  accumulatedBaseTrainingBudget?: number;
  /**
   * Anti-cheese override: arithmetic mean of the per-matchday performance-weight multipliers.
   * When provided, REPLACES the mode-at-season-end `PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[trainingMode]`
   * lookup. Absent → legacy behaviour. (Must NOT be looked up from the "average mode": `mittel` is the
   * maximum, so averaging modes then looking up would over-reward mixed schedules — see B.2.)
   */
  performanceWeightMultiplier?: number;
  /**
   * Saisonale Entwicklungs-Route des Spielers (aus dem Forecast). Wenn gesetzt, verschiebt der
   * Signature-Shift die Wachstums-Affinität auf das saisonale Route-Attribut (×1,15/×0,8 wirken
   * dann real auf die saisonalen Sterne/Malus-Attribute). Absent → statische Basis (Alt-Verhalten).
   */
  route?: PlayerDevelopmentRoute | null;
  /**
   * NUR für Zwischenstands-PROGNOSEN (Saison-Forecast in der Trainingshistorie): anteilige
   * Spieltag-Skalierung der Regression (gespielte Spieltage / Saison-Spieltage, 0..1).
   *
   * Ursache: Der kumulierte Saison-Forecast skaliert Training (Budget = Σ Modus-Anteile über
   * gespielte Spieltage / GESAMT-Spieltage) und Performance (nur Records bis heute) bereits
   * anteilig — die Regression wurde aber immer als VOLLER Saisonbetrag abgezogen. Nach 3 von
   * 10 Spieltagen stand damit 3/10 Wachstum gegen 10/10 Regression → die Prognose sah
   * unrealistisch negativ aus. Mit dieser Skala zieht die Regression im gleichen Takt mit.
   *
   * Absent/1 = volle Saison-Regression — das ist der Pflichtwert für den Saisonende-Apply
   * (`season-end-xp-apply-service`), der diesen Parameter bewusst NICHT setzt: die real
   * gebuchte Entwicklung bleibt unverändert.
   */
  regressionMatchdayScale?: number;
}): OrganicSeasonProgressionResult {
  const attributesBefore = normalizePlayerAttributes(input.player);
  if (!attributesBefore) {
    const empty = Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as PlayerGeneratorAttributes;
    return {
      playerId: input.player.id,
      seasonId: input.gameState.season.id,
      classBefore: input.player.className,
      classAfter: "Hero",
      classChanged: false,
      primaryTrainingClass: "Hero",
      secondaryTrainingClass: null,
      trainingMode: normalizeTrainingMode(input.player.trainingMode),
      fatigueLoad: 0,
      potentialRating: isFiniteNumber(input.player.potential) && input.player.potential > 0 ? input.player.potential : null,
      potentialTrainingMultiplier: getPotentialTrainingMultiplierFromRecord(input.gameState, input.player),
      performanceGapAccelerator: getPerformanceGapAccelerator(
        getPotentialTrainingMultiplierFromRecord(input.gameState, input.player),
      ),
      traitTrainingMultiplier: 1,
      traitModifierPct: 0,
      traitBreakdown: [],
      facilityModifierPct: 0,
      baseRegressionPerAttribute: ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
      marketValuePressureTotal: 0,
      marketValuePressurePerAttribute: 0,
      marketValueMaintenanceReliefPct: 0,
      trainingSetpoints: 0,
      appliedTrainingSetpoints: 0,
      spilloverSetpoints: 0,
      performanceSetpoints: 0,
      appliedPerformanceSetpoints: 0,
      performanceRegressionTotal: 0,
      performanceRegressionPerAttribute: 0,
      regressionBreakdown: buildOrganicRegressionBreakdown({
        marktwertBase: 0,
        marketValuePressurePerAttribute: 0,
      }),
      netSetpoints: 0,
      topTrainingAttributes: [],
      negativeTrainingRisks: [],
      attributeAffinity: {
        signatureAttributes: ["power", "health"],
        weakAttribute: "torment",
        signatureGrowthMultiplier: SIGNATURE_ORGANIC_GROWTH_MULTIPLIER,
        weakGrowthMultiplier: WEAK_ORGANIC_GROWTH_MULTIPLIER,
      },
      attributeBreakdown: [],
      attributeDeltas: {},
      attributesBefore: empty,
      attributesAfter: empty,
      warnings: [`attribute_source_missing:${input.player.id}`],
    };
  }

  const trainingMode = normalizeTrainingMode(input.player.trainingMode);
  const traitSignal = buildTrainingTraitSignal({
    traitsPositive: input.player.traitsPositive,
    traitsNegative: input.player.traitsNegative,
    adminConfig: input.gameState.seasonState.adminBalancingConfig,
  });
  const playerTeam =
    input.gameState.teams.find((entry) =>
      input.gameState.rosters.some((roster) => roster.teamId === entry.teamId && roster.playerId === input.player.id),
    ) ?? null;
  const playerIdentity = playerTeam
    ? input.gameState.teamIdentities.find((entry) => entry.teamId === playerTeam.teamId) ?? null
    : null;
  const playerProfile = playerTeam ? getTeamStrategyProfile(input.gameState, playerTeam.teamId) : null;
  const playerGmArchetype = playerTeam
    ? getTeamGeneralManager(input.gameState, playerTeam.teamId)?.profile?.archetype ?? null
    : null;
  const developmentTendency = playerTeam
    ? getTeamDevelopmentTendency({ team: playerTeam, identity: playerIdentity, profile: playerProfile, gmArchetype: playerGmArchetype })
    : null;
  const facilityModifierPct = getFacilityTrainingModifierPct(input.facilities, developmentTendency?.score ?? 0);
  // Fix C: Academy beschleunigt die organische Entwicklung junger/Low-Tier-Spieler (F/E/D). Bewusst als
  // separater, gebundener Trainingsbudget-Multiplikator (analog zum training_center-facilityModifierPct),
  // NUR für berechtigte Spieler > 0. Für C+ oder ohne Academy = 0 (kein Effekt). Bleibt organisch/moderat
  // (Wachstumsrate, kein Flat-Cap): L1..L5 = [6,12,18,24,30] % × Effizienz (Katalog = einzige Zahlenquelle).
  const academyDevelopmentBoostPct = getAcademyDevelopmentBoostPct(
    resolveLowTierGrade(input.player.rating),
    input.facilities,
  );
  const primaryTrainingClass =
    normalizeProgressionClassName(input.player.trainingClass) ??
    normalizeProgressionClassName(input.player.className) ??
    calculateDynamicClassName(attributesBefore, input.gameState.seasonState.adminBalancingConfig);
  const secondaryTrainingClass = getSecondaryTrainingClass(input.player, input.facilities);
  const potentialRating = resolvePlayerPotentialRecordFromGameState({ gameState: input.gameState, playerId: input.player.id })?.hiddenPotentialScore ?? null;
  const starSnapshot = buildPlayerStarScoutingSnapshot({
    gameState: input.gameState,
    player: input.player,
    saveId: input.gameState.season.id,
    scoutingLevel: 5,
  });
  const potentialRecord = resolvePlayerPotentialRecordForProgression({
    gameState: input.gameState,
    player: input.player,
  });
  const axisStars = buildPlayerAxisStarProfile({ gameState: input.gameState, player: input.player });
  const axisPoStars = potentialRecord?.hiddenPotentialCeilingByAxis ?? null;
  // talent_builder ONLY: an additive lift on the gap accelerator for high-potential players. The GLOBAL
  // accelerator (getPotentialTrainingMultiplierFromRecord) stays untouched so the league median / MW economy
  // does not tip — only this GM's own high-potential talents develop faster.
  const talentBuilderPotentialFactor =
    playerGmArchetype === "talent_builder" && potentialRating != null
      ? potentialRating >= 80
        ? 1.18
        : potentialRating >= 72
          ? 1.12
          : potentialRating >= 58
            ? 1.06
            : 1
      : 1;
  const globalPotentialAccelerator = getPotentialTrainingMultiplierFromRecord(input.gameState, input.player);
  const potentialTrainingMultiplier = globalPotentialAccelerator * talentBuilderPotentialFactor;
  // Bewusst NUR der globale Beschleuniger: der talent_builder-Aufschlag bleibt ein reiner
  // Trainings-Perk dieses GM-Archetyps und soll sich nicht still in einen zweiten Kanal ausweiten.
  const performanceGapAccelerator = getPerformanceGapAccelerator(globalPotentialAccelerator);
  const baseTrainingBudget =
    input.accumulatedBaseTrainingBudget != null && Number.isFinite(input.accumulatedBaseTrainingBudget)
      ? input.accumulatedBaseTrainingBudget
      : TRAINING_SETPOINTS_BY_MODE[trainingMode];
  const performanceWeightMultiplier =
    input.performanceWeightMultiplier != null && Number.isFinite(input.performanceWeightMultiplier)
      ? input.performanceWeightMultiplier
      : PERFORMANCE_WEIGHT_MULTIPLIER_BY_MODE[trainingMode];
  const routeBonusMultiplier = getDevelopmentRouteBonusMultiplier(
    classNameToDevelopmentRoute(primaryTrainingClass),
    resolveTeamTrainingFocusAxis(input.gameState, input.player.id),
  );
  const trainingSetpoints = roundValue(
    baseTrainingBudget *
      traitSignal.trainingTraitMultiplier *
      potentialTrainingMultiplier *
      routeBonusMultiplier *
      (1 + facilityModifierPct / 100) *
      (1 + academyDevelopmentBoostPct / 100),
    2,
  );
  const primaryShare = secondaryTrainingClass ? 0.7 : 1;
  const secondaryShare = secondaryTrainingClass ? 0.3 : 0;
  const primaryTrainingDeltas = distributeByClassProfile({
    className: primaryTrainingClass,
    budget: trainingSetpoints,
    share: primaryShare,
    adminConfig: input.gameState.seasonState.adminBalancingConfig,
  });
  const secondaryTrainingDeltas = secondaryTrainingClass
    ? distributeByClassProfile({
        className: secondaryTrainingClass,
        budget: trainingSetpoints,
        share: secondaryShare,
        adminConfig: input.gameState.seasonState.adminBalancingConfig,
      })
    : (Object.fromEntries(PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => [attribute, 0])) as Record<PlayerGeneratorAttributeName, number>);
  const performance = buildPerformanceDeltas(input.gameState, input.player.id);
  const performanceSignals = buildSeasonPerformanceSignals({
    gameState: input.gameState,
    playerId: input.player.id,
    playerRating: input.player.rating,
  });
  const marktwertBase = getMarktwertForRegression(input.player);
  // B2: soft-knee the market value driving regression so extreme-value stars aren't penalized without bound.
  const marketValuePressurePerAttribute = roundValue(
    softKneeMarketValueForRegression(marktwertBase) * ORGANIC_MARKET_VALUE_PRESSURE_RATE,
    3,
  );
  const marketValuePressureTotal = roundValue(
    marketValuePressurePerAttribute * PROGRESSION_ATTRIBUTE_ORDER.length,
    2,
  );
  // Prognose-Skalierung der Regression (s. Doku am Input-Parameter). Default 1 = Apply-Verhalten.
  const regressionScale = normalizeRegressionScale(input.regressionMatchdayScale);
  const regressionBreakdown = buildOrganicRegressionBreakdown({
    marktwertBase,
    marketValuePressurePerAttribute,
    regressionScale,
  });
  const affinityProfile = resolveSeasonalAffinityProfile({
    player: input.player,
    route: input.route ?? null,
    seasonId: input.gameState.season.id,
  });
  const attributesAfter = { ...attributesBefore };
  // Nebenspeicher für den Spillover-Nachlauf: Decke-Zustand, harte Ceiling-Obergrenze und die
  // Klassen-Zuteilung je Attribut (letztere entscheidet, was "Fokus" vs. "Nebenstat" ist).
  const ceilingStateByAttribute = {} as Record<PlayerGeneratorAttributeName, AttributeHeadroomState>;
  const ceilingCapByAttribute = {} as Record<PlayerGeneratorAttributeName, number>;
  const rawAttributeBreakdown = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
    const affinity = getAttributeAffinityKind(attribute, affinityProfile);
    const organicAffinityMult = getOrganicGrowthMultiplier(affinity);
    const attributeHeadroom = getAttributeHeadroom({ player: input.player, attribute, record: potentialRecord });
    const trainingGrowthMultiplier = getCombinedAttributeTrainingMultiplier({
      player: input.player,
      attribute,
      record: potentialRecord,
      axisCaStars: axisStars,
      axisPoStars: axisPoStars ?? undefined,
      affinityGrowthMultiplier: organicAffinityMult,
    });
    const trainingMultiplier = getOrganicTrainingGrowthMultiplier(
      trainingGrowthMultiplier,
      attributeHeadroom.state,
      starSnapshot.potentialGap,
      performanceSignals,
    );
    const performanceGrowthMultiplier = getOrganicPerformanceGrowthMultiplier({
      player: input.player,
      attribute,
      record: potentialRecord,
      affinityProfile,
      signals: performanceSignals,
      potentialGapStars: starSnapshot.potentialGap,
      gapAccelerator: performanceGapAccelerator,
    });
    // B1: headroom-aware regression — a capped/closing attribute plateaus instead of eroding at full
    // speed (mirror of the growth throttle, but gentle). Open attributes keep full regression.
    const regressionHeadroomMultiplier = ORGANIC_REGRESSION_HEADROOM_MULTIPLIER[attributeHeadroom.state] ?? 1;
    // regressionScale: bei Zwischenstands-Prognosen anteilig zu den gespielten Spieltagen (s. o.);
    // im Saisonende-Apply immer 1 → identische Rechnung wie bisher.
    const regression =
      -(ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE + marketValuePressurePerAttribute) *
      regressionHeadroomMultiplier *
      regressionScale;
    const training = applyTrainingGrowthMultiplier(primaryTrainingDeltas[attribute] + secondaryTrainingDeltas[attribute], trainingMultiplier);
    const performanceDelta =
      applyPositiveGrowthMultiplier(performance.deltas[attribute], performanceGrowthMultiplier) *
      performanceWeightMultiplier;
    const delta = roundValue(regression + training + performanceDelta, 2);
    const before = attributesBefore[attribute];
    // Harte Ceiling-Bindung: Attributwachstum darf das (reconciled) Attribut-Ceiling
    // nie ueberschreiten. Damit bindet der Potenzial-Cap (v4) tatsaechlich als
    // Obergrenze und ein Performer wird nicht ueber sein Limit gedrueckt (was sonst
    // per Round-Over das Ceiling selbst anheben und den Cap aushebeln wuerde).
    // Ohne bekanntes Ceiling bleibt es bei der bisherigen 99er-Grenze; Sub-Cap-
    // Wachstum bleibt unveraendert.
    const attributeCeilingCap = isFiniteNumber(attributeHeadroom.ceiling)
      ? Math.min(99, attributeHeadroom.ceiling)
      : 99;
    ceilingStateByAttribute[attribute] = attributeHeadroom.state;
    ceilingCapByAttribute[attribute] = Math.max(1, attributeCeilingCap);
    const after = roundValue(clamp(before + delta, 1, Math.max(1, attributeCeilingCap)), 1);
    return {
      attribute,
      before,
      after,
      delta: roundValue(after - before, 2),
      regression: roundValue(regression, 2),
      training: roundValue(training, 2),
      performance: roundValue(performanceDelta, 2),
      spillover: 0,
      affinity,
      trainingGrowthMultiplier,
      performanceGrowthMultiplier,
    };
  });
  // Spillover-Nachlauf: Der Teil des Budgets, den die Fokus-Attribute nicht aufnehmen konnten
  // (Budget − auf Fokus angewendet), wird zu TRAINING_SPILLOVER_SHARE gleichmäßig auf die
  // NICHT-fokussierten, noch nicht gecappten Attribute verteilt (deterministischer ±Jitter).
  // Getrennt als `spillover` geführt und in Delta/After eingerechnet.
  const focusAppliedTraining = rawAttributeBreakdown.reduce((sum, entry) => sum + entry.training, 0);
  // Der gebundene Rest kann das Budget nie übersteigen (bei Klassen mit negativen Nebenwirkungen
  // auf die Fokus-Stats würde `budget − focusApplied` sonst über das Budget hinauslaufen).
  const boundRest = Math.min(trainingSetpoints, Math.max(0, trainingSetpoints - focusAppliedTraining));
  const spilloverPool = roundValue(boundRest * TRAINING_SPILLOVER_SHARE, 2);
  if (spilloverPool > 0) {
    const recipients = rawAttributeBreakdown.filter(
      (entry) =>
        (primaryTrainingDeltas[entry.attribute] + secondaryTrainingDeltas[entry.attribute]) <= 0.0001 &&
        ceilingStateByAttribute[entry.attribute] !== "capped",
    );
    if (recipients.length > 0) {
      const baseShare = spilloverPool / recipients.length;
      const jittered = recipients.map(
        (entry) =>
          baseShare *
          (1 + (deterministicUnitNoise(`${input.player.id}:${input.gameState.season.id}:${entry.attribute}`) * 2 - 1) * TRAINING_SPILLOVER_JITTER),
      );
      const jitterSum = jittered.reduce((sum, value) => sum + value, 0) || 1;
      const scale = spilloverPool / jitterSum; // renormieren, damit die Summe exakt dem Pool entspricht
      recipients.forEach((entry, index) => {
        const add = roundValue(jittered[index] * scale, 2);
        if (add <= 0) return;
        entry.spillover = add;
        const rawDelta = entry.regression + entry.training + entry.spillover + entry.performance;
        const after = roundValue(clamp(entry.before + rawDelta, 1, ceilingCapByAttribute[entry.attribute]), 1);
        entry.after = after;
        entry.delta = roundValue(after - entry.before, 2);
      });
    }
  }
  const attributeBreakdown = rawAttributeBreakdown;
  const regressionCombinedFromAttributes = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.regression, 0),
    2,
  );
  const regressionBreakdownAligned = {
    ...regressionBreakdown,
    combinedTotal: regressionCombinedFromAttributes,
  };
  const appliedTrainingSetpoints = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0),
    2,
  );
  const spilloverSetpoints = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.spillover, 0),
    2,
  );
  const appliedPerformanceSetpoints = roundValue(
    attributeBreakdown.reduce((sum, entry) => sum + entry.performance, 0),
    2,
  );
  for (const entry of attributeBreakdown) {
    attributesAfter[entry.attribute] = entry.after;
  }
  const attributeDeltas = Object.fromEntries(attributeBreakdown.map((entry) => [entry.attribute, entry.delta])) as Partial<Record<PlayerGeneratorAttributeName, number>>;
  const classAfter = calculateDynamicClassName(attributesAfter, input.gameState.seasonState.adminBalancingConfig);
  const classSignals = getClassTrainingSignals(primaryTrainingClass, input.gameState.seasonState.adminBalancingConfig);
  return {
    playerId: input.player.id,
    seasonId: input.gameState.season.id,
    classBefore: input.player.className,
    classAfter,
    classChanged: classAfter !== input.player.className,
    primaryTrainingClass,
    secondaryTrainingClass,
    trainingMode,
    fatigueLoad: roundValue(
      FATIGUE_LOAD_BY_MODE[trainingMode] * (1 - getRecoveryTrainingFatigueReductionPct(input.facilities) / 100),
      1,
    ),
    potentialRating,
    potentialTrainingMultiplier,
    performanceGapAccelerator,
    traitTrainingMultiplier: traitSignal.trainingTraitMultiplier,
    traitModifierPct: roundValue((traitSignal.trainingTraitMultiplier - 1) * 100, 1),
    traitBreakdown: traitSignal.breakdown.map((entry) => ({
      trait: entry.trait,
      legacyTraitTrainingFactorPct: entry.legacyTraitTrainingFactorPct,
      known: entry.known,
      tone:
        (entry.legacyTraitTrainingFactorPct ?? 0) >= 8
          ? ("positive" as const)
          : (entry.legacyTraitTrainingFactorPct ?? 0) <= -8
            ? ("negative" as const)
            : ("neutral" as const),
    })),
    facilityModifierPct,
    baseRegressionPerAttribute: ORGANIC_BASE_REGRESSION_PER_ATTRIBUTE,
    marketValuePressureTotal,
    marketValuePressurePerAttribute,
    marketValueMaintenanceReliefPct: 0,
    trainingSetpoints,
    appliedTrainingSetpoints,
    spilloverSetpoints,
    performanceSetpoints: performance.totalBudget,
    appliedPerformanceSetpoints,
    performanceRegressionTotal: 0,
    performanceRegressionPerAttribute: 0,
    regressionBreakdown: regressionBreakdownAligned,
    netSetpoints: roundValue(attributeBreakdown.reduce((sum, entry) => sum + entry.delta, 0), 2),
    topTrainingAttributes: classSignals.primaryAttributes,
    negativeTrainingRisks: classSignals.negativeRisks,
    attributeAffinity: {
      signatureAttributes: affinityProfile.signatureAttributes,
      weakAttribute: affinityProfile.weakAttribute,
      signatureGrowthMultiplier: SIGNATURE_ORGANIC_GROWTH_MULTIPLIER,
      weakGrowthMultiplier: WEAK_ORGANIC_GROWTH_MULTIPLIER,
    },
    attributeBreakdown,
    attributeDeltas,
    attributesBefore,
    attributesAfter,
    warnings: traitSignal.warnings,
  };
}
