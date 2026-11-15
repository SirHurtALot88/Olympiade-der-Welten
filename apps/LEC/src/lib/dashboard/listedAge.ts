/**
 * Wie lange ist ein Artikel mindestens bei eBay eingestellt? (Chris, 13.11.: bei nie verkauften Artikeln unterscheiden, ob frisch oder
 * zwei Jahre alt.) Das Einstelldatum liefert weder die Shopseite noch Billbee. Aber eBay-Artikelnummern wachsen mit der Zeit: ein Angebot
 * mit kleinerer Nummer wurde vor einem mit groesserer Nummer eingestellt. Hat der Artikel mit der naechst groesseren Nummer seinen ersten
 * Verkauf am Tag T, war unser Artikel spaetestens an T eingestellt -> mindestens (heute - T) Tage alt. Eine Untergrenze, kein Datum.
 */
export interface ListedSample {
  itemId: number;
  /** Erster Verkauf des Artikels (spaeter als das Einstellen, also eine obere Grenze fuer das Einstelldatum). */
  firstSoldAt: Date;
}

export const ITEM_ID_RE = /^\d{9,14}$/;

export function buildListedIndex(samples: ListedSample[]): { ids: number[]; suffixMin: number[] } {
  const sorted = [...samples].sort((a, b) => a.itemId - b.itemId);
  const ids = sorted.map((s) => s.itemId);
  const suffixMin = new Array<number>(sorted.length);
  let min = Infinity;
  for (let i = sorted.length - 1; i >= 0; i--) {
    min = Math.min(min, sorted[i].firstSoldAt.getTime());
    suffixMin[i] = min;
  }
  return { ids, suffixMin };
}

/** Spaetestes Einstelldatum (Millisekunden) fuer eine Artikelnummer; null, wenn kein Artikel mit groesserer Nummer verkauft wurde. */
export function listedBeforeMs(index: { ids: number[]; suffixMin: number[] }, itemId: number, ownFirstSoldAt?: Date | null): number | null {
  // erster Index mit id > itemId
  let lo = 0;
  let hi = index.ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index.ids[mid] > itemId) hi = mid;
    else lo = mid + 1;
  }
  const fromLarger = lo < index.ids.length ? index.suffixMin[lo] : null;
  const own = ownFirstSoldAt ? ownFirstSoldAt.getTime() : null;
  if (fromLarger === null) return own;
  return own === null ? fromLarger : Math.min(own, fromLarger);
}

/** Mindestalter in Tagen oder null. */
export function listedDaysAtLeast(index: { ids: number[]; suffixMin: number[] }, itemIdRaw: string | null | undefined, ownFirstSoldAt: Date | null | undefined, now = Date.now()): number | null {
  if (!itemIdRaw || !ITEM_ID_RE.test(itemIdRaw)) return null;
  const ms = listedBeforeMs(index, Number(itemIdRaw), ownFirstSoldAt);
  return ms === null ? null : Math.max(0, Math.floor((now - ms) / 86_400_000));
}
