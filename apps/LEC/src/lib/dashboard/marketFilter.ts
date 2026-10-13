/**
 * Filter "VK vs. Markt" (Cardmarket-Marktwert als EK, Zielspanne 25-33 % Deckungsbeitrag) —
 * eine Definition fuer Sortiment und Marktpreise.
 *
 * "offen" = kein Urteil moeglich: kein Marktwert (Bundle, unbekannter Set-Code) oder mehrere
 * Seltenheits-Varianten, deren Urteil nicht fuer alle gleich ausfaellt.
 */
export type MarketFilter = "zu_guenstig" | "im_korridor" | "zu_teuer" | "ek_ueber" | "offen";

export const MARKET_FILTER_ORDER: MarketFilter[] = ["zu_guenstig", "im_korridor", "zu_teuer", "ek_ueber", "offen"];

export const MARKET_FILTER_LABEL: Record<MarketFilter, string> = {
  zu_guenstig: "zu günstig",
  im_korridor: "im Rahmen",
  zu_teuer: "zu teuer",
  ek_ueber: "EK über Markt",
  offen: "ohne Urteil",
};

export const MARKET_FILTER_HINT: Record<MarketFilter, string> = {
  zu_guenstig: "VK liegt unter der Zielspanne: unter dem Preis für 25 % Deckungsbeitrag bei Nachkauf zum Marktwert (teure Karten: unter 1,25-fach)",
  im_korridor: "VK liegt in der Zielspanne 25–33 % (±3 %) oder auf der Untergrenze 4,99 €",
  zu_teuer: "VK liegt über der Zielspanne: über dem Preis für 33 % Deckungsbeitrag, bei teuren Karten über dem 1,5-fachen Marktwert",
  ek_ueber: "Dein EK liegt mehr als 50 % über dem heutigen Marktwert",
  offen: "Kein Marktwert oder mehrere Seltenheits-Varianten ohne einheitliches Urteil",
};

export interface MarketVerdict {
  /** Gibt es ein belastbares Urteil (Marktwert, oder bei Spanne: Urteil gilt fuer jede Variante)? */
  rated: boolean;
  status: "zu_guenstig" | "im_korridor" | "zu_teuer";
  ekAboveMarket: boolean;
}

/** Genau ein Urteils-Eimer je Artikel (EK ueber Markt ist ein zusaetzliches Merkmal, kein Eimer). */
export function marketBucket(v: MarketVerdict | null): "zu_guenstig" | "im_korridor" | "zu_teuer" | "offen" {
  return !v || !v.rated ? "offen" : v.status;
}

/** Leere Auswahl = alles. Mehrere Auswahlen = Vereinigung (ODER). */
export function matchesMarketFilter(v: MarketVerdict | null, filters: ReadonlySet<MarketFilter>): boolean {
  if (filters.size === 0) return true;
  return filters.has(marketBucket(v)) || (filters.has("ek_ueber") && v?.ekAboveMarket === true);
}

/** Zaehler je Filter ueber eine Liste (Eimer + EK ueber Markt). */
export function countMarketFilters(verdicts: Iterable<MarketVerdict | null>): Record<MarketFilter, number> {
  const c: Record<MarketFilter, number> = { zu_guenstig: 0, im_korridor: 0, zu_teuer: 0, ek_ueber: 0, offen: 0 };
  for (const v of verdicts) {
    c[marketBucket(v)]++;
    if (v?.ekAboveMarket) c.ek_ueber++;
  }
  return c;
}
