import { hasSetCode } from "./setCode";

/**
 * Privatverkaeufe (Elektronik, Schmuck, Muenzen ueber denselben Shop-Account)
 * ausfiltern (KONZEPT.md Abschnitt 12.3 / Entscheidungen Abschnitt 11):
 * "als Karte gilt nur, was Set-Code/Yu-Gi-Oh-Marker traegt". Bundles ohne
 * eigenen Set-Code ("250 YuGiOh! Karten Sammlung") tragen den Marker im
 * Namen und werden damit korrekt erkannt.
 */
const YUGIOH_MARKER = /yu[\s-]?gi[\s-]?oh/i;

export function isCardArticleName(name: string): boolean {
  return hasSetCode(name) || YUGIOH_MARKER.test(name);
}
