import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { normalizeVisibleRosterMoney } from "@/lib/market/transfermarkt-sale-factor";
import { getPlayerBaselineEconomyReference } from "@/lib/players/player-baseline-service";

export function getPlayerDisplayMarketValue(
  player?: Pick<Player, "id" | "marketValue" | "displayMarketValue"> | null,
) {
  return resolvePlayerEconomyContract({ playerId: player?.id ?? null, player }).marketValue;
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
  return getPlayerBaselineEconomyReference(baseline)?.marketValue ?? null;
}

export function getPlayerDisplayMarketValueDelta(input: {
  player?: Player | null;
  rosterEntry?: Pick<RosterEntry, "currentValue" | "purchasePrice" | "joinedSeasonId"> | null;
  gameState?: GameState | null;
}) {
  const marketValue = getPlayerDisplayMarketValue(input.player);
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
  return Math.abs(delta) >= 0.01 ? Number(delta.toFixed(2)) : null;
}
