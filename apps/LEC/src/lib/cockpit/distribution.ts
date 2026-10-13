import type { ArticleClass } from "../pricing/classification";
import { LABELS_DE, type SortimentRow } from "../dashboard/viewModel";

/**
 * Verteilungen fuer die 100 %-Stapelbalken (COCKPIT_V2_KONZEPT §4 Module 9 + 10).
 * Reihenfolge der Klassen ist ORDINAL (gesund → tot), deshalb fest und nie nach Groesse sortiert:
 * der Leser soll die Ordnung in der Farbe wiederfinden.
 */
export const CLASS_ORDER: ArticleClass[] = ["champion", "solide", "beobachten", "faellt_ab", "low_runner", "ladenhueter"];

export type PriceStatusKey = SortimentRow["priceStatus"];
export const PRICE_STATUS_ORDER: PriceStatusKey[] = ["ueber_gut", "im_korridor", "ziel_unerreichbar", "unter_min", "kein_ek"];
export const PRICE_STATUS_LABELS: Record<PriceStatusKey, string> = {
  ueber_gut: "über GUT",
  im_korridor: "im Korridor",
  ziel_unerreichbar: "Ziel unerreichbar",
  unter_min: "unter MIN",
  kein_ek: "kein EK",
};

export interface DistributionSegment<K extends string> {
  key: K;
  label: string;
  count: number;
  countShare: number;
  revenue: number;
  revenueShare: number;
}

export interface Distribution<K extends string> {
  segments: DistributionSegment<K>[];
  total: number;
  totalRevenue: number;
}

function build<K extends string>(
  rows: SortimentRow[],
  order: K[],
  labels: Record<K, string>,
  keyOf: (r: SortimentRow) => K,
  revenueOf: (r: SortimentRow) => number
): Distribution<K> {
  const counts = new Map<K, { count: number; revenue: number }>();
  for (const k of order) counts.set(k, { count: 0, revenue: 0 });
  let total = 0;
  let totalRevenue = 0;
  for (const r of rows) {
    const k = keyOf(r);
    const slot = counts.get(k);
    if (!slot) continue;
    slot.count++;
    slot.revenue += revenueOf(r);
    total++;
    totalRevenue += revenueOf(r);
  }
  return {
    segments: order.map((k) => {
      const s = counts.get(k)!;
      return {
        key: k,
        label: labels[k],
        count: s.count,
        countShare: total > 0 ? s.count / total : 0,
        revenue: s.revenue,
        revenueShare: totalRevenue > 0 ? s.revenue / totalRevenue : 0,
      };
    }),
    total,
    totalRevenue,
  };
}

/** Klassenverteilung ueber ALLE Artikel; Umsatzanteil auf Basis `revenue365`. */
export function classDistribution(rows: SortimentRow[]): Distribution<ArticleClass> {
  return build(rows, CLASS_ORDER, LABELS_DE, (r) => r.articleClass, (r) => r.revenue365);
}

/** Preis-Ampel ueber die AKTIVEN Artikel (nur dort gibt es einen Listenpreis zum Pruefen). */
export function priceStatusDistribution(rows: SortimentRow[]): Distribution<PriceStatusKey> {
  return build(
    rows.filter((r) => r.active),
    PRICE_STATUS_ORDER,
    PRICE_STATUS_LABELS,
    (r) => r.priceStatus,
    (r) => r.revenue365
  );
}
