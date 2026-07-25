/**
 * Datums-Parser fuer die deutschen Formate in den Billbee/eBay-Exporten.
 */

/** "15.06.2026" -> Date (UTC-Mitternacht). */
export function parseGermanDDMMYYYY(raw: string): Date {
  const match = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) {
    throw new Error(`Ungueltiges Datum: "${raw}"`);
  }
  const [, day, month, year] = match;
  return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
}

/** "Zeitraum: 15.06.2026 - 15.07.2026" -> { from, to }. */
export function parseBillbeeZeitraum(raw: string): { from: Date; to: Date } {
  const match = raw.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (!match) {
    throw new Error(`Kann Zeitraum nicht lesen: "${raw}"`);
  }
  return {
    from: parseGermanDDMMYYYY(match[1]),
    to: parseGermanDDMMYYYY(match[2]),
  };
}

const GERMAN_MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mär: 2,
  maer: 2,
  mrz: 2,
  apr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  okt: 9,
  nov: 10,
  dez: 11,
};

/** "Bericht vom 1. Jan 2026 bis 15. Jul 2026" -> { from, to }. */
export function parseEbayReportDateRange(raw: string): { from: Date; to: Date } | null {
  const match = raw.match(
    /vom\s+(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4})\s+bis\s+(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4})/i
  );
  if (!match) {
    return null;
  }
  const [, d1, m1, y1, d2, m2, y2] = match;
  const month1 = GERMAN_MONTHS[m1.toLowerCase().slice(0, 3)];
  const month2 = GERMAN_MONTHS[m2.toLowerCase().slice(0, 3)];
  if (month1 === undefined || month2 === undefined) {
    return null;
  }
  return {
    from: new Date(Date.UTC(parseInt(y1, 10), month1, parseInt(d1, 10))),
    to: new Date(Date.UTC(parseInt(y2, 10), month2, parseInt(d2, 10))),
  };
}

export type SaleWindowKey = "30" | "90" | "365" | "all";

/** Ordnet eine Zeitspanne (in Tagen) dem naechstliegenden Fenster zu. */
export function classifyWindow(from: Date, to: Date): SaleWindowKey {
  const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 45) return "30";
  if (days <= 120) return "90";
  if (days <= 400) return "365";
  return "all";
}
