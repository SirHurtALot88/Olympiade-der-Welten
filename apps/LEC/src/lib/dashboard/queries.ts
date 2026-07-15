import type { PrismaClient } from "@prisma/client";
import type { SaleWindowKey } from "../parsing/date";
import { buildDashboardViewModel, type ArticleAggregate, type DashboardViewModel } from "./viewModel";
import { DEFAULT_COST_SETTINGS } from "../pricing/costSettings";

/** Laedt alle Artikel + Fenster-Snapshots aus der DB und baut das Dashboard-View-Model. */
export async function loadDashboardViewModel(prisma: PrismaClient): Promise<DashboardViewModel> {
  const articles = await prisma.article.findMany({
    where: { isCard: true },
    include: { saleWindows: true },
  });

  const aggregates: ArticleAggregate[] = articles.map((article) => {
    const windows: ArticleAggregate["windows"] = {};
    for (const sw of article.saleWindows) {
      const key = sw.window as SaleWindowKey;
      const existing = windows[key];
      if (existing) {
        // Mehrere Snapshots desselben Fensters (sollte durch die Unique-
        // Constraint kaum vorkommen) -- konservativ aufsummieren.
        existing.qty += sw.qty;
        existing.revenue += sw.revenue;
        existing.ek += sw.ek;
        existing.ebayFeeTotal += sw.ebayFeeTotal;
        existing.shippingCost += sw.shippingCost;
        existing.dbI += sw.dbI;
        existing.dbII += sw.dbII;
        existing.avgPrice = existing.qty > 0 ? existing.revenue / existing.qty : 0;
      } else {
        windows[key] = {
          qty: sw.qty,
          revenue: sw.revenue,
          ek: sw.ek,
          ebayFeeTotal: sw.ebayFeeTotal,
          shippingCost: sw.shippingCost,
          dbI: sw.dbI,
          dbII: sw.dbII,
          avgPrice: sw.avgPrice,
        };
      }
    }

    return {
      articleId: article.id,
      nameRaw: article.nameRaw,
      setCode: article.setCode,
      packQty: article.packQty,
      windows,
    };
  });

  // TODO(Phase 3): cost_settings aus der DB laden (versioniert, konfigurierbar
  // ueber die Einstellungen-Seite). Bis dahin Defaults aus KONZEPT §7.3.
  return buildDashboardViewModel(aggregates, DEFAULT_COST_SETTINGS);
}
