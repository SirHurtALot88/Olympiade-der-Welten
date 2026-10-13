import type { PrismaClient } from "@prisma/client";
import { YGO_CARDINFO_URL } from "../images/ygoprodeck";
import {
  CM_PRICE_GUIDE_URL,
  CM_PRODUCTS_URL,
  buildCatalogIndex,
  resolveMarket,
  type CmPrice,
  type CmProduct,
} from "./catalog";

export const MARKET_SOURCE = "cardmarket-priceguide";

export interface MarketSyncReport {
  priceGuideDate: string | null;
  articles: number;
  eindeutig: number;
  mehrdeutig: number;
  keiner: Record<"kein_set_code" | "set_code_unbekannt" | "kein_produkt", number>;
  startedAt: string;
  finishedAt: string;
}

async function getJson<T>(fetchFn: typeof fetch, url: string): Promise<T> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`${new URL(url).host} antwortet mit HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Holt die Cardmarket-Preisliste und schreibt je Kartenartikel genau einen
 * aktuellen Marktwert-Datensatz (Quelle cardmarket-priceguide). Preise sind je
 * EINZELNER Karte; Pack-Artikel rechnen beim Vergleich mit x packQty.
 */
export async function syncMarketPrices(prisma: PrismaClient, fetchFn: typeof fetch = fetch): Promise<MarketSyncReport> {
  const startedAt = new Date().toISOString();
  const [guide, products, ygo] = await Promise.all([
    getJson<{ createdAt?: string; priceGuides: CmPrice[] }>(fetchFn, CM_PRICE_GUIDE_URL),
    getJson<{ products: CmProduct[] }>(fetchFn, CM_PRODUCTS_URL),
    getJson<{ data?: { name?: string; card_sets?: { set_code?: string }[] }[] }>(fetchFn, YGO_CARDINFO_URL),
  ]);
  const index = buildCatalogIndex(ygo.data ?? [], products.products, guide.priceGuides);
  const fetchedAt = guide.createdAt ? new Date(guide.createdAt) : new Date();

  const articles = await prisma.article.findMany({ where: { isCard: true }, select: { id: true, setCode: true } });
  const report: MarketSyncReport = {
    priceGuideDate: guide.createdAt ?? null,
    articles: articles.length,
    eindeutig: 0,
    mehrdeutig: 0,
    keiner: { kein_set_code: 0, set_code_unbekannt: 0, kein_produkt: 0 },
    startedAt,
    finishedAt: "",
  };

  const rows = [];
  for (const a of articles) {
    const r = resolveMarket(index, a.setCode);
    if (r.quality === "eindeutig") {
      report.eindeutig++;
      rows.push({
        articleId: a.id,
        source: MARKET_SOURCE,
        matchQuality: "eindeutig",
        idProduct: r.idProduct,
        priceFrom: r.price.low,
        priceTrend: r.price.trend,
        priceAvg30: r.price.avg30,
        priceAvg7: r.price.avg7,
        priceAvg1: r.price.avg1,
        variants: 1,
        fetchedAt,
      });
    } else if (r.quality === "mehrdeutig") {
      report.mehrdeutig++;
      rows.push({
        articleId: a.id,
        source: MARKET_SOURCE,
        matchQuality: "mehrdeutig",
        priceMin: r.trendMin,
        priceMax: r.trendMax,
        variants: r.variants,
        fetchedAt,
      });
    } else {
      report.keiner[r.reason]++;
    }
  }

  // Ein Datensatz je Artikel und Quelle: alten Stand ersetzen, nicht stapeln.
  await prisma.$transaction([
    prisma.marketPrice.deleteMany({ where: { source: MARKET_SOURCE } }),
    prisma.marketPrice.createMany({ data: rows }),
  ]);

  report.finishedAt = new Date().toISOString();
  return report;
}
