import { boundCapitalOf, type ArticleAggregate } from "../dashboard/viewModel";
import type { RunRateBands } from "./bands";
import type { PurchaseFacts } from "./guardrails";

/**
 * Kapital & Tempo (COCKPIT_V2_KONZEPT §4 Modul 12): Was liegt im Regal, wie schnell geht es
 * raus, wie schnell kommt Neues rein. Bei der EUeR ist Ware sofort Aufwand -- deshalb ist
 * Einkaufstempo vs. Verkaufstempo der Gewinnhebel, nicht die Marge je Karte.
 */
export interface CapitalFacts {
  /** Σ Bestand × EK/Stk ueber aktive Artikel mit bekanntem EK (boundCapitalOf). */
  boundCapitalEk: number;
  /** Artikel, die in boundCapitalEk eingehen. */
  articlesWithKnownCapital: number;
  /** Aktive Artikel mit Bestand > 0, deren EK unbekannt ist -> Kapital nicht bezifferbar. */
  articlesStockWithoutEk: number;
  /** Deren Bestand in Stk (damit die Luecke eine Groesse hat). */
  stockUnitsWithoutEk: number;
  /** Σ Bestand × Listen-VK (potenzieller Umsatz), ueber aktive Artikel mit Listen-VK. */
  potentialRevenueVk: number;
  /** Σ Bestand (Stk) aktiver Artikel. */
  stockUnits: number;
  /** Ø Wareneinsatz je Monat (Band A, letzte 30 T) und (Band B+C gewichtet, 31–365 T). */
  wareneinsatzPerMonth30: number;
  wareneinsatzPerMonth365: number;
  /** Reichweite in Monaten = gebundenes Kapital / Ø Wareneinsatz je Monat (365-T-Basis); null ohne Basis. */
  reachMonths: number | null;
  /** GMROI = Σ DB I (365 T) ÷ gebundenes Kapital; Fenster mit Menge > 0 und EK 0 zaehlen nicht mit. null ohne Kapital. */
  gmroi: number | null;
  /** Artikel mit Verkaeufen in 365 T, aber ohne EK im Fenster -- fallen aus Reichweite und GMROI heraus. */
  salesWithoutEkArticles: number;
  /** Deren Anteil am 365-T-Umsatz (0..1); null ohne Umsatz. */
  salesWithoutEkRevenueShare: number | null;
  /** Einkaufstempo: Ø Einkauf je Monat aus den letzten 90 T der Purchase-Tabelle; null ohne Daten. */
  purchasePerMonth90: number | null;
  /** true, wenn ein Bestandsimport vorliegt (irgendein aktiver Artikel). */
  stockImported: boolean;
}

export function computeCapital(articles: ArticleAggregate[], bands: RunRateBands, purchases: PurchaseFacts): CapitalFacts {
  let boundCapitalEk = 0;
  let articlesWithKnownCapital = 0;
  let articlesStockWithoutEk = 0;
  let stockUnitsWithoutEk = 0;
  let potentialRevenueVk = 0;
  let stockUnits = 0;
  let stockImported = false;
  for (const a of articles) {
    if (!a.active) continue;
    stockImported = true;
    stockUnits += a.stock;
    if (a.stock > 0 && a.currentVk !== null && a.currentVk > 0) potentialRevenueVk += a.stock * a.currentVk;
    const cap = boundCapitalOf(a);
    if (cap === null) continue;
    const hasEk = (a.currentEk !== null && a.currentEk > 0) || cap > 0;
    if (a.stock > 0 && !hasEk) {
      articlesStockWithoutEk++;
      stockUnitsWithoutEk += a.stock;
      continue;
    }
    if (a.stock > 0) {
      boundCapitalEk += cap;
      articlesWithKnownCapital++;
    }
  }

  // Reichweite/GMROI nur ueber Fenster mit bekanntem EK (Opus 14.11.): fehlt der EK, stuende sonst ein
  // Wareneinsatz von 0 im Nenner bzw. ein voller Erloes als Rohertrag im Zaehler.
  let ek365 = 0;
  let dbI365 = 0;
  let revenueAll365 = 0;
  let revenueNoEk365 = 0;
  let salesWithoutEkArticles = 0;
  for (const art of articles) {
    const w = art.windows["365"];
    if (!w || w.qty <= 0) continue;
    revenueAll365 += w.revenue;
    if (w.ek > 0) {
      ek365 += w.ek;
      dbI365 += w.dbI;
    } else {
      revenueNoEk365 += w.revenue;
      salesWithoutEkArticles++;
    }
  }
  const gmroi = boundCapitalEk > 0 && ek365 > 0 ? dbI365 / boundCapitalEk : null;
  const salesWithoutEkRevenueShare = revenueAll365 > 0 ? revenueNoEk365 / revenueAll365 : null;

  const [a, b, c] = bands.bands;
  const wareneinsatzPerMonth30 = a?.ekPerMonth ?? 0;
  // Baender B und C nach Laenge gewichtet -> Ø je Monat ueber Tage 31–365.
  const monthsBC = (b?.months ?? 0) + (c?.months ?? 0);
  const wareneinsatzPerMonth365 =
    monthsBC > 0 ? ((b?.ekPerMonth ?? 0) * (b?.months ?? 0) + (c?.ekPerMonth ?? 0) * (c?.months ?? 0) + wareneinsatzPerMonth30 * 1) / (monthsBC + 1) : wareneinsatzPerMonth30;

  const reachMonths = boundCapitalEk > 0 && ek365 > 0 ? boundCapitalEk / (ek365 / 12) : null;
  const purchasePerMonth90 = purchases.spentLast90d === null ? null : purchases.spentLast90d / 3;

  return {
    boundCapitalEk,
    articlesWithKnownCapital,
    articlesStockWithoutEk,
    stockUnitsWithoutEk,
    potentialRevenueVk,
    stockUnits,
    wareneinsatzPerMonth30,
    wareneinsatzPerMonth365,
    reachMonths,
    gmroi,
    salesWithoutEkArticles,
    salesWithoutEkRevenueShare,
    purchasePerMonth90,
    stockImported,
  };
}
