import { prisma } from "@/lib/db/client";
import { loadDashboardViewModel } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewModel = await loadDashboardViewModel(prisma);
  return <DashboardShell viewModel={viewModel} />;
}
