import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { daysToFirstSale, outOfStock, priceEffects, saleVsMarket } from "@/lib/dashboard/kennzahlen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Einkaeufe und eBay-Verkaufsberichte eines Artikels fuer das Detail-Fenster im Sortiment.
 * Nur lesend. Verkaufsdaten gibt es nur je Berichtszeitraum (von/bis), nicht je Einzelverkauf.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [purchases, facts, market, sales, stockLog, priceLog, article, history, losses, allStock, allPrice, ekLog] = await Promise.all([
    prisma.purchase.findMany({ where: { articleId: id }, orderBy: { date: "desc" }, take: 50 }),
    prisma.ebayListingFact.findMany({ where: { articleId: id }, orderBy: { reportTo: "desc" }, take: 20 }),
    prisma.marketPrice.findFirst({ where: { articleId: id, source: "cardmarket-priceguide" }, orderBy: { fetchedAt: "desc" } }),
    prisma.sale.findMany({ where: { articleId: id }, orderBy: { soldAt: "desc" }, take: 200 }),
    prisma.stockMovement.findMany({ where: { articleId: id }, orderBy: { at: "desc" }, take: 40 }),
    prisma.priceChange.findMany({ where: { articleId: id }, orderBy: { at: "desc" }, take: 10 }),
    prisma.article.findUnique({ where: { id }, select: { createdAt: true, stock: true, currentEk: true, billbeeId: true } }),
    prisma.marketPriceHistory.findMany({ where: { articleId: id }, orderBy: { at: "asc" }, select: { at: true, priceAvg7: true, priceTrend: true } }),
    prisma.stockLoss.findMany({ where: { articleId: id }, orderBy: { at: "desc" }, take: 50 }),
    prisma.stockMovement.findMany({ where: { articleId: id }, orderBy: { at: "asc" }, select: { at: true, before: true, after: true } }),
    prisma.priceChange.findMany({ where: { articleId: id }, orderBy: { at: "asc" }, select: { at: true, before: true, after: true } }),
    prisma.ekChange.findMany({ where: { articleId: id }, orderBy: { at: "desc" }, take: 10, select: { at: true, before: true, after: true } }),
  ]);
  const now = new Date();
  const kennzahlen = article
    ? {
        saleVsMarket: saleVsMarket(sales, history),
        priceEffects: priceEffects(allPrice, sales, now),
        outOfStock: outOfStock(allStock, article.stock, sales, article.createdAt, now),
        firstSale: daysToFirstSale(article.createdAt, sales, now),
        historyPoints: history.length,
      }
    : null;
  const lossCost = losses.reduce((n, l) => n + l.qty * (l.unitEk ?? article?.currentEk ?? 0), 0);
  return NextResponse.json({
    billbeeId: article?.billbeeId ?? null,
    kennzahlen,
    ekLog: ekLog.map((c) => ({ at: c.at.toISOString(), before: c.before, after: c.after })),
    losses: losses.map((l) => ({ id: l.id, at: l.at.toISOString(), kind: l.kind, qty: l.qty, unitEk: l.unitEk, note: l.note })),
    lossCost,
    purchases: purchases.map((p) => ({
      date: p.date.toISOString(),
      qty: p.qty,
      unitEk: p.unitEk,
      buyShipping: p.buyShipping,
      source: p.source,
    })),
    sales: sales.map((x) => ({ soldAt: x.soldAt.toISOString(), qty: x.qty, unitPrice: x.unitPrice })),
    priceLog: priceLog.map((c) => ({ at: c.at.toISOString(), before: c.before, after: c.after })),
    stockLog: stockLog.map((m) => ({ at: m.at.toISOString(), before: m.before, after: m.after })),
    reports: facts.map((f) => ({
      from: f.reportFrom.toISOString(),
      to: f.reportTo.toISOString(),
      qtySold: f.qtySold,
      revenue: f.totalRevenueGross,
      avgPrice: f.avgSellingPrice,
    })),
    market: market
      ? {
          avg1: market.priceAvg1,
          avg7: market.priceAvg7,
          avg30: market.priceAvg30,
          trend: market.priceTrend,
          low: market.priceFrom,
          fetchedAt: market.fetchedAt.toISOString(),
        }
      : null,
  });
}
