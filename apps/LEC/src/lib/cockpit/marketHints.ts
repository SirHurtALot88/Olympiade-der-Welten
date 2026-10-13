import type { ArticleAggregate } from "../dashboard/viewModel";
import { shopVolumeFromAggregates } from "../dashboard/viewModel";
import { buildMarketComparisonRow, type LatestQuote, type MarketComparisonRow } from "../dashboard/marketComparison";
import type { CostSettingsValues } from "../pricing/costSettings";
import type { ImageMap } from "./movers";
import { imageUrlFor } from "./movers";

/**
 * Preis-Hinweise aus dem automatischen Cardmarket-Marktwert (MarketPrice, source
 * "cardmarket-priceguide"): wie viele Artikel liegen gegen die Zielspanne (25 % bis 33 %
 * Deckungsbeitrags-Marge auf Marktwert-EK + Einkaufs-Versand, mindestens 4,99 €) zu guenstig /
 * zu teuer, bei wie vielen liegt der EK ueber dem Markt. Bewertung kommt 1:1 aus
 * `buildMarketComparisonRow` (dieselbe Zeile wie /marktpreise) -- das Cockpit zaehlt nur.
 */
export interface MarketHintEntry {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  ownVk: number;
  /** Zielspanne des VK (25 % .. 33 % Deckungsbeitrags-Marge bei Marktwert-EK). */
  targetMin: number;
  targetOpt: number;
  marketValue: number;
  deltaPercent: number;
  /** Hebel in Stk: max(Bestand, 90-T-Absatz) -- fuer die Sortierung "wo liegt am meisten Geld". */
  lever: number;
  /** Abstand zur naechsten Spannengrenze × Hebel, € gesamt (zu guenstig: Ziel-Minimum − VK, zu teuer: VK − Ziel-Optimum). */
  effect: number;
  imageUrl: string | null;
}

export interface MarketHints {
  /** Artikel mit Marktwert (eindeutig oder mehrdeutig). */
  withQuote: number;
  activeTotal: number;
  /** Anteil aktiver Artikel mit Marktwert (0..1). */
  coverage: number;
  ambiguous: number;
  stale: number;
  tooCheap: number;
  inCorridor: number;
  tooExpensive: number;
  ekAboveMarket: number;
  /** Σ (Ziel-Minimum − VK) × Hebel ueber "zu guenstig" -- liegengelassenes Geld, € gesamt. */
  tooCheapEffect: number;
  topTooCheap: MarketHintEntry[];
  topTooExpensive: MarketHintEntry[];
  /** Juengster Abruf, null ohne Daten. */
  latestFetch: Date | null;
}

const LIMIT = 5;

function toEntry(a: ArticleAggregate, r: MarketComparisonRow, images: ImageMap): MarketHintEntry | null {
  if (r.targetMin === null || r.targetOpt === null || r.marketValue === null || r.deltaPercent === null) return null;
  const lever = Math.max(a.active ? a.stock : 0, a.windows["90"]?.qty ?? 0);
  const gap = r.status === "zu_guenstig" ? r.targetMin - r.ownVk : r.status === "zu_teuer" ? r.ownVk - r.targetOpt : 0;
  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    ownVk: r.ownVk,
    targetMin: r.targetMin,
    targetOpt: r.targetOpt,
    marketValue: r.marketValue,
    deltaPercent: r.deltaPercent,
    lever,
    effect: Math.max(0, gap) * lever,
    imageUrl: imageUrlFor(a.articleId, images),
  };
}

export function computeMarketHints(
  articles: ArticleAggregate[],
  quotes: ReadonlyMap<string, LatestQuote>,
  costSettings: CostSettingsValues,
  images: ImageMap
): MarketHints {
  const shop = shopVolumeFromAggregates(articles, costSettings);
  const hints: MarketHints = {
    withQuote: 0,
    activeTotal: articles.filter((a) => a.active).length,
    coverage: 0,
    ambiguous: 0,
    stale: 0,
    tooCheap: 0,
    inCorridor: 0,
    tooExpensive: 0,
    ekAboveMarket: 0,
    tooCheapEffect: 0,
    topTooCheap: [],
    topTooExpensive: [],
    latestFetch: null,
  };
  const cheap: MarketHintEntry[] = [];
  const expensive: MarketHintEntry[] = [];
  let activeWithQuote = 0;
  for (const a of articles) {
    const q = quotes.get(a.articleId);
    if (!q) continue;
    const r = buildMarketComparisonRow(a, q, costSettings, shop);
    hints.withQuote++;
    if (a.active) activeWithQuote++;
    if (r.matchQuality === "mehrdeutig") hints.ambiguous++;
    if (r.stale) hints.stale++;
    if (r.ekAboveMarket) hints.ekAboveMarket++;
    if (!hints.latestFetch || q.fetchedAt > hints.latestFetch) hints.latestFetch = q.fetchedAt;
    if (r.status === "zu_guenstig") hints.tooCheap++;
    else if (r.status === "zu_teuer") hints.tooExpensive++;
    else hints.inCorridor++;
    const e = toEntry(a, r, images);
    if (!e) continue;
    if (r.status === "zu_guenstig") {
      cheap.push(e);
      hints.tooCheapEffect += (e.targetMin - e.ownVk) * e.lever;
    } else if (r.status === "zu_teuer") {
      expensive.push(e);
    }
  }
  hints.coverage = hints.activeTotal > 0 ? activeWithQuote / hints.activeTotal : 0;
  const byEffect = (x: MarketHintEntry, y: MarketHintEntry) => y.effect - x.effect || Math.abs(y.deltaPercent) - Math.abs(x.deltaPercent);
  hints.topTooCheap = cheap.sort(byEffect).slice(0, LIMIT);
  hints.topTooExpensive = expensive.sort(byEffect).slice(0, LIMIT);
  return hints;
}
