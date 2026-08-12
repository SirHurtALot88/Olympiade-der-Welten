/**
 * Abschreibungs-Resistenz beim Vertragsausstieg — „behalten statt Verlust realisieren".
 *
 * Steht in einer EIGENEN Datei und nicht mehr im `contract-renewal-service`, weil sie inzwischen
 * von zwei Seiten gebraucht wird: von der Verlaengern-gegen-Ziehenlassen-Abwaegung dort UND von
 * der KI-Entscheidung ueber Vertragsaufloesungen (`ai-contract-dissolution-service`). Bliebe sie
 * im Vertragsdienst, importierten sich die beiden Module gegenseitig — dieselbe Ueberlegung wie
 * bei `season-transition-steps`. Der Vertragsdienst exportiert sie unveraendert weiter, damit
 * bestehende Aufrufer und Tests nichts merken.
 */

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function roundMoney(value: number | null | undefined, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

/**
 * Sell-parity for contract exits: exit cash (MW × factor) below purchase price is a realized cash loss
 * (e.g. bought for 20, exit fee 15 → −5). Bias toward a short renewal when eating that loss is
 * worse than bridging one more season — same spirit as lossResistance on market sells, no hard gate.
 */
export function resolveContractExitRenewBias(input: {
  exitProfitLoss: number | null;
  exitPurchasePrice: number | null;
  exitValue: number | null;
  renewalSalary: number | null;
  currentSalary: number | null;
  ratingValue: number;
  badValueContract: boolean;
}): {
  score: number;
  shouldBiasRenew: boolean;
  preferRenewOverExit: boolean;
  exitLossAbs: number;
  renewalYearCost: number;
} {
  const empty = {
    score: 0,
    shouldBiasRenew: false,
    preferRenewOverExit: false,
    exitLossAbs: 0,
    renewalYearCost: 0,
  };
  if (input.badValueContract) {
    return empty;
  }
  const purchasePrice = input.exitPurchasePrice;
  const exitValue = input.exitValue;
  if (purchasePrice == null || purchasePrice <= 0 || exitValue == null) {
    return empty;
  }
  if (exitValue + 0.005 >= purchasePrice) {
    return empty;
  }
  const exitLossAbs = Math.max(0, purchasePrice - exitValue);
  const renewalYearCost = roundMoney(input.renewalSalary ?? input.currentSalary ?? 0) ?? 0;
  const lossRatio = exitLossAbs / purchasePrice;
  const bracketScale = Math.max(6, purchasePrice * 0.15);
  const relativePart = clamp01(lossRatio / 0.35);
  const absolutePart = clamp01(exitLossAbs / bracketScale);
  const combined = 0.3 * relativePart + 0.7 * absolutePart;
  const ratingScale = input.ratingValue < 22 ? 0.35 : input.ratingValue < 30 ? 0.65 : 1;
  // Bridge TCO: one season salary is cheaper than realizing the exit write-down → renew and hope.
  const tcoFavorsRenew =
    renewalYearCost > 0 &&
    exitLossAbs >= renewalYearCost * 0.9 &&
    input.ratingValue >= 28;
  const score = Math.min(1, combined * ratingScale + (tcoFavorsRenew ? 0.28 : 0));
  const shouldBiasRenew = score >= 0.22 || tcoFavorsRenew;
  return {
    score,
    shouldBiasRenew,
    preferRenewOverExit: tcoFavorsRenew,
    exitLossAbs,
    renewalYearCost,
  };
}
