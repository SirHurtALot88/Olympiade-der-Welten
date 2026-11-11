import { toEnglishSetCode } from "../images/ygoprodeck";
import { parseSetCode, rarityCandidates, rarityFromTitle, rarityKey } from "./rarity";

/**
 * Cardmarket-Marktwert je Artikel aus den oeffentlichen Katalogdateien
 * (kein Login, nicht hinter der Cloudflare-Sperre der Webseite):
 *
 *   Preisliste   priceGuide/price_guide_3.json        (3 = Yu-Gi-Oh!)
 *   Produkte     productList/products_singles_3.json
 *
 * Cardmarket-Produkte tragen weder Set-Code noch Seltenheit, nur Name + idExpansion.
 * Bruecken:
 *  - Set-Code (DE->EN) -> englischer Kartenname ueber YGOPRODeck.
 *  - Set-Praefix (RA02, CORI …) -> Cardmarket-Expansion(en) per Abstimmung: die Expansion,
 *    in der die meisten Karten dieses Sets vorkommen (plus Expansionen mit mindestens der
 *    Haelfte der Stimmen, fuer Sets mit Sonderdruck-Expansion).
 *  - Gibt es die Karte im Set in mehreren Seltenheiten, fuehrt Cardmarket gleichnamige
 *    Produkte OHNE Seltenheit. Die Zuordnung Seltenheit -> Produkt steht in rarityMap.json,
 *    gebaut aus Cardcluster (scripts/build-rarity-map.ts): Cardcluster zeigt je Seltenheit
 *    einen Preis, und der ist exakt der 7-Tage-Schnitt (avg7) des Cardmarket-Produkts —
 *    nachgemessen am 13.10. an 10.797 Varianten ohne eine Abweichung.
 *  - Fehlt Seltenheit oder Eintrag, steht ehrlich die Spanne statt eines geratenen Werts.
 */

export const CM_PRICE_GUIDE_URL = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_3.json";
export const CM_PRODUCTS_URL = "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_3.json";

export interface CmProduct {
  idProduct: number;
  name: string;
  idExpansion: number;
  /** "2023-04-14 10:00:00"; Cardmarket fuehrt die 25th-Anniversary-Neuauflagen als Expansionen mit diesem Datum. */
  dateAdded?: string;
}

export interface CmPrice {
  idProduct: number;
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
}

interface YgoCard {
  name?: string;
  card_sets?: { set_code?: string }[];
}

/**
 * Seltenheits-Zuordnung: Set-Praefix -> Kartennummer -> Seltenheitsname (rarityKey) -> idProduct.
 * Ein Array statt einer Zahl heisst: mehrere Varianten hatten beim Bau denselben 7-Tage-Schnitt
 * (gleicher Preis, Zuordnung nicht beweisbar).
 */
export type RarityMap = Record<string, Record<string, Record<string, number | number[]>>>;

export interface CatalogIndex {
  /** Set-Code englisch -> englischer Kartenname */
  nameByCode: Map<string, string>;
  /** Set-Praefix -> idExpansion(en) */
  expansionsByPrefix: Map<string, number[]>;
  /** Set-Praefix -> Expansionen der 25th-Anniversary-Neuauflage (LOB, MRD, SRL, PSV, DCR, IOC ...): deutsche Karten mit
   * Code -DE sind dort die Neuauflage, die Originale tragen den Sprachcode G (LOB-G108) bzw. E / keinen. */
  reprint25ByPrefix: Map<string, number[]>;
  /** kleingeschriebener Name -> Produkte */
  productsByName: Map<string, CmProduct[]>;
  prices: Map<number, CmPrice>;
}

const prefixOf = (code: string) => code.split("-")[0];

export function buildCatalogIndex(ygoCards: YgoCard[], cmProducts: CmProduct[], cmPrices: CmPrice[]): CatalogIndex {
  const productsByName = new Map<string, CmProduct[]>();
  for (const p of cmProducts) {
    const n = p.name.toLowerCase();
    (productsByName.get(n) ?? productsByName.set(n, []).get(n)!).push(p);
  }

  const nameByCode = new Map<string, string>();
  const votes = new Map<string, Map<number, number>>();
  for (const card of ygoCards) {
    if (!card.name) continue;
    const exps = (productsByName.get(card.name.toLowerCase()) ?? []).map((p) => p.idExpansion);
    for (const set of card.card_sets ?? []) {
      const code = set.set_code?.toUpperCase();
      if (!code) continue;
      if (!nameByCode.has(code)) nameByCode.set(code, card.name);
      const v = votes.get(prefixOf(code)) ?? votes.set(prefixOf(code), new Map()).get(prefixOf(code))!;
      for (const e of exps) v.set(e, (v.get(e) ?? 0) + 1);
    }
  }
  const expansionsByPrefix = new Map<string, number[]>();
  for (const [pre, v] of votes) {
    const top = Math.max(0, ...v.values());
    if (top === 0) continue;
    expansionsByPrefix.set(pre, [...v].filter(([, n]) => n >= top * 0.5).map(([e]) => e));
  }

  // 25th-Anniversary-Neuauflagen: vollstaendige Sets, deren Produkte alle im Fenster 14.-16.04.2023 angelegt wurden
  // (nachgemessen am 11.11.: LOB 5339, MRD 5340, SRL/MRL 5341, PSV 5342, DCR 5343, IOC 5344).
  const dateByExpansion = new Map<number, { min: string; max: string }>();
  for (const p of cmProducts) {
    const d = (p.dateAdded ?? "").slice(0, 10);
    if (!d) continue;
    const cur = dateByExpansion.get(p.idExpansion);
    dateByExpansion.set(p.idExpansion, { min: cur && cur.min < d ? cur.min : d, max: cur && cur.max > d ? cur.max : d });
  }
  const namesPerPrefix = new Map<string, Set<string>>();
  for (const card of ygoCards) {
    for (const set of card.card_sets ?? []) {
      const code = set.set_code?.toUpperCase();
      if (!code || !card.name) continue;
      (namesPerPrefix.get(prefixOf(code)) ?? namesPerPrefix.set(prefixOf(code), new Set()).get(prefixOf(code))!).add(card.name);
    }
  }
  const reprint25ByPrefix = new Map<string, number[]>();
  for (const [pre, v] of votes) {
    const total = namesPerPrefix.get(pre)?.size ?? 0;
    const exps = [...v]
      .filter(([e, n]) => {
        const d = dateByExpansion.get(e);
        return total >= 40 && n >= total * 0.8 && !!d && d.min >= "2023-04-14" && d.max <= "2023-04-16";
      })
      .map(([e]) => e);
    if (exps.length > 0) reprint25ByPrefix.set(pre, exps);
  }

  return { nameByCode, expansionsByPrefix, reprint25ByPrefix, productsByName, prices: new Map(cmPrices.map((p) => [p.idProduct, p])) };
}

/** Alle Cardmarket-Varianten einer Karte im Set, nach idProduct sortiert. `edition` waehlt Original oder 25th-Neuauflage. */
export function variantsOf(index: CatalogIndex, name: string, prefix: string, edition: "original" | "25th" | "any" = "any"): CmProduct[] {
  const reprints = index.reprint25ByPrefix.get(prefix) ?? [];
  const exps = edition === "25th" ? reprints : edition === "original" ? index.expansionsByPrefix.get(prefix)?.filter((e) => !reprints.includes(e)) : index.expansionsByPrefix.get(prefix);
  if (!exps) return [];
  return (index.productsByName.get(name.toLowerCase()) ?? [])
    .filter((p) => exps.includes(p.idExpansion))
    .sort((a, b) => a.idProduct - b.idProduct);
}

export type MarketResolution =
  | { quality: "eindeutig"; idProduct: number; price: CmPrice; how: "einzige_variante" | "seltenheit"; edition?: "25th" | "original" }
  | { quality: "mehrdeutig"; variants: number; trendMin: number | null; trendMax: number | null; why: "keine_seltenheit_im_titel" | "nicht_in_zuordnung" | "preise_weichen_ab" }
  | { quality: "keiner"; reason: "kein_set_code" | "set_code_unbekannt" | "kein_produkt" };

/**
 * Marktwert je Karte: 7-Tage-Schnitt, sonst 30-Tage-Schnitt, sonst Trend, sonst Tiefstpreis.
 * Der 7-Tage-Schnitt ist exakt der Wert, den Cardcluster als Cardmarket-Preis zeigt;
 * der Trend ist bei wenig gehandelten Karten unbrauchbar (Beispiel: Trend 0,02 € bei Schnitt 12,85 €).
 */
export function cardValue(p: CmPrice | undefined): number | null {
  if (!p) return null;
  return p.avg7 ?? p.avg30 ?? p.trend ?? p.low ?? null;
}

/** Gleichpreisige Varianten (Array in der Zuordnung) gelten nur dann als eine, wenn ihre Preise heute noch beieinanderliegen. */
const TIE_TOLERANCE = 0.1;

export function resolveMarket(
  index: CatalogIndex,
  setCodeIn: string | null,
  title: string | null,
  rarityMap: RarityMap
): MarketResolution {
  // Alte Codes (LOB-G108 deutsch, LOB-E108 / LOB-108 englisch) tragen kein -DE/-EN: das sind die ORIGINALE.
  // Mit -DE gelten in den Sets der 25th-Anniversary-Neuauflage (LOB, MRD, SRL, PSV, DCR, IOC) die Neuauflagen.
  let setCode = setCodeIn;
  let edition: "original" | "25th" | null = null;
  if (!setCode && title) {
    const legacy = title.toUpperCase().match(/\b([A-Z0-9]{2,5})-(?:[GE])?(\d{3})\b/);
    if (legacy && !/-(?:DE|EN)/.test(legacy[0])) {
      setCode = `${legacy[1]}-EN${legacy[2]}`;
      edition = "original";
    }
  }
  if (!setCode) return { quality: "keiner", reason: "kein_set_code" };
  const parsed = parseSetCode(setCode);
  const en = toEnglishSetCode(setCode);
  const name = index.nameByCode.get(en);
  if (!parsed || !name) return { quality: "keiner", reason: "set_code_unbekannt" };
  if (edition === null && /-DE/i.test(setCode) && index.reprint25ByPrefix.has(parsed.prefix)) edition = "25th";

  let cands = edition === "25th" ? variantsOf(index, name, parsed.prefix, "25th") : [];
  if (cands.length === 0) {
    edition = edition === "25th" ? null : edition;
    cands = variantsOf(index, name, parsed.prefix, edition === "original" ? "original" : "any");
  }
  const editionTag = edition ?? undefined;
  if (edition === "25th" && cands.length === 1) {
    const price = index.prices.get(cands[0].idProduct);
    if (!price) return { quality: "keiner", reason: "kein_produkt" };
    return { quality: "eindeutig", idProduct: cands[0].idProduct, price, how: "einzige_variante", edition: "25th" };
  }
  if (cands.length === 0) return { quality: "keiner", reason: "kein_produkt" };
  if (cands.length === 1) {
    const price = index.prices.get(cands[0].idProduct);
    if (!price) return { quality: "keiner", reason: "kein_produkt" };
    return { quality: "eindeutig", idProduct: cands[0].idProduct, price, how: "einzige_variante", ...(editionTag ? { edition: editionTag } : {}) };
  }

  const spread = (why: "keine_seltenheit_im_titel" | "nicht_in_zuordnung" | "preise_weichen_ab", products: CmProduct[]): MarketResolution => {
    const values = products.map((c) => cardValue(index.prices.get(c.idProduct))).filter((v): v is number => v !== null);
    return {
      quality: "mehrdeutig",
      variants: products.length,
      trendMin: values.length ? Math.min(...values) : null,
      trendMax: values.length ? Math.max(...values) : null,
      why,
    };
  };

  const rarity = title ? rarityFromTitle(title) : null;
  if (!rarity) return spread("keine_seltenheit_im_titel", cands);
  // Die Seltenheits-Zuordnung (Cardcluster) gilt fuer die Originale; bei der Neuauflage bleibt nur die Spanne.
  const forCard = edition === "25th" ? undefined : rarityMap[parsed.prefix]?.[parsed.number];
  const entry = rarityCandidates(rarity)
    .map((r) => forCard?.[rarityKey(r)])
    .find((e) => e !== undefined);
  if (entry === undefined) return spread("nicht_in_zuordnung", cands);

  const ids = (Array.isArray(entry) ? entry : [entry]).filter((id) => cands.some((c) => c.idProduct === id));
  if (ids.length === 0) return spread("nicht_in_zuordnung", cands);
  if (ids.length > 1) {
    const vals = ids.map((id) => cardValue(index.prices.get(id)));
    const known = vals.filter((v): v is number => v !== null);
    const lo = Math.min(...known);
    const hi = Math.max(...known);
    if (known.length !== vals.length || hi > lo * (1 + TIE_TOLERANCE) + 0.02) {
      return spread("preise_weichen_ab", cands.filter((c) => ids.includes(c.idProduct)));
    }
  }
  const price = index.prices.get(ids[0]);
  if (!price) return { quality: "keiner", reason: "kein_produkt" };
  return { quality: "eindeutig", idProduct: ids[0], price, how: "seltenheit", ...(editionTag ? { edition: editionTag } : {}) };
}
