/**
 * Verkaufsbestellungen aus den Billbee-Verkaeufen (Sale.orderRef): wie viele Bestellungen und wie viele Artikel je Bestellung
 * (Chris, 14.11.2026: "die Zahl der Verkaeufe musst du anhand der Bestellungen aus Billbee ziehen"). Speist den Versand je Stueck.
 */
export interface OrderStats {
  orders: number;
  units: number;
  /** Ø Artikel je Bestellung; null, wenn zu wenige Bestellungen mit Bestellnummer vorliegen. */
  itemsPerOrder: number | null;
}

/** Ab so vielen Bestellungen ist der Durchschnitt belastbar genug, den Standardwert zu ersetzen. */
export const MIN_ORDERS_FOR_MEASURE = 200;

export function orderStats(sales: ReadonlyArray<{ orderRef: string | null; qty: number }>): OrderStats {
  const orders = new Set<string>();
  let units = 0;
  for (const s of sales) {
    if (!s.orderRef) continue; // Verkaeufe ohne Bestellnummer sagen nichts ueber die Bestellgroesse
    orders.add(s.orderRef);
    units += s.qty;
  }
  return { orders: orders.size, units, itemsPerOrder: orders.size >= MIN_ORDERS_FOR_MEASURE && units > 0 ? units / orders.size : null };
}
