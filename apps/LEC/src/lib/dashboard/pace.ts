/**
 * Verkaufstempo je Monat aus den ECHTEN Einzelverkaeufen (Datum + Menge), mit abklingender Gewichtung:
 * juengere Verkaeufe zaehlen mehr, aelteste noch mit. Das ist realistischer als ein starres 90-Tage-Fenster
 * (ein einzelner Verkauf ergab bei 10 Verkaeufen im Jahr "12 Monate Reichweite") und als der Jahresschnitt allein
 * (uebersieht anziehenden oder abflauenden Absatz).
 *
 * Schaetzer fuer konstante Rate ueber `spanDays`: rate/Tag = Σ menge·e^(−λ·alter) · λ / (1 − e^(−λ·span)),
 * λ = ln2 / Halbwertszeit. Bei gleichmaessigem Absatz kommt der Jahresschnitt heraus.
 */
export function weightedMonthlyPace(
  sales: { soldAt: Date; qty: number }[],
  now: Date,
  opts: { halfLifeDays?: number; spanDays?: number } = {}
): number {
  const half = opts.halfLifeDays ?? 180;
  const span = opts.spanDays ?? 365;
  const lambda = Math.LN2 / half;
  let sum = 0;
  for (const s of sales) {
    const age = (now.getTime() - s.soldAt.getTime()) / 86_400_000;
    if (age < 0 || age > span || !(s.qty > 0)) continue;
    sum += s.qty * Math.exp(-lambda * age);
  }
  const perDay = (sum * lambda) / (1 - Math.exp(-lambda * span));
  return perDay * 30.4375;
}
