/**
 * Set-Code-Extraktor fuer Yu-Gi-Oh!-Artikelnamen.
 *
 * Format nach docs/enterich-cards/KONZEPT.md Abschnitt 5.2:
 * `[A-Z0-9]{2,5}-(DE|EN)[A-Z]?\d{2,3}`, z. B. "RA04-DE050", "BROL-DE067",
 * "DLCS-DE137", "GFTP-EN011".
 */
const SET_CODE_PATTERN = /\b[A-Z0-9]{2,5}-(?:DE|EN)[A-Z]?\d{2,3}\b/i;

/** Erste Set-Code-Fundstelle im Namen (Original-Schreibweise), oder null. */
export function extractSetCode(name: string): string | null {
  const match = name.match(SET_CODE_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

/** true, wenn der Name (irgendwo) einen gueltigen Set-Code enthaelt. */
export function hasSetCode(name: string): boolean {
  return extractSetCode(name) !== null;
}
