import { formatEuro, formatEuroCents, formatPercent } from "@/lib/format";

/** "€ 1.234" -- gerundet, mit Euro-Zeichen vorn (wie im Rest der App). */
export function eur(value: number): string {
  return `€ ${formatEuro(value)}`;
}

/** "€ 12,34". */
export function eurCents(value: number): string {
  return `€ ${formatEuroCents(value)}`;
}

/** Signiert: "+€ 120" / "−€ 80". */
export function eurSigned(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}€ ${formatEuro(Math.abs(value))}`;
}

/** "38 %" aus 0.38. */
export function pct(value: number, digits = 0): string {
  if (digits === 0) return `${formatPercent(value)} %`;
  return `${(value * 100).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

/** Kompakt fuer Achsen: 0 / 500 / 1,2k / 24k. */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000) return `${Math.round(value / 1000).toLocaleString("de-DE")}k`;
  if (abs >= 1000) return `${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}k`;
  return Math.round(value).toLocaleString("de-DE");
}

export function dateDe(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** Artikelname ohne das immer gleiche "Yu-Gi-Oh!"-Praefix. */
export function shortName(name: string): string {
  return name.replace(/^(\d+x\s*)?Yu-Gi-Oh!\s*/i, (m) => (m.match(/^\d+x/) ? `${m.match(/^\d+x/)![0]} ` : ""));
}
