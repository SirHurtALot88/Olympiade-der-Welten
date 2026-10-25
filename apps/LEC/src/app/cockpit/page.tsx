import { prisma } from "@/lib/db/client";
import { loadCockpitViewModel } from "@/lib/cockpit/queries";
import { parseWindowParam } from "@/lib/cockpit/viewModel";
import { CockpitPage } from "@/components/cockpit/CockpitPage";
import "./cockpit.css";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /cockpit -- neues Dashboard (COCKPIT_V2_KONZEPT.md), reine Server Component: das Fenster kommt
 * aus der URL (?fenster=30|90|365|all), alle Charts sind serverseitig gerendertes HTML/SVG,
 * kein zusaetzliches Client-JS.
 */
export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const window = parseWindowParam(params.fenster);
  const vm = await loadCockpitViewModel(prisma, window);
  return <CockpitPage vm={vm} />;
}
