import { hasSetCode } from "./setCode";

/**
 * Privatverkaeufe (Elektronik, Schmuck, Muenzen ueber denselben Shop-Account)
 * ausfiltern (KONZEPT.md Abschnitt 12.3 / Entscheidungen Abschnitt 11):
 * "als Karte gilt nur, was Set-Code/Yu-Gi-Oh-Marker traegt". Bundles ohne
 * eigenen Set-Code ("250 YuGiOh! Karten Sammlung") tragen den Marker im
 * Namen und werden damit korrekt erkannt.
 */
const YUGIOH_MARKER = /yu[\s-]?gi[\s-]?oh/i;
/** Pokemon (mit und ohne Akzent): zweites Spiel im Shop, hat keine Yu-Gi-Oh-Set-Codes (Chris, 14.10.). */
const POKEMON_MARKER = /pok[eéè]mon/i;

/** Yu-Gi-Oh oder Pokemon; alles andere (Zubehoer anderer Spiele, Elektronik, Schmuck ...) nicht. */
export function isCardArticleName(name: string): boolean {
  return hasSetCode(name) || YUGIOH_MARKER.test(name) || POKEMON_MARKER.test(name);
}
