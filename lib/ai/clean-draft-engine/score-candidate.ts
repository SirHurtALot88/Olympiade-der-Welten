import type { Player } from "@/lib/data/olyDataTypes";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

import { resolveCleanTeamTraits, type CleanTeamTraits } from "./plan-team-lanes";
import type { CleanThemeTarget, ScoreCandidateInput, ScoreCandidateResult } from "./types";

// Balanced weighting: quality anchors the score, but marginal-need, identity fit, weighted value,
// discipline coverage and a strong-consistent theme bonus all pull real weight. Value is a genuine
// term (heavier for value-priority teams) but capped so it never dominates and recreates the
// reserve barbell. Theme is strong on EVERY slot — off-theme is the exception, not the norm — while
// staying additive so a clearly-superior off-theme candidate can still win.
const W_QUALITY = 100;
const W_NEED = 45;
const W_IDENTITY = 22; // premium (star/superstar) slots anchor harder in the team's own axis
const W_VALUE_BASE = 12;
const W_VALUE_TRAIT = 26; // scaled by valuePriority
const W_DISCIPLINE = 16;
const W_POTENTIAL = 20; // scaled by development bias, weighted more on lower-tier slots
const THEME_BASE = 26;
const THEME_URGENCY = 16; // extra weight while below the theme quota (never reduces the base)

type Axis = "pow" | "spe" | "men" | "soc";
const AXES: Axis[] = ["pow", "spe", "men", "soc"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRace(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function candidateAxis(candidate: TransfermarktFreeAgentItem, axis: Axis): number {
  const raw = candidate[axis];
  return clamp((typeof raw === "number" && Number.isFinite(raw) ? raw : 0) / 100, 0, 1);
}

function candidateOverall(candidate: TransfermarktFreeAgentItem): number {
  const ovr = candidate.ovr ?? candidate.mvs ?? null;
  if (ovr != null && Number.isFinite(ovr)) return clamp(ovr / 100, 0, 1);
  const avg = AXES.reduce((sum, axis) => sum + candidateAxis(candidate, axis), 0) / AXES.length;
  return clamp(avg, 0, 1);
}

/** Identity axis weights (0..1 each), from the team's pow/spe/men/soc identity. */
function identityWeights(identity: ScoreCandidateInput["identity"]) {
  return {
    pow: clamp((identity?.pow ?? 50) / 100, 0, 1),
    spe: clamp((identity?.spe ?? 50) / 100, 0, 1),
    men: clamp((identity?.men ?? 50) / 100, 0, 1),
    soc: clamp((identity?.soc ?? 50) / 100, 0, 1),
  };
}

/** Team's current per-axis coverage from the roster-so-far (0 if empty). */
function axisCoverage(players: Player[]) {
  if (players.length === 0) return { pow: 0, spe: 0, men: 0, soc: 0 };
  const totals = { pow: 0, spe: 0, men: 0, soc: 0 };
  for (const player of players) {
    for (const axis of AXES) {
      const value = player.coreStats?.[axis];
      totals[axis] += clamp((typeof value === "number" ? value : 0) / 100, 0, 1);
    }
  }
  return {
    pow: totals.pow / players.length,
    spe: totals.spe / players.length,
    men: totals.men / players.length,
    soc: totals.soc / players.length,
  };
}

/**
 * MARGINAL-VALUE / NEED: reward candidates who lift the team where it is currently WEAK relative to
 * what its identity wants — a POW-strong roster values a SPE/MEN candidate more. Gaps are weighted by
 * the shortfall between the identity's desired axis and the roster's current coverage.
 */
function needScore(input: ScoreCandidateInput): number {
  const desired = identityWeights(input.identity);
  const coverage = axisCoverage(input.currentRosterPlayers);
  const gaps = AXES.map((axis) => Math.max(0, desired[axis] - coverage[axis]));
  const gapSum = gaps.reduce((sum, gap) => sum + gap, 0);
  if (gapSum <= 0) {
    // Fully covered (or no identity signal): fall back to raw axis strength.
    return AXES.reduce((sum, axis) => sum + candidateAxis(input.candidate, axis), 0) / AXES.length;
  }
  let score = 0;
  AXES.forEach((axis, index) => {
    score += candidateAxis(input.candidate, axis) * (gaps[index]! / gapSum);
  });
  return clamp(score, 0, 1);
}

/** Identity fit: candidate axes weighted by the team's identity axis emphasis. */
function identityFit(input: ScoreCandidateInput): number {
  const weights = identityWeights(input.identity);
  const weightSum = weights.pow + weights.spe + weights.men + weights.soc || 1;
  const dot = AXES.reduce((sum, axis) => sum + weights[axis] * candidateAxis(input.candidate, axis), 0);
  return clamp(dot / weightSum, 0, 1);
}

/**
 * VALUE / price-efficiency: quality per market value plus a healthy market-value-to-salary ratio and
 * a preference for the lower half of the slot band. Genuine weighted term (heavier for value teams),
 * capped by its weight so it stays balanced against need/identity/quality.
 */
function valueScore(input: ScoreCandidateInput): number {
  const price = input.candidate.marketValue ?? 0;
  const overall = candidateOverall(input.candidate);
  const qualityPerCost = price > 0 ? clamp(overall / (price / 40), 0, 1) : 0.5; // ~1.0 at 40MW for a top player
  const ratio = input.candidate.marketValueSalaryRatio;
  const ratioScore = ratio != null && Number.isFinite(ratio) ? clamp(ratio / 3, 0, 1) : 0.5;
  const span = Math.max(input.slot.priceCap - input.slot.priceFloor, 1);
  const positional = 1 - clamp((price - input.slot.priceFloor) / span, 0, 1) * 0.5;
  return clamp(qualityPerCost * 0.45 + ratioScore * 0.3 + positional * 0.25, 0, 1);
}

/** DISCIPLINE COVERAGE: reward covering disciplines the roster-so-far has not covered yet. */
function disciplineCoverageScore(input: ScoreCandidateInput): number {
  const candidateDisciplines = input.candidate.preferredDisciplineIds ?? [];
  if (candidateDisciplines.length === 0) return 0.3;
  const covered = new Set<string>();
  for (const player of input.currentRosterPlayers) {
    for (const id of player.preferredDisciplineIds ?? []) covered.add(id);
  }
  if (covered.size === 0) return 0.6; // early roster: any coverage is useful
  const fresh = candidateDisciplines.filter((id) => !covered.has(id)).length;
  return clamp(fresh / 2, 0, 1);
}

/** POTENTIAL: young/high-ceiling players, weighted only for development-leaning teams / lower slots. */
function potentialScore(candidate: TransfermarktFreeAgentItem): number {
  const stars = candidate.potentialStarsMin;
  if (stars != null && Number.isFinite(stars)) return clamp(stars / 5, 0, 1);
  switch (candidate.potentialBand) {
    case "elite":
      return 1;
    case "high":
      return 0.75;
    case "medium":
      return 0.5;
    case "low":
      return 0.25;
    default:
      return 0.4;
  }
}

function isOnTheme(candidate: TransfermarktFreeAgentItem, themeTarget: CleanThemeTarget): boolean {
  if (!themeTarget || themeTarget.coreRaces.length === 0) return false;
  const race = normalizeRace(candidate.race);
  if (!race) return false;
  return themeTarget.coreRaces.some((entry) => normalizeRace(entry) === race);
}

/** Strong, CONSISTENT theme bonus on every slot; boosted (never reduced) while below the quota. */
function themeBonus(input: ScoreCandidateInput, onTheme: boolean): number {
  if (!onTheme || !input.themeTarget) return 0;
  const minCorePct = clamp(input.themeTarget.minCorePct, 0, 1);
  const currentShare =
    input.rosterCountSoFar > 0 ? clamp(input.onThemeCountSoFar / input.rosterCountSoFar, 0, 1) : 0;
  const deficit = minCorePct > 0 ? clamp((minCorePct - currentShare) / minCorePct, 0, 1) : 0;
  return THEME_BASE + deficit * THEME_URGENCY;
}

export function scoreCandidate(input: ScoreCandidateInput): ScoreCandidateResult {
  const traits: CleanTeamTraits = resolveCleanTeamTraits(input);
  const isPremiumSlot = input.slot.lane === "superstar" || input.slot.lane === "star";
  const isLowerSlot = input.slot.lane === "backup" || input.slot.lane === "reserve" || input.slot.lane === "depth";

  const onTheme = isOnTheme(input.candidate, input.themeTarget);

  const quality = candidateOverall(input.candidate) * W_QUALITY;

  // Identity anchor: premium picks lean into the team's own axis; body picks lean into filling gaps.
  const identityWeight = isPremiumSlot ? W_IDENTITY * 1.8 : W_IDENTITY;
  const needWeight = isPremiumSlot ? W_NEED * 0.5 : W_NEED;
  const need = needScore(input) * needWeight;
  const identity = identityFit(input) * identityWeight;

  const valueWeight = W_VALUE_BASE + traits.valuePriority * W_VALUE_TRAIT;
  const value = valueScore(input) * valueWeight;

  const discipline = disciplineCoverageScore(input) * W_DISCIPLINE;

  const potentialWeight = W_POTENTIAL * traits.developmentBias * (isLowerSlot ? 1 : 0.4);
  const potential = potentialScore(input.candidate) * potentialWeight;

  // The premium/franchise pick is the team's anchor: it should favor on-theme even MORE (the star
  // represents the identity), so there is no off-theme exception for the marquee slot.
  const theme = themeBonus(input, onTheme) * (isPremiumSlot ? 1.35 : 1);

  return { score: quality + need + identity + value + discipline + potential + theme, onTheme };
}
