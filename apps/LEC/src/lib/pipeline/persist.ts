import type { PrismaClient } from "@prisma/client";
import type { ImportPlan } from "./importPlan";

export interface PersistResult {
  articlesUpserted: number;
  saleWindowsUpserted: number;
  reviewItemsCreated: number;
}

/**
 * Schreibt einen ImportPlan (siehe importPlan.ts) in die Datenbank. Duennes
 * Prisma-Adapter — die eigentliche Berechnungslogik ist DB-unabhaengig und
 * in importPlan.ts getestet. Diese Funktion wird gegen die echten
 * .local-fixtures nur lokal ueber scripts/import-local-fixtures.ts verifiziert.
 */
export async function persistImportPlan(
  prisma: PrismaClient,
  plan: ImportPlan
): Promise<PersistResult> {
  const articleIdByName = new Map<string, string>();

  for (const article of plan.articles) {
    const record = await prisma.article.upsert({
      where: { nameNormalized: article.nameNormalized },
      create: {
        nameNormalized: article.nameNormalized,
        nameRaw: article.nameRaw,
        setCode: article.setCode,
        packQty: article.packQty,
        isCard: article.isCard,
      },
      update: {
        nameRaw: article.nameRaw,
        setCode: article.setCode,
        packQty: article.packQty,
        isCard: article.isCard,
      },
    });
    articleIdByName.set(article.nameNormalized, record.id);
  }

  let saleWindowsUpserted = 0;
  for (const sw of plan.saleWindows) {
    const articleId = articleIdByName.get(sw.nameNormalized);
    if (!articleId) continue;

    await prisma.saleWindow.upsert({
      where: {
        articleId_window_windowFrom_windowTo: {
          articleId,
          window: sw.window,
          windowFrom: sw.windowFrom,
          windowTo: sw.windowTo,
        },
      },
      create: {
        articleId,
        window: sw.window,
        windowFrom: sw.windowFrom,
        windowTo: sw.windowTo,
        qty: sw.qty,
        revenue: sw.revenue,
        ek: sw.ek,
        margeBillbee: sw.margeBillbee,
        ebayFeeTotal: sw.ebayFeeTotal,
        shippingCost: sw.shippingCost,
        fixedCostShare: sw.fixedCostShare,
        dbI: sw.dbI,
        dbII: sw.dbII,
        avgPrice: sw.avgPrice,
      },
      update: {
        qty: sw.qty,
        revenue: sw.revenue,
        ek: sw.ek,
        margeBillbee: sw.margeBillbee,
        ebayFeeTotal: sw.ebayFeeTotal,
        shippingCost: sw.shippingCost,
        fixedCostShare: sw.fixedCostShare,
        dbI: sw.dbI,
        dbII: sw.dbII,
        avgPrice: sw.avgPrice,
        snapshotDate: new Date(),
      },
    });
    saleWindowsUpserted++;
  }

  let reviewItemsCreated = 0;
  for (const item of plan.reviewItems) {
    const existing = await prisma.reviewItem.findFirst({
      where: { source: item.source, nameRaw: item.nameRaw, status: "open" },
    });
    if (existing) continue;
    await prisma.reviewItem.create({
      data: {
        source: item.source,
        nameRaw: item.nameRaw,
        nameNormalized: item.nameNormalized,
        setCode: item.setCode,
        qty: item.qty,
        revenue: item.revenue,
      },
    });
    reviewItemsCreated++;
  }

  return {
    articlesUpserted: plan.articles.length,
    saleWindowsUpserted,
    reviewItemsCreated,
  };
}
