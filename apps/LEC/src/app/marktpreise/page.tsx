import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { shopVolumeFromAggregates } from "@/lib/dashboard/viewModel";
import { buildMarketComparisonRow } from "@/lib/dashboard/marketComparison";
import { MarktpreisePage } from "@/components/marktpreise/MarktpreisePage";

export const dynamic = "force-dynamic";

function urgency(r: ReturnType<typeof buildMarketComparisonRow>): number {
  const base = r.status === "zu_guenstig" ? 3000 : r.status === "zu_teuer" ? 2000 : r.ekAboveMarket ? 1000 : 0;
  return base + Math.min(999, Math.abs(r.deltaPercent ?? 0) * 100);
}

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);

  const quotes = await prisma.marketPrice.findMany({ orderBy: { fetchedAt: "desc" } });
  const latestByArticle = new Map<string, (typeof quotes)[number]>();
  for (const q of quotes) {
    if (!latestByArticle.has(q.articleId)) latestByArticle.set(q.articleId, q);
  }

  const shop = shopVolumeFromAggregates(aggregates, costSettings);
  const rows = aggregates
    .filter((a) => latestByArticle.has(a.articleId))
    .map((a) => buildMarketComparisonRow(a, latestByArticle.get(a.articleId)!, costSettings, shop))
    // Handlungsbedarf zuerst: zu guenstig (Geld liegt liegen), zu teuer, EK ueber Markt,
    // danach nach Abstand zum Formel-VK.
    .sort((a, b) => urgency(b) - urgency(a));

  return <MarktpreisePage rows={rows} />;
}
