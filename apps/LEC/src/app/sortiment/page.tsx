import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { classifyArticles, buildFullSortiment } from "@/lib/dashboard/viewModel";
import { SortimentPage } from "@/components/sortiment/SortimentPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);
  const classified = classifyArticles(aggregates);
  const rows = buildFullSortiment(aggregates, classified, costSettings);

  // "Aktiv" = Verkaeufe in den letzten 365 Tagen (Lebenszeit-Historie allein
  // reicht nicht -- genau das waeren sonst die Ladenhueter, KONZEPT §2).
  const activeCount = rows.filter((r) => (r.windows["365"]?.qty ?? 0) > 0).length;
  const ladenhueterCount = rows.filter((r) => r.articleClass === "ladenhueter").length;

  return (
    <SortimentPage
      rows={rows}
      totalCount={rows.length}
      activeCount={activeCount}
      ladenhueterCount={ladenhueterCount}
    />
  );
}
