export function passesStrategicBuyGate(input: {
  score: number | null;
  price: number | null;
  plannedSellCount: number;
  rosterAfterSell: number | null;
  playerMin: number | null;
  teamCash: number | null;
  cashAfterBuy: number | null;
  cashBuffer?: number;
}) {
  const score = input.score ?? 0;
  const rosterAfterSell = input.rosterAfterSell;
  const playerMin = input.playerMin;
  const minGap =
    rosterAfterSell != null && playerMin != null ? Math.max(0, playerMin - rosterAfterSell) : 0;

  if (minGap > 0) {
    return { ok: true as const, reason: "min_roster_gap" };
  }

  if (input.teamCash != null && input.teamCash < 0) {
    return { ok: false as const, reason: "negative_cash" };
  }

  const cashAfterBuy = input.cashAfterBuy;
  const cashBuffer = input.cashBuffer ?? 6;
  if (cashAfterBuy != null && cashAfterBuy < cashBuffer) {
    return { ok: false as const, reason: "cash_buffer" };
  }

  if (score < 42 && input.plannedSellCount === 0) {
    return { ok: false as const, reason: "score_too_low_without_sell" };
  }

  if (score < 35) {
    return { ok: false as const, reason: "score_too_low" };
  }

  const price = input.price;
  if (price != null && price <= 0) {
    return { ok: false as const, reason: "invalid_price" };
  }

  return { ok: true as const, reason: "strategic_buy" };
}
