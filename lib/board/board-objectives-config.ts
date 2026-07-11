/**
 * Central config + feature flag for the Board-Objectives V2 redesign (see
 * docs/design/board-objectives-redesign.md). V2 replaces trivial objectives (cash-positive,
 * roster>=N) with strength-calibrated, meaningful goals and (in later slices) a perceived-pressure
 * layer + captain channel.
 *
 * Flag default OFF: V2 is behaviour-changing (golden-master / objective tests shift intentionally),
 * so it stays behind OLY_BOARD_OBJECTIVES_V2 until parity/balancing is green. Set "1" to enable.
 */
export function isBoardObjectivesV2Enabled(): boolean {
  return process.env.OLY_BOARD_OBJECTIVES_V2 === "1";
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
