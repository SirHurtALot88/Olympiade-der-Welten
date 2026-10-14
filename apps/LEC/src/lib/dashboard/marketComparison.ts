import type { ArticleAggregate } from "./viewModel";
import type { CostSettingsValues } from "../pricing/costSettings";
import {
  computeHk,
  computePriceCorridor,
  computeMarketTargetRange,
  type MarketTargetRange,
  contributionMarginForPrice,
  fixedCostPerUnit,
  type ShopVolume,
  type TargetRange,
} from "../pricing/costEngine";
import { classifyAgainstRange, computeMarketEk, type MarketStatus } from "../pricing/marketPrice";

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
  /** Wie der Marktwert zugeordnet wurde: "seltenheit" | "einzige_variante" (eindeutig). */
  how?: string | null;
  /** Set-Code, nach dem der Marktwert gesucht wurde, wenn er vom Code im Titel abweicht (Name gilt). */
  usedCode?: string | null;
}

/**
 * Marktwert des ARTIKELS aus dem Datensatz: Cardmarket-Preise gelten je Karte, der VK je Artikel
 * (3er-Pack = 3 Karten). 7-Tage-Schnitt (wie Cardcluster), sonst 30-Tage-Schnitt, sonst Trend.
 * Null bei mehrdeutiger Seltenheit (dann gibt es nur `marketRangeOf`) oder ohne Preis.
 */
export function marketValueOf(quote: LatestQuote, packQty: number): number | null {
  if (quote.matchQuality === "mehrdeutig") return null;
  const perCard = quote.priceAvg7 ?? quote.priceAvg30 ?? quote.priceTrend ?? null;
  return perCard === null ? null : perCard * Math.max(1, packQty);
}

export function marketRangeOf(quote: LatestQuote, packQty: number): { min: number; max: number; variants: number } | null {
  if (quote.matchQuality !== "mehrdeutig" || quote.priceMin == null || quote.priceMax == null) return null;
  const pack = Math.max(1, packQty);
  return { min: quote.priceMin * pack, max: quote.priceMax * pack, variants: quote.variants ?? 0 };
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
  /** Marktwert des ARTIKELS = 7-Tage-Schnitt (wie Cardcluster; sonst 30-T, sonst Trend) x Pack-Menge. Null wenn mehrdeutig. */
  marketValue: number | null;
  /** Mehrdeutig: Spanne des Artikel-Marktwerts (billigste..teuerste Variante, x Pack). */
  marketRange: { min: number; max: number; variants: number } | null;
  /**
   * Zielspanne des VK bei heutigem Marktwert als EK + Einkaufs-Versand: 25 % (min) bis
   * 33 % (opt) Deckungsbeitrags-Marge, mindestens 4,99 €. Bei mehrdeutiger Seltenheit
   * spannt sie alle Varianten auf (billigste min .. teuerste opt).
   */
  targetMin: number | null;
  targetOpt: number | null;
  /** Der Marktdeckel (teure Karten: selten mehr als 1,5-fach) hat die Spanne begrenzt. */
  capped: boolean;
  /** Nein = die 25-%-Marge ist bei realistischem Preis nicht erreichbar; der Markt gibt nicht mehr her. */
  marginReachable: boolean;
  /** Deckungsbeitrags-Marge, die der heutige VK braeuchte, wenn die Karte zum Marktwert nachgekauft wird. */
  marginAtMarket: number | null;
  /** Deckungsbeitrags-Marge des heutigen VK mit dem tatsaechlichen EK (null ohne EK). */
  marginAtOwnEk: number | null;
  /** Letzter Einkaufspreis je Stueck (Billbee-Artikelstamm, sonst realisierter EK), null ohne EK. */
  lastEk: number | null;
  /** Deckungsbeitrags-Marge des heutigen VK mit dem letzten Einkaufspreis. */
  marginAtLastEk: number | null;
  /** Der Artikel hat sich zu (fast) diesem VK bereits mehrfach verkauft: der Markt nimmt den Preis. */
  provenByDemand: boolean;
  soldAtVk: { qty: number; avg: number; days: 90 | 365 } | null;
  /** Eigener EK deutlich (>50 %) ueber dem Marktwert: teuer eingekauft oder Markt gefallen. */
  ekAboveMarket: boolean;
  matchQuality: string | null;
  /** Zuordnung des Marktwerts: "seltenheit" (ueber die Seltenheit im Titel), "einzige_variante", sonst null. */
  how: string | null;
  /** Aus Markt-ab x Packgroesse + Einkaufs-Versand (KONZEPT §7.2), null ohne "ab"-Preis. */
  marketEk: number | null;
  /** Abstand zur naechsten Spannengrenze: unter min negativ, ueber opt positiv, in der Spanne 0. Null ohne Marktwert. */
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
  const kind = a.packQty > 1 ? "pack" : "single";
  const corridor = computePriceCorridor(hk, ownVk || hk.total, costSettings, { kind, packSize: a.packQty, shop });

  // Cardmarket-Preise gelten je Karte, der VK je Artikel (3er-Pack = 3 Karten).
  const marketValue = marketValueOf(quote, pack);
  const marketRange = marketRangeOf(quote, pack);

  const rangeFor = (marketPerUnit: number): MarketTargetRange =>
    computeMarketTargetRange(marketPerUnit, { kind, packSize: a.packQty, shop }, costSettings);

  let target: TargetRange | null = null;
  let capped = false;
  let marginReachable = true;
  let status: MarketStatus = "im_korridor";
  if (marketValue !== null) {
    const r = rangeFor(marketValue);
    target = r;
    capped = r.capped;
    marginReachable = r.marginReachable;
    status = classifyAgainstRange(ownVk, target);
  } else if (marketRange) {
    // Mehrdeutig: nur werten, wenn das Urteil fuer JEDE Variante gilt — zu guenstig
    // selbst gegen die billigste, zu teuer selbst gegen die teuerste. Sonst keine Ampel.
    const lo = rangeFor(marketRange.min);
    const hi = rangeFor(marketRange.max);
    target = { min: lo.min, opt: hi.opt };
    capped = lo.capped || hi.capped;
    marginReachable = lo.marginReachable && hi.marginReachable;
    if (classifyAgainstRange(ownVk, lo) === "zu_guenstig") status = "zu_guenstig";
    else if (classifyAgainstRange(ownVk, hi) === "zu_teuer") status = "zu_teuer";
  }

  // Nachfrage-Beweis (Chris, 14.10.): Ein Preis, zu dem sich der Artikel schon mehrfach verkauft hat,
  // ist nicht "zu teuer", egal was der Marktwert rechnerisch hergibt. Nur "zu teuer" wird so entkraeftet;
  // "zu guenstig" bleibt (dort liegt Geld auf dem Tisch).
  const w90 = a.windows["90"];
  const w365 = a.windows["365"];
  const soldAtVk: MarketComparisonRow["soldAtVk"] =
    ownVk > 0
      ? w90 && w90.qty >= 2 && w90.avgPrice >= ownVk * 0.95
        ? { qty: w90.qty, avg: w90.avgPrice, days: 90 }
        : w365 && w365.qty >= 5 && w365.avgPrice >= ownVk * 0.95
          ? { qty: w365.qty, avg: w365.avgPrice, days: 365 }
          : null
      : null;
  let provenByDemand = false;
  if (status === "zu_teuer" && soldAtVk) {
    status = "im_korridor";
    provenByDemand = true;
  }

  let deltaPercent: number | null = provenByDemand ? 0 : null;
  if (target !== null && ownVk > 0 && !provenByDemand) {
    deltaPercent = ownVk < target.min ? (ownVk - target.min) / target.min : ownVk > target.opt ? (ownVk - target.opt) / target.opt : 0;
  }
  const marginAtMarket =
    marketValue !== null && ownVk > 0
      ? contributionMarginForPrice(ownVk, { ek: marketValue, kind, packSize: a.packQty, shop }, costSettings.adFeeRateGood, costSettings)
      : null;
  const marginAtOwnEk =
    ek > 0 && ownVk > 0
      ? contributionMarginForPrice(ownVk, { ek, kind, packSize: a.packQty, shop }, costSettings.adFeeRateGood, costSettings)
      : null;
  const lastEk = (a.currentEk ?? 0) > 0 ? (a.currentEk as number) : realizedEk > 0 ? realizedEk : null;
  const marginAtLastEk =
    lastEk !== null && ownVk > 0
      ? contributionMarginForPrice(ownVk, { ek: lastEk, kind, packSize: a.packQty, shop }, costSettings.adFeeRateGood, costSettings)
      : null;
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
    targetMin: target ? target.min : null,
    targetOpt: target ? target.opt : null,
    capped,
    marginReachable,
    marginAtMarket,
    marginAtOwnEk,
    lastEk,
    marginAtLastEk,
    provenByDemand,
    soldAtVk,
    ekAboveMarket,
    matchQuality: quote.matchQuality ?? null,
    how: quote.how ?? null,
    marketEk,
    deltaPercent,
    status,
    fetchedAt: quote.fetchedAt,
    stale,
  };
}
