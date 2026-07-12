/**
 * Organic marginal-utility squad builder — utility weight derivation (Master-Plan P1).
 *
 * See docs/design/draft-composition-organic-masterplan.md. PURE function, NOT wired into any
 * game/AI logic yet (P1 = pure functions + tests, no behaviour change). Derives the dimensionless
 * `OrganicUtilityWeights` multipliers from team identity (base character) with GM bias layered on
 * top (handwriting), mirroring the normalization + signal-direction conventions already used by
 * `normalizeManagementValue` / `computeIdentityLaneAppetite` / `applyGmBiasToLaneAppetite` in
 * lib/ai/ai-needs-picks-compare-service.ts (NOT modified here — only mirrored).
 *
 * These weights are dimensionless multipliers consumed later by ./utility.ts, which applies the
 * actual term-scaling of price vs. quality vs. wage etc. This file does NOT do that scaling; it
 * only decides how much each team cares about each term, relative to the others.
 */

import type { OrganicGmBiasInput, OrganicIdentityInput, OrganicUtilityWeights } from "./types";
import { ROSTER_MAX, ROSTER_MIN } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalize an identity field to 0..1. Mirrors `normalizeManagementValue` in
 * ai-needs-picks-compare-service.ts: values are on a dual 0–10 / 0–100 scale (legacy data may use
 * either), non-finite input falls back to a neutral 0.5, everything is clamped to 0..1.
 */
function normId(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  const normalized = Number(value);
  if (normalized <= 10) {
    return clamp(normalized / 10, 0, 1);
  }
  return clamp(normalized / 100, 0, 1);
}

/**
 * Normalize a GM bias field (1..10 scale, neutral 5) to a signed [-0.5, +0.5] range. Mirrors the
 * `norm` helper inside `applyGmBiasToLaneAppetite`: missing/non-finite input falls back to
 * `fallback` (neutral 5 by default), so an absent field contributes ~0 (no tilt).
 */
function normBias(value: number | undefined, fallback = 5): number {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp((raw - 1) / 9, 0, 1) - 0.5;
}

/**
 * Derive the organic utility weights (base from identity, modulated by GM bias).
 *
 * ASSUMPTION (documented per Master-Plan instructions): all weights are dimensionless multipliers
 * intentionally chosen to land in a modest, comparable ~0.2..2.0 range. The actual scaling between
 * price/quality/wage terms happens downstream in ./utility.ts — this function only decides the
 * *relative* appetite/aversion per team, not the absolute magnitude of any utility term.
 *
 * Base (from identity, 0–100 or legacy 0–10 management scale):
 *  - ambitionN, financesN, harmonyN: normId(identity field).
 *  - boardPressureN = 1 − normId(boardConfidence) (low board confidence ⇒ high pressure).
 *  - wWin base rises with ambitionN + boardPressureN (ambitious/under-pressure teams spend to win).
 *  - wThrift base rises with (1 − financesN) (poorer teams are more cost-averse).
 *  - wPatience base rises with financesN + (1 − boardPressureN) (secure/rich teams can afford to
 *    hold cash rather than deploy it).
 *  - wSustain base is moderate, rising slightly with (1 − financesN) (poorer teams watch wages more).
 *  - wAsset base is low-moderate (potential/future value is a secondary term for most teams).
 *
 * GM modulation (each applied as base + coef*normBias(field), mirroring the signal directions in
 * `applyGmBiasToLaneAppetite`):
 *  - starPriority↑ → wWin↑
 *  - valuePriority↑ → wThrift↑
 *  - cashPriority↑ → wPatience↑
 *  - riskTolerance↑ → wWin↑ and wSustain↓ (risk-tolerant GMs chase upside, worry less about wages)
 *  - wageSensitivity↑ → wSustain↑
 *  - rosterDepthPreference↑ → optTarget↑ (handled separately, see below)
 *  - eliteSmallRosterPreference↑ → optTarget↓ (below) and wWin per-slot↑ (fewer, better players)
 *  - sellForProfitAggression↑ → wAsset↑ slightly (values players as tradeable future assets)
 *
 * Every weight is clamped to [0, 3] (base + GM tilt can never push it negative or unbounded).
 *
 * `optTarget` starts from `identity.playerOpt`, then shifts by
 * `k*normBias(rosterDepthPreference) - k*normBias(eliteSmallRosterPreference)` (k ≈ 3.5, so a
 * strongly-biased GM moves it by roughly 1–2 roster slots), clamped to [ROSTER_MIN, ROSTER_MAX] and
 * rounded to the nearest integer.
 */
export function deriveUtilityWeights(
  identity: OrganicIdentityInput,
  gmBias: OrganicGmBiasInput,
): OrganicUtilityWeights {
  const ambitionN = normId(identity?.ambition);
  const financesN = normId(identity?.finances);
  const harmonyN = normId(identity?.harmony);
  const boardPressureN = 1 - normId(identity?.boardConfidence);
  // harmonyN is part of the identity contract (kept for future terms / documentation parity with
  // computeIdentityLaneAppetite); it does not drive any weight here yet.
  void harmonyN;

  // --- Base weights from identity, chosen to land in a modest ~0.2..2.0 range. ---
  const wWinBase = 0.5 + ambitionN * 0.7 + boardPressureN * 0.5;
  const wThriftBase = 0.4 + (1 - financesN) * 0.9;
  const wPatienceBase = 0.35 + financesN * 0.5 + (1 - boardPressureN) * 0.25;
  const wSustainBase = 0.5 + (1 - financesN) * 0.3;
  const wAssetBase = 0.3 + financesN * 0.2;

  // --- GM modulation on top of the identity base. ---
  const starPriority = normBias(gmBias?.starPriority);
  const valuePriority = normBias(gmBias?.valuePriority);
  const cashPriority = normBias(gmBias?.cashPriority);
  const riskTolerance = normBias(gmBias?.riskTolerance);
  const wageSensitivity = normBias(gmBias?.wageSensitivity);
  const eliteSmallRosterPreference = normBias(gmBias?.eliteSmallRosterPreference);
  const sellForProfitAggression = normBias(gmBias?.sellForProfitAggression);
  const rosterDepthPreference = normBias(gmBias?.rosterDepthPreference);

  // Profit-flip appetite: near 0 for a neutral/loyal club (base is deliberately tiny) and rises
  // strongly with sellForProfitAggression, so a trader GM actively realizes unrealized gains while a
  // stable/loyal GM barely reacts to them. Downstream, sellUtility multiplies this by
  // max(0, marketValue − purchasePrice); the coefficient is large because that gap is a raw MW figure
  // (comparable to saleValue) and the tilt must be able to flip an otherwise-negative sell for a trader.
  const wProfit = clamp(0.1 + sellForProfitAggression * 1.6, 0, 2);

  const wWin = clamp(
    wWinBase + starPriority * 0.6 + riskTolerance * 0.4 + eliteSmallRosterPreference * 0.3,
    0,
    3,
  );
  // Roster SIZE variety comes from optTarget + the rotation drive + budget-relative pricing (a depth
  // club's high opt → low budget/slot → it naturally buys cheaper, more players), NOT from suppressing
  // spend via wThrift — a strong depth→thrift makes clubs hoard instead of building out. Keep only a
  // light nudge so depth GMs lean value and elite GMs lean quality.
  const wThrift = clamp(
    wThriftBase + valuePriority * 0.6 + rosterDepthPreference * 0.2 - eliteSmallRosterPreference * 0.2,
    0,
    3,
  );
  const wPatience = clamp(wPatienceBase + cashPriority * 0.6, 0, 3);
  const wSustain = clamp(wSustainBase - riskTolerance * 0.4 + wageSensitivity * 0.6, 0, 3);
  const wAsset = clamp(wAssetBase + sellForProfitAggression * 0.3, 0, 3);

  // --- Soft roster target: identity base, shifted by depth vs. elite-small-roster GM bias. ---
  const K = 3.5;
  const optTargetRaw =
    (Number.isFinite(identity?.playerOpt) ? Number(identity.playerOpt) : (ROSTER_MIN + ROSTER_MAX) / 2) +
    K * rosterDepthPreference -
    K * eliteSmallRosterPreference;
  const optTarget = Math.round(clamp(optTargetRaw, ROSTER_MIN, ROSTER_MAX));

  return { wWin, wThrift, wSustain, wAsset, wPatience, wProfit, optTarget };
}

/**
 * Target contract length (in seasons) to offer when RENEWING a keeper at season end, clamped to the
 * [1, 5] range `previewContractRenewalAction`/`applyContractRenewalAction` expect (they both clamp via
 * `Math.max(1, Math.min(5, …))`).
 *
 * Two opposing pulls, both centered on the neutral midpoint 3:
 *  - SHORT (flexible flipping): high `shortContractPreference` and/or high `sellForProfitAggression` —
 *    a trader wants to keep players tradeable and its wage book flexible, so it renews on 1–2 seasons.
 *  - LONG (stability, wage-saving): high `longContractPreference`, OR a stable club with high
 *    `harmony` / high `boardConfidence` — it locks keepers in for 4–5 seasons to save future wage
 *    negotiation and signal continuity.
 *
 * PURE, no game state. Missing GM fields fall back to neutral (normBias fallback 5 ⇒ 0 tilt), so an
 * unbiased club renews at the neutral midpoint.
 */
export function resolveRenewalContractLength(
  identity: OrganicIdentityInput,
  gmBias: OrganicGmBiasInput,
): number {
  const shortPref = normBias(gmBias?.shortContractPreference);
  const longPref = normBias(gmBias?.longContractPreference);
  const profitAggression = normBias(gmBias?.sellForProfitAggression);
  // Identity stability signals, re-centered on 0 (so a neutral 0.5 club adds nothing).
  const harmonyTilt = normId(identity?.harmony) - 0.5;
  const boardConfidenceTilt = normId(identity?.boardConfidence) - 0.5;

  const stabilityPull = longPref + harmonyTilt + boardConfidenceTilt; // ∈ [-1.5, 1.5]
  const flexibilityPull = shortPref + profitAggression; // ∈ [-1.0, 1.0]

  const MID = 3;
  const raw = MID + 2.5 * stabilityPull - 2.5 * flexibilityPull;
  return Math.round(clamp(raw, 1, 5));
}
