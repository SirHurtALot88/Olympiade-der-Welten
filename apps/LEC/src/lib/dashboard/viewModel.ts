import type { SaleWindowKey } from "../parsing/date";
import { classifyArticle, type ArticleClass } from "../pricing/classification";
import { computeHk, computePriceCorridor, classifyPriceStatus, type ItemKind } from "../pricing/costEngine";
import type { CostSettingsValues } from "../pricing/costSettings";

export interface WindowAggregate {
  qty: number;
  revenue: number;
  ek: number;
  ebayFeeTotal: number;
  shippingCost: number;
  dbI: number;
  dbII: number;
  avgPrice: number;
  rank: number | null;
}

export interface ArticleAggregate {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  packQty: number;
  /** Lagerbestand (Stk). Aktuell i. d. R. 0 -- Billbee-"Verkaeufe nach Artikel" liefert keinen
   * Bestand (siehe KONZEPT §5.4/PAGES_CONCEPT §B); Follow-up: Billbee-Artikelstamm-Import. */
  stock: number;
  /** Cardmarket-Preistrend aus dem juengsten MarketPrice-Datensatz, sonst null ("—"). */
  latestMarketTrend: number | null;
  windows: Partial<Record<SaleWindowKey, WindowAggregate>>;
}

const WINDOW_LABELS: Record<SaleWindowKey, string> = {
  "30": "30 Tage",
  "90": "90 Tage",
  "365": "365 Tage",
  all: "Lebenszeit",
};

export interface WindowKpis {
  window: SaleWindowKey;
  label: string;
  revenue: number;
  qty: number;
  avgPrice: number;
  dbIPercent: number;
  dbIIPercent: number;
}

export interface DeadCapital {
  count: number;
  totalArticles: number;
  percent: number;
}

export interface MoverItem {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  revenue: number;
  qty: number;
  ek: number;
  dbIPercent: number;
  dbIIPercent: number;
}

/** Kennzahlen je Zeitfenster fuer Chris' Dashboard-Spalten (PAGES_CONCEPT §B). */
export interface SortimentWindowMetrics {
  qty: number;
  revenue: number;
  avgPrice: number;
  rank: number | null;
}

export interface SortimentRow {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  velocity: [number, number, number]; // 30 / 90 / 365
  revenue365: number;
  vk: number; // Preis VK (Ø Verkaufspreis der Referenz-Periode)
  ek: number; // Preis EK je Stk (Referenz-Periode)
  corridor: { min: number; good: number };
  priceStatus: ReturnType<typeof classifyPriceStatus>;
  articleClass: ArticleClass;
  classLabel: string;
  /** DB I / DB II je verkauftem Stueck (Referenz-Periode), DB II % gleiche Basis wie Klassifikation. */
  dbIPerUnit: number;
  dbIIPerUnit: number;
  dbIIPercent: number;
  /** Rank/Verkaeufe/Umsatz/Ø-Preis je Fenster (30/90/365/all) fuer die Dashboard-Spalten. */
  windows: Partial<Record<SaleWindowKey, SortimentWindowMetrics>>;
  /** Lagerbestand -- 0 solange kein Bestandsimport lief (PAGES_CONCEPT §B). */
  stock: number;
  /** Stk x VK, nur wenn Bestand importiert ist (sonst null -> "Bestand nicht importiert"). */
  potentialRevenue: number | null;
  /** Bestandsreichweite in Monaten (Stk / Verkaeufe pro Monat aus 90T), null ohne Bestand/Velocity. */
  stockMonthsCover: number | null;
  /** Cardmarket-Preistrend (aus MarketPrice), null wenn noch nicht erfasst -> "—". */
  priceTrend: number | null;
}

export interface OperatingQuotas {
  warenquote: number;
  betriebsausgabenquote: number;
  targetWarenquote: number;
  targetBetriebsausgabenquote: number;
}

export interface Recommendation {
  kind: "auslisten" | "preis_anpassen" | "nachkaufen" | "lot_bilden";
  title: string;
  detail: string;
  effect: string;
}

export interface DashboardViewModel {
  windows: Record<SaleWindowKey, WindowKpis>;
  deadCapital: DeadCapital;
  moversGood: MoverItem[];
  moversBad: MoverItem[];
  sortiment: SortimentRow[];
  quotas: OperatingQuotas;
  recommendations: Recommendation[];
  totals: { articleCount: number; cardArticleCount: number };
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function buildDashboardViewModel(
  articles: ArticleAggregate[],
  costSettings: CostSettingsValues
): DashboardViewModel {
  const windowKeys: SaleWindowKey[] = ["30", "90", "365", "all"];

  const windows = {} as Record<SaleWindowKey, WindowKpis>;
  for (const w of windowKeys) {
    let revenue = 0;
    let qty = 0;
    let dbI = 0;
    let dbII = 0;
    for (const article of articles) {
      const agg = article.windows[w];
      if (!agg) continue;
      revenue += agg.revenue;
      qty += agg.qty;
      dbI += agg.dbI;
      dbII += agg.dbII;
    }
    windows[w] = {
      window: w,
      label: WINDOW_LABELS[w],
      revenue,
      qty,
      avgPrice: qty > 0 ? revenue / qty : 0,
      dbIPercent: pct(dbI, revenue),
      dbIIPercent: pct(dbII, revenue),
    };
  }

  // Totes Kapital / Ladenhueter-Proxy: Artikel mit Lebenszeit-Verkaeufen, aber
  // 0 Verkaeufen in 365 Tagen. (Echter Bestand (Stk) liegt noch nicht vor --
  // die Billbee "Verkaeufe nach Artikel"-Exporte enthalten keinen Lagerbestand,
  // siehe README "Status/offene Punkte". Diese Kennzahl ist daher eine
  // Naeherung ueber die Verkaufshistorie, kein echter Lager-Bestandswert.)
  const withHistory = articles.filter((a) => (a.windows.all?.qty ?? 0) > 0);
  const deadArticles = withHistory.filter((a) => (a.windows["365"]?.qty ?? 0) === 0);
  const deadCapital: DeadCapital = {
    count: deadArticles.length,
    totalArticles: withHistory.length,
    percent: pct(deadArticles.length, withHistory.length),
  };

  // Klassifikation je Artikel (regelbasiert, KONZEPT §8 Stufe 1).
  const classified = classifyArticles(articles);

  // Laeuft gerade gut: Top-Bewegung 30 Tage unter den Artikeln mit positivem DB I.
  const moversGood: MoverItem[] = articles
    .filter((a) => (a.windows["30"]?.qty ?? 0) > 0 && (a.windows["30"]?.dbI ?? 0) > 0)
    .sort((a, b) => (b.windows["30"]?.revenue ?? 0) - (a.windows["30"]?.revenue ?? 0))
    .slice(0, 4)
    .map((a) => toMoverItem(a, "30"));

  // Laeuft schlecht: schlechteste Lebenszeit-DB-II-% unter Artikeln mit Verkaeufen.
  const moversBad: MoverItem[] = articles
    .filter((a) => (a.windows.all?.qty ?? 0) > 0 && (a.windows.all?.dbII ?? 0) < 0)
    .sort(
      (a, b) =>
        pct(a.windows.all!.dbII, a.windows.all!.revenue) -
        pct(b.windows.all!.dbII, b.windows.all!.revenue)
    )
    .slice(0, 4)
    .map((a) => toMoverItem(a, "all"));

  // Vollstaendige Sortiment-Liste (PAGES_CONCEPT Vorarbeit: kein slice(0,20)/
  // revenue>0-Filter mehr -- Ladenhueter mit 0 € muessen auf /sortiment
  // sichtbar sein). Die Dashboard-Vorschau schneidet clientseitig auf die
  // ersten N Zeilen (siehe SortimentTable `limit`-Prop).
  const sortiment: SortimentRow[] = buildFullSortiment(articles, classified, costSettings);

  const quotaWindow = windows["365"].revenue > 0 ? windows["365"] : windows.all;
  const quotaAgg = articles.reduce(
    (sum, a) => {
      const agg = a.windows["365"] ?? a.windows.all;
      if (!agg) return sum;
      return {
        ek: sum.ek + agg.ek,
        variableCosts: sum.variableCosts + agg.ebayFeeTotal + agg.shippingCost,
        revenue: sum.revenue + agg.revenue,
      };
    },
    { ek: 0, variableCosts: 0, revenue: 0 }
  );
  const quotas: OperatingQuotas = {
    warenquote: pct(quotaAgg.ek, quotaAgg.revenue || quotaWindow.revenue),
    betriebsausgabenquote: pct(quotaAgg.variableCosts, quotaAgg.revenue || quotaWindow.revenue),
    targetWarenquote: 0.43,
    targetBetriebsausgabenquote: 0.4,
  };

  const recommendations = buildRecommendations(classified, sortiment);

  return {
    windows,
    deadCapital,
    moversGood,
    moversBad,
    sortiment,
    quotas,
    recommendations,
    totals: { articleCount: articles.length, cardArticleCount: articles.length },
  };
}

function toMoverItem(a: ArticleAggregate, window: SaleWindowKey): MoverItem {
  const agg = a.windows[window] ?? {
    qty: 0,
    revenue: 0,
    ek: 0,
    dbI: 0,
    dbII: 0,
    ebayFeeTotal: 0,
    shippingCost: 0,
    avgPrice: 0,
    rank: null,
  };
  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    revenue: agg.revenue,
    qty: agg.qty,
    ek: agg.ek,
    dbIPercent: pct(agg.dbI, agg.revenue),
    dbIIPercent: pct(agg.dbII, agg.revenue),
  };
}

export interface ClassifiedArticle {
  article: ArticleAggregate;
  articleClass: ArticleClass;
  label: string;
  reason: string;
}

/** Klassifikation je Artikel (regelbasiert, KONZEPT §8 Stufe 1) -- wiederverwendbarer Baustein. */
export function classifyArticles(articles: ArticleAggregate[]): ClassifiedArticle[] {
  return articles.map((a) => {
    const c = classifyArticle({
      qty30d: a.windows["30"]?.qty ?? 0,
      qty90d: a.windows["90"]?.qty ?? 0,
      qty365d: a.windows["365"]?.qty ?? 0,
      qtyAllTime: a.windows.all?.qty ?? 0,
      dbIIPercent: pct(a.windows.all?.dbII ?? 0, a.windows.all?.revenue ?? 1),
    });
    return { article: a, ...c };
  });
}

/** Monatliche Verkaufsgeschwindigkeit aus dem 90-Tage-Fenster (90 T ≈ 3 Monate). */
function monthlyVelocity(a: ArticleAggregate): number {
  return (a.windows["90"]?.qty ?? 0) / 3;
}

/**
 * Baut die Sortiment-Zeile eines Artikels -- wiederverwendbarer Baustein
 * (PAGES_CONCEPT Vorarbeit), genutzt von Dashboard-Vorschau UND `/sortiment`.
 */
export function buildSortimentRow(
  a: ArticleAggregate,
  articleClass: ArticleClass,
  costSettings: CostSettingsValues
): SortimentRow {
  const referenceAgg = a.windows["365"] ?? a.windows.all;
  const vk = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.avgPrice : 0;
  const ekPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.ek / referenceAgg.qty : 0;
  const kind: ItemKind = a.packQty > 1 ? "pack" : "single";

  const hk = computeHk(
    { ek: ekPerUnit, kind, packSize: a.packQty, fixedCostPerUnit: 0 },
    costSettings
  );
  const corridor = computePriceCorridor(hk.total, vk || hk.total, costSettings);
  const priceStatus = vk > 0 ? classifyPriceStatus(vk, corridor) : "im_korridor";

  const dbIPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.dbI / referenceAgg.qty : 0;
  const dbIIPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.dbII / referenceAgg.qty : 0;
  const dbIIPercent = referenceAgg && referenceAgg.revenue > 0 ? referenceAgg.dbII / referenceAgg.revenue : 0;

  const windowMetrics: SortimentRow["windows"] = {};
  for (const key of ["30", "90", "365", "all"] as SaleWindowKey[]) {
    const agg = a.windows[key];
    if (!agg) continue;
    windowMetrics[key] = { qty: agg.qty, revenue: agg.revenue, avgPrice: agg.avgPrice, rank: agg.rank };
  }

  const velocityPerMonth = monthlyVelocity(a);
  const stockMonthsCover = a.stock > 0 && velocityPerMonth > 0 ? a.stock / velocityPerMonth : null;

  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    velocity: [a.windows["30"]?.qty ?? 0, a.windows["90"]?.qty ?? 0, a.windows["365"]?.qty ?? 0],
    revenue365: a.windows["365"]?.revenue ?? a.windows.all?.revenue ?? 0,
    vk,
    ek: ekPerUnit,
    corridor: { min: corridor.vkMin, good: corridor.vkGood },
    priceStatus,
    articleClass,
    classLabel: LABELS_DE[articleClass],
    dbIPerUnit,
    dbIIPerUnit,
    dbIIPercent,
    windows: windowMetrics,
    stock: a.stock,
    potentialRevenue: a.stock > 0 ? a.stock * vk : null,
    stockMonthsCover,
    priceTrend: a.latestMarketTrend,
  };
}

/**
 * Vollstaendige Sortiment-Liste, KEIN Filter/Slice (PAGES_CONCEPT Vorarbeit) --
 * Ladenhüter mit 0 € Umsatz muessen auf `/sortiment` sichtbar sein. Default-
 * Sortierung: aktuelle Velocity (90d, dann 30d) vor Lebenszeit-/365T-Umsatz,
 * siehe Kommentar in `buildDashboardViewModel` (Bundle-Falle KONZEPT §2).
 */
export function buildFullSortiment(
  articles: ArticleAggregate[],
  classified: ClassifiedArticle[],
  costSettings: CostSettingsValues
): SortimentRow[] {
  const classByArticle = new Map(classified.map((c) => [c.article, c.articleClass]));
  return [...articles]
    .sort((a, b) => {
      const qty90Diff = (b.windows["90"]?.qty ?? 0) - (a.windows["90"]?.qty ?? 0);
      if (qty90Diff !== 0) return qty90Diff;
      const qty30Diff = (b.windows["30"]?.qty ?? 0) - (a.windows["30"]?.qty ?? 0);
      if (qty30Diff !== 0) return qty30Diff;
      return (
        (b.windows["365"]?.revenue ?? b.windows.all?.revenue ?? 0) -
        (a.windows["365"]?.revenue ?? a.windows.all?.revenue ?? 0)
      );
    })
    .map((a) => buildSortimentRow(a, classByArticle.get(a) ?? "beobachten", costSettings));
}

/** Deutsche Klassen-Labels fuer die Sortiment-Klasse -- wiederverwendbar fuer Filter-Chips etc. */
export const LABELS_DE: Record<ArticleClass, string> = {
  champion: "Champion",
  solide: "Solide",
  beobachten: "Beobachten",
  faellt_ab: "Fällt ab",
  low_runner: "Auslisten",
  ladenhueter: "Ladenhüter",
};

function buildRecommendations(
  classified: Array<{ article: ArticleAggregate; articleClass: ArticleClass; reason: string }>,
  sortiment: SortimentRow[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const lowRunner = classified
    .filter((c) => c.articleClass === "low_runner")
    .sort((a, b) => (a.article.windows.all?.dbII ?? 0) - (b.article.windows.all?.dbII ?? 0))[0];
  if (lowRunner) {
    recommendations.push({
      kind: "auslisten",
      title: `${shortName(lowRunner.article.nameRaw)} auslisten.`,
      detail: lowRunner.reason,
      effect: `bindet € ${Math.abs(lowRunner.article.windows.all?.dbII ?? 0).toFixed(0)}`,
    });
  }

  const priceAlert = sortiment.find((s) => s.priceStatus === "unter_min");
  if (priceAlert) {
    recommendations.push({
      kind: "preis_anpassen",
      title: `${shortName(priceAlert.nameRaw)} VK anheben.`,
      detail: `Aktueller VK ${priceAlert.vk.toFixed(2)} € liegt unter dem MIN-Korridor ${priceAlert.corridor.min.toFixed(2)} €.`,
      effect: `+ € ${(priceAlert.corridor.min - priceAlert.vk).toFixed(2)} / Stk`,
    });
  }

  const champion = classified
    .filter((c) => c.articleClass === "champion")
    .sort((a, b) => (b.article.windows["30"]?.revenue ?? 0) - (a.article.windows["30"]?.revenue ?? 0))[0];
  if (champion) {
    recommendations.push({
      kind: "nachkaufen",
      title: `${shortName(champion.article.nameRaw)} nachkaufen.`,
      detail: champion.reason,
      effect: `DB II ${(pct(champion.article.windows.all?.dbII ?? 0, champion.article.windows.all?.revenue ?? 1) * 100).toFixed(0)}%`,
    });
  }

  const ladenhueterCount = classified.filter((c) => c.articleClass === "ladenhueter").length;
  if (ladenhueterCount > 0) {
    const boundCapital = classified
      .filter((c) => c.articleClass === "ladenhueter")
      .reduce((sum, c) => sum + (c.article.windows.all?.ek ?? 0), 0);
    recommendations.push({
      kind: "lot_bilden",
      title: "Ladenhüter zu Lots bündeln.",
      detail: `${ladenhueterCount} Artikel ohne Velocity — als Sammlungs-Lot abverkaufen.`,
      effect: `≈ € ${boundCapital.toFixed(0)} gebunden`,
    });
  }

  return recommendations;
}

function shortName(name: string): string {
  return name.replace(/^Yu-Gi-Oh!\s*/i, "").replace(/^\d+x\s*/i, "").slice(0, 60);
}
