import type { PrismaClient } from "@prisma/client";

export type StandLevel = "ok" | "warn" | "crit" | "none";

export interface StandItem {
  key: "billbee" | "ebay" | "markt";
  label: string;
  at: string | null;
  level: StandLevel;
}

export interface StandInfo {
  items: StandItem[];
  /** Anteil der Artikel mit Bestand, fuer die ein Marktwert vorliegt (0..1); null = keine Artikel mit Bestand. */
  marktAbdeckung: number | null;
  withStock: number;
  withMarkt: number;
}

const DAY = 86_400_000;

/** Gelb ab warnDays, rot ab doppelter Zeit (Chris/Opus 14.11.): Billbee/eBay 2 Tage, Cardmarket 7 Tage. */
export function freshness(at: Date | null, now: Date, warnDays: number): StandLevel {
  if (!at) return "none";
  const days = (now.getTime() - at.getTime()) / DAY;
  if (days >= warnDays * 2) return "crit";
  if (days >= warnDays) return "warn";
  return "ok";
}

export async function loadStand(prisma: PrismaClient, now = new Date()): Promise<StandInfo> {
  const [billbee, ebay, markt, stockArticles, withMarkt] = await Promise.all([
    prisma.importBatch.findFirst({ where: { kind: { in: ["billbee", "billbee_artikel"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.article.aggregate({ _max: { ebayPriceAt: true } }),
    prisma.marketPrice.aggregate({ where: { source: "cardmarket-priceguide" }, _max: { fetchedAt: true } }),
    prisma.article.count({ where: { active: true, hidden: false, isCard: true, stock: { gt: 0 } } }),
    prisma.article.count({
      where: {
        active: true,
        hidden: false,
        isCard: true,
        stock: { gt: 0 },
        marketPrices: { some: { source: "cardmarket-priceguide", priceTrend: { not: null } } },
      },
    }),
  ]);
  const b = billbee?.createdAt ?? null;
  const e = ebay._max.ebayPriceAt ?? null;
  const m = markt._max.fetchedAt ?? null;
  return {
    items: [
      { key: "billbee", label: "Billbee", at: b?.toISOString() ?? null, level: freshness(b, now, 2) },
      { key: "ebay", label: "eBay", at: e?.toISOString() ?? null, level: freshness(e, now, 2) },
      { key: "markt", label: "Cardmarket", at: m?.toISOString() ?? null, level: freshness(m, now, 7) },
    ],
    marktAbdeckung: stockArticles > 0 ? withMarkt / stockArticles : null,
    withStock: stockArticles,
    withMarkt,
  };
}
