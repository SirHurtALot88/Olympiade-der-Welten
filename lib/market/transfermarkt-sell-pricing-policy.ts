import type { GameState, Player, RosterEntry, TeamIdentity } from "@/lib/data/olyDataTypes";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import type { TransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";

export type SellPricingPolicyBreakdown = {
  seasonStartDiscount: number;
  timingMultiplier: number;
  liquidationMalus: number;
  identityFitMultiplier: number;
  combinedMultiplier: number;
  notes: string[];
};

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Absolute-loss cap (in MW units — same units as market value / fees; "5 mio" = 5) tolerated on ANY
 * sale before the value-aware floor bites. See resolveValueAwareSellFloor.
 */
export const VALUE_AWARE_SELL_MAX_ABS_LOSS = 5;
/** Percentage-loss cap on a sale (25 % of MW). See resolveValueAwareSellFloor. */
export const VALUE_AWARE_SELL_MAX_PCT_LOSS = 0.25;

/**
 * Owner rule: a player should never lose more than max(25 % of MW, 5 mio) on a sale. Expressed as a
 * realized-sale-price FLOOR that is the higher of the two allowances (whichever LOSES LESS money):
 *
 *     floor = min(0.75 × MW, MW − 5)
 *
 * - MW > 20 → the 25 % term wins (0.75 × MW), capping the loss at a quarter of the value.
 * - MW ≤ 20 → the absolute term wins (MW − 5), capping the loss at 5 mio (a larger % is tolerated
 *   because the absolute money at stake is small).
 * - MW ≤ 5 → MW − 5 ≤ 0 ⇒ floor ≤ 0 ⇒ no effective protection (a trivial-value sale can go to ~0).
 *
 * Applies to NON-distressed (voluntary) sells only; distressed sellers (cash < 0) retain the lower
 * base-0.65 behaviour so forced sales can still clear. PURE.
 */
export function resolveValueAwareSellFloor(marketValue: number | null | undefined): number {
  if (marketValue == null || !Number.isFinite(marketValue) || marketValue <= 0) {
    return 0;
  }
  return Math.min(
    (1 - VALUE_AWARE_SELL_MAX_PCT_LOSS) * marketValue,
    marketValue - VALUE_AWARE_SELL_MAX_ABS_LOSS,
  );
}

/**
 * True when a realized sale price breaches the value-aware floor — i.e. the loss vs MW exceeds
 * max(25 % of MW, 5 mio). Shared by the mechanical price floor (Part 1) and the organic "think twice"
 * decision gate (Part 2) so both use identical math. PURE.
 */
export function isBigHaircut(
  marketValue: number | null | undefined,
  realizedPrice: number | null | undefined,
): boolean {
  if (marketValue == null || !Number.isFinite(marketValue) || marketValue <= 0) {
    return false;
  }
  if (realizedPrice == null || !Number.isFinite(realizedPrice)) {
    return false;
  }
  // 1e-6 tolerance so a price sitting exactly on the floor (rounding noise) is not treated as a breach.
  return realizedPrice < resolveValueAwareSellFloor(marketValue) - 1e-6;
}

/**
 * Distress signal for the sell-pricing stage: a seller is DISTRESSED when its cash is negative — the
 * exact input Stage-B's liquidationMalus already keys off (getLiquidationMalus checks team.cash < 0).
 * Distressed sellers are exempt from the raised value-aware floor so forced fire-sales can still clear
 * (they retain the lower base-0.65 behaviour). PURE.
 */
export function isSellerDistressed(gameState: GameState, teamId: string): boolean {
  const team = gameState.teams?.find((entry) => entry.teamId === teamId);
  if (!team) {
    return false;
  }
  return Number.isFinite(team.cash) && team.cash < 0;
}

function getIdentityFitMultiplier(gameState: GameState, teamId: string, player: Player | null | undefined) {
  if (!player) {
    return 1;
  }

  const teamPlayers = gameState.players.filter((entry) =>
    gameState.rosters.some((roster) => roster.teamId === teamId && roster.playerId === entry.id),
  );
  const fit = calculateTransfermarktFit(player, teamPlayers, { teamId }).teamFit;
  if (fit == null || !Number.isFinite(fit)) {
    return 1;
  }

  // Strong team fit keeps resale value; poor fit trims the achievable price.
  return round(clamp(0.92 + fit * 0.1, 0.88, 1.08), 3);
}

function getTimingMultiplier(gameState: GameState) {
  const window = getTransferWindowStatus(gameState);
  const phase = gameState.gamePhase ?? "season_active";

  if (phase === "transfer_sell_phase" || window.label === "Verkaufsfenster") {
    return 1;
  }
  if (window.label === "Saisonstart-Setup") {
    return 0.95;
  }
  if (phase === "preseason_management") {
    return 0.98;
  }
  return 0.92;
}

function getLiquidationMalus(gameState: GameState, teamId: string, rosterAfter: number, playerMin: number | null) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    return 1;
  }

  let malus = 1;
  if (Number.isFinite(team.cash) && team.cash < 0) {
    malus *= 0.88;
  }
  if (playerMin != null && rosterAfter < playerMin) {
    malus *= 0.9;
  }
  return round(malus, 3);
}

export function buildSellPricingPolicyBreakdown(input: {
  gameState: GameState;
  teamId: string;
  player: Player | null | undefined;
  rosterEntry?: RosterEntry | null;
  baseBreakdown: TransfermarktSaleFactorBreakdown;
  rosterAfter: number;
}): SellPricingPolicyBreakdown {
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
  const profile = getTeamStrategyProfile(input.gameState, input.teamId);
  const playerMin = identity?.playerMin ?? profile?.rosterMinTarget ?? null;
  const notes: string[] = [];

  const seasonStartDiscount =
    input.baseBreakdown.factorSource === "fallback_no_ranked_group" ? 0.92 : 1;
  if (seasonStartDiscount < 1) {
    notes.push("Saisonstart ohne Ranking: leichter Preisabschlag.");
  }

  const timingMultiplier = getTimingMultiplier(input.gameState);
  if (timingMultiplier < 1) {
    notes.push("Verkauf ausserhalb des idealen Verkaufsfensters.");
  }

  const liquidationMalus = getLiquidationMalus(input.gameState, input.teamId, input.rosterAfter, playerMin);
  if (liquidationMalus < 1) {
    notes.push("Liquidations-/Kaderdruck reduziert den erzielbaren Preis.");
  }

  const identityFitMultiplier = getIdentityFitMultiplier(input.gameState, input.teamId, input.player);
  if (identityFitMultiplier > 1.02) {
    notes.push("Starker Team-Fit stuetzt den Verkaufspreis.");
  } else if (identityFitMultiplier < 0.98) {
    notes.push("Schwacher Team-Fit drueckt den Verkaufspreis.");
  }

  const combinedMultiplier = round(
    seasonStartDiscount * timingMultiplier * liquidationMalus * identityFitMultiplier,
    3,
  );

  return {
    seasonStartDiscount,
    timingMultiplier,
    liquidationMalus,
    identityFitMultiplier,
    combinedMultiplier,
    notes,
  };
}

export function applySellPricingPolicyToBreakdown(input: {
  gameState: GameState;
  teamId: string;
  player: Player | null | undefined;
  rosterEntry?: RosterEntry | null;
  baseBreakdown: TransfermarktSaleFactorBreakdown;
  rosterAfter: number;
}) {
  const policy = buildSellPricingPolicyBreakdown(input);
  const baseFactor = input.baseBreakdown.saleFactor ?? 1;
  const basePrice = input.baseBreakdown.salePrice ?? input.baseBreakdown.baseMarketValue;
  const saleFactor = round(baseFactor * policy.combinedMultiplier, 3);
  // Stage-B price BEFORE the value-aware floor — the natural market price. Kept on the result so the
  // organic "think twice" gate (Part 2) can see the true haircut the floor would otherwise mask.
  const preFloorSalePrice =
    basePrice != null ? round(basePrice * policy.combinedMultiplier, 2) : input.baseBreakdown.salePrice;

  // VALUE-AWARE FLOOR (Part 1): for NON-distressed (voluntary) sells, never realize below
  // min(0.75 × MW, MW − 5) — cap the loss at max(25 % of MW, 5 mio). Distressed sellers (cash < 0) are
  // exempt so forced fire-sales still clear at the lower base-0.65 price. Never LOWERS a price that is
  // already above the floor (Math.max semantics).
  const marketValue = input.baseBreakdown.baseMarketValue;
  const distressed = isSellerDistressed(input.gameState, input.teamId);
  let salePrice = preFloorSalePrice;
  let flooredSaleFactor = saleFactor;
  let floorApplied = false;
  if (
    !distressed &&
    marketValue != null &&
    marketValue > 0 &&
    preFloorSalePrice != null &&
    Number.isFinite(preFloorSalePrice)
  ) {
    const floor = resolveValueAwareSellFloor(marketValue);
    if (floor > preFloorSalePrice) {
      salePrice = round(floor, 2);
      flooredSaleFactor = round(salePrice / marketValue, 3);
      floorApplied = true;
    }
  }

  return {
    policy,
    preFloorSalePrice,
    floorApplied,
    breakdown: {
      ...input.baseBreakdown,
      saleFactor: flooredSaleFactor,
      salePrice,
    },
  };
}
