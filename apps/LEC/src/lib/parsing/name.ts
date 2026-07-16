/**
 * Namens-Normalisierer fuer den Billbee<->eBay-Abgleich (KONZEPT.md Abschnitt 5.2/5.3).
 *
 * - trim, Mehrfach-Leerzeichen zusammenfassen, Gross/Klein vereinheitlichen.
 * - Mengen-Praefix "3x"/"2x " am Anfang wird separat als Pack-Menge erfasst,
 *   nicht Teil des Match-Keys (Billbee und eBay schreiben den Praefix nicht
 *   immer identisch, z. B. "3x " vs. "3 x " vs. fehlend).
 */

const PACK_PREFIX_PATTERN = /^(\d+)\s*[xX]\s*/;

export interface NormalizedName {
  /** Match-Key: klein geschrieben, ohne Pack-Praefix, Whitespace vereinheitlicht. */
  normalized: string;
  /** Menge aus einem "3x"/"2x"-Praefix, sonst 1. */
  packQty: number;
  /** Name ohne Pack-Praefix, aber in Original-Schreibweise (fuer Anzeige). */
  displayName: string;
}

function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function normalizeArticleName(raw: string): NormalizedName {
  const trimmed = collapseWhitespace(raw);

  const packMatch = trimmed.match(PACK_PREFIX_PATTERN);
  const packQty = packMatch ? parseInt(packMatch[1], 10) : 1;
  const withoutPackPrefix = packMatch ? trimmed.slice(packMatch[0].length) : trimmed;
  const displayName = collapseWhitespace(withoutPackPrefix);

  const normalized = displayName.toLowerCase();

  return {
    normalized,
    packQty: Number.isFinite(packQty) && packQty > 0 ? packQty : 1,
    displayName,
  };
}

/** Nur der Match-Key, praktisch fuer schnelle Vergleiche. */
export function normalizedNameKey(raw: string): string {
  return normalizeArticleName(raw).normalized;
}
