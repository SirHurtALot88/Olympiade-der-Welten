import type { PrismaClient } from "@prisma/client";
import type { ImportPlan } from "./importPlan";
import type { SaleWindowKey } from "../parsing/date";

export interface PersistResult {
  articlesUpserted: number;
  saleWindowsWritten: number;
  windowsReplaced: SaleWindowKey[];
  reviewItemsCreated: number;
  reviewItemsOpen: number;
}

/**
 * Schreibt einen ImportPlan (siehe importPlan.ts) in die Datenbank. Duennes
 * Prisma-Adapter — die eigentliche Berechnungslogik ist DB-unabhaengig und in
 * importPlan.ts getestet.
 *
 * Idempotenz: Ein Re-Import DESSELBEN Fensters (30/90/365/all) ersetzt dessen
 * Snapshot vollstaendig. Dazu werden vor dem Schreiben alle vorhandenen
 * SaleWindows der im Plan enthaltenen Fenster-Keys geloescht und frisch
 * angelegt. So bleibt pro (Artikel, Fenster) genau ein aktueller Snapshot
 * (das Dashboard aggregiert je Fenster-Key -- mehrere Snapshots wuerden sonst
 * doppelt zaehlen).
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

  // Fenster-Keys, die dieser Import mitbringt -> vor dem Neuschreiben leeren.
  const windowsReplaced = Array.from(
    new Set(plan.saleWindows.map((sw) => sw.window))
  ) as SaleWindowKey[];
  if (windowsReplaced.length > 0) {
    await prisma.saleWindow.deleteMany({ where: { window: { in: windowsReplaced } } });
  }

  let saleWindowsWritten = 0;
  const writtenKeys = new Set<string>();
  for (const sw of plan.saleWindows) {
    const articleId = articleIdByName.get(sw.nameNormalized);
    if (!articleId) continue;

    // Defensiv gegen die Unique-Constraint (articleId, window, from, to):
    // sollte derselbe Artikel im selben Fenster doppelt vorkommen (z. B. zwei
    // Zeilen mit identischem normalisiertem Namen in einer Datei), nur einmal
    // schreiben.
    const key = `${articleId}::${sw.window}::${sw.windowFrom.getTime()}::${sw.windowTo.getTime()}`;
    if (writtenKeys.has(key)) continue;
    writtenKeys.add(key);

    await prisma.saleWindow.create({
      data: {
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
    });
    saleWindowsWritten++;
  }

  // Review-Liste nur neu aufbauen, wenn dieser Import einen eBay-Report
  // enthielt (nur dann liegt Match-Information vor). Ein reiner Billbee-Import
  // wuerde sonst die bestehenden offenen Reviews grundlos loeschen.
  if (!plan.reviewListEvaluated) {
    const reviewItemsOpenCount = await prisma.reviewItem.count({ where: { status: "open" } });
    return {
      articlesUpserted: plan.articles.length,
      saleWindowsWritten,
      windowsReplaced,
      reviewItemsCreated: 0,
      reviewItemsOpen: reviewItemsOpenCount,
    };
  }

  // Bereits per Alias gelernte oder manuell erledigte/ignorierte Namen NICHT
  // erneut vorschlagen. Offene (noch unbearbeitete) Review-Items werden vor
  // dem Neuaufbau geleert, damit keine veralteten Vorschlaege stehen bleiben.
  await prisma.reviewItem.deleteMany({ where: { status: "open" } });

  const knownAliases = new Set(
    (await prisma.articleAlias.findMany({ select: { nameVariant: true } })).map((a) => a.nameVariant)
  );
  const handledReviews = new Set(
    (
      await prisma.reviewItem.findMany({
        where: { status: { in: ["resolved", "ignored"] } },
        select: { nameNormalized: true },
      })
    ).map((r) => r.nameNormalized)
  );

  let reviewItemsCreated = 0;
  const seen = new Set<string>();
  for (const item of plan.reviewItems) {
    const dedupeKey = `${item.source}::${item.nameNormalized}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    if (knownAliases.has(item.nameNormalized) || handledReviews.has(item.nameNormalized)) continue;

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

  const reviewItemsOpen = await prisma.reviewItem.count({ where: { status: "open" } });
  return {
    articlesUpserted: plan.articles.length,
    saleWindowsWritten,
    windowsReplaced,
    reviewItemsCreated,
    reviewItemsOpen,
  };
}
