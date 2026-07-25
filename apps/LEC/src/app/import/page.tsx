import { prisma } from "@/lib/db/client";
import { listOpenReviewItems } from "@/lib/pipeline/review";
import { AppShell } from "@/components/shell/AppShell";
import { ImportView } from "@/components/import/ImportView";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const reviewItems = await listOpenReviewItems(prisma);
  const articleCount = await prisma.article.count({ where: { isCard: true } });

  return (
    <AppShell title="Import & Matching" subtitle="Billbee-Fenster (30/90/365 T) + eBay-Report hochladen">
      <ImportView initialReviewItems={reviewItems} articleCount={articleCount} />
    </AppShell>
  );
}
