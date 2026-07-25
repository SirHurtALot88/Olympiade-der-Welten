import type { ArticleAggregate } from "./viewModel";
import type { CostSettingsValues } from "../pricing/costSettings";
import { computeHk, computePriceCorridor } from "../pricing/costEngine";
import { classifyMarketStatus, computeMarketEk, type MarketStatus } from "../pricing/marketPrice";

/** Minimaler Auszug eines MarketPrice-Datensatzes, den die Vergleichs-Zeile braucht. */
export interface LatestQuote {
  priceFrom: number | null;
  priceTrend: number | null;
  priceAvg30: number | null;
  priceAvg7: number | null;
  priceAvg1: number | null;
  available: number | null;
  fetchedAt: Date;
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
  corridor: { min: number; good: number };
  marketFrom: number | null;
  marketTrend: number | null;
  /** Aus Markt-ab x Packgroesse + Einkaufs-Versand (KONZEPT §7.2), null ohne "ab"-Preis. */
  marketEk: number | null;
  /** (ownVk - marketTrend) / marketTrend, null ohne Markt-Trend. */
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
  costSettings: CostSettingsValues
): MarketComparisonRow {
  const referenceAgg = a.windows["365"] ?? a.windows.all;
  const avgVkRealized = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.avgPrice : 0;
  const ek = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.ek / referenceAgg.qty : 0;
  const ownVk = a.currentVk && a.currentVk > 0 ? a.currentVk : avgVkRealized;

  const hk = computeHk(
    { ek, kind: a.packQty > 1 ? "pack" : "single", packSize: a.packQty, fixedCostPerUnit: 0 },
    costSettings
  );
  const corridor = computePriceCorridor(hk.total, ownVk || hk.total, costSettings);

  const trend = quote.priceTrend ?? 0;
  const status = trend > 0 ? classifyMarketStatus(ownVk, trend) : "im_korridor";
  const deltaPercent = trend > 0 && ownVk > 0 ? (ownVk - trend) / trend : null;

  const marketEk = quote.priceFrom !== null ? computeMarketEk(quote.priceFrom, a.packQty, hk.buyShipping) : null;

  const stale = Date.now() - quote.fetchedAt.getTime() > STALE_MS;

  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    packQty: a.packQty,
    ownVk,
    ek,
    corridor: { min: corridor.vkMin, good: corridor.vkGood },
    marketFrom: quote.priceFrom,
    marketTrend: quote.priceTrend,
    marketEk,
    deltaPercent,
    status,
    fetchedAt: quote.fetchedAt,
    stale,
  };
}
