/** Zahlen- und Textformate des Office (Hauskomma, Einheit C). */
const MINUS = "−";

export function zahl(v: number, stellen = 2): string {
  const n = Number.isFinite(v) ? v : 0;
  const t = Math.abs(n).toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
  return n < 0 && Math.abs(n) >= 0.5 * Math.pow(10, -stellen) ? `${MINUS}${t}` : t;
}

export const C = (v: number, stellen = 2) => `${zahl(v, stellen)} C`;

/** Mit Vorzeichen: +0,5 / −0,4 / ±0. */
export function vz(v: number, stellen = 1): string {
  if (Math.abs(v) < 0.5 * Math.pow(10, -stellen)) return "±0";
  return `${v > 0 ? "+" : MINUS}${zahl(Math.abs(v), stellen)}`;
}

export const vzKlasse = (v: number) => (v > 0.004 ? "is-plus" : v < -0.004 ? "is-minus" : "is-null");

export function prozent(anteil: number): string {
  return `${Math.round(anteil * 100)} %`;
}
