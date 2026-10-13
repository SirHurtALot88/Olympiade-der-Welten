import { normalizeArticleName } from "../parsing/name";
import type { StoreListing } from "./ebayStore";

/**
 * Ordnet Shop-Angebote den Artikeln zu. Reihenfolge der Schluessel:
 *
 * 1. eBay-Artikelnummer — aus dem eBay-Report (EbayListingFact) schon einem
 *    Artikel zugeordnet. Eindeutig, kein Raten.
 * 2. Name — Angebotstitel normalisiert == Article.nameNormalized. Billbee
 *    uebernimmt den eBay-Titel, die Namen stimmen also im Normalfall 1:1.
 * 3. Alias — eine in der Review-Liste gelernte Namensvariante.
 *
 * Mehrere Angebote auf denselben Artikel (Einzelkarte und 3er-Pack teilen sich
 * den normalisierten Namen): das Angebot mit passender Pack-Menge gewinnt.
 */

export type ImageMatchKind = "item_id" | "name" | "alias";

export interface MatchableArticle {
  id: string;
  nameNormalized: string;
  packQty: number;
}

export interface ImageAssignment {
  articleId: string;
  listing: StoreListing;
  matchedBy: ImageMatchKind;
}

export interface ImageMatchResult {
  assignments: ImageAssignment[];
  unmatched: StoreListing[];
}

const RANK: Record<ImageMatchKind, number> = { item_id: 0, name: 1, alias: 2 };

export function matchListingsToArticles(
  listings: StoreListing[],
  articles: MatchableArticle[],
  /** eBay-Artikelnummer -> articleId (aus EbayListingFact). */
  articleIdByItemId: Map<string, string>,
  /** Namensvariante (normalisiert) -> nameNormalized des Ziel-Artikels. */
  aliases: Map<string, string> = new Map()
): ImageMatchResult {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const byName = new Map(articles.map((a) => [a.nameNormalized, a]));

  const best = new Map<string, ImageAssignment & { packFits: boolean }>();
  const unmatched: StoreListing[] = [];

  for (const listing of listings) {
    const { normalized, packQty } = normalizeArticleName(listing.title);

    let article: MatchableArticle | undefined;
    let matchedBy: ImageMatchKind | undefined;

    const viaItem = articleIdByItemId.get(listing.itemId);
    if (viaItem && byId.has(viaItem)) {
      article = byId.get(viaItem);
      matchedBy = "item_id";
    } else if (byName.has(normalized)) {
      article = byName.get(normalized);
      matchedBy = "name";
    } else {
      const target = aliases.get(normalized);
      if (target && byName.has(target)) {
        article = byName.get(target);
        matchedBy = "alias";
      }
    }

    if (!article || !matchedBy) {
      unmatched.push(listing);
      continue;
    }

    const candidate = { articleId: article.id, listing, matchedBy, packFits: packQty === article.packQty };
    const current = best.get(article.id);
    if (!current || isBetter(candidate, current)) {
      best.set(article.id, candidate);
    }
  }

  const assignments = [...best.values()].map(({ packFits: _packFits, ...a }) => a);
  return { assignments, unmatched };
}

function isBetter(
  a: { matchedBy: ImageMatchKind; packFits: boolean },
  b: { matchedBy: ImageMatchKind; packFits: boolean }
): boolean {
  if (RANK[a.matchedBy] !== RANK[b.matchedBy]) return RANK[a.matchedBy] < RANK[b.matchedBy];
  return a.packFits && !b.packFits;
}
