import type { ArticleAggregate } from "./viewModel";
import type { CostSettingsValues } from "../pricing/costSettings";
import { computeHk, computePriceCorridor, fixedCostPerUnit, type ShopVolume } from "../pricing/costEngine";
import { classifyAgainstFormula, computeMarketEk, formulaVk, type MarketStatus } from "../pricing/marketPrice";

/** Minimaler Auszug eines MarketPrice-Datensatzes, den die Vergleichs-Zeile braucht. */
export interface LatestQuote {
  priceFrom: number | null;
  priceTrend: number | null;
  priceAvg30: number | null;
  priceAvg7: number | null;
  priceAvg1: number | null;
  available: number | null;
  fetchedAt: Date;
  /** "eindeutig" | "mehrdeutig" bei automatischen Werten, null bei alten manuellen. */
  matchQuality?: string | null;
  /** Mehrdeutig: Trend der billigsten/teuersten Variante (je Karte). */
  priceMin?: number | null;
  priceMax?: number | null;
  variants?: number | null;
}

export interface MarketComparisonRow {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  packQty: number;
  /** Eigener VK -- aktueller Listen-VK, sonst realisierter Ø-VK (KONZEPT-Methodik). */
  ownVk: number;
  /** Realisierter EK/Stk (Referenz-Periode). */
  ek: number;
  corridor: { min: number; good: number; contribution: number };
  /** Cardmarket-Werte JE KARTE, wie in der Preisliste. */
  marketFrom: number | null;
  marketTrend: number | null;
  /** Marktwert des ARTIKELS = Trend (sonst 30-T-Schnitt) x Pack-Menge. Null wenn mehrdeutig. */
  marketValue: number | null;
  /** Mehrdeutig: Spanne des Artikel-Marktwerts (billigste..teuerste Variante, x Pack). */
  marketRange: { min: number; max: number; variants: number } | null;
  /** Wo der VK nach Chris' Formel bei heutigem Marktwert stuende. */
  formulaVk: number | null;
  /** Eigener EK deutlich (>50 %) ueber dem Marktwert: teuer eingekauft oder Markt gefallen. */
  ekAboveMarket: boolean;
  matchQuality: string | null;
  /** Aus Markt-ab x Packgroesse + Einkaufs-Versand (KONZEPT §7.2), null ohne "ab"-Preis. */
  marketEk: number | null;
  /** (ownVk - formulaVk) / formulaVk, null ohne Marktwert. */
  deltaPercent: number | null;
  status: MarketStatus;
  fetchedAt: Date;
  /** > 30 Tage alt. */
  stale: boolean;
}

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Baut die Marktpreis-Vergleichszeile eines Artikels (PAGES_CONCEPT §3):
 * eigener VK/EK vs. Cardmarket-Angaben, EK-Ableitung, Ampel-Status.
 */
export function buildMarketComparisonRow(
  a: ArticleAggregate,
  quote: LatestQuote,
  costSettings: CostSettingsValues,
  shop: ShopVolume | null
): MarketComparisonRow {
  const referenceAgg = a.windows["365"] ?? a.windows.all;
  const avgVkRealized = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.avgPrice : 0;
  const realizedEk = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.ek / referenceAgg.qty : 0;
  // Realisierter EK zuerst (Margen-Methodik), sonst der aktuelle Stamm-EK.
  const ek = realizedEk > 0 ? realizedEk : (a.currentEk ?? 0);
  const ownVk = a.currentVk && a.currentVk > 0 ? a.currentVk : avgVkRealized;
  const pack = Math.max(1, a.packQty);

  // Gleiche Kostenbasis wie das Sortiment (buildSortimentRow): shopweite Fixkosten + VK-abhaengiges Einschreiben.
  const hk = computeHk(
    {
      ek,
      kind: a.packQty > 1 ? "pack" : "single",
      packSize: a.packQty,
      fixedCostPerUnit: fixedCostPerUnit(shop?.units365d ?? 0, costSettings),
      vk: ownVk > 0 ? ownVk : null,
      shop,
    },
    costSettings
  );
  const corridor = computePriceCorridor(hk, ownVk || hk.total, costSettings);

  // Cardmarket-Preise gelten je Karte, der VK je Artikel (3er-Pack = 3 Karten).
  const perCard = quote.priceTrend ?? quote.priceAvg30 ?? null;
  const marketValue = quote.matchQuality === "mehrdeutig" || perCard === null ? null : perCard * pack;
  const marketRange =
    quote.matchQuality === "mehrdeutig" && quote.priceMin != null && quote.priceMax != null
      ? { min: quote.priceMin * pack, max: quote.priceMax * pack, variants: quote.variants ?? 0 }
      : null;

  const formula = marketValue !== null ? formulaVk(marketValue) : null;
  let status: MarketStatus = formula !== null ? classifyAgainstFormula(ownVk, formula) : "im_korridor";
  // Mehrdeutig: nur werten, wenn das Urteil fuer JEDE Variante gilt — zu guenstig
  // selbst gegen die billigste, zu teuer selbst gegen die teuerste. Sonst keine Ampel.
  if (marketRange) {
    if (classifyAgainstFormula(ownVk, formulaVk(marketRange.min)) === "zu_guenstig") status = "zu_guenstig";
    else if (classifyAgainstFormula(ownVk, formulaVk(marketRange.max)) === "zu_teuer") status = "zu_teuer";
  }
  const deltaPercent = formula !== null && ownVk > 0 ? (ownVk - formula) / formula : null;
  const ekAboveMarket = marketValue !== null && marketValue > 0 && ek > marketValue * 1.5;

  const marketEk = quote.priceFrom !== null ? computeMarketEk(quote.priceFrom, a.packQty, hk.buyShipping) : null;

  const stale = Date.now() - quote.fetchedAt.getTime() > STALE_MS;

  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    packQty: a.packQty,
    ownVk,
    ek,
    corridor: { min: corridor.vkMin, good: corridor.vkGood, contribution: corridor.vkContribution },
    marketFrom: quote.priceFrom,
    marketTrend: quote.priceTrend,
    marketValue,
    marketRange,
    formulaVk: formula,
    ekAboveMarket,
    matchQuality: quote.matchQuality ?? null,
    marketEk,
    deltaPercent,
    status,
    fetchedAt: quote.fetchedAt,
    stale,
  };
}
