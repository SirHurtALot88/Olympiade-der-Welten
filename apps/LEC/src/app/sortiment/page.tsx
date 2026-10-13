import { prisma } from "@/lib/db/client";
import { loadArticleAggregates } from "@/lib/dashboard/queries";
import { classifyArticles, buildFullSortiment, shopVolumeFromAggregates } from "@/lib/dashboard/viewModel";
import { computeMarketTargetRange } from "@/lib/pricing/costEngine";
import type { BandPoint } from "@/components/sortiment/PreisUeberblick";
import { SortimentPage } from "@/components/sortiment/SortimentPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { aggregates, costSettings } = await loadArticleAggregates(prisma);
  const classified = classifyArticles(aggregates);
  const rows = buildFullSortiment(aggregates, classified, costSettings);

  // Zielband fuer das Streudiagramm: dieselbe Rechnung wie in jeder Zeile, an log-verteilten Marktwerten.
  const shop = shopVolumeFromAggregates(aggregates, costSettings);
  const band: BandPoint[] = [];
  for (let i = 0; i <= 40; i++) {
    const m = 0.3 * Math.pow(700 / 0.3, i / 40);
    const t = computeMarketTargetRange(m, { kind: "single", shop }, costSettings);
    band.push({ m, min: t.min, opt: t.opt });
  }

  // Bildkennung je Artikel: steckt in der Bild-URL, damit der Browser ein
  // geaendertes Bild neu laedt und ein unveraendertes dauerhaft im Cache haelt.
  const withImage = await prisma.article.findMany({
    where: { imageFile: { not: null } },
    select: { id: true, imageGuid: true },
  });
  const imageVersions: Record<string, string> = {};
  for (const a of withImage) imageVersions[a.id] = a.imageGuid ?? "1";

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
      imageVersions={imageVersions}
      band={band}
    />
  );
}
