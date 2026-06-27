import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";

function roundMoneyDelta(value: number) {
  return Number(value.toFixed(2));
}

function economyReferenceRatio(left: number, right: number) {
  return Math.max(left, right) / Math.max(0.01, Math.min(left, right));
}

function resolveLegacySafeEconomyReference(input: {
  baselineReference: number | null;
  catalogReference: number | null;
  currentMarketValue: number | null;
}) {
  const { baselineReference, catalogReference, currentMarketValue } = input;
  const baselineMismatchesCurrent =
    baselineReference != null &&
    currentMarketValue != null &&
    economyReferenceRatio(baselineReference, currentMarketValue) >= 3;
  const baselineMismatchesCatalog =
    baselineReference != null &&
    catalogReference != null &&
    economyReferenceRatio(baselineReference, catalogReference) >= 3;

  if ((baselineMismatchesCurrent || baselineMismatchesCatalog) && catalogReference != null) {
    return catalogReference;
  }

  return baselineReference ?? catalogReference;
}

export function getPlayerDisplayMarketValue(
  player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null,
) {
  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).marketValue;
}

/**
 * Season-0 reference MW for history tables and unrostered fallbacks.
 * Prefers playerBaselines, but falls back to imported display values when legacy baselines are on the wrong scale.
 */
export function getPlayerSeasonZeroMarketValueReference(input: {
  player?: Pick<Player, "id" | "marketValue" | "displayMarketValue" | "displaySalary" | "salaryDemand"> | null;
  gameState?: GameState | null;
  currentMarketValue?: number | null;
}) {
  const currentMarketValue = input.currentMarketValue ?? getPlayerDisplayMarketValue(input.player);
  const catalogReference = input.player ? getImportedPlayerDisplayMarketValue(input.player) : null;
  const baseline = input.gameState?.playerBaselines?.find((entry) => entry.playerId === input.player?.id) ?? null;
  const baselineReference = getPlayerBaselineEconomyReference(baseline)?.marketValue ?? null;

  return resolveLegacySafeEconomyReference({
    baselineReference,
    catalogReference,
    currentMarketValue,
  });
}

export function getPlayerSeasonZeroMarketValueDelta(input: {
  player?: Player | null;
  gameState?: GameState | null;
  currentMarketValue?: number | null;
}) {
  const marketValue = input.currentMarketValue ?? getPlayerDisplayMarketValue(input.player);
  if (marketValue == null) {
    return null;
  }

  const baselineValue = getPlayerSeasonZeroMarketValueReference({
    player: input.player,
    gameState: input.gameState,
    currentMarketValue: marketValue,
  });
  if (baselineValue == null) {
    return null;
  }

  const delta = marketValue - baselineValue;
  return Math.abs(delta) >= 0.01 ? roundMoneyDelta(delta) : null;
}

/**
 * Reference MW for the Teams-page delta column.
 * Compares live MW against the roster signing price at acquisition:
 * - Draft / carry-over: draft `purchasePrice`
 * - Mid-season signing: current-season `purchasePrice`
 * - Unrostered: season-0 baseline fallback
 */
export function getPlayerSeasonMarketValueReference(input: {
  player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null;
  rosterEntry?: Pick<RosterEntry, "currentValue" | "purchasePrice" | "joinedSeasonId"> | null;
  gameState?: GameState | null;
  currentMarketValue?: number | null;
}) {
  const currentMarketValue = input.currentMarketValue ?? getPlayerDisplayMarketValue(input.player);
  if (currentMarketValue == null) {
    return null;
  }

  const rosterEntry = input.rosterEntry;
  if (rosterEntry) {
    const signingReference = normalizeVisibleRosterMoney(rosterEntry.purchasePrice ?? null, currentMarketValue);
    if (signingReference != null) {
      return signingReference;
    }

    const fallbackAnchor = normalizeVisibleRosterMoney(rosterEntry.currentValue ?? null, currentMarketValue);
    if (fallbackAnchor != null) {
      return fallbackAnchor;
    }
  }

  const baseline = input.gameState?.playerBaselines?.find((entry) => entry.playerId === input.player?.id) ?? null;
  const baselineReference = getPlayerBaselineEconomyReference(baseline)?.marketValue ?? null;
  const catalogReference = input.player ? getImportedPlayerDisplayMarketValue(input.player) : null;
  return resolveLegacySafeEconomyReference({
    baselineReference,
    catalogReference,
    currentMarketValue,
  });
}

export function getPlayerDisplayMarketValueDelta(input: {
  player?: Player | null;
  rosterEntry?: Pick<RosterEntry, "currentValue" | "purchasePrice" | "joinedSeasonId"> | null;
  gameState?: GameState | null;
  currentMarketValue?: number | null;
}) {
  const marketValue = input.currentMarketValue ?? getPlayerDisplayMarketValue(input.player);
  if (marketValue == null) {
    return null;
  }

  const baselineValue = getPlayerSeasonMarketValueReference({
    player: input.player,
    rosterEntry: input.rosterEntry,
    gameState: input.gameState,
    currentMarketValue: marketValue,
  });
  if (baselineValue == null) {
    return null;
  }

  const delta = marketValue - baselineValue;
  return Math.abs(delta) >= 0.01 ? roundMoneyDelta(delta) : null;
}
