/**
 * Organic marginal-utility squad builder — cash option value (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE function, not wired into any
 * game logic yet. This scores the utility of NOT spending — i.e. holding cash — so it can be
 * weighed against a player's marginal quality gain in the later buy-vs-stop decision (that
 * composition itself lives in ./utility.ts and is out of scope for P1).
 */

import type { CashFlowForecast } from "./types";

/**
 * Overall scale of the returned value. Chosen so the output lands in the same rough range
 * (0..~60) as a player's marginal quality gain (see ./quality.ts, which is 0-100+ but typically
 * dominated by need-weighted core stats well under 60 for a single marginal pick). This keeps
 * "hold the cash" competitive with "buy the player" in the eventual buy-vs-stop comparison
 * without structurally dominating it.
 */
const BASE = 60;

/** Weight on bufferPressure (cash near/below the cash buffer). */
const W_BUFFER = 0.35;
/** Weight on bleedPressure (forecast is bleeding cash, i.e. negative sustainability margin). */
const W_BLEED = 0.35;
/** Weight on boardRisk (board pressure makes cash more precious). */
const W_BOARD = 0.2;
/** Weight on rosterFullBoost (squad already at/near its soft target — less need to keep buying). */
const W_ROSTER_FULL = 0.1;

/** Clamp `value` into [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** Coerce missing/NaN/non-finite numbers to 0 so arithmetic never propagates NaN. */
function safe(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Round to 2 decimal places, defensive against floating point noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The utility of holding cash rather than spending it, in the same rough scale (0..~60) as a
 * player's marginal quality gain — see {@link BASE}.
 *
 * Composed of four smooth, bounded [0,1] pressure terms, weighted and scaled by {@link BASE}:
 *  - `bufferPressure`: rises to 1 as `cash` falls to/below `cashBuffer`, falls to 0 once cash is
 *    roughly 2x the buffer above it. Formula: `clamp((cashBuffer - (cash - cashBuffer)) / cashBuffer, 0, 1)`.
 *  - `bleedPressure`: 0 whenever `forecast.sustainabilityMargin` is non-negative; otherwise rises
 *    to 1 as the (negative) margin approaches `-cashBuffer` or worse.
 *  - `boardRisk`: used directly (already 0..1 — higher board pressure, more precious cash).
 *  - `rosterFullBoost`: `clamp(rosterSize / optTarget, 0, 1)` — note this already saturates to 1
 *    once `rosterSize >= optTarget` (the ratio is then >= 1), so a squad that is "full enough"
 *    gets the maximum boost without any discontinuity at the threshold.
 *
 * Because every term is clamped to [0, 1] and the weights sum to 1, the result is always
 * within [0, BASE] — i.e. always >= 0.
 */
export function cashOptionValue(input: {
  cash: number;
  cashBuffer: number;
  forecast: CashFlowForecast;
  /** 0..1, higher = more board pressure = cash more precious. */
  boardRisk: number;
  rosterSize: number;
  optTarget: number;
}): number {
  const cash = safe(input.cash);
  const cashBuffer = safe(input.cashBuffer);
  const margin = safe(input.forecast?.sustainabilityMargin);
  const boardRisk = clamp(safe(input.boardRisk), 0, 1);
  const rosterSize = safe(input.rosterSize);
  const optTarget = safe(input.optTarget);

  const bufferDenom = Math.max(cashBuffer, 1);
  const bufferPressure = clamp((cashBuffer - (cash - cashBuffer)) / bufferDenom, 0, 1);

  const bleedPressure = margin < 0 ? clamp(-margin / bufferDenom, 0, 1) : 0;

  const rosterFullBoost = clamp(rosterSize / Math.max(optTarget, 1), 0, 1);

  const value =
    BASE *
    (W_BUFFER * bufferPressure +
      W_BLEED * bleedPressure +
      W_BOARD * boardRisk +
      W_ROSTER_FULL * rosterFullBoost);

  return round2(Math.max(0, value));
}
