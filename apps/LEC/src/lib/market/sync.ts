import type { PrismaClient } from "@prisma/client";
import { YGO_CARDINFO_URL, toEnglishSetCode } from "../images/ygoprodeck";
import { buildCodeNames, buildNameIndex, suggestCodes, titleNameMismatch } from "./names";
import { cleanTitle } from "../dashboard/board";
import { rarityCandidates, rarityFromTitle } from "./rarity";
import rarityMapData from "./rarityMap.json";
import {
  CM_PRICE_GUIDE_URL,
  CM_PRODUCTS_URL,
  buildCatalogIndex,
  resolveMarket,
  type CmPrice,
  type CmProduct,
  type RarityMap,
} from "./catalog";

const RARITY_MAP = rarityMapData as RarityMap;

export const MARKET_SOURCE = "cardmarket-priceguide";

export interface MarketSyncReport {
  priceGuideDate: string | null;
  articles: number;
  eindeutig: number;
  /** Davon ueber die Seltenheit aus dem Titel zugeordnet (Rest: Karte hat im Set nur eine Variante). */
  perSeltenheit: number;
  mehrdeutig: number;
  /** Mehrdeutig, aufgeschluesselt nach Grund. */
  mehrdeutigGrund: Record<string, number>;
  keiner: Record<"kein_set_code" | "set_code_unbekannt" | "kein_produkt", number>;
  /** Titel nennt einen anderen Namen als der Code: Marktwert nach dem Namen (eindeutiger Code) oder keiner. */
  nameCodeKonflikt: { korrigiert: number; ohneMarktwert: number };
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
  const [guide, products, ygo, ygoDe] = await Promise.all([
    getJson<{ createdAt?: string; priceGuides: CmPrice[] }>(fetchFn, CM_PRICE_GUIDE_URL),
    getJson<{ products: CmProduct[] }>(fetchFn, CM_PRODUCTS_URL),
    getJson<{ data?: { id?: number; name?: string; card_sets?: { set_code?: string }[] }[] }>(fetchFn, YGO_CARDINFO_URL),
    // Deutsche Kartennamen nur zum Pruefen der Titel: faellt der Abruf aus, laeuft der Marktwert trotzdem.
    getJson<{ data?: { id?: number; name?: string }[] }>(fetchFn, `${YGO_CARDINFO_URL}?language=de`).catch(() => null),
  ]);
  const codeNames = buildCodeNames(ygo.data ?? [], ygoDe?.data ?? null);
  const nameIndex = buildNameIndex(ygo.data ?? [], ygoDe?.data ?? null);
  const index = buildCatalogIndex(ygo.data ?? [], products.products, guide.priceGuides);
  const fetchedAt = guide.createdAt ? new Date(guide.createdAt) : new Date();

  const articles = await prisma.article.findMany({ where: { isCard: true }, select: { id: true, setCode: true, nameRaw: true } });
  const report: MarketSyncReport = {
    priceGuideDate: guide.createdAt ?? null,
    articles: articles.length,
    eindeutig: 0,
    perSeltenheit: 0,
    mehrdeutig: 0,
    mehrdeutigGrund: {},
    keiner: { kein_set_code: 0, set_code_unbekannt: 0, kein_produkt: 0 },
    nameCodeKonflikt: { korrigiert: 0, ohneMarktwert: 0 },
    startedAt,
    finishedAt: "",
  };

  // Kartenname laut Set-Code je Artikel (auch ohne Marktwert). Nennt der Titel einen anderen Namen, gilt
  // der NAME (Chris: die Codes sind es, die falsch eingetippt sind, z. B. RA04 statt ALIN): der
  // Marktwert wird dann fuer den eindeutigen Code zum Namen gesucht, sonst gibt es keinen.
  const effectiveCode = new Map<string, string | null>();
  for (const a of articles) {
    const n = a.setCode ? codeNames.get(toEnglishSetCode(a.setCode)) : undefined;
    let codeHint: string | null = null;
    let hintCodes: string[] = [];
    let mismatch = false;
    if (n) {
      const titleName = cleanTitle(a.nameRaw).name;
      mismatch = titleNameMismatch(titleName, n);
      if (mismatch) {
        const rarity = rarityFromTitle(a.nameRaw);
        hintCodes = suggestCodes(nameIndex, titleName, rarity ? rarityCandidates(rarity) : []) ?? [];
        codeHint = hintCodes.join(", ") || null;
      }
    }
    effectiveCode.set(a.id, mismatch ? (hintCodes.length === 1 ? hintCodes[0] : null) : a.setCode);
    await prisma.article.update({ where: { id: a.id }, data: { codeNameEn: n?.en ?? null, codeNameDe: n?.de ?? null, codeHint } });
  }

  const rows = [];
  for (const a of articles) {
    const code = effectiveCode.get(a.id) ?? null;
    const corrected = code !== a.setCode;
    if (corrected && code === null) {
      report.nameCodeKonflikt.ohneMarktwert++;
      continue;
    }
    if (corrected) report.nameCodeKonflikt.korrigiert++;
    const r = resolveMarket(index, code, a.nameRaw, RARITY_MAP);
    if (r.quality === "eindeutig") {
      report.eindeutig++;
      if (r.how === "seltenheit") report.perSeltenheit++;
      rows.push({
        articleId: a.id,
        source: MARKET_SOURCE,
        matchQuality: "eindeutig",
        idProduct: r.idProduct,
        priceFrom: r.price.low,
        priceTrend: r.price.trend,
        raw: JSON.stringify({ how: r.how, ...(corrected ? { code } : {}) }),
        priceAvg30: r.price.avg30,
        priceAvg7: r.price.avg7,
        priceAvg1: r.price.avg1,
        variants: 1,
        fetchedAt,
      });
    } else if (r.quality === "mehrdeutig") {
      report.mehrdeutig++;
      report.mehrdeutigGrund[r.why] = (report.mehrdeutigGrund[r.why] ?? 0) + 1;
      rows.push({
        articleId: a.id,
        source: MARKET_SOURCE,
        matchQuality: "mehrdeutig",
        raw: JSON.stringify({ why: r.why, ...(corrected ? { code } : {}) }),
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
