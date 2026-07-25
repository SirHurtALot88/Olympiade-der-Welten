import { prisma } from "@/lib/db/client";
import { loadActiveCostSettings, listRecentImportBatches } from "@/lib/dashboard/queries";
import { getAuthConfig } from "@/lib/auth/config";
import { EinstellungenPage } from "@/components/einstellungen/EinstellungenPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const costSettings = await loadActiveCostSettings(prisma);
  const importBatchesRaw = await listRecentImportBatches(prisma, 20);
  const importBatches = importBatchesRaw.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    windowFrom: b.windowFrom ? b.windowFrom.toISOString() : null,
    windowTo: b.windowTo ? b.windowTo.toISOString() : null,
  }));
  const auth = getAuthConfig();

  return (
    <EinstellungenPage
      costSettings={costSettings}
      importBatches={importBatches}
      authEnabled={auth.enabled}
    />
  );
}
