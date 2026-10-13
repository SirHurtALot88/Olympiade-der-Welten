import { toEnglishSetCode } from "../images/ygoprodeck";

/**
 * Cardmarket-Marktwert je Artikel aus den oeffentlichen Katalogdateien
 * (kein Login, nicht hinter der Cloudflare-Sperre der Webseite):
 *
 *   Preisliste   priceGuide/price_guide_3.json        (3 = Yu-Gi-Oh!)
 *   Produkte     productList/products_singles_3.json
 *
 * Cardmarket-Produkte tragen keinen Set-Code, nur Name + idExpansion. Die
 * Bruecke ist YGOPRODeck: Set-Code (DE->EN) -> englischer Kartenname. Welche
 * idExpansion zu einem Set-Praefix (RA02, CORI …) gehoert, ergibt eine
 * Abstimmung: die Expansion, in der die meisten Karten dieses Sets vorkommen.
 *
 * Grenze, nachgemessen am 13.10. an Chris' 1.676 Angeboten: gibt es die Karte
 * im selben Set in mehreren Seltenheiten (Secret + Starlight + Quarter Century),
 * fuehrt Cardmarket sie als gleichnamige Produkte OHNE Seltenheit. Zwei
 * Zuordnungsversuche (Preisrang, Seltenheits-Hierarchie) trafen nicht besser als
 * Raten. Solche Artikel bekommen deshalb ehrlich die Spanne statt eines Werts.
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

export interface CatalogIndex {
  /** Set-Code englisch -> englischer Kartenname */
  nameByCode: Map<string, string>;
  /** Set-Praefix -> idExpansion */
  expansionByPrefix: Map<string, number>;
  /** "name|idExpansion" -> Produkte */
  products: Map<string, CmProduct[]>;
  prices: Map<number, CmPrice>;
}

const key = (name: string, exp: number) => `${name.toLowerCase()}|${exp}`;
const prefixOf = (code: string) => code.split("-")[0];

export function buildCatalogIndex(ygoCards: YgoCard[], cmProducts: CmProduct[], cmPrices: CmPrice[]): CatalogIndex {
  const expansionsByName = new Map<string, number[]>();
  const products = new Map<string, CmProduct[]>();
  for (const p of cmProducts) {
    const n = p.name.toLowerCase();
    (expansionsByName.get(n) ?? expansionsByName.set(n, []).get(n)!).push(p.idExpansion);
    const k = key(p.name, p.idExpansion);
    (products.get(k) ?? products.set(k, []).get(k)!).push(p);
  }

  const nameByCode = new Map<string, string>();
  const votes = new Map<string, Map<number, number>>();
  for (const card of ygoCards) {
    if (!card.name) continue;
    const exps = expansionsByName.get(card.name.toLowerCase()) ?? [];
    for (const set of card.card_sets ?? []) {
      const code = set.set_code?.toUpperCase();
      if (!code) continue;
      if (!nameByCode.has(code)) nameByCode.set(code, card.name);
      const pre = prefixOf(code);
      const v = votes.get(pre) ?? votes.set(pre, new Map()).get(pre)!;
      for (const e of exps) v.set(e, (v.get(e) ?? 0) + 1);
    }
  }
  const expansionByPrefix = new Map<string, number>();
  for (const [pre, v] of votes) {
    let best: number | null = null;
    let bestN = 0;
    for (const [e, n] of v) if (n > bestN) [best, bestN] = [e, n];
    if (best !== null) expansionByPrefix.set(pre, best);
  }

  return { nameByCode, expansionByPrefix, products, prices: new Map(cmPrices.map((p) => [p.idProduct, p])) };
}

export type MarketResolution =
  | { quality: "eindeutig"; idProduct: number; price: CmPrice }
  | { quality: "mehrdeutig"; variants: number; trendMin: number | null; trendMax: number | null }
  | { quality: "keiner"; reason: "kein_set_code" | "set_code_unbekannt" | "kein_produkt" };

/** Repraesentativer Preis je Karte: Trend, sonst 30-Tage-Schnitt, sonst Tiefstpreis. */
export function cardValue(p: CmPrice | undefined): number | null {
  if (!p) return null;
  return p.trend ?? p.avg30 ?? p.low ?? null;
}

export function resolveMarket(index: CatalogIndex, setCode: string | null): MarketResolution {
  if (!setCode) return { quality: "keiner", reason: "kein_set_code" };
  const en = toEnglishSetCode(setCode);
  const name = index.nameByCode.get(en);
  const exp = index.expansionByPrefix.get(prefixOf(en));
  if (!name || exp === undefined) return { quality: "keiner", reason: "set_code_unbekannt" };

  const cands = index.products.get(key(name, exp)) ?? [];
  if (cands.length === 0) return { quality: "keiner", reason: "kein_produkt" };
  if (cands.length === 1) {
    const price = index.prices.get(cands[0].idProduct);
    if (!price) return { quality: "keiner", reason: "kein_produkt" };
    return { quality: "eindeutig", idProduct: cands[0].idProduct, price };
  }
  const values = cands.map((c) => cardValue(index.prices.get(c.idProduct))).filter((v): v is number => v !== null);
  return {
    quality: "mehrdeutig",
    variants: cands.length,
    trendMin: values.length ? Math.min(...values) : null,
    trendMax: values.length ? Math.max(...values) : null,
  };
}
