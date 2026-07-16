import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { classifyArticles, buildFullSortiment } from "@/lib/dashboard/viewModel";
import { SortimentPage } from "@/components/sortiment/SortimentPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);
  const classified = classifyArticles(aggregates);
  const rows = buildFullSortiment(aggregates, classified, costSettings);

  // "Aktiv" = im Billbee-Artikelstamm-Katalog vorhanden (Chris' Ergaenzung:
  // die reine Verkaufshistorie enthaelt auch laengst ausgelaufene Artikel).
  const activeCount = rows.filter((r) => r.active).length;
  const discontinuedCount = rows.length - activeCount;
  const ladenhueterCount = rows.filter((r) => r.articleClass === "ladenhueter").length;

  return (
    <SortimentPage
      rows={rows}
      totalCount={rows.length}
      activeCount={activeCount}
      discontinuedCount={discontinuedCount}
      ladenhueterCount={ladenhueterCount}
    />
  );
}
