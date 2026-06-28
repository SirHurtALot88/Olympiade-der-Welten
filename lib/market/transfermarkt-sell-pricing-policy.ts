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
  const salePrice =
    basePrice != null ? round(basePrice * policy.combinedMultiplier, 2) : input.baseBreakdown.salePrice;

  return {
    policy,
    breakdown: {
      ...input.baseBreakdown,
      saleFactor,
      salePrice,
    },
  };
}
