import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Einkaeufe und eBay-Verkaufsberichte eines Artikels fuer das Detail-Fenster im Sortiment.
 * Nur lesend. Verkaufsdaten gibt es nur je Berichtszeitraum (von/bis), nicht je Einzelverkauf.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [purchases, facts, market, sales] = await Promise.all([
    prisma.purchase.findMany({ where: { articleId: id }, orderBy: { date: "desc" }, take: 50 }),
    prisma.ebayListingFact.findMany({ where: { articleId: id }, orderBy: { reportTo: "desc" }, take: 20 }),
    prisma.marketPrice.findFirst({ where: { articleId: id, source: "cardmarket-priceguide" }, orderBy: { fetchedAt: "desc" } }),
    prisma.sale.findMany({ where: { articleId: id }, orderBy: { soldAt: "desc" }, take: 40 }),
  ]);
  return NextResponse.json({
    purchases: purchases.map((p) => ({
      date: p.date.toISOString(),
      qty: p.qty,
      unitEk: p.unitEk,
      buyShipping: p.buyShipping,
      source: p.source,
    })),
    sales: sales.map((x) => ({ soldAt: x.soldAt.toISOString(), qty: x.qty, unitPrice: x.unitPrice })),
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
