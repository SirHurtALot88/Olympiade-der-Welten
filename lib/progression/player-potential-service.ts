import type {
  GameState,
  Player,
  PlayerPotentialBand,
  PlayerPotentialRecord,
  PlayerPotentialSource,
} from "@/lib/data/olyDataTypes";

// Cache buildPlayerScoutPotentialFromGameState results per (gameState, playerId) to avoid
// repeated O(n) scans through playerPotential for the same player in the same state.
const scoutPotentialCache = new WeakMap<GameState, Map<string, PlayerScoutPotential>>();
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildHiddenAttributeCeilingsFromPotentialScore } from "@/lib/scouting/player-attribute-ceiling-service";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";
import {
  attachPotentialCeilingToRecord,
  applyAxisCeilingSeasonDrift,
  buildPlayerPotentialCeilingProfile,
  buildPotentialRecordWithCeilings,
} from "@/lib/scouting/player-potential-ceiling-service";

export type PlayerPotentialCertainty = "missing_source" | "low" | "medium" | "high";

export type PlayerScoutPotential = {
  scoutRating: number | null;
  potentialRange: { min: number; max: number } | null;
  starRating: string;
  band: PlayerPotentialBand;
  certainty: PlayerPotentialCertainty;
  confidence: number;
  source: PlayerPotentialSource;
  scoutingLevel: number;
  trainingSpeedMultiplier: number;
  marketValuePotentialPremiumPct: number;
  salaryExpectationPremiumPct: number;
  ceilingMode: "soft_range_no_hard_ceiling";
  reasons: string[];
  warnings: string[];
};

export type PlayerGrowthOutlook = "breakout" | "growth" | "stable" | "stagnation" | "regression_risk";
export type PlayerDevelopmentRouteSuggestion = "POW" | "SPE" | "MEN" | "SOC" | "BALANCED" | "RECOVERY";

export type PlayerDevelopmentInsight = {
  currentRating: number | null;
  performanceRating: number | null;
  potentialRangeRaw: { min: number; max: number } | null;
  potentialRangeDisplay: { min: number; max: number } | null;
  potentialLabel: string;
  scoutConfidence: number;
  confidenceLabel: PlayerPotentialCertainty;
  developmentGap: number | null;
  trainingForm: "S+" | "S" | "A" | "B" | "C" | "D" | "E" | "F";
  developmentRoute: PlayerDevelopmentRouteSuggestion;
  growthOutlook: PlayerGrowthOutlook;
  growthSpeed: number;
  netDevelopmentXP: number | null;
  developmentFactors: {
    potentialGapFactor: number;
    trainingFormFactor: number;
    routeFitFactor: number;
    regressionPressure: number;
    growthSpeed: number;
  };
  risk: "low" | "medium" | "high";
  reasons: string[];
  reasonChips: string[];
  recommendation: string;
  warnings: string[];
};

export type PotentialAiTeamContext =
  | "rebuild"
  | "win_now"
  | "cash_value"
  | "high_harmony"
  | "training_boost"
  | "poor_recovery"
  | "balanced";

export type PotentialAiUsagePreview = {
  playerId: string;
  context: PotentialAiTeamContext;
  currentPriority: number;
  potentialPriority: number;
  valuePriority: number;
  riskPenalty: number;
  finalScore: number;
  recommendation: "buy_develop" | "buy_current" | "value_watch" | "hold" | "avoid";
  reasons: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number, digits = 0) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeTraitToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasTokenMatch(tokens: string[], values: string[]) {
  const normalizedValues = values.map(normalizeTraitToken).filter(Boolean);
  return tokens.some((token) => {
    const normalizedToken = normalizeTraitToken(token);
    return normalizedValues.some((value) => value === normalizedToken || value.includes(normalizedToken));
  });
}

function normalizeScoutingLevel(level: number | null | undefined) {
  if (!isFiniteNumber(level)) return 0;
  return clamp(Math.round(level), 0, 5);
}

function getScoutingUncertainty(level: number | null | undefined) {
  const normalizedLevel = normalizeScoutingLevel(level);
  if (normalizedLevel <= 0) return 16;
  if (normalizedLevel >= 5) return 3;
  if (normalizedLevel >= 4) return 4;
  if (normalizedLevel >= 3) return 6;
  if (normalizedLevel >= 2) return 8;
  return 10;
}

function getCertainty(level: number | null | undefined): PlayerPotentialCertainty {
  const confidence = getScoutingConfidencePct(level);
  if (confidence <= 0) return "missing_source";
  if (confidence >= 75) return "high";
  if (confidence >= 45) return "medium";
  return "low";
}

function getScoutingConfidencePct(level: number | null | undefined) {
  const normalizedLevel = normalizeScoutingLevel(level);
  if (normalizedLevel <= 0) return 20;
  if (normalizedLevel >= 5) return 90;
  if (normalizedLevel >= 4) return 82;
  if (normalizedLevel >= 3) return 70;
  if (normalizedLevel >= 2) return 55;
  return 35;
}

export function getPotentialBand(potential: number): PlayerPotentialBand {
  if (potential >= 88) return "elite";
  if (potential >= 78) return "high";
  if (potential >= 62) return "medium";
  return "low";
}

/**
 * PERCENTILE-anchored CA/PO star curve (recalibrated to the MEASURED league,
 * with a REAL 0.5★ floor so weak players read as weak).
 *
 * The real catalog (data/generated/oly-player-stats.json, n=2984) has CA/PO
 * scores that cluster ~30–78 with
 *   p5≈29  p25≈39  p50≈46  p75≈54  p90≈62  p95≈68  p99≈78
 * An earlier recalibration tracked those percentiles but floored the low end at
 * 1.5★, so a genuinely weak player (CA ~22, market value ~6 mio) still rendered
 * ~2★ and could not be told apart from a mid player. The anchors below keep the
 * same percentile-shaped intent at the top (strong players ~70 → 4.5★, ≥78 → 5★)
 * but WIDEN the spread at the bottom with a true 0.5★ floor and a steeper low end:
 *   ~22 (clearly sub-p5) → 0.5★ · ~30 (p5–p10) → 1.0★ · ~47 (median) → 2.5★ ·
 *   ~58 → 3.5★ · ~70 → 4.5★ · ≥78 → 5.0★.
 * Scores below the first anchor floor at 0.5★. Monotonic, piecewise-linear,
 * continuous. PO uses the same curve on its higher scores → saturates cleanly at
 * the 5★ ceiling. Signature/return type unchanged.
 */
const CA_PO_STAR_ANCHORS: ReadonlyArray<readonly [score: number, stars: number]> = [
  [22, 0.5],
  [30, 1.0],
  [47, 2.5],
  [58, 3.5],
  [70, 4.5],
  [78, 5.0],
];

export function potentialScoreToStars(score: number) {
  const value = clamp(score, 0, 99);
  const first = CA_PO_STAR_ANCHORS[0]!;
  const last = CA_PO_STAR_ANCHORS[CA_PO_STAR_ANCHORS.length - 1]!;
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let index = 1; index < CA_PO_STAR_ANCHORS.length; index += 1) {
    const [hiScore, hiStars] = CA_PO_STAR_ANCHORS[index]!;
    if (value <= hiScore) {
      const [loScore, loStars] = CA_PO_STAR_ANCHORS[index - 1]!;
      const t = (value - loScore) / (hiScore - loScore);
      return roundValue(loStars + t * (hiStars - loStars), 2);
    }
  }
  return last[1];
}

/**
 * Version des Potenzial-Generator-Modells. Wird auf jeden generierten
 * `PlayerPotentialRecord` gestempelt (`modelVersion`). Beim Laden migriert
 * `ensurePlayerPotentialForGameState` Saves mit älterer Version einmalig auf das
 * aktuelle Modell (Star-Uniform-Verteilung) — ohne dass ein neues Spiel nötig ist.
 *
 * v6: PO wird pro CA-Sternband gleichmäßig über [CA, 5] gezogen (statt festem
 *     Punkte-Gap). Junge/schwache Spieler bekommen echte, breit gestreute
 *     Ausbau-Reserve; Veteranen nahe der Decke bleiben gedeckelt.
 */
export const POTENTIAL_MODEL_VERSION = 6;

/**
 * Inverse zu {@link potentialScoreToStars}: gibt zu einem Ziel-Stern (0.5–5) den
 * niedrigsten Score, der diesen Stern ergibt (stückweise linear über
 * CA_PO_STAR_ANCHORS). Wird vom Star-Uniform-Potenzial-Generator genutzt, um einen
 * gleichverteilt gezogenen Ziel-PO-Stern zurück in Score-Raum zu übersetzen.
 */
function starsToPotentialScore(stars: number): number {
  const first = CA_PO_STAR_ANCHORS[0]!;
  const last = CA_PO_STAR_ANCHORS[CA_PO_STAR_ANCHORS.length - 1]!;
  if (stars <= first[1]) return first[0];
  if (stars >= last[1]) return last[0];
  for (let index = 1; index < CA_PO_STAR_ANCHORS.length; index += 1) {
    const [hiScore, hiStars] = CA_PO_STAR_ANCHORS[index]!;
    if (stars <= hiStars) {
      const [loScore, loStars] = CA_PO_STAR_ANCHORS[index - 1]!;
      const t = (stars - loStars) / (hiStars - loStars);
      return loScore + t * (hiScore - loScore);
    }
  }
  return last[0];
}

export type PotentialRangeStarSlot = {
  index: number;
  minFill: number;
  maxFill: number;
  showUncertain: boolean;
};

/**
 * Star-space range → per-star fill slots (uncertain overlay math).
 * Shared primitive: works directly on star values (0..5). `buildPotentialRangeStarSlots`
 * composes this with `potentialScoreToStars` for score-space callers. Do NOT reinvent this
 * fill math elsewhere — the shared `NlAbilityStars` component consumes it.
 */
export function buildAbilityStarRangeSlots(minStars: number, maxStars: number): PotentialRangeStarSlot[] {
  return [0, 1, 2, 3, 4].map((index) => {
    const minFill = Math.max(0, Math.min(1, minStars - index));
    const maxFill = Math.max(0, Math.min(1, maxStars - index));
    return {
      index,
      minFill,
      maxFill,
      showUncertain: maxFill > minFill,
    };
  });
}

export function buildPotentialRangeStarSlots(minScore: number, maxScore: number): PotentialRangeStarSlot[] {
  return buildAbilityStarRangeSlots(potentialScoreToStars(minScore), potentialScoreToStars(maxScore));
}

export function shouldShowPotentialRangeStars(minScore: number, maxScore: number) {
  return potentialScoreToStars(maxScore) > potentialScoreToStars(minScore);
}

function getStarRating(potential: number) {
  return `${potentialScoreToStars(potential).toFixed(1)} Sterne`;
}

function getTrainingSpeedMultiplier(potential: number) {
  if (potential >= 94) return 1.18;
  if (potential >= 88) return 1.14;
  if (potential >= 80) return 1.09;
  if (potential >= 72) return 1.04;
  if (potential >= 58) return 1;
  return 0.94;
}

function getMarketValuePotentialPremiumPct(potential: number) {
  if (potential >= 94) return 22;
  if (potential >= 88) return 16;
  if (potential >= 80) return 10;
  if (potential >= 72) return 5;
  if (potential >= 58) return 0;
  return -4;
}

function applyConfidenceCap(input: { premiumPct: number; confidence: number }) {
  if (input.premiumPct <= 0) return input.premiumPct;
  if (input.confidence < 45) return roundValue(input.premiumPct * 0.35, 1);
  if (input.confidence < 70) return roundValue(input.premiumPct * 0.65, 1);
  return input.premiumPct;
}

function getPlayerSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/** Returns the highest single core stat value. */
function getMaxAxisValue(player: Player): number {
  const coreValues = Object.values(player.coreStats ?? {}).filter(isFiniteNumber);
  if (coreValues.length > 0) return Math.max(...coreValues);
  const disciplineValues = Object.values(player.disciplineRatings ?? {}).filter(
    (value): value is number => isFiniteNumber(value),
  );
  if (disciplineValues.length > 0) return Math.max(...disciplineValues);
  return 35;
}

/** Specialist-weighted ability estimate for headroom checks. */
function getSpecialistAbilityEstimate(player: Player): number {
  const coreValues = Object.values(player.coreStats ?? {}).filter(isFiniteNumber);
  if (coreValues.length === 0) return getMaxAxisValue(player);
  const sorted = [...coreValues].sort((left, right) => right - left);
  while (sorted.length < 4) sorted.push(sorted[sorted.length - 1] ?? 35);
  return (
    (sorted[0] ?? 35) * 0.45 +
    (sorted[1] ?? 35) * 0.30 +
    (sorted[2] ?? 35) * 0.15 +
    (sorted[3] ?? 35) * 0.10
  );
}

/**
 * Talent traits: raw ceiling, nothing to do with work ethic.
 * Positive = natural gift; Negative = hard ceiling that limits growth.
 */
function getTalentTraitPotentialModifier(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let modifier = 0;
  for (const trait of ["prodigy", "gifted", "natural", "talented", "late bloomer", "wonder kid"]) {
    if (positives.has(trait)) modifier += 5;
  }
  for (const trait of ["limited ceiling", "plateaued", "slow developer", "ceiling limited", "stagnant"]) {
    if (negatives.has(trait)) modifier -= 4;
  }
  return clamp(modifier, -8, 10);
}

/**
 * Inverse-CDF (quantile) anchors for the hidden CA→PO *headroom* generator,
 * expressed as [cumulativeProbability, gapScorePoints]: the amount of upside a
 * player has ABOVE their current ability, in raw score points (~11–12 points ≈
 * one star on the `CA_PO_STAR_ANCHORS` curve above).
 *
 * Why a GAP curve, not an absolute-PO curve: the previous generator drew an
 * absolute score independent of CA and then floored it at CA (`max(rawRoll, CA)`).
 * Because the raw draw was right-skewed with a median (~46) well ABOVE the median
 * CA, it landed above CA for most low-CA players and pinned their PO at that
 * ~46/2.5★ floor — so a genuine 1★ was AUTOMATICALLY lifted to ~2.5★ potential,
 * the observed CA→PO gap was suspiciously stable, and headroom was negatively
 * coupled to CA. Drawing the gap directly, decoupled from CA, fixes all three:
 * a 1★ with a small draw stays ~1.5★, headroom varies freely, and it no longer
 * tracks CA.
 *
 * Shape: deliberately TIGHT and right-skewed — most players carry only a little
 * headroom (median ~0.5★), the spread is real (so the gap is no longer "stable"),
 * and the elite tail stays THIN so the top is NOT broadened (a 3★→5★ wonder kid
 * is a rare outlier, not a common outcome). Across many seeds a low-/mid-CA player
 * gets, typically: median ~0.5★ · p82 ~1.1★ · p96 ~2★ · p99 ~2.7★ of headroom.
 * Monotonic, piecewise-linear, seed-deterministic (no Math.random).
 */
/**
 * Star-Uniform-Potenzial (Modell v6).
 *
 * Statt eines festen Punkte-„Gaps" auf CA (der Starke an die 5★-Decke presst und
 * über die ganze Liga einen inkonsistenten, meist winzigen Abstand erzeugt) wird
 * ein ZIEL-PO-STERN gezogen — GLEICHVERTEILT über [CA-Stern, 5] — und zurück in
 * Score-Raum übersetzt. Wirkung, gemessen an der echten Liga (n=2984):
 *   - Pro CA-Sternband ist das Potenzial ~gleichmäßig über die erreichbaren Sterne
 *     gestreut: 1★ → PO 1–5, 2★ → 2–5, 3★ → 3–5, 4★ → 4–5, 5★ → 5.
 *   - Junge/schwache Spieler bekommen echte, breit gestreute Ausbau-Reserve (die
 *     man entwickeln kann); Veteranen nahe der Decke bleiben gedeckelt.
 *   - Kein 5★-Stau: der Ziel-Stern kommt aus dem CA-Band, nicht aus einem
 *     absoluten Bonus.
 * Der Ziehwert ist der Spieler-ID-Hash (seed-deterministisch, kein Math.random).
 * Der per-Season-Trainings-Cap bleibt davon unberührt — nur die Decke steigt.
 */
function deriveHiddenPotentialScore(input: {
  saveId: string;
  player: Player;
  currentAbilityStars?: number | null;
}) {
  const seed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:potential-v6`);
  const currentAbilityScore = computeCurrentAbilityScore(input.player.coreStats) ?? 35;
  // CA-Stern als untere Bandgrenze: bevorzugt der angezeigte Achsen-Overall-Stern,
  // Fallback der Score-basierte CA-Stern (wenn beim Read-Time-Aufruf ohne GameState
  // kein Achsenprofil vorliegt).
  const caStars = clamp(input.currentAbilityStars ?? potentialScoreToStars(currentAbilityScore), 0.5, 5);
  const targetStars = caStars + seed * (5 - caStars);
  const rawScore = starsToPotentialScore(targetStars);
  const traitBonus = getTalentTraitPotentialModifier(input.player);
  // PO-Score nie unter CA-Score (Score-Raum-Invariante); Talent-Trait als kleiner
  // Bonus/Malus; auf die Generator-Band [35,99] geklemmt.
  return clamp(Math.max(rawScore + traitBonus, currentAbilityScore), 35, 99);
}

export function buildPlayerPotentialRecord(input: {
  saveId: string;
  player: Player;
  existing?: PlayerPotentialRecord | null;
  currentAbilityStars?: number | null;
}): PlayerPotentialRecord {
  if (input.existing?.hiddenPotentialScore != null) {
    return input.existing;
  }
  const hiddenPotentialScore = deriveHiddenPotentialScore(input);
  return {
    playerId: input.player.id,
    potentialBand: getPotentialBand(hiddenPotentialScore),
    hiddenPotentialScore,
    revealedPotentialRange: undefined,
    confidence: 0,
    source: "generated",
    modelVersion: POTENTIAL_MODEL_VERSION,
  };
}

export function buildPlayerPotentialRecordsForSave(input: {
  saveId: string;
  players: Player[];
  gameState?: GameState | null;
}) {
  return input.players.map((player) => {
    // CA-Achsen-Overall-Stern zuerst berechnen, damit der Star-Uniform-Generator
    // das Potenzial über [CA-Stern, 5] ziehen kann.
    const currentStars = input.gameState
      ? buildPlayerAxisStarProfile({
          gameState: input.gameState,
          player,
          disciplines: input.gameState.disciplines,
        })
      : null;
    const record = buildPlayerPotentialRecord({
      saveId: input.saveId,
      player,
      currentAbilityStars: currentStars?.overall ?? null,
    });
    if (!input.gameState || !currentStars) {
      return record;
    }
    const ceiling = buildPlayerPotentialCeilingProfile({
      saveId: input.saveId,
      player,
      currentStars,
      hiddenPotentialScore: record.hiddenPotentialScore,
    });
    return attachPotentialCeilingToRecord({
      record,
      ceiling,
      player,
      saveId: input.saveId,
    });
  });
}

/** True, wenn ALLE Potenzial-Records mit dem aktuellen Modell erzeugt wurden. */
export function isPlayerPotentialModelCurrent(
  records: PlayerPotentialRecord[] | undefined | null,
): boolean {
  if (!records || records.length === 0) return true;
  return records.every((record) => (record.modelVersion ?? 0) >= POTENTIAL_MODEL_VERSION);
}

/**
 * Migriert bestehende Potenzial-Records eines Saves auf das aktuelle Generator-Modell.
 * hiddenPotentialScore + Ceilings werden neu berechnet (deterministisch aus dem Seed),
 * der Scouting-/Reveal-Fortschritt (confidence, revealedPotentialRange, lastSeasonSnapshot)
 * bleibt erhalten. Idempotent: erneuter Aufruf liefert dasselbe Ergebnis.
 */
export function migratePlayerPotentialRecordsToCurrentModel(input: {
  saveId: string;
  gameState: GameState;
}): PlayerPotentialRecord[] {
  const previousById = new Map(
    (input.gameState.playerPotential ?? []).map((record) => [record.playerId, record] as const),
  );
  const fresh = buildPlayerPotentialRecordsForSave({
    saveId: input.saveId,
    players: input.gameState.players,
    gameState: input.gameState,
  });
  return fresh.map((record) => {
    const previous = previousById.get(record.playerId);
    if (!previous) return record;
    return {
      ...record,
      confidence: previous.confidence,
      ...(previous.revealedPotentialRange ? { revealedPotentialRange: previous.revealedPotentialRange } : {}),
      ...(previous.lastSeasonSnapshot ? { lastSeasonSnapshot: previous.lastSeasonSnapshot } : {}),
    };
  });
}

function resolvePlayerPotentialRecord(input: {
  gameState?: GameState | null;
  player: Player;
  saveId?: string | null;
}) {
  const existing = input.gameState?.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null;
  return buildPlayerPotentialRecord({
    saveId: input.saveId ?? input.gameState?.season.id ?? "local-save",
    player: input.player,
    existing,
  });
}

function buildScoutPotentialFromScore(input: {
  potentialScore: number | null;
  scoutingLevel?: number | null;
  source: PlayerPotentialSource;
  sourceWarning?: string | null;
}): PlayerScoutPotential {
  const scoutingLevel = normalizeScoutingLevel(input.scoutingLevel);
  if (!isFiniteNumber(input.potentialScore) || input.potentialScore <= 0) {
    return {
      scoutRating: null,
      potentialRange: null,
      starRating: "-",
      band: "unknown",
      certainty: "missing_source",
      confidence: 0,
      source: "missing",
      scoutingLevel,
      trainingSpeedMultiplier: 1,
      marketValuePotentialPremiumPct: 0,
      salaryExpectationPremiumPct: 0,
      ceilingMode: "soft_range_no_hard_ceiling",
      reasons: ["potential_source_missing"],
      warnings: ["potential_source_missing"],
    };
  }

  const hiddenPotential = roundValue(clamp(input.potentialScore, 1, 99), 0);
  const uncertainty = getScoutingUncertainty(scoutingLevel);
  const potentialRange = {
    min: roundValue(clamp(hiddenPotential - uncertainty, 35, 99), 0),
    max: roundValue(clamp(hiddenPotential + uncertainty, 35, 99), 0),
  };
  const scoutRating = roundValue((potentialRange.min + potentialRange.max) / 2, 0);
  const band = getPotentialBand(scoutRating);
  const trainingSpeedMultiplier = getTrainingSpeedMultiplier(hiddenPotential);
  const confidence = getScoutingConfidencePct(scoutingLevel);
  const uncappedMarketValuePotentialPremiumPct = getMarketValuePotentialPremiumPct(hiddenPotential);
  const marketValuePotentialPremiumPct = applyConfidenceCap({
    premiumPct: uncappedMarketValuePotentialPremiumPct,
    confidence,
  });
  const reasons = ["soft_potential_range_no_hard_ceiling"];
  if (input.source === "generated") reasons.push("save_seed_generated_potential");
  if (input.source === "imported") reasons.push("imported_potential_source");
  if (band === "elite") reasons.push("high_potential_training_acceleration");
  if (band === "high") reasons.push("above_average_potential");
  if (band === "low") reasons.push("limited_scouted_upside");
  if (trainingSpeedMultiplier !== 1) reasons.push("potential_training_speed_modifier");
  if (marketValuePotentialPremiumPct > 0) reasons.push("market_value_potential_premium_preview");
  if (marketValuePotentialPremiumPct !== uncappedMarketValuePotentialPremiumPct) reasons.push("low_confidence_caps_premium");
  if (uncertainty >= 10) reasons.push("wide_scouting_range");

  return {
    scoutRating,
    potentialRange,
    starRating: getStarRating(scoutRating),
    band,
    certainty: getCertainty(scoutingLevel),
    confidence,
    source: input.source,
    scoutingLevel,
    trainingSpeedMultiplier,
    marketValuePotentialPremiumPct,
    salaryExpectationPremiumPct: roundValue(marketValuePotentialPremiumPct * 0.5, 1),
    ceilingMode: "soft_range_no_hard_ceiling",
    reasons,
    warnings: [uncertainty >= 10 ? "potential_range_uncertain" : null, input.sourceWarning].filter(
      (entry): entry is string => Boolean(entry),
    ),
  };
}

export function revealPlayerPotentialRecord(input: {
  record: PlayerPotentialRecord;
  scoutingLevel?: number | null;
}): PlayerPotentialRecord {
  const scoutPotential = buildScoutPotentialFromScore({
    potentialScore: input.record.hiddenPotentialScore ?? null,
    scoutingLevel: input.scoutingLevel,
    source: input.record.source,
    sourceWarning: input.record.source === "missing" ? "potential_source_missing" : null,
  });
  return {
    ...input.record,
    potentialBand: scoutPotential.band,
    revealedPotentialRange: scoutPotential.potentialRange ?? undefined,
    confidence: scoutPotential.confidence,
    source: normalizeScoutingLevel(input.scoutingLevel) > 0 && scoutPotential.source !== "missing"
      ? "scouted"
      : input.record.source,
  };
}

export function buildPlayerScoutPotential(input: {
  player: Pick<Player, "potential">;
  scoutingLevel?: number | null;
}): PlayerScoutPotential {
  if (!isFiniteNumber(input.player.potential) || input.player.potential <= 0) {
    return {
      scoutRating: null,
      potentialRange: null,
      starRating: "-",
      band: "unknown",
      certainty: "missing_source",
      confidence: 0,
      source: "missing",
      scoutingLevel: normalizeScoutingLevel(input.scoutingLevel),
      trainingSpeedMultiplier: 1,
      marketValuePotentialPremiumPct: 0,
      salaryExpectationPremiumPct: 0,
      ceilingMode: "soft_range_no_hard_ceiling",
      reasons: ["potential_source_missing"],
      warnings: ["potential_source_missing"],
    };
  }

  return buildScoutPotentialFromScore({
    potentialScore: input.player.potential,
    scoutingLevel: input.scoutingLevel,
    source: "imported",
  });
}

export function buildPlayerScoutPotentialFromGameState(input: {
  gameState?: GameState | null;
  player: Player;
  saveId?: string | null;
  scoutingLevel?: number | null;
}): PlayerScoutPotential {
  // Cache when there's no custom scoutingLevel override (the common season-end path).
  const gs = input.gameState;
  if (gs && input.scoutingLevel == null) {
    let perState = scoutPotentialCache.get(gs);
    if (!perState) {
      perState = new Map();
      scoutPotentialCache.set(gs, perState);
    }
    const hit = perState.get(input.player.id);
    if (hit) return hit;
    const record = resolvePlayerPotentialRecord(input);
    const result = buildScoutPotentialFromScore({
      potentialScore: record.hiddenPotentialScore ?? null,
      scoutingLevel: input.scoutingLevel,
      source: record.source,
      sourceWarning: record.source === "missing" ? "potential_source_missing" : null,
    });
    perState.set(input.player.id, result);
    return result;
  }
  const record = resolvePlayerPotentialRecord(input);
  return buildScoutPotentialFromScore({
    potentialScore: record.hiddenPotentialScore ?? null,
    scoutingLevel: input.scoutingLevel,
    source: record.source,
    sourceWarning: record.source === "missing" ? "potential_source_missing" : null,
  });
}

function getTrainingFormFromTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">): PlayerDevelopmentInsight["trainingForm"] {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let score = 55;
  for (const trait of ["diligent", "disciplined", "motivated", "ambitious"]) {
    if (positives.has(trait)) score += 9;
  }
  for (const trait of ["lazy", "diva", "fainthearted", "paranoid"]) {
    if (negatives.has(trait)) score -= 11;
  }
  if (score >= 92) return "S+";
  if (score >= 82) return "S";
  if (score >= 72) return "A";
  if (score >= 60) return "B";
  if (score >= 48) return "C";
  if (score >= 36) return "D";
  if (score >= 24) return "E";
  return "F";
}

function getBestAxis(player: Player): PlayerDevelopmentRouteSuggestion {
  const axes = [
    ["POW", player.coreStats?.pow ?? 0],
    ["SPE", player.coreStats?.spe ?? 0],
    ["MEN", player.coreStats?.men ?? 0],
    ["SOC", player.coreStats?.soc ?? 0],
  ] as const;
  const sorted = [...axes].sort((left, right) => right[1] - left[1]);
  if (Math.abs((sorted[0]?.[1] ?? 0) - (sorted[1]?.[1] ?? 0)) <= 4) return "BALANCED";
  return sorted[0]?.[0] ?? "BALANCED";
}

function getCurrentRating(input: { player: Player; currentRating?: number | null }) {
  if (isFiniteNumber(input.currentRating)) return roundValue(input.currentRating, 1);
  if (isFiniteNumber(input.player.ovr)) return roundValue(input.player.ovr, 1);
  if (isFiniteNumber(input.player.rating)) return roundValue(input.player.rating, 1);
  const coreValues = Object.values(input.player.coreStats ?? {}).filter(isFiniteNumber);
  return coreValues.length ? roundValue(coreValues.reduce((sum, value) => sum + value, 0) / coreValues.length, 1) : null;
}

function getPerformanceRating(input: { performanceRating?: number | null; player: Player }) {
  if (isFiniteNumber(input.performanceRating)) return roundValue(input.performanceRating, 1);
  if (isFiniteNumber(input.player.pps)) return roundValue(input.player.pps, 1);
  return null;
}

export function buildPlayerDevelopmentInsight(input: {
  gameState?: GameState | null;
  player: Player;
  currentRating?: number | null;
  performanceRating?: number | null;
  scoutingLevel?: number | null;
  scoutPotential?: PlayerScoutPotential | null;
}) {
  const scoutPotential =
    input.scoutPotential ??
    buildPlayerScoutPotentialFromGameState({
      gameState: input.gameState,
      player: input.player,
      scoutingLevel: input.scoutingLevel,
    });
  const currentRating = getCurrentRating({ player: input.player, currentRating: input.currentRating });
  const performanceRating = getPerformanceRating({ player: input.player, performanceRating: input.performanceRating });
  const rawRange = scoutPotential.potentialRange;
  const displayRange =
    rawRange && currentRating != null
      ? {
          min: roundValue(Math.max(rawRange.min, Math.floor(currentRating)), 0),
          max: roundValue(Math.max(rawRange.max, Math.ceil(currentRating)), 0),
        }
      : rawRange;
  const midpoint = displayRange ? (displayRange.min + displayRange.max) / 2 : null;
  const gap = midpoint != null && currentRating != null ? roundValue(midpoint - currentRating, 1) : null;
  const trainingForm = getTrainingFormFromTraits(input.player);
  const lowConfidence = scoutPotential.confidence < 45;
  const highRiskTraits = (input.player.traitsNegative ?? []).some((trait) =>
    ["Lazy", "Diva", "FaintHearted", "Paranoid", "Gambler", "Mercenary"].includes(trait),
  );
  const positiveGrowthTraits = (input.player.traitsPositive ?? []).some((trait) =>
    ["Diligent", "Disciplined", "Motivated", "Ambitious"].includes(trait),
  );
  const growthOutlook: PlayerGrowthOutlook =
    gap == null
      ? "stable"
      : gap >= 18 && positiveGrowthTraits
        ? "breakout"
        : gap >= 10
          ? "growth"
          : gap >= 3
            ? "stable"
            : highRiskTraits || gap < 0
              ? "regression_risk"
              : "stagnation";
  const risk: PlayerDevelopmentInsight["risk"] =
    growthOutlook === "regression_risk" || (highRiskTraits && lowConfidence)
      ? "high"
      : lowConfidence || highRiskTraits
        ? "medium"
        : "low";
  const route: PlayerDevelopmentRouteSuggestion =
    risk === "high" && (input.player.fatigue ?? 0) >= 70 ? "RECOVERY" : getBestAxis(input.player);
  const potentialGapFactor =
    gap == null ? 1 : gap >= 20 ? 1.18 : gap >= 10 ? 1.1 : gap >= 3 ? 1.02 : gap >= 0 ? 0.92 : 0.72;
  const trainingFormFactor =
    trainingForm === "S+" ? 1.24 :
      trainingForm === "S" ? 1.16 :
        trainingForm === "A" ? 1.09 :
          trainingForm === "B" ? 1.02 :
            trainingForm === "C" ? 0.96 :
              trainingForm === "D" ? 0.88 :
                trainingForm === "E" ? 0.78 :
                  0.64;
  const routeFitFactor =
    (route === "RECOVERY" ? 0.9 : highRiskTraits ? 0.92 : 1) *
    (route !== "BALANCED" && route !== "RECOVERY" ? 1.08 : 1);
  const regressionPressure = roundValue(
    (gap != null && gap < 0 ? Math.abs(gap) * 8 : 0) +
      (highRiskTraits ? 24 : 0) +
      (lowConfidence ? 8 : 0) +
      ((input.player.fatigue ?? 0) >= 70 ? 18 : 0),
    0,
  );
  const earnedXP = roundValue(70 * scoutPotential.trainingSpeedMultiplier * trainingFormFactor * potentialGapFactor * routeFitFactor, 0);
  const maintenanceXP = roundValue((currentRating ?? 50) * 0.65 + (gap != null && gap <= 4 ? 28 : 10), 0);
  const netDevelopmentXP = roundValue(earnedXP - maintenanceXP - regressionPressure, 0);
  const reasons = [
    currentRating != null ? `Current ${currentRating}` : "current_rating_missing",
    displayRange ? `Potential Range ${displayRange.min}-${displayRange.max}` : "potential_range_missing",
    gap != null ? `Development Gap ${gap}` : "development_gap_missing",
    `Scout Confidence ${scoutPotential.confidence}%`,
    positiveGrowthTraits ? "positive_growth_traits" : null,
    highRiskTraits ? "negative_growth_risk_traits" : null,
    lowConfidence ? "low_confidence_wide_range" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const potentialLabel =
    gap == null
      ? "Scout unsicher"
      : gap <= 1
        ? highRiskTraits
          ? "Regression Risk"
          : "Kaum Upside"
        : gap >= 14
          ? "Hohe Upside"
          : "Solide Upside";
  const recommendation =
    growthOutlook === "breakout"
      ? "Prospect aktiv entwickeln und Einsaetze geben"
      : growthOutlook === "growth"
        ? "Gezielt trainieren und als Core/Value halten"
        : growthOutlook === "regression_risk"
          ? "Schonung, klare Rolle oder Marktwert testen"
          : lowConfidence
            ? "Mehr scouten, bevor Premium bezahlt wird"
            : "Stabil halten und Performance beobachten";
  return {
    currentRating,
    performanceRating,
    potentialRangeRaw: rawRange,
    potentialRangeDisplay: displayRange,
    potentialLabel,
    scoutConfidence: scoutPotential.confidence,
    confidenceLabel: scoutPotential.certainty,
    developmentGap: gap,
    trainingForm,
    developmentRoute: route,
    growthOutlook,
      growthSpeed: scoutPotential.trainingSpeedMultiplier,
    netDevelopmentXP,
    developmentFactors: {
      potentialGapFactor: roundValue(potentialGapFactor, 2),
      trainingFormFactor: roundValue(trainingFormFactor, 2),
      routeFitFactor: roundValue(routeFitFactor, 2),
      regressionPressure,
      growthSpeed: scoutPotential.trainingSpeedMultiplier,
    },
    risk,
    reasons,
    reasonChips: [
      growthOutlook,
      trainingForm,
      route,
      lowConfidence ? "Scout unsicher" : "Scout stabil",
      highRiskTraits ? "Trait-Risiko" : "Trait-Fit",
      gap != null && gap > 8 ? "Upside" : gap != null && gap <= 1 ? "Kaum Upside" : "Stabil",
    ],
    recommendation,
    warnings: [
      ...scoutPotential.warnings,
      rawRange && currentRating != null && rawRange.max < currentRating ? "potential_range_below_current_clamped" : null,
      lowConfidence ? "scout_confidence_low" : null,
      highRiskTraits ? "trait_growth_risk" : null,
    ].filter((entry): entry is string => Boolean(entry)),
  } satisfies PlayerDevelopmentInsight;
}

export function buildPotentialAiUsagePreview(input: {
  player: Player;
  context: PotentialAiTeamContext;
  currentRating?: number | null;
  marketValue?: number | null;
  salary?: number | null;
  scoutPotential?: PlayerScoutPotential | null;
}) {
  const insight = buildPlayerDevelopmentInsight({
    player: input.player,
    currentRating: input.currentRating,
    scoutPotential: input.scoutPotential ?? buildPlayerScoutPotential({ player: input.player, scoutingLevel: 2 }),
  });
  const current = insight.currentRating ?? input.player.rating ?? 50;
  const gap = insight.developmentGap ?? 0;
  const confidenceFactor = insight.scoutConfidence >= 75 ? 1 : insight.scoutConfidence >= 45 ? 0.72 : 0.42;
  const valueBase =
    input.marketValue != null && input.marketValue > 0
      ? clamp((current + Math.max(gap, 0) * 0.5) / Math.max(input.marketValue, 1) * 20, 0, 100)
      : 50;
  const toxicRisk = hasTokenMatch(["toxic", "diva", "lazy", "fainthearted"], input.player.traitsNegative ?? []);
  const currentPriority =
    input.context === "win_now"
      ? current * 1.15
      : input.context === "rebuild"
        ? current * 0.72
        : current;
  const potentialPriority =
    input.context === "rebuild"
      ? Math.max(gap, 0) * 4.2 * confidenceFactor
      : input.context === "cash_value"
        ? Math.max(gap, 0) * 2.4 * confidenceFactor
        : input.context === "training_boost"
          ? Math.max(gap, 0) * 3.2 * confidenceFactor
          : input.context === "win_now"
            ? Math.max(gap, 0) * 0.9 * confidenceFactor
            : Math.max(gap, 0) * 1.8 * confidenceFactor;
  const valuePriority = input.context === "cash_value" ? valueBase * 1.35 : valueBase;
  const riskPenalty =
    (insight.risk === "high" ? 28 : insight.risk === "medium" ? 12 : 0) +
    (input.context === "high_harmony" && toxicRisk ? 34 : 0) +
    (input.context === "poor_recovery" && insight.growthOutlook === "regression_risk" ? 18 : 0);
  const finalScore = roundValue(clamp(currentPriority * 0.45 + potentialPriority + valuePriority * 0.35 - riskPenalty, 0, 100), 1);
  const recommendation: PotentialAiUsagePreview["recommendation"] =
    riskPenalty >= 34
      ? "avoid"
      : input.context === "win_now" && current >= 70
        ? "buy_current"
        : input.context === "rebuild" && gap >= 10 && insight.scoutConfidence >= 45
          ? "buy_develop"
          : input.context === "cash_value" && finalScore >= 55
            ? "value_watch"
            : finalScore >= 50
              ? "hold"
              : "avoid";

  return {
    playerId: input.player.id,
    context: input.context,
    currentPriority: roundValue(currentPriority, 1),
    potentialPriority: roundValue(potentialPriority, 1),
    valuePriority: roundValue(valuePriority, 1),
    riskPenalty: roundValue(riskPenalty, 1),
    finalScore,
    recommendation,
    reasons: [
      `current=${roundValue(current, 1)}`,
      `gap=${gap}`,
      `confidence=${insight.scoutConfidence}`,
      `outlook=${insight.growthOutlook}`,
      toxicRisk ? "toxic_trait_risk" : null,
      input.context,
    ].filter((entry): entry is string => Boolean(entry)),
  } satisfies PotentialAiUsagePreview;
}

/**
 * Season-end potential update — snapshot, gentle bidirectional drift, rebuild ceilings.
 */
export function applySeasonEndPotentialUpdate(input: {
  saveId: string;
  seasonId: string;
  player: Player;
  record: PlayerPotentialRecord;
  growthOutlook?: PlayerGrowthOutlook | null;
  gameState?: GameState | null;
}): PlayerPotentialRecord {
  const currentScore = input.record.hiddenPotentialScore;
  if (!isFiniteNumber(currentScore)) return input.record;

  const outlook = input.growthOutlook ?? "stable";
  const seed = getPlayerSeedValue(`${input.saveId}:${input.player.id}:${input.seasonId}:pot-update-v2`);
  let scoreDelta = roundValue((seed - 0.5) * 4, 0);
  if (outlook === "breakout") scoreDelta += 1;
  else if (outlook === "growth" && scoreDelta < 0) scoreDelta = 0;
  else if (outlook === "stagnation" && scoreDelta > 0) scoreDelta = 0;
  else if (outlook === "regression_risk") scoreDelta -= 1;
  if (scoreDelta === 0) scoreDelta = seed >= 0.5 ? 1 : -1;

  const newScore = clamp(currentScore + scoreDelta, 35, 99);
  const baseRecord: PlayerPotentialRecord = {
    ...input.record,
    hiddenPotentialScore: newScore,
    potentialBand: getPotentialBand(newScore),
  };

  if (!input.gameState) {
    return baseRecord;
  }

  const currentStars = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player: input.player,
    disciplines: input.gameState.disciplines,
  });

  const currentCeiling =
    input.record.hiddenPotentialCeilingByAxis && input.record.hiddenPotentialOverallStars != null
      ? {
          pow: input.record.hiddenPotentialCeilingByAxis.pow,
          spe: input.record.hiddenPotentialCeilingByAxis.spe,
          men: input.record.hiddenPotentialCeilingByAxis.men,
          soc: input.record.hiddenPotentialCeilingByAxis.soc,
          overall: input.record.hiddenPotentialOverallStars,
        }
      : buildPlayerPotentialCeilingProfile({
          saveId: input.saveId,
          player: input.player,
          currentStars,
          hiddenPotentialScore: currentScore,
        });

  const snapshot = {
    seasonId: input.seasonId,
    hiddenPotentialScore: currentScore,
    overallStars: currentCeiling.overall,
    byAxis: {
      pow: currentCeiling.pow,
      spe: currentCeiling.spe,
      men: currentCeiling.men,
      soc: currentCeiling.soc,
    },
  };

  const currentAttributeCeiling =
    input.record.hiddenAttributeCeiling ??
    buildHiddenAttributeCeilingsFromPotentialScore({
      saveId: input.saveId,
      player: input.player,
      currentStars,
      hiddenPotentialScore: currentScore,
    });

  const drifted = applyAxisCeilingSeasonDrift({
    ceiling: currentCeiling,
    attributeCeilings: currentAttributeCeiling,
    currentStars,
    saveId: input.saveId,
    playerId: input.player.id,
    seasonId: input.seasonId,
    growthOutlook: outlook,
  });

  return buildPotentialRecordWithCeilings({
    saveId: input.saveId,
    player: input.player,
    record: {
      ...baseRecord,
      lastSeasonSnapshot: snapshot,
    },
    currentStars,
    attributeCeilingOverride: drifted.attributeCeilings,
  });
}

/**
 * Batch version — applies season-end potential updates to all players in a GameState.
 * Returns the updated playerPotential array (does not mutate the state).
 */
export function applySeasonEndPotentialUpdates(input: {
  saveId: string;
  seasonId: string;
  gameState: GameState;
}): PlayerPotentialRecord[] {
  const existingRecords = new Map(
    (input.gameState.playerPotential ?? []).map((record) => [record.playerId, record] as const),
  );
  return input.gameState.players.map((player) => {
    const record = existingRecords.get(player.id) ?? buildPlayerPotentialRecord({
      saveId: input.saveId,
      player,
    });
    const insight = buildPlayerDevelopmentInsight({
      gameState: input.gameState,
      player,
    });
    return applySeasonEndPotentialUpdate({
      saveId: input.saveId,
      seasonId: input.seasonId,
      player,
      record,
      growthOutlook: insight.growthOutlook,
      gameState: input.gameState,
    });
  });
}
