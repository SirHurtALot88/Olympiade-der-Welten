/**
 * Nachbestellen: wann ist ein Artikel faellig, und lohnt es sich ueberhaupt?
 *
 * Faellig (Chris, 12./13.11.):
 *  - Bestand auf/unter dem Mindestbestand aus Billbee -> immer faellig (bewusst gesetzt),
 *  - sonst rechnerisch: Artikel hat im letzten Jahr verkauft UND ist ausverkauft oder reicht nur noch <= 1,5 Monate.
 * Lohnt sich (nur fuer die rechnerische Faelligkeit): mindestens 2 Verkaeufe im Jahr, ODER ein Verkauf, der je Stueck
 * mindestens 3 € Deckungsbeitrag bringt. Kleine Artikel muessen sich also mehrfach verkaufen, teure mit gutem Gewinn
 * reichen auch einzeln. Nie verkaufte Artikel werden nicht vorgeschlagen (oft frisch eingestellt oder noch falsch bepreist).
 * Die Grenzen sind am echten Bestand gemessen (11.2026: etwa die Haelfte der rechnerisch faelligen Artikel besteht).
 * Zurueckgestellt ("erstmal nicht nachbestellen"): bis zum gesetzten Datum nicht faellig.
 */
export const REORDER_RULES = {
  coverMonthsDue: 1.5,
  /** Bestellmenge ohne Soll-Bestand: so viele Monate Verkaufstempo sollen danach im Lager sein */
  orderCoverMonths: 3,
  minUnitsPerYear: 2,
  minUnitProfitSingleSale: 3,
  defaultSnoozeDays: 90,
} as const;

export type ReorderReason = "mindestbestand" | "ausverkauft" | "reichweite";

export interface ReorderInput {
  active: boolean;
  stock: number;
  minStock: number | null;
  desiredStock: number | null;
  /** Verkaufte Stueck in 365 Tagen */
  units365: number;
  /** Verkaufte Stueck insgesamt (Historie) */
  unitsAll: number;
  /** Reichweite in Monaten; null ohne Tempo */
  coverMonths: number | null;
  /** Verkaufstempo in Stueck pro Monat; null/0 ohne Tempo */
  paceMonth?: number | null;
  /** Deckungsbeitrag (DB II) je Stueck, null wenn unbekannt */
  unitProfit: number | null;
  snoozeUntil: Date | null;
  now: Date;
}

export interface ReorderResult {
  due: boolean;
  reason: ReorderReason | null;
  qty: number | null;
  snoozedUntil: string | null;
  /** Warum der Artikel NICHT vorgeschlagen wird, obwohl er rechnerisch knapp ist (fuer den Drawer). */
  skipReason: string | null;
}

export function assessReorder(i: ReorderInput): ReorderResult {
  const none: ReorderResult = { due: false, reason: null, qty: null, snoozedUntil: null, skipReason: null };
  if (!i.active) return none;
  const snoozed = i.snoozeUntil !== null && i.snoozeUntil.getTime() > i.now.getTime();
  const snoozedUntil = snoozed ? i.snoozeUntil!.toISOString() : null;
  const qtyFor = (stock: number) => {
    if (i.desiredStock !== null && i.desiredStock > stock) return i.desiredStock - stock;
    const byPace = Math.ceil((i.paceMonth ?? 0) * REORDER_RULES.orderCoverMonths);
    const target = Math.max(byPace, (i.minStock ?? 0) + 1, 1);
    return Math.max(1, target - Math.max(stock, 0));
  };

  const belowMin = (i.minStock ?? 0) > 0 && i.stock <= (i.minStock as number);
  const computedBasis = i.units365 > 0 && (i.stock <= 0 || (i.coverMonths !== null && i.coverMonths <= REORDER_RULES.coverMonthsDue));

  if (!belowMin && !computedBasis) return { ...none, snoozedUntil };
  if (snoozed) return { ...none, snoozedUntil };

  if (belowMin) return { due: true, reason: "mindestbestand", qty: qtyFor(i.stock), snoozedUntil: null, skipReason: null };

  const worth = i.units365 >= REORDER_RULES.minUnitsPerYear || (i.units365 >= 1 && (i.unitProfit ?? 0) >= REORDER_RULES.minUnitProfitSingleSale);
  if (!worth) {
    return {
      ...none,
      skipReason: `Nicht zum Nachbestellen vorgeschlagen: ${i.units365} Verkauf im Jahr mit ${i.unitProfit !== null ? `${i.unitProfit.toFixed(2).replace(".", ",")} €` : "unbekanntem"} Gewinn je Stück (Grenze: ${REORDER_RULES.minUnitsPerYear} Verkäufe im Jahr oder ${REORDER_RULES.minUnitProfitSingleSale} € je Stück).`,
    };
  }
  return { due: true, reason: i.stock <= 0 ? "ausverkauft" : "reichweite", qty: qtyFor(i.stock), snoozedUntil: null, skipReason: null };
}
