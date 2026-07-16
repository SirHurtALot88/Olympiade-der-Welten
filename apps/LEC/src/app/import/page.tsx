import { prisma } from "@/lib/db/client";
import { listOpenReviewItems } from "@/lib/pipeline/review";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ImportView } from "@/components/import/ImportView";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const reviewItems = await listOpenReviewItems(prisma);
  const articleCount = await prisma.article.count({ where: { isCard: true } });

  return (
    <div className="app">
      <Sidebar active="import" />
      <main>
        <div className="topbar">
          <div>
            <h1>Import &amp; Matching</h1>
            <div className="sub">Billbee-Fenster (30/90/365 T) + eBay-Report hochladen</div>
          </div>
          <div className="spacer" />
        </div>
        <ImportView initialReviewItems={reviewItems} articleCount={articleCount} />
      </main>
    </div>
  );
}
