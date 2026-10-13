/**
 * Rueckfall fuer Artikel ohne eBay-Bild (ausgelaufen, gerade nicht gelistet):
 * das Kartenbild von YGOPRODeck ueber den Set-Code.
 *
 * Deutsche Set-Codes kennt YGOPRODeck nicht, die Nummer im Set ist aber
 * sprachunabhaengig: RA02-DE048 -> RA02-EN048 -> Mystical Space Typhoon.
 * Nachgemessen am 13.10. an Chris' 1.543 Angeboten mit Set-Code: 98,6 % Treffer.
 * Es fehlen nur EU-Sonderdrucke (Adventskalender AC11/AC14, Tins TN23, BLC1).
 *
 * YGOPRODeck bittet darum, die Datenbank einmal zu laden statt sie mit
 * Einzelabfragen zu fluten, und Bilder herunterzuladen statt zu verlinken.
 */

export const YGO_CARDINFO_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

export function ygoImageUrl(cardId: number): string {
  return `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`;
}

/** Deutscher Set-Code -> englischer (RA02-DE048 -> RA02-EN048). Andere bleiben unveraendert. */
export function toEnglishSetCode(setCode: string): string {
  return setCode.toUpperCase().replace(/-DE(?=[A-Z]?\d)/, "-EN");
}

interface CardInfoResponse {
  data?: {
    card_sets?: { set_code?: string }[];
    card_images?: { id?: number }[];
  }[];
}

/** Set-Code (englisch, gross) -> ID des Kartenbilds. */
export function buildSetCodeIndex(json: CardInfoResponse): Map<string, number> {
  const index = new Map<string, number>();
  for (const card of json.data ?? []) {
    const imageId = card.card_images?.[0]?.id;
    if (!imageId) continue;
    for (const set of card.card_sets ?? []) {
      const code = set.set_code?.toUpperCase();
      if (code && !index.has(code)) index.set(code, imageId);
    }
  }
  return index;
}

export function lookupCardImageId(index: Map<string, number>, setCode: string): number | null {
  return index.get(toEnglishSetCode(setCode)) ?? null;
}
