import type { Player, PlayerGeneratorAttributeName, PlayerPotentialRecord } from "@/lib/data/olyDataTypes";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
import type { PlayerAxisKey, PlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";
import {
  applyAttributeCeilingSeasonDrift,
  buildHiddenAttributeCeilings,
  buildHiddenAttributeCeilingsFromPotentialScore,
  deriveAxisPoStarsFromAttributeCeilings,
  derivePlayerPotentialCeilingProfileFromAttributeCeilings,
  getPlayerAttributeValue,
} from "@/lib/scouting/player-attribute-ceiling-service";
// Same non-saturating CA/PO percentile curve used for current-ability stars. Imported
// for the PO ceiling recalibration below. (Runtime-only use inside functions — the
// module cycle with player-potential-service is safe because the binding is a live
// export resolved at call time, never at module-init time.)
import { potentialScoreToStars } from "@/lib/progression/player-potential-service";
import type { GameState } from "@/lib/data/olyDataTypes";

export type PlayerPotentialCeilingProfile = {
  pow: number;
  spe: number;
  men: number;
  soc: number;
  overall: number;
};

export type RevealedPotentialStars = {
  overallMin: number | null;
  overallMax: number | null;
  byAxis: Partial<Record<PlayerAxisKey, { min: number; max: number }>> | null;
  band: "low" | "medium" | "high" | "elite" | null;
  displayLabel: string;
};

const AXIS_KEYS: PlayerAxisKey[] = ["pow", "spe", "men", "soc"];
const MIN_AXIS_PO_UPSIDE_STARS = 0.5;

const CLASS_AXIS_AFFINITY: Record<PlayerAxisKey, string[]> = {
  pow: ["charger", "warrior", "tank", "berserker", "power"],
  spe: ["runner", "scout", "speed", "rogue", "ranger"],
  men: ["teacher", "scholar", "tactician", "monk", "sage"],
  soc: ["bard", "charmer", "diplomat", "leader", "captain"],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundHalfStar(value: number) {
  return clamp(Math.round(value * 2) / 2, 0.5, 5);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getPlayerSeedValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function getTalentTraitCeilingModifier(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  const positives = new Set((player.traitsPositive ?? []).map((entry) => entry.toLowerCase()));
  const negatives = new Set((player.traitsNegative ?? []).map((entry) => entry.toLowerCase()));
  let modifier = 0;
  for (const trait of ["prodigy", "gifted", "natural", "talented", "late bloomer", "wonder kid"]) {
    if (positives.has(trait)) modifier += 0.75;
  }
  for (const trait of ["limited ceiling", "plateaued", "slow developer", "ceiling limited", "stagnant"]) {
    if (negatives.has(trait)) modifier -= 0.5;
  }
  return clamp(modifier, -1, 1.5);
}

function getClassAxisAffinity(className: string | null | undefined, axis: PlayerAxisKey) {
  const normalized = (className ?? "").toLowerCase();
  const keywords = CLASS_AXIS_AFFINITY[axis];
  if (keywords.some((keyword) => normalized.includes(keyword))) {
    return 1.35;
  }
  return 1;
}

function getAxisRawValue(player: Player, axis: PlayerAxisKey) {
  const value = player.coreStats?.[axis];
  return isFiniteNumber(value) ? value : null;
}

function mapHiddenScoreToUpsideBudget(score: number) {
  const normalized = clamp(score, 35, 99);
  return 0.5 + ((normalized - 35) / 64) * 3.5;
}

function computeOverallFromAxisStars(values: Record<PlayerAxisKey, number>) {
  const sorted = AXIS_KEYS.map((axis) => values[axis]).sort((left, right) => right - left) as [
    number,
    number,
    number,
    number,
  ];
  return roundHalfStar(
    sorted[0] * 0.45 +
      sorted[1] * 0.30 +
      sorted[2] * 0.15 +
      sorted[3] * 0.10 +
      sorted[3] * 0.10,
  );
}

// Single-axis specialist protection: a player whose strongest CURRENT axis sits at
// least this many stars above his second axis is treated as a specialist, and that one
// axis keeps an above-ceiling upside so weak-overall / high-single-axis prospects still
// read as high-potential on that axis (matches the "kohan-like" prospect case).
const SPECIALIST_AXIS_GAP_STARS = 1;
const SPECIALIST_AXIS_UPSIDE_STARS = 1;

/**
 * Score → PO ceiling star on the shared CA/PO percentile curve, with the top segment
 * stretched for the potential-score distribution.
 *
 * The hidden potential score is generated ~uniformly on 35..99 (mean ~66), i.e. much
 * higher and denser at the top than the CA-score distribution the CA curve was fitted to
 * (CA clusters ~30..68, 5★ ≈ score 78, above p95). Feeding potential scores straight into
 * `potentialScoreToStars` therefore saturates: ~a third of players exceed the 78→5★ anchor
 * and read as 5★. So we keep the CA curve VERBATIM for weak/mid potential (score ≤ 70 →
 * identical stars, so ~p10 lands ~2★, the median ~4★) and stretch only the top rung
 * `[70,99] → [4.5,5.0]` — continuous at 70 (the curve's 4.5★ anchor) — so 5★ stays reserved
 * for genuine top potential (~p95+, score ≈ 96) instead of a third of the league.
 */
function potentialCeilingOverallStars(hiddenPotentialScore: number): number {
  const score = clamp(hiddenPotentialScore, 0, 99);
  if (score <= 70) return potentialScoreToStars(score);
  const t = (score - 70) / (99 - 70);
  return Number((4.5 + t * 0.5).toFixed(2));
}

/**
 * Recalibrates a raw attribute-derived ceiling profile onto the SAME non-saturating
 * percentile curve the CA stars use (`potentialScoreToStars`).
 *
 * Why: the per-attribute upside budget in `buildHiddenAttributeCeilingsFromPotentialScore`
 * pushes nearly every axis ceiling to ~90–99 → every axis maps to 5★ → `ceiling.overall`
 * saturates at 5★ for ~97% of players, so every roster card showed "5★ potential". The
 * hidden potential score (35..99) shares CA's absolute 0..99 scale, so mapping it through
 * the CA/PO curve gives a PO overall that SPREADS like CA: weak potential ~1.5–2.5★,
 * typical ~3–4.5★, only genuine top potential reaches 5★.
 *
 * Mechanics: every axis is hard-capped at the score-justified ceiling `poCeilStar`
 * (a weak axis already below it is left untouched — we never inflate it up to the cap),
 * then floored at the player's current axis star so PO can never drop below CA. Genuine
 * single-axis specialists keep one axis above the cap.
 *
 * The OVERALL is the crux: CA axis stars are generous (many players carry two or three
 * 4.5–5★ axes even at a mid CA overall), and because PO axes must stay ≥ CA axes, the
 * peak-weighted axis overall rounds back up to 5★ for a low-potential player who merely
 * has strong current axes. So for BALANCED players the overall is additionally capped at
 * the score-justified `poCeilStar` (floored at CA overall — a finished product with
 * CA > potential-score legitimately shows PO ≈ CA and no headroom). SPECIALISTS keep the
 * uncapped, peak-weighted overall so a weak-overall / one-elite-axis prospect still shows
 * real overall upside. `finalizePotentialCeilingProfile` preserves this overall (it no
 * longer forces it back up to the axis-peak overall), so the profile is idempotent.
 */
function recalibratePotentialCeilingToPotentialScore(
  currentStars: PlayerAxisStarProfile,
  ceiling: PlayerPotentialCeilingProfile,
  hiddenPotentialScore: number,
): PlayerPotentialCeilingProfile {
  const poCeilStar = potentialCeilingOverallStars(hiddenPotentialScore);
  const currentByAxisDesc = [...AXIS_KEYS].sort((left, right) => currentStars[right] - currentStars[left]);
  const strongestCurrentAxis = currentByAxisDesc[0]!;
  const isSpecialist =
    currentStars[strongestCurrentAxis] - currentStars[currentByAxisDesc[1]!] >= SPECIALIST_AXIS_GAP_STARS;

  const recalibratedAxis = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    const cappedToScore = Math.min(ceiling[axis], poCeilStar);
    const floor =
      isSpecialist && axis === strongestCurrentAxis
        ? currentStars[axis] + SPECIALIST_AXIS_UPSIDE_STARS
        : currentStars[axis];
    recalibratedAxis[axis] = roundHalfStar(clamp(Math.max(cappedToScore, floor), currentStars[axis], 5));
  }

  const axisOverall = computeOverallFromAxisStars(recalibratedAxis);
  // Balanced players: cap the overall at the score-justified ceiling (never below CA).
  // Specialists: keep the full peak-weighted overall so single-axis upside shows.
  const overallCap = isSpecialist ? 5 : Math.max(roundHalfStar(poCeilStar), currentStars.overall);
  const overall = roundHalfStar(clamp(Math.min(axisOverall, overallCap), currentStars.overall, 5));

  return {
    ...recalibratedAxis,
    overall,
  };
}

export function resolveEffectiveAxisPoStars(
  currentStars: PlayerAxisStarProfile,
  poStars: Partial<Record<PlayerAxisKey, number>> | null | undefined,
): Record<PlayerAxisKey, number> {
  const resolved = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    const stored = poStars?.[axis] ?? currentStars[axis];
    resolved[axis] = roundHalfStar(
      Math.min(5, Math.max(stored, currentStars[axis], currentStars[axis] + MIN_AXIS_PO_UPSIDE_STARS)),
    );
  }
  return resolved;
}

export function clampPotentialOverallToCurrent(currentOverall: number, potentialOverall: number) {
  return roundHalfStar(Math.max(potentialOverall, currentOverall));
}

export function clampPotentialCeilingToCurrentStars(
  currentStars: PlayerAxisStarProfile,
  ceiling: PlayerPotentialCeilingProfile,
): PlayerPotentialCeilingProfile {
  const clampedAxis = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    clampedAxis[axis] = roundHalfStar(Math.max(ceiling[axis], currentStars[axis]));
  }
  return {
    ...clampedAxis,
    // Preserve the profile's own `overall` (only floored at CA overall). A DERIVED profile
    // already carries `overall === computeOverallFromAxisStars(clampedAxis)`, so this is a
    // no-op for it; a RECALIBRATED profile intentionally carries an overall BELOW the
    // axis-peak value (see recalibratePotentialCeilingToPotentialScore) and must keep it,
    // otherwise generous CA axes would force every capped PO overall back up to 5★.
    overall: clampPotentialOverallToCurrent(
      currentStars.overall,
      Math.max(ceiling.overall, currentStars.overall),
    ),
  };
}

function deriveAxisCeiling(input: {
  axis: PlayerAxisKey;
  currentStars: number;
  hiddenPotentialScore: number;
  axisSeed: number;
  isStrongestRawAxis: boolean;
  classAffinity: number;
  traitModifier: number;
}) {
  const budget = mapHiddenScoreToUpsideBudget(input.hiddenPotentialScore);
  const skew = 0.25 + input.axisSeed * 1.65;
  let upside = budget * skew;

  if (input.isStrongestRawAxis) {
    upside += 0.75 + input.axisSeed * 1.25;
  } else if (input.axisSeed > 0.72) {
    upside += input.axisSeed * 0.75;
  }

  upside *= input.classAffinity;
  upside += input.traitModifier * (0.35 + input.axisSeed * 0.4);

  return roundHalfStar(clamp(input.currentStars + upside, input.currentStars, 5));
}

export function getPlayerDevelopmentBand(player: Player): "youth" | "peak" | "veteran" {
  const rating = isFiniteNumber(player.rating) ? player.rating : isFiniteNumber(player.ovr) ? player.ovr : 60;
  const coreValues = Object.values(player.coreStats ?? {}).filter(isFiniteNumber);
  const bestAxis = coreValues.length > 0 ? Math.max(...coreValues) : rating;
  if (bestAxis <= 42 || rating <= 45) return "youth";
  if (rating >= 78 || bestAxis >= 82) return "veteran";
  return "peak";
}

export function buildPlayerPotentialCeilingProfile(input: {
  saveId: string;
  player: Player;
  currentStars: PlayerAxisStarProfile;
  hiddenPotentialScore?: number | null;
  existing?: PlayerPotentialRecord | null;
}): PlayerPotentialCeilingProfile {
  const effectiveScore = input.hiddenPotentialScore ?? input.existing?.hiddenPotentialScore ?? null;
  const attributeCeilings = buildHiddenAttributeCeilingsFromPotentialScore({
    saveId: input.saveId,
    player: input.player,
    currentStars: input.currentStars,
    hiddenPotentialScore: effectiveScore,
  });
  const derived = derivePlayerPotentialCeilingProfileFromAttributeCeilings({
    attributeCeilings,
    currentStars: input.currentStars,
  });
  const recalibrated = isFiniteNumber(effectiveScore)
    ? recalibratePotentialCeilingToPotentialScore(input.currentStars, derived, effectiveScore)
    : derived;
  return finalizePotentialCeilingProfile(input.currentStars, recalibrated);
}

function finalizePotentialCeilingProfile(
  currentStars: PlayerAxisStarProfile,
  ceiling: PlayerPotentialCeilingProfile,
): PlayerPotentialCeilingProfile {
  return clampPotentialCeilingToCurrentStars(currentStars, ceiling);
}

export function buildPotentialGap(input: {
  currentStars: PlayerAxisStarProfile;
  ceiling: PlayerPotentialCeilingProfile;
}) {
  const ceiling = finalizePotentialCeilingProfile(input.currentStars, input.ceiling);
  return roundHalfStar(clamp(ceiling.overall - input.currentStars.overall, 0, 5));
}

export function revealPotentialStars(input: {
  ceiling: PlayerPotentialCeilingProfile;
  currentStars: PlayerAxisStarProfile;
  scoutingLevel: number;
}): RevealedPotentialStars {
  const ceiling = finalizePotentialCeilingProfile(input.currentStars, input.ceiling);
  const level = clamp(Math.round(input.scoutingLevel), 0, 5);
  const gap = buildPotentialGap({ currentStars: input.currentStars, ceiling });

  if (level <= 2) {
    const band =
      gap >= 2 ? "elite" : gap >= 1.5 ? "high" : gap >= 0.75 ? "medium" : "low";
    return {
      overallMin: null,
      overallMax: null,
      byAxis: null,
      band,
      displayLabel:
        band === "elite"
          ? "Potenzial: elite"
          : band === "high"
            ? "Potenzial: hoch"
            : band === "medium"
              ? "Potenzial: mittel"
              : "Potenzial: niedrig",
    };
  }

  const blur = level >= 5 ? 0.25 : level >= 4 ? 0.5 : 1;
  const overallMin = roundHalfStar(Math.max(input.currentStars.overall, ceiling.overall - blur));
  const overallMax = roundHalfStar(Math.max(overallMin, Math.min(5, ceiling.overall + blur)));

  if (level <= 3) {
    return {
      overallMin,
      overallMax,
      byAxis: null,
      band: null,
      displayLabel: `Pot ${overallMin}–${overallMax}★`,
    };
  }

  const byAxis: RevealedPotentialStars["byAxis"] = {};
  for (const axis of AXIS_KEYS) {
    byAxis[axis] = {
      min: roundHalfStar(Math.max(input.currentStars[axis], ceiling[axis] - blur)),
      max: roundHalfStar(
        Math.max(input.currentStars[axis], Math.min(5, ceiling[axis] + (level >= 5 ? 0 : blur))),
      ),
    };
  }

  const axisLabels = AXIS_KEYS.map((axis) => {
    const range = byAxis[axis];
    if (!range) return null;
    const label = axis === "pow" ? "P" : axis === "spe" ? "S" : axis === "men" ? "M" : "So";
    return `${label}${range.max}★`;
  })
    .filter(Boolean)
    .join(" · ");

  return {
    overallMin,
    overallMax,
    byAxis,
    band: null,
    displayLabel: axisLabels ? `Pot ${overallMin}–${overallMax}★ (${axisLabels})` : `Pot ${overallMin}–${overallMax}★`,
  };
}

export function attachPotentialCeilingToRecord(input: {
  record: PlayerPotentialRecord;
  ceiling?: PlayerPotentialCeilingProfile;
  player?: Player;
  saveId?: string;
  currentStars?: PlayerAxisStarProfile;
  attributeCeiling?: Partial<Record<PlayerGeneratorAttributeName, number>>;
}): PlayerPotentialRecord {
  const attributeCeiling =
    input.attributeCeiling ??
    (input.player && input.saveId && input.currentStars
      ? buildHiddenAttributeCeilingsFromPotentialScore({
          saveId: input.saveId,
          player: input.player,
          currentStars: input.currentStars,
          hiddenPotentialScore: input.record.hiddenPotentialScore,
        })
      : input.player && input.saveId && input.ceiling
        ? buildHiddenAttributeCeilings({
            saveId: input.saveId,
            player: input.player,
            axisCeiling: input.ceiling,
          })
        : input.record.hiddenAttributeCeiling);

  const derivedCeiling =
    attributeCeiling && input.currentStars
      ? derivePlayerPotentialCeilingProfileFromAttributeCeilings({
          attributeCeilings: attributeCeiling,
          currentStars: input.currentStars,
        })
      : input.ceiling ?? null;

  if (!derivedCeiling || !attributeCeiling) {
    return input.record;
  }

  // Persist the SAME non-saturating recalibration the display path uses, so stored
  // axis/overall PO stars match the roster snapshot (and season-end drift stays bounded).
  const ceiling =
    input.currentStars && isFiniteNumber(input.record.hiddenPotentialScore)
      ? recalibratePotentialCeilingToPotentialScore(
          input.currentStars,
          derivedCeiling,
          input.record.hiddenPotentialScore,
        )
      : derivedCeiling;

  return {
    ...input.record,
    hiddenPotentialCeilingByAxis: {
      pow: ceiling.pow,
      spe: ceiling.spe,
      men: ceiling.men,
      soc: ceiling.soc,
    },
    hiddenPotentialOverallStars: ceiling.overall,
    hiddenAttributeCeiling: attributeCeiling,
  };
}

export function buildPotentialRecordWithCeilings(input: {
  saveId: string;
  player: Player;
  record: PlayerPotentialRecord;
  currentStars: PlayerAxisStarProfile;
  axisCeilingOverride?: PlayerPotentialCeilingProfile | null;
  attributeCeilingOverride?: Partial<Record<PlayerGeneratorAttributeName, number>> | null;
}): PlayerPotentialRecord {
  const attributeCeiling =
    input.attributeCeilingOverride ??
    buildHiddenAttributeCeilingsFromPotentialScore({
      saveId: input.saveId,
      player: input.player,
      currentStars: input.currentStars,
      hiddenPotentialScore: input.record.hiddenPotentialScore,
    });
  const ceiling =
    input.axisCeilingOverride ??
    derivePlayerPotentialCeilingProfileFromAttributeCeilings({
      attributeCeilings: attributeCeiling,
      currentStars: input.currentStars,
    });
  return attachPotentialCeilingToRecord({
    record: input.record,
    ceiling,
    player: input.player,
    saveId: input.saveId,
    currentStars: input.currentStars,
    attributeCeiling,
  });
}

export function applyAxisCeilingSeasonDrift(input: {
  ceiling: PlayerPotentialCeilingProfile;
  attributeCeilings?: Partial<Record<PlayerGeneratorAttributeName, number>> | null;
  currentStars: PlayerAxisStarProfile;
  saveId: string;
  playerId: string;
  seasonId: string;
  growthOutlook: "breakout" | "growth" | "stable" | "stagnation" | "regression_risk";
}): {
  ceiling: PlayerPotentialCeilingProfile;
  attributeCeilings: Partial<Record<PlayerGeneratorAttributeName, number>>;
} {
  if (input.attributeCeilings && Object.keys(input.attributeCeilings).length > 0) {
    const driftedAttributes = applyAttributeCeilingSeasonDrift({
      attributeCeilings: input.attributeCeilings,
      saveId: input.saveId,
      playerId: input.playerId,
      seasonId: input.seasonId,
      growthOutlook: input.growthOutlook,
    });
    return {
      attributeCeilings: driftedAttributes,
      ceiling: finalizePotentialCeilingProfile(
        input.currentStars,
        derivePlayerPotentialCeilingProfileFromAttributeCeilings({
          attributeCeilings: driftedAttributes,
          currentStars: input.currentStars,
        }),
      ),
    };
  }

  const drifted = {} as Record<PlayerAxisKey, number>;
  for (const axis of AXIS_KEYS) {
    const seed = getPlayerSeedValue(`${input.saveId}:${input.playerId}:${input.seasonId}:${axis}:axis-drift-v1`);
    let delta = seed < 0.34 ? -0.5 : seed > 0.66 ? 0.5 : 0;
    if (input.growthOutlook === "breakout") delta = Math.max(delta, 0.5);
    else if (input.growthOutlook === "growth" && delta < 0) delta = 0;
    else if (input.growthOutlook === "stagnation" && delta > 0) delta = 0;
    else if (input.growthOutlook === "regression_risk") delta = Math.min(delta, -0.5);
    drifted[axis] = roundHalfStar(clamp(input.ceiling[axis] + delta, input.currentStars[axis], 5));
  }
  return {
    ceiling: finalizePotentialCeilingProfile(input.currentStars, {
      ...drifted,
      overall: computeOverallFromAxisStars(drifted),
    }),
    attributeCeilings: {},
  };
}

export function reconcilePlayerPotentialRecordToCurrentAbility(input: {
  player: Player;
  record: PlayerPotentialRecord;
  currentStars: PlayerAxisStarProfile;
  saveId?: string | null;
}): PlayerPotentialRecord {
  let attributeCeiling: Partial<Record<PlayerGeneratorAttributeName, number>> = {
    ...(input.record.hiddenAttributeCeiling ?? {}),
  };
  const hasAttributeCeilings = playerGeneratorAttributeKeys.some((attribute) =>
    isFiniteNumber(attributeCeiling[attribute]),
  );

  if (!hasAttributeCeilings && input.saveId) {
    if (input.record.hiddenPotentialScore != null) {
      attributeCeiling = buildHiddenAttributeCeilingsFromPotentialScore({
        saveId: input.saveId,
        player: input.player,
        currentStars: input.currentStars,
        hiddenPotentialScore: input.record.hiddenPotentialScore,
      });
    } else if (input.record.hiddenPotentialCeilingByAxis) {
      const effectiveAxis = resolveEffectiveAxisPoStars(
        input.currentStars,
        input.record.hiddenPotentialCeilingByAxis,
      );
      attributeCeiling = buildHiddenAttributeCeilings({
        saveId: input.saveId,
        player: input.player,
        axisCeiling: {
          pow: effectiveAxis.pow,
          spe: effectiveAxis.spe,
          men: effectiveAxis.men,
          soc: effectiveAxis.soc,
          overall: clampPotentialOverallToCurrent(
            input.currentStars.overall,
            input.record.hiddenPotentialOverallStars ?? input.currentStars.overall,
          ),
        },
      });
    }
  }

  for (const attribute of playerGeneratorAttributeKeys) {
    const current = getPlayerAttributeValue(input.player, attribute);
    if (!isFiniteNumber(current)) {
      continue;
    }
    const stored = attributeCeiling[attribute];
    const currentRounded = Math.round(current);
    // Hybrid-Ceiling:
    //  - Gespeichertes Ceiling >= CA: unveraendert respektieren. So greift die Near-Ceiling-
    //    Drosselung am ECHTEN Potenzial (kein kuenstlicher Puffer -> keine Ceiling-Inflation).
    //  - Gespeichertes Ceiling < CA (PO ist hinter die Faehigkeit zurueckgefallen): auf
    //    current + 6 anheben, damit der Spieler wieder offenen Wachstums-Headroom bekommt
    //    (garantiert PA > CA fuer diesen Sonderfall).
    //  - Kein Ceiling vorhanden: offener Headroom (current + 12).
    attributeCeiling[attribute] = isFiniteNumber(stored)
      ? stored >= currentRounded
        ? stored
        : Math.min(99, currentRounded + 6)
      : Math.min(99, currentRounded + 12);
  }

  const derivedCeilingProfile = derivePlayerPotentialCeilingProfileFromAttributeCeilings({
    attributeCeilings: attributeCeiling,
    currentStars: input.currentStars,
  });
  const ceilingProfile = finalizePotentialCeilingProfile(
    input.currentStars,
    isFiniteNumber(input.record.hiddenPotentialScore)
      ? recalibratePotentialCeilingToPotentialScore(
          input.currentStars,
          derivedCeilingProfile,
          input.record.hiddenPotentialScore,
        )
      : derivedCeilingProfile,
  );

  return {
    ...input.record,
    hiddenPotentialCeilingByAxis: {
      pow: ceilingProfile.pow,
      spe: ceilingProfile.spe,
      men: ceilingProfile.men,
      soc: ceilingProfile.soc,
    },
    hiddenPotentialOverallStars: ceilingProfile.overall,
    hiddenAttributeCeiling: attributeCeiling,
  };
}

export function resolvePlayerPotentialRecordForProgression(input: {
  gameState: GameState;
  player: Player;
}): PlayerPotentialRecord | null {
  const record = input.gameState.playerPotential?.find((entry) => entry.playerId === input.player.id) ?? null;
  if (!record) {
    return null;
  }
  const currentStars = buildPlayerAxisStarProfile({
    gameState: input.gameState,
    player: input.player,
    disciplines: input.gameState.disciplines,
  });
  return reconcilePlayerPotentialRecordToCurrentAbility({
    player: input.player,
    record,
    currentStars,
    saveId: input.gameState.season.id,
  });
}

export function reconcilePlayerPotentialRecordsForGameState(input: {
  gameState: GameState;
  playerIds?: string[];
}): PlayerPotentialRecord[] {
  const targetIds = input.playerIds ? new Set(input.playerIds) : null;
  const playersById = new Map(input.gameState.players.map((entry) => [entry.id, entry] as const));

  return (input.gameState.playerPotential ?? []).map((record) => {
    if (targetIds && !targetIds.has(record.playerId)) {
      return record;
    }
    const player = playersById.get(record.playerId);
    if (!player) {
      return record;
    }
    const currentStars = buildPlayerAxisStarProfile({
      gameState: input.gameState,
      player,
      disciplines: input.gameState.disciplines,
    });
    return reconcilePlayerPotentialRecordToCurrentAbility({
      player,
      record,
      currentStars,
      saveId: input.gameState.season.id,
    });
  });
}
