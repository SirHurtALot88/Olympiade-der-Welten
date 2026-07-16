"use client";

import FoundationPrizeFinanceHost, {
  type FoundationPrizeFinanceHostProps,
} from "@/app/foundation/prize-v2/FoundationPrizeFinanceHost";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { usePrizePanelDerivations } from "@/lib/foundation/tabs/use-prize-panel-derivations";

export type FoundationPrizeFinanceShellHostProps = Omit<
  FoundationPrizeFinanceHostProps,
  "prizePanelBaseProps"
> & {
  activeView: FoundationViewId;
  seasonStandRows: TeamManagementSnapshotRow[];
  prizePanelBaseProps: Omit<
    FoundationPrizeFinanceHostProps["prizePanelBaseProps"],
    | "prizePreviewRows"
    | "selectedPrizePreviewRow"
    | "prizePreviewGlobalWarnings"
    | "prizePreviewHardBlocked"
    | "seasonEndChampionRow"
  >;
};

/**
 * Prize finance shell host (Strangler Phase 5.3). Mounts prize-only derivations
 * only while the prize tab is active.
 */
export default function FoundationPrizeFinanceShellHost({
  activeView,
  seasonStandRows,
  prizePanelBaseProps,
  ...hostProps
}: FoundationPrizeFinanceShellHostProps) {
  const {
    prizePreviewRows,
    prizePreviewGlobalWarnings,
    prizePreviewHardBlocked,
    selectedPrizePreviewRow,
    seasonEndChampionRow,
  } = usePrizePanelDerivations({
    prizePreviewFeed: prizePanelBaseProps.prizePreviewFeed,
    selectedTeam: prizePanelBaseProps.selectedTeam,
    seasonStandRows,
    activeView,
  });

  return (
    <FoundationPrizeFinanceHost
      {...hostProps}
      prizePanelBaseProps={{
        ...prizePanelBaseProps,
        prizePreviewRows,
        prizePreviewGlobalWarnings,
        prizePreviewHardBlocked,
        selectedPrizePreviewRow,
        seasonEndChampionRow,
      }}
    />
  );
}
