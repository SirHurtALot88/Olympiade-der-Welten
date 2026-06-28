import type { GameState, Team } from "@/lib/data/olyDataTypes";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function countTeamSeasonSells(gameState: GameState, teamId: string, seasonId = gameState.season.id) {
  return gameState.transferHistory.filter(
    (entry) => entry.transferType === "sell" && entry.fromTeamId === teamId && entry.seasonId === seasonId,
  ).length;
}

/** 0–1 pressure signal — raises sell intent but never forces a minimum sell count. */
export function assessTeamSellRunwayPressure(input: {
  gameState: GameState;
  team: Team;
  salaryTotal: number;
  seasonId?: string;
}) {
  const cash = input.team.cash ?? 0;
  const salaryTotal = Math.max(0, input.salaryTotal);
  const seasonSells = countTeamSeasonSells(input.gameState, input.team.teamId, input.seasonId);
  const salaryExceedsCash = cash > 0 && salaryTotal > cash * 0.85;
  const tightCashRunway = cash > 0 && salaryTotal > 0 && cash < Math.max(12, salaryTotal * 0.95);
  const lowSellActivity = seasonSells === 0 && salaryTotal > 0 && cash < salaryTotal * 1.15;

  const cashPressureScore = round(
    clamp(
      (salaryExceedsCash ? 0.52 : 0) +
        (tightCashRunway ? 0.28 : 0) +
        (lowSellActivity ? 0.12 : 0) +
        (cash <= 0 && salaryTotal > 0 ? 0.35 : 0),
      0,
      1,
    ),
    3,
  );

  return {
    seasonSells,
    salaryExceedsCash,
    tightCashRunway,
    lowSellActivity,
    cashPressureScore,
  };
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

export function getProfitWindowSellThreshold(cashPressureScore: number) {
  if (cashPressureScore >= 0.65) return 30;
  if (cashPressureScore >= 0.45) return 34;
  return 38;
}

export function isAttractiveProfitSell(input: {
  expectedSellValue: number | null;
  marketValue: number | null;
  purchasePrice?: number | null;
  cashPressureScore: number;
}) {
  const { expectedSellValue, marketValue, purchasePrice, cashPressureScore } = input;
  if (expectedSellValue == null || marketValue == null || marketValue <= 0) {
    return false;
  }
  const vsMarket = (expectedSellValue - marketValue) / marketValue;
  const vsPurchase =
    purchasePrice != null && purchasePrice > 0 ? (expectedSellValue - purchasePrice) / purchasePrice : null;
  const minMarketEdge = cashPressureScore >= 0.5 ? 0.05 : 0.1;
  const minPurchaseEdge = cashPressureScore >= 0.5 ? 0 : 0.08;
  return vsMarket >= minMarketEdge || (vsPurchase != null && vsPurchase >= minPurchaseEdge);
}
