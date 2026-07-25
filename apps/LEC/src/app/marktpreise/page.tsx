import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { buildMarketComparisonRow } from "@/lib/dashboard/marketComparison";
import { MarktpreisePage } from "@/components/marktpreise/MarktpreisePage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);

  const quotes = await prisma.marketPrice.findMany({ orderBy: { fetchedAt: "desc" } });
  const latestByArticle = new Map<string, (typeof quotes)[number]>();
  for (const q of quotes) {
    if (!latestByArticle.has(q.articleId)) latestByArticle.set(q.articleId, q);
  }

  const rows = aggregates
    .filter((a) => latestByArticle.has(a.articleId))
    .map((a) => buildMarketComparisonRow(a, latestByArticle.get(a.articleId)!, costSettings))
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());

  return <MarktpreisePage rows={rows} />;
}
