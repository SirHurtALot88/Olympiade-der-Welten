/**
 * Central config + feature flag for the Board-Objectives V2 redesign (see
 * docs/design/board-objectives-redesign.md). V2 replaces trivial objectives (cash-positive,
 * roster>=N) with strength-calibrated, meaningful goals and (in later slices) a perceived-pressure
 * layer + captain channel.
 *
 * Flag default OFF: V2 is behaviour-changing (golden-master / objective tests shift intentionally),
 * Flag default ON: V2 (strength-calibrated objectives + perceived-pressure + captain channel) is now
 * the shipped default. Disable with OLY_BOARD_OBJECTIVES_V2="0" for A/B or regression comparison.
 */
export function isBoardObjectivesV2Enabled(): boolean {
  return process.env.OLY_BOARD_OBJECTIVES_V2 !== "0";
}

/**
 * Difficulty calibration: a season target is set relative to the team's expected league rank
 * (from strength) rather than hardcoded tiers. `stretch` = how many ranks above the expected finish
 * the board demands, scaled by ambition. The stretch ceiling shrinks toward the table bottom so weak
 * teams get achievable "hold your ground / avoid collapse" goals instead of impossible climbs.
 */
export const BOARD_V2_CALIBRATION = {
  /** Ambition 0 -> minStretch, ambition 1 -> maxStretch (ranks above expected finish). */
  minStretch: 0,
  maxStretch: 6,
  /** Expected rank at/after which maxStretch is damped (bottom of the table). Ranks are 1..leagueSize. */
  bottomDampFromRank: 22,
  /** Stretch multiplier applied once expectedRank >= bottomDampFromRank (weak teams stretch less). */
  bottomDampFactor: 0.4,
} as const;

/**
 * Net-transfer-balance objective (replaces cash-positive). Target scales with cash priority and
 * season number — a real "run a sustainable transfer economy" goal, not the tautological cash>0.
 */
export const BOARD_V2_NET_TRANSFER = {
  /** Base target (M) at neutral cash priority; scaled up by cashPriority and season maturity. */
  baseTargetM: 0,
  perCashPriorityM: 1.2,
  /**
   * For boards whose surplus target resolves to 0 (neutral/low cash priority), a positive surplus is
   * NOT demanded — normal squad-building net spend is fine. The objective instead becomes a soft
   * ceiling: "don't overspend beyond a cash-scaled budget", with a real at_risk band (via statusForMax)
   * so a modest net-buy stays completed/at_risk rather than auto-failing. Ceiling = max(floor, cash *
   * fraction).
   */
  overspendCeilingFloorM: 8,
  overspendCeilingCashFraction: 0.15,
} as const;

/**
 * Roster quality/composition objective (replaces roster>=N). Target = minimum share of
 * non-reserve players (superstar+star+core+depth) on the roster, nudged by identity ambition.
 * Organic: a share target, never a hard cap or forced tier count.
 */
export const BOARD_V2_COMPOSITION = {
  /** Base non-reserve share target at neutral ambition. */
  baseCoreShare: 0.45,
  /** Added share per ambition point above neutral (ambition 5 = neutral). */
  perAmbitionShare: 0.03,
  /** Clamp bounds so the target stays organic/achievable. */
  minCoreShare: 0.35,
  maxCoreShare: 0.7,
} as const;

/**
 * Squad-value-trajectory objective: hold/grow squad market value relative to the league average
 * delta (not an absolute number), so the bar tracks the whole league's inflation/deflation.
 */
export const BOARD_V2_SQUAD_VALUE = {
  /** Required fraction of the league-average squad value the team must retain (1.0 = keep pace). */
  keepPaceFraction: 0.92,
} as const;

/**
 * Board disposition (Slice 3): the board's ambition + patience drift with recent results. Derived
 * from identity temperament plus a normalized "last season vs expectation" signal (the carried board
 * value relative to neutral 5). F1: disappointment lowers patience (impatient → more GM churn) and
 * ambition; overperformance raises both (higher bar, calmer board).
 */
export const BOARD_V2_DISPOSITION = {
  /** Neutral board value; results above/below shift disposition. */
  neutralValue: 5,
  /** Response of ambition (0–1) per unit of normalized performance signal. */
  ambitionResponse: 0.25,
  /** Response of patience (0–1) per unit of normalized performance signal. */
  patienceResponse: 0.3,
  ambitionMin: 0.05,
  ambitionMax: 1.0,
  patienceMin: 0.1,
  patienceMax: 0.95,
} as const;

/**
 * Dynamic slate size (F4): a calmer/less-ambitious board sets fewer objectives (min), an
 * ambitious/pressured one more (max). Size = 3 + round(2 * (0.5*ambition + 0.5*(pressure/10))).
 */
export const BOARD_V2_SLATE = {
  minSize: 3,
  maxSize: 5,
} as const;

/**
 * Captain → board channel (Slice 4, F2): a high-leadership team captain absorbs pressure in the
 * dressing room, lowering the board's *perceived* pressure (and thereby GM-firing risk + AI panic,
 * which read perceivedPressure). Goals never move — only the felt pressure. captainDamp =
 * clamp(leadershipScore / leadershipDivisor, 0, maxDamp), subtracted from perceivedPressure.
 */
export const BOARD_V2_CAPTAIN = {
  leadershipDivisor: 40,
  maxDamp: 2.0,
} as const;
