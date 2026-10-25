import type { PrismaClient } from "@prisma/client";
import type { SaleWindowKey } from "../parsing/date";
import { buildDashboardViewModel, type ArticleAggregate, type DashboardViewModel } from "./viewModel";
import { marketValueOf, type LatestQuote } from "./marketComparison";
import { DEFAULT_COST_SETTINGS, type CostSettingsValues } from "../pricing/costSettings";

export interface ArticleAggregatesResult {
  aggregates: ArticleAggregate[];
  costSettings: CostSettingsValues;
}

/**
 * Laedt die aktive (`active=true`) `CostSettings`-Version aus der DB, sonst
 * die Konzept-Defaults (KONZEPT §7.3). Wiederverwendet von allen Seiten, die
 * mit den Kostensaetzen rechnen, sowie von `/einstellungen` (aktueller Stand).
 */
export async function loadActiveCostSettings(prisma: PrismaClient): Promise<CostSettingsValues> {
  const active = await prisma.costSettings.findFirst({
    where: { active: true },
    orderBy: { version: "desc" },
  });
  if (!active) return DEFAULT_COST_SETTINGS;
  return {
    buyShippingUnderFive: active.buyShippingUnderFive,
    buyShippingFive: active.buyShippingFive,
    buyShippingShareFactor: active.buyShippingShareFactor,
    shippingSingle: active.shippingSingle,
    shippingPack: active.shippingPack,
    registeredCostPerShipment: active.registeredCostPerShipment,
    registeredThreshold: active.registeredThreshold,
    registeredStampsPerYear: active.registeredStampsPerYear,
    packagingSingle: active.packagingSingle,
    packagingPack: active.packagingPack,
    fixedYearlyEbayShop: active.fixedYearlyEbayShop,
    fixedYearlyBillbee: active.fixedYearlyBillbee,
    fixedYearlyLexoffice: active.fixedYearlyLexoffice,
    fixedYearlyPackagingLicense: active.fixedYearlyPackagingLicense,
    fixedYearlyOther: active.fixedYearlyOther,
    ebayCommissionRate: active.ebayCommissionRate,
    ebayCommissionVat: active.ebayCommissionVat,
    ebayCommissionFixed: active.ebayCommissionFixed,
    adFeeRateSingle: active.adFeeRateSingle,
    adFeeRateMin: active.adFeeRateMin,
    adFeeRateGood: active.adFeeRateGood,
  };
}

/**
 * Gemeinsamer Loader (PAGES_CONCEPT Vorarbeit): Prisma -> `ArticleAggregate[]`
 * + `CostSettingsValues`. Basis fuer den Dashboard-View-Model UND alle
 * eigenstaendigen Seiten (/sortiment, /top-flop, /empfehlungen, …), damit
 * nicht jede Seite ihre eigene Prisma-Query schreibt.
 */
export async function loadArticleAggregates(prisma: PrismaClient): Promise<ArticleAggregatesResult> {
  const [articles, latestMarketPrices, costSettings, itemFacts] = await Promise.all([
    prisma.article.findMany({
      where: { isCard: true },
      include: { saleWindows: true },
    }),
    prisma.marketPrice.findMany({
      orderBy: { fetchedAt: "desc" },
    }),
    loadActiveCostSettings(prisma),
    // eBay-Artikelnummern aus den Verkaufsberichten: Rueckfall, wenn der Shop-Abruf sie nicht geliefert hat.
    prisma.ebayListingFact.findMany({
      where: { articleId: { not: null } },
      select: { articleId: true, ebayItemId: true },
      orderBy: { reportTo: "desc" },
    }),
  ]);
  const factItemByArticle = new Map<string, string>();
  for (const f of itemFacts) if (f.articleId && f.ebayItemId && !factItemByArticle.has(f.articleId)) factItemByArticle.set(f.articleId, f.ebayItemId);

  // Juengsten Marktpreis je Artikel merken (Liste ist bereits fetchedAt-desc sortiert).
  const latestQuoteByArticle = new Map<string, LatestQuote>();
  for (const mp of latestMarketPrices) {
    if (latestQuoteByArticle.has(mp.articleId)) continue;
    let how: string | null = null;
    let usedCode: string | null = null;
    try {
      const parsed = mp.raw ? (JSON.parse(mp.raw) as { how?: string; code?: string }) : null;
      how = parsed?.how ?? null;
      usedCode = parsed?.code ?? null;
    } catch {
      how = null;
    }
    latestQuoteByArticle.set(mp.articleId, {
      priceFrom: mp.priceFrom,
      priceTrend: mp.priceTrend,
      priceAvg30: mp.priceAvg30,
      priceAvg7: mp.priceAvg7,
      priceAvg1: mp.priceAvg1,
      available: mp.available,
      fetchedAt: mp.fetchedAt,
      matchQuality: mp.matchQuality,
      priceMin: mp.priceMin,
      priceMax: mp.priceMax,
      variants: mp.variants,
      how,
      usedCode,
    });
  }

  const aggregates: ArticleAggregate[] = articles.map((article) => {
    const quote = latestQuoteByArticle.get(article.id);
    const windows: ArticleAggregate["windows"] = {};
    for (const sw of article.saleWindows) {
      const key = sw.window as SaleWindowKey;
      const existing = windows[key];
      if (existing) {
        // Mehrere Snapshots desselben Fensters (sollte durch die Unique-
        // Constraint kaum vorkommen) -- konservativ aufsummieren.
        existing.qty += sw.qty;
        existing.revenue += sw.revenue;
        existing.ek += sw.ek;
        existing.ebayFeeTotal += sw.ebayFeeTotal;
        existing.shippingCost += sw.shippingCost;
        existing.dbI += sw.dbI;
        existing.dbII += sw.dbII;
        existing.fixedCostShare += sw.fixedCostShare;
        existing.avgPrice = existing.qty > 0 ? existing.revenue / existing.qty : 0;
        existing.rank = existing.rank ?? sw.rank ?? null;
      } else {
        windows[key] = {
          qty: sw.qty,
          revenue: sw.revenue,
          ek: sw.ek,
          ebayFeeTotal: sw.ebayFeeTotal,
          shippingCost: sw.shippingCost,
          dbI: sw.dbI,
          dbII: sw.dbII,
          fixedCostShare: sw.fixedCostShare,
          avgPrice: sw.avgPrice,
          rank: sw.rank ?? null,
        };
      }
    }

    return {
      articleId: article.id,
      nameRaw: article.nameRaw,
      setCode: article.setCode,
      packQty: article.packQty,
      stock: article.stock,
      active: article.active,
      // Live-Preis aus dem eBay-Shop vor dem Billbee-Artikelstamm (siehe Article.ebayPrice).
      currentVk: article.ebayPrice ?? article.currentVk,
      vkSource: article.ebayPrice !== null ? "ebay" : article.currentVk !== null ? "billbee" : null,
      vkAt: article.ebayPrice !== null ? article.ebayPriceAt : null,
      currentEk: article.currentEk,
      ebayItemId: article.ebayItemId ?? factItemByArticle.get(article.id) ?? null,
      codeNameEn: article.codeNameEn,
      codeNameDe: article.codeNameDe,
      codeHint: article.codeHint,
      // Marktwert des Artikels (7-Tage-Schnitt x Pack), null bei mehrdeutiger Seltenheit.
      latestMarketTrend: quote ? marketValueOf(quote, article.packQty) : null,
      marketQuote: quote ?? null,
      windows,
    };
  });

  return { aggregates, costSettings };
}

/**
 * Speichert eine NEUE Kostensaetze-Version (KONZEPT §7.3/PAGES_CONCEPT §5):
 * kein Ueberschreiben -- die vorherige aktive Version wird deaktiviert
 * (`active=false`), die neue wird `active=true` mit hochgezaehlter `version`.
 */
export async function saveCostSettings(
  prisma: PrismaClient,
  values: CostSettingsValues
): Promise<CostSettingsValues & { id: string; version: number; active: boolean; createdAt: Date }> {
  const maxVersion = await prisma.costSettings.aggregate({ _max: { version: true } });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  await prisma.costSettings.updateMany({ where: { active: true }, data: { active: false } });
  return prisma.costSettings.create({ data: { ...values, version: nextVersion, active: true } });
}

export interface ImportBatchInfo {
  id: string;
  kind: string;
  window: string | null;
  windowFrom: Date | null;
  windowTo: Date | null;
  fileName: string | null;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: Date;
}

/** Letzte Import-Laeufe (Billbee-Fenster/eBay/Artikelstamm) fuer die Datenstand-Karte auf /einstellungen. */
export async function listRecentImportBatches(prisma: PrismaClient, limit = 20): Promise<ImportBatchInfo[]> {
  return prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Laedt alle Artikel + Fenster-Snapshots aus der DB und baut das Dashboard-View-Model. */
export async function loadDashboardViewModel(prisma: PrismaClient): Promise<DashboardViewModel> {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);
  return buildDashboardViewModel(aggregates, costSettings);
}
