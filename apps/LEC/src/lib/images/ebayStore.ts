/**
 * Parser fuer Chris' eBay-Shopseite (https://www.ebay.de/str/lordenterichcards).
 *
 * Jede Angebotskachel ist ein `<article data-testid=ig-<Artikelnummer>>`. Darin
 * stehen der Link aufs Angebot (aria-label = Angebotstitel) und das Bild
 * (`imageId=<GUID>`, ausgeliefert unter i.ebayimg.com/images/g/<GUID>/s-l<Groesse>.jpg).
 *
 * Bewusst die Shopseite und nicht die einzelnen Angebotsseiten: die liefert eBay
 * an Server ohne Browser mit 403 aus, die Shopseite nicht. Eine Shopseite traegt
 * rund 48 Angebote, 1.400 Artikel sind also gut 30 Abrufe.
 */

export const STORE_URL = "https://www.ebay.de/str/lordenterichcards";

export interface StoreListing {
  itemId: string;
  title: string;
  imageGuid: string;
  /** Erster Preis der Kachel (aktueller Angebotspreis), null wenn nicht lesbar. */
  price: number | null;
}

const TILE_START = /<article\b[^>]*\bdata-testid=["']?ig-(\d{6,})/g;
const LINK_LABEL = /<a\b[^>]*\/itm\/\d+[^>]*\baria-label=(?:"([^"]*)"|'([^']*)')/;
const PRICE = /EUR\s*([\d.]+,\d{2})/;
const IMAGE_ID = /\bimageId=["']?([A-Za-z0-9_~-]{8,})/;

/**
 * Feste Sortierung (_sop=10, neu eingestellt zuerst). Ohne sie mischt eBay die
 * Reihenfolge bei jedem Abruf neu: Seite 8 bringt dann Angebote von Seite 2 noch
 * einmal, andere nie — nachgemessen am 13.10., 216 statt 1.672 Angeboten.
 */
export function storePageUrl(page: number): string {
  return `${STORE_URL}?_sop=10&_pgn=${Math.max(1, page)}`;
}

/** Gesamtzahl laut Shopseite ("1.672 Angebote"), null wenn nicht gefunden. */
export function parseTotalListings(html: string): number | null {
  const m = html.match(/([\d.]+)\s*Angebote\b/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Bild in fester Groesse. 500 px reicht fuer Vorschau und Lupe, ~50 KB je Karte. */
export function ebayImageUrl(guid: string, size = 500): string {
  return `https://i.ebayimg.com/images/g/${guid}/s-l${size}.jpg`;
}

export function parseStorePage(html: string): StoreListing[] {
  const starts: { itemId: string; index: number }[] = [];
  for (const m of html.matchAll(TILE_START)) {
    starts.push({ itemId: m[1], index: m.index ?? 0 });
  }

  const listings: StoreListing[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < starts.length; i++) {
    const { itemId, index } = starts[i];
    if (seen.has(itemId)) continue;
    const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const tile = html.slice(index, end);

    const label = tile.match(LINK_LABEL);
    const guid = tile.match(IMAGE_ID);
    if (!label || !guid) continue;

    const title = decodeEntities(label[1] ?? label[2] ?? "").trim();
    if (!title) continue;

    const priceMatch = tile.replace(/<[^>]+>/g, " ").match(PRICE);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, "").replace(",", ".")) : null;

    seen.add(itemId);
    listings.push({ itemId, title, imageGuid: guid[1], price });
  }
  return listings;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
