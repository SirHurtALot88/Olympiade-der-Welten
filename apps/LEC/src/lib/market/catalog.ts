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

  return { nameByCode, expansionsByPrefix, productsByName, prices: new Map(cmPrices.map((p) => [p.idProduct, p])) };
}

/** Alle Cardmarket-Varianten einer Karte im Set, nach idProduct sortiert. */
export function variantsOf(index: CatalogIndex, name: string, prefix: string): CmProduct[] {
  const exps = index.expansionsByPrefix.get(prefix);
  if (!exps) return [];
  return (index.productsByName.get(name.toLowerCase()) ?? [])
    .filter((p) => exps.includes(p.idExpansion))
    .sort((a, b) => a.idProduct - b.idProduct);
}

export type MarketResolution =
  | { quality: "eindeutig"; idProduct: number; price: CmPrice; how: "einzige_variante" | "seltenheit" }
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
  setCode: string | null,
  title: string | null,
  rarityMap: RarityMap
): MarketResolution {
  if (!setCode) return { quality: "keiner", reason: "kein_set_code" };
  const parsed = parseSetCode(setCode);
  const en = toEnglishSetCode(setCode);
  const name = index.nameByCode.get(en);
  if (!parsed || !name) return { quality: "keiner", reason: "set_code_unbekannt" };

  const cands = variantsOf(index, name, parsed.prefix);
  if (cands.length === 0) return { quality: "keiner", reason: "kein_produkt" };
  if (cands.length === 1) {
    const price = index.prices.get(cands[0].idProduct);
    if (!price) return { quality: "keiner", reason: "kein_produkt" };
    return { quality: "eindeutig", idProduct: cands[0].idProduct, price, how: "einzige_variante" };
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
  const forCard = rarityMap[parsed.prefix]?.[parsed.number];
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
  return { quality: "eindeutig", idProduct: ids[0], price, how: "seltenheit" };
}
