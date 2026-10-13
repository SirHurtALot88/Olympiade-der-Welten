import type { SaleWindowKey } from "../parsing/date";
import { buildMarketComparisonRow, type LatestQuote } from "./marketComparison";
import { classifyArticle, type ArticleClass } from "../pricing/classification";
import {
  computeHk,
  computePriceCorridor,
  classifyPriceStatus,
  computeShopVolume,
  fixedCostPerUnit,
  type ItemKind,
  type ShopVolume,
} from "../pricing/costEngine";
import type { CostSettingsValues } from "../pricing/costSettings";

export interface WindowAggregate {
  qty: number;
  revenue: number;
  ek: number;
  ebayFeeTotal: number;
  shippingCost: number;
  dbI: number;
  dbII: number;
  /** Anteil der SHOPWEITEN Jahresfixkosten, der auf dieses Fenster entfaellt.
   * NICHT in dbII enthalten -- DB II ist ein Deckungsbeitrag. DB III = dbII - fixedCostShare. */
  fixedCostShare: number;
  avgPrice: number;
  rank: number | null;
}

export interface ArticleAggregate {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  packQty: number;
  /** Lagerbestand (Stk), aus dem Billbee-Artikelstamm-Import ("Stock current Standard"). 0, solange
   * der Artikel dort (noch) nicht vorkommt -- siehe `active`. */
  stock: number;
  /** true = im juengsten Billbee-Artikelstamm-Export vorhanden (aktueller Katalog). false = nur aus
   * der Verkaufshistorie bekannt -> ausgelaufen/nicht mehr im Sortiment. */
  active: boolean;
  /** Aktueller Listen-VK/EK aus dem Artikelstamm-Export (Price gross / CostPrice gross). Getrennt vom
   * REALISIERTEN Ø-VK/EK der Verkaufsfenster (`WindowAggregate.avgPrice`/`ek`) zu halten ist wichtig:
   * die historische Marge (DB I/II) rechnet IMMER mit dem realisierten Fenster-Wert, waehrend der
   * Preis-Korridor-/Markt-Vergleich ("zu teuer/guenstig") den aktuellen Listenpreis gegenprueft
   * (Repricing-Frage), nicht den historischen Durchschnitt.
   */
  currentVk: number | null;
  /** Woher `currentVk` stammt: eBay-Shop (live, Vorrang) oder Billbee-Artikelstamm. */
  vkSource?: "ebay" | "billbee" | null;
  /** Stand des eBay-Preises, nur bei vkSource "ebay". */
  vkAt?: Date | null;
  currentEk: number | null;
  /** Marktwert des Artikels (Cardmarket-7-Tage-Schnitt x Pack-Menge) aus dem juengsten MarketPrice-Datensatz,
   * sonst null ("—"), auch bei mehrdeutiger Seltenheit. */
  latestMarketTrend: number | null;
  /** Juengster Cardmarket-Datensatz, fuer Zielspanne und Urteil vs. Markt (marketComparison.ts). */
  marketQuote?: LatestQuote | null;
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
  /** REALISIERTER, gewichteter Ø-VK der Referenz-Periode (SaleWindow.avgPrice) -- Basis der Marge/DB,
   * NICHT fuer den Preis-Korridor-Vergleich (dafuer `listingVk`). */
  avgVkRealized: number;
  /** Aktueller Listen-VK aus dem Billbee-Artikelstamm-Export, null wenn der Artikel dort (noch) nicht
   * gepflegt ist. Basis fuer den Preis-Korridor-/Markt-Vergleich ("zu teuer/guenstig"). */
  listingVk: number | null;
  /** Realisierter EK je Stk (Referenz-Periode) -- Basis der Marge/DB (HK-Grundlage). */
  ek: number;
  /** Aktueller Listen-EK aus dem Artikelstamm-Export, rein informativ (Repricing), null falls unbekannt. */
  currentEk: number | null;
  /** Vollkosten-Korridor MIN/GUT plus Deckungsbeitrags-Grenze `contribution` (VK, ab dem der Verkauf
   * vor Fixkosten kein Geld mehr verliert). */
  corridor: { min: number; good: number; contribution: number };
  /** Ampel-Status: vergleicht den AKTUELLEN Listen-VK (Fallback: realisierter Ø-VK, wenn kein
   * Artikelstamm-Preis vorliegt) gegen den Korridor. `"kein_ek"` (FIX 1) statt einem der drei
   * Korridor-Status, wenn `ekMissing` true ist -- der Korridor waere sonst auf Basis EK=0
   * winzig und wuerde "im Korridor"/"unter MIN" vortaeuschen, obwohl der EK schlicht unbekannt
   * ist. Bewusst als Erweiterung des Rueckgabetyps (nicht `| null`), um den bestehenden
   * Korridor-/Ampel-Code (SortimentTable, /sortiment) nicht mit Null-Checks zu durchziehen. */
  priceStatus: ReturnType<typeof classifyPriceStatus> | "kein_ek";
  articleClass: ArticleClass;
  classLabel: string;
  /** DB I / DB II je verkauftem Stueck (Referenz-Periode, REALISIERT), DB II % gleiche Basis wie Klassifikation. */
  dbIPerUnit: number;
  dbIIPerUnit: number;
  dbIIPercent: number;
  /** DB III = DB II abzueglich Fixkostenanteil (Vollkosten-Ergebnis) je Stueck. */
  dbIIIPerUnit: number;
  dbIIIPercent: number;
  /** true = weder realisierter EK (Referenz-Fenster) noch aktueller Listen-EK bekannt
   * (FIX 1, KONZEPT §7.3/§8) -- betrifft laut Chris 747 aktive Artikel. Ohne diesen Flag
   * wuerde die App Phantom-Margen (dbI = Umsatz − 0) als echte Marge behandeln. */
  ekMissing: boolean;
  /** Rank/Verkaeufe/Umsatz/Ø-Preis je Fenster (30/90/365/all) fuer die Dashboard-Spalten. */
  windows: Partial<Record<SaleWindowKey, SortimentWindowMetrics>>;
  /** true = im aktuellen Billbee-Artikelstamm-Katalog (nicht ausgelaufen). */
  active: boolean;
  /** Lagerbestand -- 0 solange kein Bestandsimport lief (PAGES_CONCEPT §B). */
  stock: number;
  /** Stk x aktueller Listen-VK, nur wenn Bestand importiert ist (sonst null -> "Bestand nicht importiert"). */
  potentialRevenue: number | null;
  /** Bestandsreichweite in Monaten (Stk / Verkaeufe pro Monat aus 90T), null ohne Bestand/Velocity. */
  stockMonthsCover: number | null;
  /** Marktwert des Artikels (Cardmarket-7-Tage-Schnitt x Pack), null wenn nicht zugeordnet oder mehrdeutig -> "—". */
  priceTrend: number | null;
  /** Woher `listingVk` stammt und wie frisch er ist: eBay-Shop (live) oder Billbee-Artikelstamm. */
  listingVkSource: "ebay" | "billbee" | null;
  listingVkAt: string | null;
  /** Cardmarket-Marktwert, Zielspanne (25-33 % Deckungsbeitrag) und Urteil. Null ohne Datensatz. */
  market: SortimentMarket | null;
}

export interface SortimentMarket {
  /** Marktwert des Artikels; null, wenn mehrdeutig (dann `range`). */
  value: number | null;
  range: { min: number; max: number; variants: number } | null;
  /** VK fuer 25 % (min) bis 33 % (opt) Deckungsbeitrags-Marge bei Marktwert-EK, mindestens 4,99 €. */
  targetMin: number | null;
  targetOpt: number | null;
  /** Deckungsbeitrags-Marge des heutigen VK bei Nachkauf zum Marktwert. */
  margin: number | null;
  status: "zu_guenstig" | "im_korridor" | "zu_teuer";
  /** Nur ein Urteil, wenn Marktwert (oder bei Spanne: fuer alle Varianten gleiches Urteil) vorliegt. */
  rated: boolean;
  quality: string | null;
  how: string | null;
  ekAboveMarket: boolean;
  fetchedAt: string;
}

export interface OperatingQuotas {
  warenquote: number;
  betriebsausgabenquote: number;
  targetWarenquote: number;
  targetBetriebsausgabenquote: number;
}

export interface RecommendationLotItem {
  articleId: string;
  nameRaw: string;
  setCode: string | null;
  /** Bestand x EK/Stk (FIX 2, siehe `boundCapitalOf`) -- NICHT der Lebenszeit-EK bereits
   * verkaufter Stuecke. `null`, wenn fuer diesen Artikel nie ein Bestandsimport lief
   * (`active === false`): dann ist der Bestand per Definition unbekannt, nicht 0 --
   * eine erfundene 0 waere hier schlimmer als eine ehrliche Luecke. */
  boundCapital: number | null;
}

export interface Recommendation {
  /** Stabile ID fuer clientseitiges "Ausblenden" (localStorage, /empfehlungen). */
  id: string;
  kind: "ek_pflegen" | "auslisten" | "preis_anpassen" | "nachkaufen" | "lot_bilden";
  title: string;
  detail: string;
  effect: string;
  /** Numerischer Betrag hinter `effect` -- Basis fuer "Sortierung nach €-Effekt" (PAGES_CONCEPT §4).
   * FIX 4 (KONZEPT §7.3/§8): durchgaengig "€ gesamt", NIE €/Stk -- siehe Formel-Kommentare je
   * Empfehlungsart in `buildRecommendations`. Ausnahme `ek_pflegen`: kein €-Betrag (der Punkt ist ja
   * gerade, dass der EK fehlt), traegt die Anzahl betroffener Artikel und steht immer ganz oben. */
  effectValue: number;
  /** Suchbegriff fuer den Link zu /sortiment?q=… (nicht bei kind === "lot_bilden"/"ek_pflegen", das verlinkt nicht 1:1). */
  linkQuery?: string;
  /** Nur bei kind === "lot_bilden": aufklappbare Ladenhüter-Artikelliste (nicht 900 Einzelzeilen). */
  items?: RecommendationLotItem[];
}

export interface DashboardViewModel {
  windows: Record<SaleWindowKey, WindowKpis>;
  deadCapital: DeadCapital;
  moversGood: MoverItem[];
  moversBad: MoverItem[];
  sortiment: SortimentRow[];
  quotas: OperatingQuotas;
  recommendations: Recommendation[];
  totals: { articleCount: number; cardArticleCount: number; marketPriceCount: number };
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Shopweite 365-Tage-Stueckzahl (N) und Stueck ab Einschreiben-Schwelle (N_T) aus den
 * Artikel-Aggregaten — dieselbe Quelle wie im Import (`importPlan.ts`): das "365"-Fenster,
 * sonst "all" als Naeherung. EINE Zahl fuer den ganzen Shop; sie speist die Fixkosten-
 * Umlage UND den Einschreiben-Satz in JEDEM Korridor (Dashboard, Sortiment, Marktpreise,
 * Einstellungen), damit die App sich nicht selbst widerspricht.
 * `null`, wenn kein Fenster mit Verkaeufen vorliegt (dann ist nichts umzulegen).
 */
export function shopVolumeFromAggregates(
  articles: ArticleAggregate[],
  costSettings: CostSettingsValues
): ShopVolume | null {
  const windowKey: SaleWindowKey | null = articles.some((a) => a.windows["365"])
    ? "365"
    : articles.some((a) => a.windows.all)
      ? "all"
      : null;
  if (windowKey === null) return null;
  const rows = articles
    .map((a) => a.windows[windowKey])
    .filter((w): w is WindowAggregate => !!w)
    .map((w) => ({ qty: w.qty, avgPrice: w.avgPrice }));
  const volume = computeShopVolume(rows, costSettings);
  return volume.units365d > 0 ? volume : null;
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
    totals: {
      articleCount: articles.length,
      cardArticleCount: articles.length,
      marketPriceCount: articles.filter((a) => a.latestMarketTrend !== null).length,
    },
  };
}

function toMoverItem(a: ArticleAggregate, window: SaleWindowKey): MoverItem {
  const agg = a.windows[window] ?? {
    qty: 0,
    revenue: 0,
    ek: 0,
    dbI: 0,
    dbII: 0,
    fixedCostShare: 0,
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

/**
 * FIX 1 (KONZEPT §7.3/§8): true, wenn WEDER ein realisierter EK (irgendein Fenster mit
 * qty>0 und ek>0) NOCH ein aktueller Listen-EK (Artikelstamm) bekannt ist. Ohne jeden
 * EK-Anhaltspunkt ist dbI = Umsatz − 0 eine Phantom-Marge von ~100 % -- genau die Kette,
 * die laut Chris Klassifikation ("Champion") und Empfehlungen ("nachkaufen") vergiftet.
 * Zentrale Stelle, wiederverwendet von Klassifikation, Preis-Korridor-Status UND der
 * "EK pflegen"-Empfehlung, damit alle drei denselben Begriff von "EK fehlt" nutzen.
 */
export function hasNoEkData(a: ArticleAggregate): boolean {
  const hasRealizedEk = (Object.keys(a.windows) as SaleWindowKey[]).some((key) => {
    const w = a.windows[key];
    return !!w && w.qty > 0 && w.ek > 0;
  });
  const hasCurrentEk = a.currentEk !== null && a.currentEk > 0;
  return !hasRealizedEk && !hasCurrentEk;
}

/**
 * FIX 2 (KONZEPT §5.4/§8): gebundenes Kapital eines Artikels = Bestand (Stk) x EK/Stk --
 * NICHT der Lebenszeit-EK bereits VERKAUFTER Stuecke (das zaehlt Wareneinsatz von Stuecken,
 * die nicht mehr im Regal liegen, siehe Bug in topFlop.ts/viewModel.ts vor diesem Fix).
 * EK/Stk-Basis: aktueller Listen-EK (Artikelstamm), sonst realisierter EK/Stk der
 * Referenz-Periode. `null`, wenn fuer diesen Artikel nie ein Bestandsimport lief
 * (`active === false` -> `stock` ist dann per Definition 0/unbekannt, nicht "0 Stk im
 * Regal", siehe ArticleAggregate.stock) -- eine erfundene 0 waere schlimmer als eine
 * ehrliche Luecke ("Bestand unbekannt").
 */
export function boundCapitalOf(a: ArticleAggregate): number | null {
  if (!a.active) return null;
  const referenceAgg = a.windows["365"] ?? a.windows.all;
  const ekPerUnit =
    a.currentEk !== null && a.currentEk > 0
      ? a.currentEk
      : referenceAgg && referenceAgg.qty > 0
        ? referenceAgg.ek / referenceAgg.qty
        : 0;
  return a.stock * ekPerUnit;
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
      // Defensiv: `stock` ist nur bei aktiven (importierten) Artikeln ein echter Wert (siehe
      // ArticleAggregate.stock) -- auch wenn das aktuelle Datenmodell das schon garantiert,
      // schuetzt das FIX 3 davor, dass ein kuenftiger Importer-Bug ausgelaufene Artikel
      // faelschlich zu Ladenhuetern macht.
      stock: a.active ? a.stock : 0,
      ekMissing: hasNoEkData(a),
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
  costSettings: CostSettingsValues,
  shop: ShopVolume | null
): SortimentRow {
  const referenceAgg = a.windows["365"] ?? a.windows.all;
  // REALISIERTER Ø-VK/EK der Referenz-Periode -- Basis der Marge/DB, siehe
  // Methodik-Hinweis an SortimentRow.avgVkRealized.
  const avgVkRealized = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.avgPrice : 0;
  const ekPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.ek / referenceAgg.qty : 0;
  const kind: ItemKind = a.packQty > 1 ? "pack" : "single";

  // Aktueller Listen-VK (Billbee-Artikelstamm) ist die Basis fuer den
  // Preis-Korridor-/Markt-Vergleich ("zu teuer/guenstig ggue. MIN/GUT bzw.
  // Markt"); ohne Artikelstamm-Datensatz faellt das auf den realisierten
  // Ø-VK zurueck (bisheriges Verhalten fuer Artikel ohne Bestandsimport).
  const listingVk = a.currentVk !== null && a.currentVk > 0 ? a.currentVk : null;
  const vkForCorridor = listingVk ?? avgVkRealized;

  // Shopweiter Fixkostenanteil (KONZEPT §7.3: HK-Bestandteil) -- NICHT 0: sonst enthielte der
  // Korridor keine Fixkosten. Einschreiben haengt am VK (Schwelle), daher VK mit durchreichen.
  const hk = computeHk(
    {
      ek: ekPerUnit,
      kind,
      packSize: a.packQty,
      fixedCostPerUnit: fixedCostPerUnit(shop?.units365d ?? 0, costSettings),
      vk: vkForCorridor > 0 ? vkForCorridor : null,
      shop,
    },
    costSettings
  );
  const corridor = computePriceCorridor(hk, vkForCorridor || hk.total, costSettings, { kind, packSize: a.packQty, shop });
  const ekMissing = hasNoEkData(a);
  // FIX 1: Ohne EK ist der Korridor auf Basis EK=0 winzig (HK enthaelt praktisch nur
  // Versand/Gebuehren) -- der reale VK liegt dann fast immer "im Korridor" oder "ueber
  // Markt", obwohl das nichts mit einem tatsaechlich guten Preis zu tun hat. Statt dieser
  // falschen Sicherheit: expliziter "kein_ek"-Status, der die Ampel/Preis-Korridor-UI NICHT
  // gruen/rot lackiert, sondern als "wir wissen es nicht" kennzeichnet.
  const priceStatus = ekMissing
    ? "kein_ek"
    : vkForCorridor > 0
      ? classifyPriceStatus(vkForCorridor, corridor)
      : "im_korridor";

  const dbIPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.dbI / referenceAgg.qty : 0;
  const dbIIPerUnit = referenceAgg && referenceAgg.qty > 0 ? referenceAgg.dbII / referenceAgg.qty : 0;
  const dbIIPercent = referenceAgg && referenceAgg.revenue > 0 ? referenceAgg.dbII / referenceAgg.revenue : 0;
  // DB III = DB II - Fixkostenanteil (Vollkosten). DB II traegt bewusst KEINE
  // Fixkosten, siehe importPlan.ts; erst DB III sagt, ob der Artikel seinen
  // Anteil an Shop, Billbee, Lexoffice, Raumkosten und Lizenzen traegt.
  const dbIII = referenceAgg ? referenceAgg.dbII - referenceAgg.fixedCostShare : 0;
  const dbIIIPerUnit = referenceAgg && referenceAgg.qty > 0 ? dbIII / referenceAgg.qty : 0;
  const dbIIIPercent = referenceAgg && referenceAgg.revenue > 0 ? dbIII / referenceAgg.revenue : 0;

  const windowMetrics: SortimentRow["windows"] = {};
  for (const key of ["30", "90", "365", "all"] as SaleWindowKey[]) {
    const agg = a.windows[key];
    if (!agg) continue;
    windowMetrics[key] = { qty: agg.qty, revenue: agg.revenue, avgPrice: agg.avgPrice, rank: agg.rank };
  }

  const velocityPerMonth = monthlyVelocity(a);
  const stockMonthsCover = a.stock > 0 && velocityPerMonth > 0 ? a.stock / velocityPerMonth : null;

  // Cardmarket-Marktwert und Zielspanne: dieselbe Zeile wie auf /marktpreise (eine Rechnung, keine zweite).
  let marketInfo: SortimentMarket | null = null;
  if (a.marketQuote) {
    const m = buildMarketComparisonRow(a, a.marketQuote, costSettings, shop);
    marketInfo = {
      value: m.marketValue,
      range: m.marketRange,
      targetMin: m.targetMin,
      targetOpt: m.targetOpt,
      margin: m.marginAtMarket,
      status: m.status,
      // Urteil nur mit Marktwert; bei Spanne nur, wenn die Ampel fuer JEDE Variante anschlaegt.
      rated: m.marketValue !== null || (m.marketRange !== null && m.status !== "im_korridor"),
      quality: m.matchQuality,
      how: m.how,
      ekAboveMarket: m.ekAboveMarket,
      fetchedAt: m.fetchedAt.toISOString(),
    };
  }

  return {
    articleId: a.articleId,
    nameRaw: a.nameRaw,
    setCode: a.setCode,
    velocity: [a.windows["30"]?.qty ?? 0, a.windows["90"]?.qty ?? 0, a.windows["365"]?.qty ?? 0],
    revenue365: a.windows["365"]?.revenue ?? a.windows.all?.revenue ?? 0,
    avgVkRealized,
    listingVk,
    ek: ekPerUnit,
    currentEk: a.currentEk,
    corridor: { min: corridor.vkMin, good: corridor.vkGood, contribution: corridor.vkContribution },
    priceStatus,
    articleClass,
    classLabel: LABELS_DE[articleClass],
    dbIPerUnit,
    dbIIPerUnit,
    dbIIPercent,
    dbIIIPerUnit,
    dbIIIPercent,
    ekMissing,
    windows: windowMetrics,
    active: a.active,
    stock: a.stock,
    potentialRevenue: a.stock > 0 ? a.stock * vkForCorridor : null,
    stockMonthsCover,
    priceTrend: a.latestMarketTrend,
    listingVkSource: a.currentVk !== null && a.currentVk > 0 ? (a.vkSource ?? null) : null,
    listingVkAt: a.vkAt ? a.vkAt.toISOString() : null,
    market: marketInfo,
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
  const shop = shopVolumeFromAggregates(articles, costSettings);
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
    .map((a) => buildSortimentRow(a, classByArticle.get(a) ?? "beobachten", costSettings, shop));
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

const RECOMMENDATION_KIND_PRIORITY: Record<Recommendation["kind"], number> = {
  ek_pflegen: -1,
  auslisten: 0,
  preis_anpassen: 1,
  nachkaufen: 2,
  lot_bilden: 3,
};

/**
 * Baut ALLE Handlungsempfehlungen (nicht nur ein Beispiel je Typ) --
 * PAGES_CONCEPT §4: vollstaendige Liste fuer `/empfehlungen`, priorisiert nach
 * €-Effekt. Das Dashboard zeigt davon nur die ersten 4 (Top-4 + "Alle
 * ansehen"-Teaser, siehe DashboardShell/Recommendations).
 *
 * FIX 4 (KONZEPT §7.3/§8): `effectValue` ist durchgaengig "€ gesamt" normiert, damit die
 * Sortierung ueber verschiedene Empfehlungsarten hinweg und die KPI-Summen auf
 * /empfehlungen ueberhaupt vergleichbar sind (vorher mischte preis_anpassen €/Stk mit
 * Lebenszeit-Summen bei nachkaufen/auslisten/lot_bilden). Formel je Art -- siehe
 * Kommentare an den jeweiligen Schleifen unten.
 */
export function buildRecommendations(
  classified: Array<{ article: ArticleAggregate; articleClass: ArticleClass; reason: string }>,
  sortiment: SortimentRow[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const sortimentByArticleId = new Map(sortiment.map((s) => [s.articleId, s]));

  // EK pflegen (FIX 1, KONZEPT §7.3/§8): EIN Sammel-Eintrag, ganz oben (siehe Sortierung
  // unten) -- aktive Artikel ohne jeden EK-Anhaltspunkt vergiften Klassifikation
  // ("Champion" trotz Phantom-Marge) UND Nachkauf-Empfehlungen. Nur AKTIVE Artikel zaehlen
  // (ausgelaufene ohne EK sind kein akutes Problem, siehe KONZEPT §7.3), sortiert nach
  // 90-Tage-Velocity: dort verzerrt der fehlende EK am meisten (die Karte VERKAUFT sich
  // gerade auf Basis eines unbekannten Einkaufspreises).
  const ekMissingActive = classified
    .filter((c) => c.article.active && hasNoEkData(c.article))
    .sort((a, b) => (b.article.windows["90"]?.qty ?? 0) - (a.article.windows["90"]?.qty ?? 0));
  if (ekMissingActive.length > 0) {
    const top = ekMissingActive[0].article;
    const topQty90 = top.windows["90"]?.qty ?? 0;
    recommendations.push({
      id: "ek_pflegen",
      kind: "ek_pflegen",
      title: `EK pflegen (${ekMissingActive.length} Artikel).`,
      detail:
        `Kein Einkaufspreis hinterlegt (weder realisiert noch im Artikelstamm) -- ` +
        `Klassifikation und Nachkauf-Empfehlung sind ohne EK nicht belastbar. ` +
        `Staerkster Fall: ${shortName(top.nameRaw)}${topQty90 > 0 ? ` (90 T: ${topQty90} Verk.)` : ""}.`,
      effect: `${ekMissingActive.length} aktive Artikel ohne EK`,
      effectValue: ekMissingActive.length,
    });
  }

  // Auslisten: JEDER Low-Runner (nicht nur der schlechteste einzelne Fall).
  // effectValue = |Lebenszeit-DB II| -- bereits eine "€ gesamt"-Groesse (Fix 4 unveraendert).
  for (const c of classified.filter((c) => c.articleClass === "low_runner")) {
    const dbIILifetime = c.article.windows.all?.dbII ?? 0;
    recommendations.push({
      id: `auslisten:${c.article.articleId}`,
      kind: "auslisten",
      title: `${shortName(c.article.nameRaw)} auslisten.`,
      detail: c.reason,
      effect: `bindet € ${Math.abs(dbIILifetime).toFixed(0)}`,
      effectValue: Math.abs(dbIILifetime),
      linkQuery: c.article.setCode ?? c.article.nameRaw,
    });
  }

  // Preis anpassen: JEDER Artikel unter dem MIN-Korridor (kein_ek-Artikel fallen hier
  // automatisch raus, siehe SortimentRow.priceStatus/FIX 1). "ziel_unerreichbar" ist bewusst
  // NICHT dabei: dort liegt die Marge schon vor Fixkosten unter dem Ziel, "VK anheben" bis MIN
  // waere kein sinnvoller Handlungsvorschlag, sondern Dauerrauschen (Signal ohne Aussage).
  // FIX 4: effectValue = Preis-Luecke/Stk x Hebel (max. aus Bestand ODER 90T-Velocity) --
  // "€ gesamt", NICHT mehr €/Stk. Der Hebel ist bewusst das Maximum aus Bestand (koennte man
  // sofort umpreisen) und 90T-Absatz (wird ohnehin in den naechsten ~3 Monaten verkauft),
  // weil beide Wege real Geld bewegen, unabhaengig davon, welcher Wert gerade groesser ist.
  for (const s of sortiment.filter((s) => s.priceStatus === "unter_min")) {
    const alertVk = s.listingVk ?? s.avgVkRealized;
    const gap = s.corridor.min - alertVk;
    const qty90 = s.windows["90"]?.qty ?? 0;
    const lever = Math.max(s.stock, qty90);
    const effectValue = gap * lever;
    recommendations.push({
      id: `preis_anpassen:${s.articleId}`,
      kind: "preis_anpassen",
      title: `${shortName(s.nameRaw)} VK anheben.`,
      detail: `Aktueller VK ${alertVk.toFixed(2)} € liegt unter dem MIN-Korridor ${s.corridor.min.toFixed(2)} €.`,
      effect:
        lever > 0
          ? `+ € ${effectValue.toFixed(0)} gesamt (${lever} Stk × ${gap.toFixed(2)} €/Stk)`
          : `+ € ${gap.toFixed(2)} / Stk (kein Bestand/Absatz zur Hochrechnung)`,
      effectValue,
      linkQuery: s.setCode ?? s.nameRaw,
    });
  }

  // Nachkaufen: JEDER Champion (Artikel mit ekMissing koennen laut Klassifikation nie
  // Champion sein, siehe FIX 1 -- kein zusaetzlicher Filter hier noetig).
  // FIX 4: effectValue = Erwartungswert der naechsten ~3 Monate (DB II/Stk x 90T-Velocity),
  // NICHT mehr die Lebenszeit-DB-II-Summe -- die sagt nichts darueber aus, was ein Nachkauf
  // heute noch bringt (siehe KONZEPT §2 Bundle-Falle: Lebenszeit-Zahlen taeuschen).
  for (const c of classified.filter((c) => c.articleClass === "champion")) {
    const row = sortimentByArticleId.get(c.article.articleId);
    const dbIIPerUnit = row?.dbIIPerUnit ?? 0;
    const dbIIPercentLifetime = row?.dbIIPercent ?? 0;
    const qty90 = c.article.windows["90"]?.qty ?? 0;
    const expectedDbII = dbIIPerUnit * qty90;
    recommendations.push({
      id: `nachkaufen:${c.article.articleId}`,
      kind: "nachkaufen",
      title: `${shortName(c.article.nameRaw)} nachkaufen.`,
      detail: c.reason,
      effect: `≈ € ${expectedDbII.toFixed(0)} / 90 T erwartet (DB II ${(dbIIPercentLifetime * 100).toFixed(0)}% · ${dbIIPerUnit.toFixed(2)} €/Stk × ${qty90} Stk)`,
      effectValue: expectedDbII,
      linkQuery: c.article.setCode ?? c.article.nameRaw,
    });
  }

  // Ladenhüter: EIN Sammel-Eintrag mit aufklappbarer Artikelliste (nicht
  // hunderte Einzelzeilen) -- Liste auf die groessten Kapitalbinder gedeckelt,
  // vollstaendige Aufschluesselung ueber /sortiment?klasse=ladenhueter.
  // FIX 2: boundCapital = Bestand x EK/Stk (siehe `boundCapitalOf`), NICHT mehr der
  // Lebenszeit-EK bereits verkaufter Stuecke. Artikel ohne Bestandsimport (`null`) werden
  // NICHT als 0 mitsummiert (siehe Filter unten), sondern separat ausgewiesen.
  const ladenhueter = classified.filter((c) => c.articleClass === "ladenhueter");
  if (ladenhueter.length > 0) {
    const items: RecommendationLotItem[] = ladenhueter
      .map((c) => ({
        articleId: c.article.articleId,
        nameRaw: c.article.nameRaw,
        setCode: c.article.setCode,
        boundCapital: boundCapitalOf(c.article),
      }))
      .sort((a, b) => (b.boundCapital ?? -1) - (a.boundCapital ?? -1));
    const knownItems = items.filter((i): i is RecommendationLotItem & { boundCapital: number } => i.boundCapital !== null);
    const unknownStockCount = items.length - knownItems.length;
    const boundCapital = knownItems.reduce((sum, i) => sum + i.boundCapital, 0);
    const unknownNote =
      unknownStockCount > 0
        ? ` ${unknownStockCount} davon ohne Bestandsimport -- Bestand unbekannt, nicht mitgerechnet.`
        : "";
    recommendations.push({
      id: "lot_bilden",
      kind: "lot_bilden",
      title: "Ladenhüter zu Lots bündeln.",
      detail: `${ladenhueter.length} Artikel ohne Velocity (0 Verk. in 365 T trotz Historie) — als Sammlungs-Lot abverkaufen.${unknownNote}`,
      effect: `≈ € ${boundCapital.toFixed(0)} gebunden`,
      effectValue: boundCapital,
      items: items.slice(0, 50),
    });
  }

  recommendations.sort((a, b) => {
    // FIX 1: "EK pflegen" ist eine Datenqualitaets-Warnung, kein €-Effekt-Ranking-Kandidat
    // -- sie steht IMMER ganz oben, unabhaengig von effectValue.
    const aIsEkPflegen = a.kind === "ek_pflegen";
    const bIsEkPflegen = b.kind === "ek_pflegen";
    if (aIsEkPflegen !== bIsEkPflegen) return aIsEkPflegen ? -1 : 1;
    const diff = Math.abs(b.effectValue) - Math.abs(a.effectValue);
    if (diff !== 0) return diff;
    return RECOMMENDATION_KIND_PRIORITY[a.kind] - RECOMMENDATION_KIND_PRIORITY[b.kind];
  });

  return recommendations;
}

function shortName(name: string): string {
  return name.replace(/^Yu-Gi-Oh!\s*/i, "").replace(/^\d+x\s*/i, "").slice(0, 60);
}
