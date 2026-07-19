/**
 * Sponsor-forecast + team-value SALARY CEILING (Master-Plan: replaces the crude cash-only salary budgeting
 * with an income-and-team-value-anchored total-wage-bill ceiling).
 *
 * WHY (see task/PR description): the organic engine today budgets squad-building off spendable CASH
 * (`spendableNet` in composition-plan.ts / the cash affordability floor in draft-builder.ts). Two problems
 * observed in multi-season sims: (a) sponsor-rich teams under-build — they leave wage capacity unused
 * because cash (a volatile snapshot) doesn't reflect their real income power, ending up with too few
 * players; (b) a team can carry a wage bill far above its income for years, funded by cash reserves, with
 * no brake. This module adds a SOFT ceiling on the team's TOTAL planned salary, anchored on:
 *   - `sustainableSalary`: what the team's own income (last season's sponsor settlement, preseason-known)
 *     can service after fixed costs (facility upkeep + loan installments) — the "can afford forever" line.
 *   - `rangeWidth * ambitionScale`: extra GAMBLE room on top, scaled by team value (cash + roster market
 *     value) and by how ambitious the club (identity.ambition + GM archetype) wants to play — a rich,
 *     ambitious club may deliberately run a wage bill above what it can sustain forever, financed by its
 *     value cushion. `trendFactor` squeezes that gamble room back down for a team whose team value has been
 *     falling for multiple seasons running (the cushion funding the gamble is evaporating).
 *
 * SOFT by design: this NEVER forces a sale and never blocks reaching the hard roster minimum — see the
 * wiring in draft-builder.ts (the ceiling only gates NEW salary added while the roster is already at/above
 * playerMin). Pure, deterministic, no Date.now/Math.random — every input is read off `gameState` as of the
 * call (preseason-known figures only, per estimateTeamAnnualRevenue's own doc).
 *
 * Gated by OLY_SALARY_CEILING_V2 (see draft-adapter.ts wiring) — this module itself reads no env for the
 * on/off switch (matches composition-plan.ts's pattern: the flag lives at the call site), but its tunable
 * constants ARE env-overridable (OLY_SALCEIL_*) so the anchoring can be re-calibrated without a code change.
 */

import type { GameState, TeamGeneralManagerArchetype } from "@/lib/data/olyDataTypes";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

/** identity.ambition (and GM profile ambition) are authored 0..10 — normalize to 0..1, neutral (0.5) when
 *  missing/invalid, matching the normId() convention used elsewhere in the organic-squad wiring. */
function normAmbition(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return clamp(value / 10, 0, 1);
}

// ---------------------------------------------------------------------------------------------------
// Tunable constants (all OLY_SALCEIL_* env-overridable; defaults chosen so a mid-table team's ceiling
// lands a bit above its current salary — freeing the under-building sponsor-rich case — while a team
// with a 2+ season falling team value gets its gamble headroom squeezed back toward sustainableSalary).
// ---------------------------------------------------------------------------------------------------

/** teamValue reference point (cash + roster market value) below which NO extra gamble headroom is
 *  granted — roughly a mid-table team's typical value cushion. Above it, headroom scales with the
 *  surplus; below it, rangeWidth is 0 and the ceiling is just sustainableSalary. */
const LEAGUE_MEDIAN_TEAMVALUE_REF = Number(process.env.OLY_SALCEIL_TEAMVALUE_REF ?? 260) || 260;

/** Fraction of (teamValue − LEAGUE_MEDIAN_TEAMVALUE_REF) that converts into raw gamble headroom (before
 *  the ambition scale is applied). Bigger K ⇒ wealth translates into more wage-bill risk appetite. */
const RANGE_WIDTH_K = Number(process.env.OLY_SALCEIL_RANGE_K ?? 0.3) || 0.3;

/** Hard cap on raw gamble headroom (pre-ambitionScale) — keeps even a hyper-rich outlier's ceiling
 *  bounded rather than unboundedly ballooning with team value. */
const RANGE_WIDTH_CAP = Number(process.env.OLY_SALCEIL_RANGE_CAP ?? 70) || 70;

/** Sustained-decline trend floor: a team whose (cash+marketValue) has fallen for
 *  OLY_SALCEIL_TREND_MIN_STREAK consecutive tracked seasons has its rangeWidth multiplied down toward
 *  this fraction — the gamble cushion funding ambition is itself shrinking, so gamble room shrinks too. */
const TREND_FLOOR = clamp(Number(process.env.OLY_SALCEIL_TREND_FLOOR ?? 0.35) || 0.35, 0, 1);

/** Minimum number of CONSECUTIVE down-seasons (in the up-to-3-season trailing window) before the trend
 *  squeeze engages — a single bad season is noise, not a trend. */
const TREND_MIN_DOWN_STREAK = Math.max(1, Math.round(Number(process.env.OLY_SALCEIL_TREND_MIN_STREAK ?? 2) || 2));

/** ambitionScale = normAmbition(identity.ambition) × archetypeMult, clamped to this ceiling — bounds how
 *  much even a maximally-ambitious, star-chasing GM can multiply the value-scaled gamble headroom. */
const AMBITION_SCALE_MAX = Number(process.env.OLY_SALCEIL_AMBITION_SCALE_MAX ?? 1.6) || 1.6;

/** Archetype multiplier for GMs whose whole identity is chasing upside (star_chaser/risk_gambler) — they
 *  lean into the gamble room a value cushion buys them. */
const AMBITION_MULT_HIGH = Number(process.env.OLY_SALCEIL_AMBITION_MULT_HIGH ?? 1.6) || 1.6;

/** Archetype multiplier for GMs whose whole identity is conservative (bargain_hunter/culture_keeper) —
 *  they take ~none of the available gamble room regardless of raw ambition. */
const AMBITION_MULT_LOW = Number(process.env.OLY_SALCEIL_AMBITION_MULT_LOW ?? 0.1) || 0.1;

/** Neutral archetype multiplier (every other GM archetype, or no GM assigned). */
const AMBITION_MULT_BASE = Number(process.env.OLY_SALCEIL_AMBITION_MULT_BASE ?? 1.0) || 1.0;

const HIGH_AMBITION_ARCHETYPES: ReadonlySet<TeamGeneralManagerArchetype> = new Set(["star_chaser", "risk_gambler"]);
const LOW_AMBITION_ARCHETYPES: ReadonlySet<TeamGeneralManagerArchetype> = new Set(["bargain_hunter", "culture_keeper"]);

function archetypeAmbitionMult(archetype: TeamGeneralManagerArchetype | null | undefined): number {
  if (archetype && HIGH_AMBITION_ARCHETYPES.has(archetype)) return AMBITION_MULT_HIGH;
  if (archetype && LOW_AMBITION_ARCHETYPES.has(archetype)) return AMBITION_MULT_LOW;
  return AMBITION_MULT_BASE;
}

/**
 * Trailing (cash + marketValue) trend factor from up to the last 3 completed season snapshots for this
 * team. 1.0 (no squeeze) unless there are at least `TREND_MIN_DOWN_STREAK` CONSECUTIVE down-seasons
 * ending at the most recent tracked snapshot, in which case it drops to TREND_FLOOR — with only 3
 * snapshots considered (2 deltas), "consecutive down for >=2 seasons" and "the trend is bad" collapse to
 * the same trailing-window check, so this is a floor rather than a smoothly graded curve; that keeps the
 * signal simple, deterministic, and exactly matched to the "steadily falling over >=2 seasons" spec.
 */
function computeTeamValueTrendFactor(gameState: GameState, teamId: string): number {
  const snapshots = (gameState.seasonState.seasonSnapshots ?? []).filter((snapshot) => snapshot.status !== "dry_run");
  const recent = snapshots.slice(-3);
  const series: number[] = [];
  for (const snapshot of recent) {
    const record =
      (snapshot.teamSnapshots ?? snapshot.finalStandings ?? []).find((entry) => entry.teamId === teamId) ?? null;
    if (!record) continue;
    const cashEnd = typeof record.cashEnd === "number" && Number.isFinite(record.cashEnd) ? record.cashEnd : 0;
    const marketValueEnd =
      typeof record.marketValueEnd === "number" && Number.isFinite(record.marketValueEnd) ? record.marketValueEnd : 0;
    series.push(cashEnd + marketValueEnd);
  }
  if (series.length < 2) return 1.0; // not enough history to judge a trend — assume flat, no squeeze.

  let downStreak = 0;
  for (let i = series.length - 1; i > 0; i -= 1) {
    if (series[i]! < series[i - 1]!) downStreak += 1;
    else break;
  }
  return downStreak >= TREND_MIN_DOWN_STREAK ? TREND_FLOOR : 1.0;
}

export type TeamSalaryCeilingResult = {
  /** The final soft ceiling on TOTAL planned salary (existing roster + planned additions). */
  salaryCeiling: number;
  /** Income-anchored "can service forever" line: max(0, expectedSponsor − fixedCosts). */
  sustainableSalary: number;
  /** Value-and-trend-scaled extra gamble headroom (pre-ambitionScale multiplication is already applied). */
  rangeWidth: number;
  /** 0..1 (well, up to AMBITION_SCALE_MAX) multiplier applied to rangeWidth from identity+GM ambition. */
  ambitionScale: number;
  /** 1.0 normally, squeezed toward TREND_FLOOR for a multi-season team-value decliner. */
  trendFactor: number;
  /** Last-season sponsor settlement proxy (estimateTeamAnnualRevenue), preseason-known. */
  expectedSponsor: number;
  /** Facility upkeep + annual loan installments — the fixed costs netted out of expectedSponsor. */
  fixedCosts: number;
  /** cash + roster market value — the wealth base rangeWidth scales off. */
  teamValue: number;
};

/**
 * Computes the sponsor-forecast + team-value salary ceiling for one team. Pure and deterministic: every
 * input is read off the given `gameState` snapshot (no mutation, no randomness). See module doc for the
 * formula and rationale; see draft-builder.ts / draft-adapter.ts for how this gates the organic squad
 * builder's greedy buy loop (soft cap on NEW salary, hard roster minimum always wins).
 */
export function computeTeamSalaryCeiling(
  gameState: GameState,
  teamId: string,
  options: { teamCash: number },
): TeamSalaryCeilingResult {
  const expectedSponsor = estimateTeamAnnualRevenue(gameState, teamId);
  const fixedCosts =
    calculateFacilityUpkeep(getTeamFacilityState(gameState, teamId)) + getTeamAnnualLoanInstallment(gameState, teamId);

  if (expectedSponsor <= 0) {
    // No income signal at all — estimateTeamAnnualRevenue's own doc: this proxy is 0 only when there is
    // NEITHER a settled sponsor payout log NOR a current sponsor contract with a base component, i.e. a
    // genuine data gap (in practice: the brief pre-assignment window at the very start of a fresh Season 1,
    // before AI teams have accepted a sponsor offer yet — see ai-picks-run-service.ts's organic builder,
    // which runs on exactly that fresh/empty-roster state). Anchoring a ceiling on a 0 that means "unknown"
    // rather than "the team truly earns nothing" would silently starve every brand-new team's whole wage
    // capacity — the opposite of this feature's goal. So: no income data ⇒ no cap yet (Infinity), rather
    // than a false, catastrophic sustainableSalary of 0. Once a real sponsor figure exists (next call, after
    // the team's contract/settlement is known), the ceiling engages normally.
    return {
      salaryCeiling: Infinity,
      sustainableSalary: Infinity,
      rangeWidth: 0,
      ambitionScale: 0,
      trendFactor: 1,
      expectedSponsor: 0,
      fixedCosts: round(fixedCosts),
      teamValue: round(options.teamCash + resolveTeamRosterMarketValue(gameState, teamId)),
    };
  }

  const sustainableSalary = Math.max(0, expectedSponsor - fixedCosts);

  const rosterMarketValue = resolveTeamRosterMarketValue(gameState, teamId);
  const teamValue = options.teamCash + rosterMarketValue;

  const trendFactor = computeTeamValueTrendFactor(gameState, teamId);
  const rangeWidthBase = clamp((teamValue - LEAGUE_MEDIAN_TEAMVALUE_REF) * RANGE_WIDTH_K, 0, RANGE_WIDTH_CAP);
  const rangeWidth = round(rangeWidthBase * trendFactor);

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const gmArchetype = getTeamGeneralManager(gameState, teamId)?.profile?.archetype ?? null;
  const ambitionScale = round(clamp(normAmbition(identity?.ambition) * archetypeAmbitionMult(gmArchetype), 0, AMBITION_SCALE_MAX));

  const salaryCeiling = round(sustainableSalary + rangeWidth * ambitionScale);

  return {
    salaryCeiling,
    sustainableSalary: round(sustainableSalary),
    rangeWidth,
    ambitionScale,
    trendFactor,
    expectedSponsor: round(expectedSponsor),
    fixedCosts: round(fixedCosts),
    teamValue: round(teamValue),
  };
}
