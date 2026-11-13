/**
 * Dynamischer empfohlener VK (Konzept PREIS_DYNAMIK_KONZEPT.md, Chris 13.11.): Statt fest 25-33 % Marge ein Zielwert m* je Artikel,
 * der aus dem Verkaufsverhalten und dem Markt abgeleitet wird. Alle Werte sind Startwerte und noch nicht an Chris' Verkaeufen kalibriert.
 * m* = 28 % + Tempo + Reichweite + Markt + Preisbeweis, begrenzt auf 15 bis 40 %.
 */
export const DYN = { base: 0.28, min: 0.15, max: 0.4 };

export interface DynSignals {
  /** Gewichtetes Verkaufstempo in Stueck je Monat; null/0 = kein Tempo bekannt. */
  paceMonth: number | null;
  stock: number;
  /** Marktwert je Verkaufseinheit (€), Basis des Preisbands. */
  marketValue: number;
  /** Ø7 / Ø30 - 1 (positiv = Preis zieht an). */
  trend7vs30: number | null;
  /** Guenstigstes Angebot geteilt durch Trend. */
  fromVsTrend: number | null;
  /** Verkaeufe seit der letzten Preisaenderung und Tage seitdem; null = keine Aenderung bekannt. */
  salesSincePriceChange: number | null;
  daysSincePriceChange: number | null;
}

/** Soll an Verkaeufen je Jahr nach Preisband (Startwerte). */
export function soldPerYear(marketValue: number): number {
  return marketValue < 8 ? 4 : marketValue < 20 ? 3 : marketValue < 40 ? 2 : 1;
}

export interface DynResult {
  margin: number;
  /** Beitraege in Prozentpunkten: Tempo, Reichweite, Markt, Preisbeweis. */
  parts: { tempo: number; reichweite: number; markt: number; beweis: number };
  note: string;
}

export function dynamicMargin(s: DynSignals): DynResult {
  const pace = s.paceMonth ?? 0;
  let tempo = 0;
  if (pace > 0) {
    const ratio = (pace * 12) / soldPerYear(s.marketValue);
    tempo = ratio >= 2 ? 5 : ratio >= 1 ? 2 : ratio >= 0.5 ? 0 : -3;
  }
  let reichweite = 0;
  if (pace > 0 && s.stock > 0) {
    const months = s.stock / pace;
    reichweite = months <= 3 && s.stock <= 2 ? 3 : months >= 24 ? -4 : months >= 12 ? -2 : 0;
  }
  let markt = 0;
  if (s.marketValue >= 2) {
    if (s.trend7vs30 !== null) markt += s.trend7vs30 >= 0.1 ? 3 : s.trend7vs30 <= -0.1 ? -3 : 0;
    if (s.fromVsTrend !== null && s.fromVsTrend < 0.6) markt -= 2;
  }
  let beweis = 0;
  if (s.salesSincePriceChange !== null && s.daysSincePriceChange !== null) {
    if (s.salesSincePriceChange >= 2 && s.daysSincePriceChange <= 60) beweis = 3;
    else if (s.salesSincePriceChange === 0 && pace > 0 && (pace * s.daysSincePriceChange) / 30 >= 1.5) beweis = -2;
  }
  const sum = tempo + reichweite + markt + beweis;
  const margin = Math.min(DYN.max, Math.max(DYN.min, DYN.base + sum / 100));
  const bits = [tempo && `Tempo ${tempo > 0 ? "+" : ""}${tempo}`, reichweite && `Reichweite ${reichweite > 0 ? "+" : ""}${reichweite}`, markt && `Markt ${markt > 0 ? "+" : ""}${markt}`, beweis && `Preisbeweis ${beweis > 0 ? "+" : ""}${beweis}`].filter(Boolean);
  return { margin, parts: { tempo, reichweite, markt, beweis }, note: bits.length ? `Zielmarge ${Math.round(margin * 100)} % (28 % ${bits.join(", ")})` : `Zielmarge ${Math.round(margin * 100)} % (kein Signal)` };
}

/** Preisstufen auf .99: unter 10 € in 1-€-, bis 30 € in 2-€-, darueber in 5-€-Schritten. */
export function roundToStep99(price: number): number {
  const step = price < 10 ? 1 : price < 30 ? 2 : 5;
  const stepped = Math.round((price + 0.01) / step) * step - 0.01;
  return Math.max(4.99, Math.round(stepped * 100) / 100);
}
