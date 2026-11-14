/**
 * Kennzahlen, die Billbee nicht liefert, aus Daten, die LEC selbst sammelt (TODO.md, Chris 13.11.):
 * Verkaufspreis gegen Marktwert, Wirkung einer Preisaenderung, Tage ohne Bestand, Tage bis zum ersten Verkauf,
 * Kapitalbindung je Ordner/Kartenart. Alles reine Funktionen, ohne Datenbankzugriff.
 */

const DAY = 86_400_000;
const t = (d: Date | string) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

// ---------------------------------------------------------------------------------------------
// 2) Verkaufspreis gegen Marktwert zum Verkaufszeitpunkt
// ---------------------------------------------------------------------------------------------

export interface HistoryPoint {
  at: Date | string;
  priceAvg7: number | null;
  priceTrend: number | null;
}
export interface SaleLite {
  soldAt: Date | string;
  qty: number;
  unitPrice: number;
}
export interface SaleVsMarket {
  soldAt: string;
  unitPrice: number;
  market: number;
  /** unitPrice - market (negativ = unter Markt verkauft). */
  diff: number;
  diffPct: number;
}
export interface SaleVsMarketSummary {
  rows: SaleVsMarket[];
  /** Verkaeufe, zu denen es einen Marktstand aus den 14 Tagen davor gab. */
  matched: number;
  total: number;
  /** Menge-gewichtete Abweichung in % (negativ = im Schnitt unter Markt). */
  avgDiffPct: number | null;
  /** Euro, die gegenueber dem Marktwert liegen blieben (Summe der negativen Abweichungen x Menge). */
  leftOnTable: number;
}

/** Marktreferenz eines Verlaufspunkts: Ø 7 Tage, sonst Trend. Der Preisfuehrer gilt fuer NM; Zustandsabschlaege sind nicht enthalten. */
const refOf = (h: HistoryPoint) => h.priceAvg7 ?? h.priceTrend;

export function saleVsMarket(sales: SaleLite[], history: HistoryPoint[], maxGapDays = 14): SaleVsMarketSummary {
  const hist = history
    .map((h) => ({ at: t(h.at), ref: refOf(h) }))
    .filter((h): h is { at: number; ref: number } => h.ref !== null && h.ref > 0)
    .sort((a, b) => a.at - b.at);
  const rows: SaleVsMarket[] = [];
  let weighted = 0;
  let qtySum = 0;
  let left = 0;
  for (const s of sales) {
    const at = t(s.soldAt);
    let pick: { at: number; ref: number } | null = null;
    for (const h of hist) {
      if (h.at <= at) pick = h;
      else break;
    }
    if (!pick || at - pick.at > maxGapDays * DAY) continue;
    const diff = s.unitPrice - pick.ref;
    const diffPct = (diff / pick.ref) * 100;
    rows.push({ soldAt: new Date(at).toISOString(), unitPrice: s.unitPrice, market: pick.ref, diff, diffPct });
    weighted += diffPct * s.qty;
    qtySum += s.qty;
    if (diff < 0) left += -diff * s.qty;
  }
  return { rows, matched: rows.length, total: sales.length, avgDiffPct: qtySum > 0 ? weighted / qtySum : null, leftOnTable: left };
}

// ---------------------------------------------------------------------------------------------
// 3) Wirkung einer Preisaenderung
// ---------------------------------------------------------------------------------------------

export interface PriceChangeLite {
  at: Date | string;
  before: number;
  after: number;
}
export type PriceEffectVerdict = "schneller" | "langsamer" | "unveraendert" | "zu_wenig_daten";
export interface PriceEffect {
  at: string;
  before: number;
  after: number;
  /** Aenderung in %, bezogen auf den alten Preis. */
  pct: number;
  daysBefore: number;
  daysAfter: number;
  unitsBefore: number;
  unitsAfter: number;
  /** Stueck je 30 Tage vor/nach der Aenderung. */
  perMonthBefore: number;
  perMonthAfter: number;
  verdict: PriceEffectVerdict;
}

export const PRICE_EFFECT = { windowDays: 60, minAfterDays: 14, minChangePct: 10, minUnits: 2, ratio: 1.25 } as const;

/**
 * Vorher/Nachher in gleich langen Fenstern (hoechstens 60 Tage), begrenzt durch die benachbarten Aenderungen. Aenderungen unter 10 %
 * zaehlen nicht, eine Aenderung mit weniger als 14 Tagen Nachlauf ebenfalls nicht. Ein Urteil gibt es nur ab zwei Verkaeufen im
 * Vergleich, sonst "zu wenig Daten": bei Karten mit seltenen Verkaeufen ist das ehrlich der Normalfall.
 */
export function priceEffects(changes: PriceChangeLite[], sales: SaleLite[], now: Date = new Date()): PriceEffect[] {
  const cs = changes
    .map((c) => ({ at: t(c.at), before: c.before, after: c.after }))
    .filter((c) => c.before > 0 && Math.abs(c.after - c.before) / c.before >= PRICE_EFFECT.minChangePct / 100)
    .sort((a, b) => a.at - b.at);
  const all = changes.map((c) => t(c.at)).sort((a, b) => a - b);
  const out: PriceEffect[] = [];
  for (const c of cs) {
    const prev = [...all].reverse().find((x) => x < c.at) ?? null;
    const next = all.find((x) => x > c.at) ?? null;
    const afterEnd = Math.min(next ?? Infinity, c.at + PRICE_EFFECT.windowDays * DAY, now.getTime());
    const daysAfter = (afterEnd - c.at) / DAY;
    if (daysAfter < PRICE_EFFECT.minAfterDays) continue;
    const beforeStart = Math.max(prev ?? -Infinity, c.at - daysAfter * DAY);
    const daysBefore = (c.at - beforeStart) / DAY;
    if (!Number.isFinite(daysBefore) || daysBefore < PRICE_EFFECT.minAfterDays) {
      out.push(effect(c, daysBefore > 0 && Number.isFinite(daysBefore) ? daysBefore : 0, daysAfter, 0, unitsIn(sales, c.at, afterEnd), true));
      continue;
    }
    out.push(effect(c, daysBefore, daysAfter, unitsIn(sales, beforeStart, c.at), unitsIn(sales, c.at, afterEnd), false));
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function unitsIn(sales: SaleLite[], from: number, to: number): number {
  return sales.filter((s) => t(s.soldAt) >= from && t(s.soldAt) < to).reduce((n, s) => n + s.qty, 0);
}

function effect(c: { at: number; before: number; after: number }, daysBefore: number, daysAfter: number, unitsBefore: number, unitsAfter: number, noBefore: boolean): PriceEffect {
  const perMonthBefore = daysBefore > 0 ? (unitsBefore / daysBefore) * 30 : 0;
  const perMonthAfter = (unitsAfter / daysAfter) * 30;
  let verdict: PriceEffectVerdict = "zu_wenig_daten";
  if (!noBefore && unitsBefore + unitsAfter >= PRICE_EFFECT.minUnits) {
    if (perMonthAfter > perMonthBefore * PRICE_EFFECT.ratio) verdict = "schneller";
    else if (perMonthAfter < perMonthBefore / PRICE_EFFECT.ratio) verdict = "langsamer";
    else verdict = "unveraendert";
  }
  return {
    at: new Date(c.at).toISOString(),
    before: c.before,
    after: c.after,
    pct: ((c.after - c.before) / c.before) * 100,
    daysBefore,
    daysAfter,
    unitsBefore,
    unitsAfter,
    perMonthBefore,
    perMonthAfter,
    verdict,
  };
}

// ---------------------------------------------------------------------------------------------
// 5) Tage ohne Bestand
// ---------------------------------------------------------------------------------------------

export interface StockMoveLite {
  at: Date | string;
  before: number;
  after: number;
}
export interface OutOfStock {
  /** Betrachteter Zeitraum in Tagen (hoechstens windowDays, frueheste Grenze ist trackedSince). */
  windowDays: number;
  daysOut: number;
  daysIn: number;
  /** Anteil der Zeit ohne Bestand, 0..1. */
  outShare: number;
  /** Verkaeufe je 30 Tage, gerechnet nur ueber die Tage MIT Bestand; null, wenn nie Bestand oder keine Verkaeufe. */
  perMonthInStock: number | null;
  /** Geschaetzt verpasste Stueck in den Tagen ohne Bestand (Tempo mit Bestand x Tage ohne Bestand / 30). */
  missedUnits: number | null;
}

/**
 * Rekonstruiert den Bestandsverlauf aus den Billbee-Abgleichen (StockMovement) und zaehlt die Tage mit Bestand 0. Vor der ersten
 * Aufzeichnung (trackedSince) ist nichts bekannt, deshalb beginnt das Fenster fruehestens dort. Ohne jede Bewegung gilt der heutige Bestand
 * fuer das ganze Fenster.
 */
export function outOfStock(moves: StockMoveLite[], currentStock: number, sales: SaleLite[], trackedSince: Date, now: Date = new Date(), windowDays = 365): OutOfStock {
  const end = now.getTime();
  const start = Math.max(end - windowDays * DAY, trackedSince.getTime());
  const ms = moves.map((m) => ({ at: t(m.at), before: m.before, after: m.after })).sort((a, b) => a.at - b.at);
  // Bestand zu Beginn des Fensters
  let stock: number;
  const prior = [...ms].reverse().find((m) => m.at <= start);
  if (prior) stock = prior.after;
  else if (ms.length > 0) stock = ms[0].before;
  else stock = currentStock;
  let cursor = start;
  let out = 0;
  let inn = 0;
  for (const m of ms.filter((x) => x.at > start && x.at <= end)) {
    const span = m.at - cursor;
    if (stock <= 0) out += span;
    else inn += span;
    cursor = m.at;
    stock = m.after;
  }
  const tail = end - cursor;
  if (stock <= 0) out += tail;
  else inn += tail;
  const daysOut = out / DAY;
  const daysIn = inn / DAY;
  const total = daysOut + daysIn;
  const units = sales.filter((s) => t(s.soldAt) >= start && t(s.soldAt) <= end).reduce((n, s) => n + s.qty, 0);
  const perMonthInStock = daysIn >= 14 && units > 0 ? (units / daysIn) * 30 : null;
  return {
    windowDays: total,
    daysOut,
    daysIn,
    outShare: total > 0 ? daysOut / total : 0,
    perMonthInStock,
    missedUnits: perMonthInStock !== null ? (perMonthInStock * daysOut) / 30 : null,
  };
}

// ---------------------------------------------------------------------------------------------
// 4) Tage bis zum ersten Verkauf
// ---------------------------------------------------------------------------------------------

export interface FirstSale {
  days: number | null;
  /** true = noch kein Verkauf; days zaehlt dann die Tage seit der Erfassung (Untergrenze fuer die Wartezeit). */
  waiting: boolean;
}

/** Tage von der Erfassung in LEC (Article.createdAt) bis zum ersten Verkauf danach. Verkaeufe vor der Erfassung zaehlen nicht (Altbestand). */
export function daysToFirstSale(firstSeen: Date, sales: SaleLite[], now: Date = new Date()): FirstSale {
  const seen = firstSeen.getTime();
  const later = sales.map((s) => t(s.soldAt)).filter((x) => x >= seen).sort((a, b) => a - b);
  if (later.length > 0) return { days: Math.round((later[0] - seen) / DAY), waiting: false };
  return { days: Math.round((now.getTime() - seen) / DAY), waiting: true };
}

// ---------------------------------------------------------------------------------------------
// 1) Kapitalbindung und Umschlag je Gruppe
// ---------------------------------------------------------------------------------------------

export interface CapitalRowInput {
  active: boolean;
  hidden?: boolean;
  stock: number;
  ek: number;
  ekMissing?: boolean;
  /** Verkaufte Stueck in 365 Tagen. */
  units365: number;
  /** Sortiment-Massnahme (preis_senken | auslaufen | auslisten) oder null. */
  lifecycle?: string | null;
  group: string;
}
export interface CapitalGroup {
  group: string;
  articles: number;
  units: number;
  capital: number;
  /** Kapital in Artikeln mit Massnahme (Preis senken, Auslaufen, Auslisten). */
  stuckCapital: number;
  stuckShare: number;
  /** Artikel mit Bestand, aber ohne bekannten EK (Kapital fehlt in der Summe). */
  withoutEk: number;
  /** Umschlag je Jahr: Wareneinsatz der letzten 365 Tage / gebundenes Kapital. null ohne Kapital. */
  turnsPerYear: number | null;
  /** Tage, bis der Bestand bei heutigem Tempo verkauft ist (365 / Umschlag). */
  daysOfCover: number | null;
}

export function capitalByGroup(rows: CapitalRowInput[]): CapitalGroup[] {
  const map = new Map<string, { articles: number; units: number; capital: number; stuck: number; noEk: number; cogs: number }>();
  for (const r of rows) {
    if (!r.active || r.hidden || r.stock <= 0) continue;
    const g = map.get(r.group) ?? { articles: 0, units: 0, capital: 0, stuck: 0, noEk: 0, cogs: 0 };
    g.articles++;
    g.units += r.stock;
    if (r.ekMissing || r.ek <= 0) {
      g.noEk++;
    } else {
      const cap = r.stock * r.ek;
      g.capital += cap;
      g.cogs += r.units365 * r.ek;
      if (r.lifecycle) g.stuck += cap;
    }
    map.set(r.group, g);
  }
  return [...map.entries()]
    .map(([group, g]): CapitalGroup => {
      const turns = g.capital > 0 ? g.cogs / g.capital : null;
      return {
        group,
        articles: g.articles,
        units: g.units,
        capital: g.capital,
        stuckCapital: g.stuck,
        stuckShare: g.capital > 0 ? g.stuck / g.capital : 0,
        withoutEk: g.noEk,
        turnsPerYear: turns,
        daysOfCover: turns && turns > 0 ? 365 / turns : null,
      };
    })
    .sort((a, b) => b.capital - a.capital);
}

// ---------------------------------------------------------------------------------------------
// Verkaufsmuster je Artikel (Drawer): Monatsbalken, Rhythmus, Mengen je Verkauf
// ---------------------------------------------------------------------------------------------

export interface MonthBar {
  /** "MM.JJ" */
  label: string;
  qty: number;
}

/** Verkaufte Stueck je Kalendermonat fuer die letzten `months` Monate (aeltester zuerst, laufender Monat zuletzt). */
export function monthlyBars(sales: SaleLite[], now: Date = new Date(), months = 12): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bars.push({ label: `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`, qty: 0 });
  }
  const first = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();
  for (const s of sales) {
    const at = new Date(s.soldAt);
    if (at.getTime() < first || at.getTime() > now.getTime()) continue;
    const idx = (at.getFullYear() - new Date(first).getFullYear()) * 12 + (at.getMonth() - new Date(first).getMonth());
    if (idx >= 0 && idx < months) bars[idx].qty += s.qty;
  }
  return bars;
}

export interface SalesPattern {
  /** Anzahl Verkaufszeilen. */
  count: number;
  /** Ø Tage zwischen zwei Verkaufstagen; null bei weniger als zwei Verkaufstagen. */
  avgGapDays: number | null;
  /** Laengste Pause zwischen zwei Verkaufstagen in Tagen. */
  longestGapDays: number | null;
  /** Verkaufszeilen mit genau einem Stueck / mit zwei oder mehr. */
  singles: number;
  multi: number;
}

export function salesPattern(sales: SaleLite[]): SalesPattern {
  const days = [...new Set(sales.map((s) => Math.floor(t(s.soldAt) / DAY)))].sort((a, b) => a - b);
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  return {
    count: sales.length,
    avgGapDays: gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    longestGapDays: gaps.length > 0 ? Math.max(...gaps) : null,
    singles: sales.filter((s) => s.qty === 1).length,
    multi: sales.filter((s) => s.qty > 1).length,
  };
}
