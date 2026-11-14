import { computeEbayFees } from "./costEngine";
import type { CostSettingsValues } from "./costSettings";

/**
 * Betriebszahlen je Jahr, von Chris genannt (Billbee-Bericht "Verkaeufe pro Tag", eBay "Pruefen Sie Ihren Umsatz", Lexoffice-Belege).
 * Quelle und Rechenweg: docs/enterich-cards/BETRIEBSZAHLEN.md. Zahlen mit `derived: true` sind aus Veraenderungsraten zurueckgerechnet.
 * Keine Datenbank: Chris pflegt diese Werte hier (neues Jahr = neue Zeile).
 */
export interface YearFacts {
  year: number;
  /** Teiljahr: bis zu diesem Datum (Text). */
  partialUntil?: string;
  purchaseOrders: number | null;
  purchaseSum: number | null;
  /** Zeitraum, bis zu dem die Einkaufszahlen reichen, wenn kuerzer als der Umsatz (Text). */
  purchaseUntil?: string;
  salesOrders: number | null;
  revenueBillbee: number | null;
  revenueEbay: number | null;
  /** Umsatz auf den Zeitraum der Einkaufszahlen gekuerzt (nur Teiljahr), Basis der Einkaufsquote. */
  revenueForPurchaseQuote?: number;
  pieces: number | null;
  ebayCosts: number | null;
  packagingShipping: number | null;
  derived?: boolean;
}

export const YEAR_FACTS: YearFacts[] = [
  { year: 2022, purchaseOrders: null, purchaseSum: null, salesOrders: 2244, revenueBillbee: 17945.38, revenueEbay: null, pieces: null, ebayCosts: null, packagingShipping: null },
  { year: 2023, purchaseOrders: 935, purchaseSum: 7934, salesOrders: 2147, revenueBillbee: 19038.05, revenueEbay: 19660, pieces: 3117, ebayCosts: null, packagingShipping: 2757, derived: true },
  { year: 2024, purchaseOrders: 1366, purchaseSum: 11866, salesOrders: 2528, revenueBillbee: 26263.97, revenueEbay: 27630.02, pieces: 3828, ebayCosts: 8694.68, packagingShipping: 3327 },
  { year: 2025, purchaseOrders: 968, purchaseSum: 8656, salesOrders: 1944, revenueBillbee: 23093.02, revenueEbay: 24135.12, pieces: 3055, ebayCosts: 7993.22, packagingShipping: 2870 },
  {
    year: 2026,
    partialUntil: "14.11.",
    purchaseOrders: 753,
    purchaseSum: 8061,
    purchaseUntil: "31.10.",
    salesOrders: 1658,
    revenueBillbee: 22029.21,
    revenueEbay: 23448.7,
    revenueForPurchaseQuote: (23448.7 * 304) / 318,
    pieces: 2481,
    ebayCosts: null,
    packagingShipping: 2409,
  },
];

export interface YearMetrics {
  year: number;
  /** Ø Warenkorb: Billbee-Umsatz je Bestellung. */
  basket: number | null;
  /** Artikel je Verkaufsbestellung (Stueck eBay / Bestellungen Billbee). */
  itemsPerOrder: number | null;
  /** Ø Einkaufsbestellung in EUR. */
  purchaseAvg: number | null;
  /** Einkauf in % vom Umsatz (Einkaeufe sind nicht Wareneinsatz: Lageraufbau/-abbau verzerrt einzelne Jahre). */
  purchaseQuote: number | null;
  /** Verpackung + Versand je Verkaufsbestellung. */
  packagingPerOrder: number | null;
  /** Verpackung + Versand in % vom Umsatz. */
  packagingQuote: number | null;
  /** Grober Rest: eBay-Umsatz - eBay-Verkaufskosten - Einkaeufe - Verpackung/Versand (ohne uebrige Fixkosten, Lager). Nur wo alle Zahlen vorliegen. */
  rest: number | null;
}

const div = (a: number | null, b: number | null): number | null => (a !== null && b !== null && b > 0 ? a / b : null);

export function yearMetrics(f: YearFacts): YearMetrics {
  const rest =
    f.revenueEbay !== null && f.ebayCosts !== null && f.purchaseSum !== null && f.packagingShipping !== null
      ? f.revenueEbay - f.ebayCosts - f.purchaseSum - f.packagingShipping
      : null;
  return {
    year: f.year,
    basket: div(f.revenueBillbee, f.salesOrders),
    itemsPerOrder: div(f.pieces, f.salesOrders),
    purchaseAvg: div(f.purchaseSum, f.purchaseOrders),
    purchaseQuote: div(f.purchaseSum, f.revenueForPurchaseQuote ?? f.revenueEbay),
    packagingPerOrder: div(f.packagingShipping, f.salesOrders),
    packagingQuote: div(f.packagingShipping, f.revenueEbay),
    rest,
  };
}

export interface FeeYearCheck {
  year: number;
  revenue: number;
  orders: number;
  /** Provision + Anzeigen + Fixgebuehr je Bestellung laut Kostenmodell. */
  modelFees: number;
  shopFee: number;
  modelTotal: number;
  actual: number;
  /** Modell inkl. Shop-Abo minus eBay-Wert (EUR). */
  diff: number;
}

/**
 * eBay-Verkaufskosten laut eBay-Jahresbericht gegen das Kostenmodell: Provision und Anzeigen auf den Umsatz, Fixgebuehr je Bestellung, plus
 * Shop-Abo (die eBay-Verkaufskosten enthalten es). Ein Wert zur Plausibilitaet, kein Ersatz fuer den Satz je Artikel: eBay und EUER weichen durch
 * Verschiebungen und Privatverkaeufe voneinander ab.
 */
export function feeYearChecks(facts: YearFacts[], settings: CostSettingsValues): FeeYearCheck[] {
  const out: FeeYearCheck[] = [];
  for (const f of facts) {
    if (f.revenueEbay === null || f.ebayCosts === null || f.salesOrders === null) continue;
    // Provision/Anzeigen als Anteil vom Umsatz, Fixgebuehr je Bestellung: computeEbayFees mit Mittelwert-Preis je Bestellung
    const basket = f.revenueEbay / f.salesOrders;
    const perOrder = computeEbayFees(basket, settings.adFeeRateSingle, settings).total;
    const modelFees = perOrder * f.salesOrders;
    const shopFee = settings.fixedYearlyEbayShop;
    const modelTotal = modelFees + shopFee;
    out.push({ year: f.year, revenue: f.revenueEbay, orders: f.salesOrders, modelFees, shopFee, modelTotal, actual: f.ebayCosts, diff: modelTotal - f.ebayCosts });
  }
  return out;
}
