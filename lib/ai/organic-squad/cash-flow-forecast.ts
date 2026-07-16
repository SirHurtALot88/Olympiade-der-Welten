/**
 * Organic marginal-utility squad builder — cash-flow forecast (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE function, not wired into any
 * game logic yet. NOTE: in this game prize money is BENCHMARK-ONLY — it is never credited to a
 * team's real cash balance. `expectedPrize` here is a PLANNING input only: the AI is allowed to
 * factor an expected prize into its forecast/sustainability read, even though that prize will
 * never actually land in `cash`. Do not confuse this forecast with the real cash ledger.
 */

import type { CashFlowForecast } from "./types";

/** Round to 2 decimal places, defensive against floating point noise. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Coerce missing/NaN/non-finite numbers to 0 so arithmetic never propagates NaN. */
function safe(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Project season-end cash and the resulting sustainability margin.
 *
 * `projectedSeasonEndCash = cash − salaryTotal + expectedPrize + sponsorIncome + facilityNet + netTransfer`.
 * `sustainabilityMargin = projectedSeasonEndCash − cashBuffer` (negative ⇒ bleeding cash).
 *
 * All inputs are treated defensively: missing/NaN/non-finite values are treated as 0 so the
 * result is always a finite number. Both outputs are rounded to 2 decimals.
 */
export function projectCashFlow(input: {
  cash: number;
  salaryTotal: number;
  expectedPrize: number;
  sponsorIncome: number;
  facilityNet: number;
  netTransfer: number;
  cashBuffer: number;
}): CashFlowForecast {
  const cash = safe(input.cash);
  const salaryTotal = safe(input.salaryTotal);
  const expectedPrize = safe(input.expectedPrize);
  const sponsorIncome = safe(input.sponsorIncome);
  const facilityNet = safe(input.facilityNet);
  const netTransfer = safe(input.netTransfer);
  const cashBuffer = safe(input.cashBuffer);

  const projectedSeasonEndCash = round2(
    cash - salaryTotal + expectedPrize + sponsorIncome + facilityNet + netTransfer,
  );
  const sustainabilityMargin = round2(projectedSeasonEndCash - cashBuffer);

  return { projectedSeasonEndCash, sustainabilityMargin };
}
