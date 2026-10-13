import type { SaleWindowKey } from "../parsing/date";
import type { ArticleAggregate } from "../dashboard/viewModel";

/**
 * Shopweite Summen eines Fensters ueber alle Artikel -- dieselben Felder, die
 * `buildDashboardViewModel` fuer `windows[w]` aufsummiert, plus die Kostenbloecke, die das
 * Dashboard dort noch nicht ausweist (Wareneinsatz, eBay, Versand, Fixkostenanteil). Das Cockpit
 * rechnet nichts neu, es summiert nur die gespeicherten Fenster-Snapshots.
 */
export interface WindowSums {
  window: SaleWindowKey;
  qty: number;
  revenue: number;
  ek: number;
  ebayFeeTotal: number;
  shippingCost: number;
  dbI: number;
  dbII: number;
  fixedCostShare: number;
  /** DB III = DB II - Fixkostenanteil (Vollkosten-Ergebnis des Fensters). */
  dbIII: number;
  /** Anzahl Artikel mit mindestens einem Verkauf im Fenster. */
  articlesWithSales: number;
}

export const WINDOW_KEYS: SaleWindowKey[] = ["30", "90", "365", "all"];

export function emptyWindowSums(window: SaleWindowKey): WindowSums {
  return {
    window,
    qty: 0,
    revenue: 0,
    ek: 0,
    ebayFeeTotal: 0,
    shippingCost: 0,
    dbI: 0,
    dbII: 0,
    fixedCostShare: 0,
    dbIII: 0,
    articlesWithSales: 0,
  };
}

export function sumWindow(articles: ArticleAggregate[], window: SaleWindowKey): WindowSums {
  const s = emptyWindowSums(window);
  for (const a of articles) {
    const w = a.windows[window];
    if (!w) continue;
    s.qty += w.qty;
    s.revenue += w.revenue;
    s.ek += w.ek;
    s.ebayFeeTotal += w.ebayFeeTotal;
    s.shippingCost += w.shippingCost;
    s.dbI += w.dbI;
    s.dbII += w.dbII;
    s.fixedCostShare += w.fixedCostShare;
    if (w.qty > 0) s.articlesWithSales++;
  }
  s.dbIII = s.dbII - s.fixedCostShare;
  return s;
}

export function sumAllWindows(articles: ArticleAggregate[]): Record<SaleWindowKey, WindowSums> {
  return {
    "30": sumWindow(articles, "30"),
    "90": sumWindow(articles, "90"),
    "365": sumWindow(articles, "365"),
    all: sumWindow(articles, "all"),
  };
}
