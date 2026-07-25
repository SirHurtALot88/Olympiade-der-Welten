import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { classifyArticles } from "@/lib/dashboard/viewModel";
import { classifiedToRecord } from "@/lib/dashboard/topFlop";
import { TopFlopPage } from "@/components/topflop/TopFlopPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates } = await loadArticleAggregates(prisma);
  const classified = classifyArticles(aggregates);
  const classByArticleId = classifiedToRecord(classified);

  return <TopFlopPage articles={aggregates} classByArticleId={classByArticleId} />;
}
