import TransfermarktLabClient from "@/app/foundation/transfermarkt-lab/TransfermarktLabClient";
import { listTransfermarktFreeAgents, type TransfermarktReadResult } from "@/lib/market/transfermarkt-read-service";

export const dynamic = "force-dynamic";

export default function TransfermarktLabPage() {
  return loadPage();
}

async function loadPage() {
  let initialData: TransfermarktReadResult | null = null;
  let initialError: string | null = null;

  try {
    initialData = await listTransfermarktFreeAgents({
      saveId: "save-initial",
      seasonId: "season-1",
      limit: 50,
    });
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Transfermarkt free agents could not be loaded.";
  }

  return <TransfermarktLabClient initialData={initialData} initialError={initialError} />;
}
