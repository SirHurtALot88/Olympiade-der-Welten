import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { classifyArticles, buildFullSortiment, buildRecommendations } from "@/lib/dashboard/viewModel";
import { EmpfehlungenPage } from "@/components/empfehlungen/EmpfehlungenPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);
  const classified = classifyArticles(aggregates);
  const sortiment = buildFullSortiment(aggregates, classified, costSettings);
  const recommendations = buildRecommendations(classified, sortiment);

  const sum = (kind: string) =>
    recommendations.filter((r) => r.kind === kind).reduce((s, r) => s + r.effectValue, 0);
  const count = (kind: string) => recommendations.filter((r) => r.kind === kind).length;

  const kpis = {
    boundCapital: sum("lot_bilden"),
    lowRunnerLoss: sum("auslisten"),
    givenAwayMargin: sum("preis_anpassen"),
    nachkaufCount: count("nachkaufen"),
  };

  return <EmpfehlungenPage recommendations={recommendations} kpis={kpis} />;
}
