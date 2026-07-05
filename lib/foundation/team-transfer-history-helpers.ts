import type { GameState } from "@/lib/data/olyDataTypes";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function resolveTeamPlayerAcquisitionPrice(
  gameState: GameState,
  teamId: string,
  playerId: string,
): number | null {
  const rosterEntry = gameState.rosters.find((entry) => entry.teamId === teamId && entry.playerId === playerId);
  if (rosterEntry?.purchasePrice != null && Number.isFinite(rosterEntry.purchasePrice)) {
    return rosterEntry.purchasePrice;
  }

  const buyTransfer = [...gameState.transferHistory]
    .filter((entry) => entry.playerId === playerId && entry.transferType === "buy" && entry.toTeamId === teamId)
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt))[0];

  if (buyTransfer?.fee != null && Number.isFinite(buyTransfer.fee)) {
    return buyTransfer.fee;
  }

  return null;
}

export function resolveTeamSellProfit(
  gameState: GameState,
  teamId: string,
  playerId: string,
  sellFee: number | null | undefined,
): number | null {
  if (sellFee == null || !Number.isFinite(sellFee)) {
    return null;
  }

  const acquisitionPrice = resolveTeamPlayerAcquisitionPrice(gameState, teamId, playerId);
  if (acquisitionPrice == null || !Number.isFinite(acquisitionPrice)) {
    return null;
  }

  return roundMoney(sellFee - acquisitionPrice);
}
