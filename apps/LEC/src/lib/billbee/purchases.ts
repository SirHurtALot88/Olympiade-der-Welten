import type { PrismaClient } from "@prisma/client";

/**
 * Einkaeufe aus dem Billbee-Abgleich erkennen (Chris, 21.11.): Chris traegt beim Einkaufen den neuen Einkaufspreis in Billbee ein.
 * Steigt der Bestand zwischen zwei Abgleichen, gilt der Zuwachs als Einkauf zum EK nach dem Abgleich -- aendert sich der EK nicht,
 * wurde zum selben Preis eingekauft. Daraus entstehen ein gewogener Durchschnittspreis und eine Entwicklung des echten Einkaufspreises.
 */
export const PURCHASE_SOURCE = "Billbee-Abgleich";

export interface StockIncrease {
  articleId: string;
  before: number;
  after: number;
  /** EK je Stueck nach dem Abgleich (Billbee CostPrice). */
  ek: number;
}

/**
 * Eingekaufte Stueck = Bestandszuwachs plus die zwischen den Abgleichen verkauften Stueck (der Bestand ging dazwischen schon runter).
 * null, wenn nichts eingekauft wurde.
 */
export function purchasedQty(before: number, after: number, soldSince: number): number | null {
  const delta = after - before;
  if (!(delta > 0)) return null;
  const qty = Math.round(delta + Math.max(0, soldSince));
  return qty > 0 ? qty : null;
}

/** Schreibt je erkanntem Zuwachs einen Einkauf. sinceAt = Zeitpunkt des vorigen Abgleichs (null = unbekannt, dann zaehlt nur der Zuwachs). */
export async function recordPurchases(prisma: PrismaClient, increases: StockIncrease[], sinceAt: Date | null, now: Date): Promise<number> {
  let written = 0;
  for (const inc of increases) {
    if (!(inc.ek > 0)) continue;
    let sold = 0;
    if (sinceAt) {
      const agg = await prisma.sale.aggregate({ where: { articleId: inc.articleId, soldAt: { gt: sinceAt } }, _sum: { qty: true } });
      sold = agg._sum.qty ?? 0;
    }
    const qty = purchasedQty(inc.before, inc.after, sold);
    if (qty === null) continue;
    await prisma.purchase.create({ data: { articleId: inc.articleId, date: now, qty, unitEk: inc.ek, buyShipping: 0, source: PURCHASE_SOURCE } });
    written++;
  }
  return written;
}
