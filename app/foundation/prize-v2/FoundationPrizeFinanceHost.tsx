"use client";

import type * as React from "react";

import FoundationPrizeV2Panel, {
  type FoundationPrizeV2PanelProps,
} from "@/app/foundation/prize-v2/FoundationPrizeV2Panel";
import FoundationSponsorsPanel from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";
import { usePrizeV2PanelModel } from "@/lib/foundation/tabs/use-prize-v2-panel-model";

type FoundationSponsorsPanelProps = React.ComponentProps<typeof FoundationSponsorsPanel>;

type PrizeV2HostInnerProps = Omit<
  FoundationPrizeFinanceHostProps["prizePanelBaseProps"],
  never
>;

function FoundationPrizeV2HostInner(props: PrizeV2HostInnerProps) {
  const {
    prizePreviewRows,
    selectedPrizePreviewRow,
    selectedRoster,
    selectedStandingRow,
    prizePreviewSort,
    tableColumnPreferences,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
    ...panelProps
  } = props;

  const model = usePrizeV2PanelModel({
    gameState: panelProps.gameState,
    prizePreviewFeed: panelProps.prizePreviewFeed,
    prizePreviewRows,
    selectedPrizePreviewRow,
    selectedTeam: panelProps.selectedTeam,
    selectedRoster,
    selectedStandingRow,
    prizePreviewSort,
    tableColumnPreferences,
    isTableColumnVisible,
    getTablePinnedLeftIds,
    getTablePinnedRightIds,
  });

  return (
    <FoundationPrizeV2Panel
      {...panelProps}
      isTableColumnVisible={isTableColumnVisible}
      prizeForecastRank={model.prizeForecastRank}
      setPrizeForecastRank={model.setPrizeForecastRank}
      prizeForecastRankRow={model.prizeForecastRankRow}
      prizeForecastRows={model.prizeForecastRows}
      prizePreviewTableColumns={model.prizePreviewTableColumns}
      visiblePrizePreviewColumns={model.visiblePrizePreviewColumns}
      displayPrizePreviewRows={model.displayPrizePreviewRows}
      prizeV2Summary={model.prizeV2Summary}
      prizeV2LeaderRow={model.prizeV2LeaderRow}
      prizeV2TopSponsorRow={model.prizeV2TopSponsorRow}
      prizeV2TotalSponsorCash={model.prizeV2TotalSponsorCash}
      prizeV2SelectedTeamSummary={model.prizeV2SelectedTeamSummary}
      prizeV2SwingRow={model.prizeV2SwingRow}
      prizeV2RiskRow={model.prizeV2RiskRow}
      prizeV2FactorRows={model.prizeV2FactorRows}
    />
  );
}

export type FoundationPrizeFinanceHostProps = {
  prizeFinanceTab: "sponsors" | "prize";
  sponsorsPanelProps: FoundationSponsorsPanelProps;
  prizePanelBaseProps: Omit<
    FoundationPrizeV2PanelProps,
    | "prizeForecastRank"
    | "setPrizeForecastRank"
    | "prizeForecastRankRow"
    | "prizeForecastRows"
    | "prizePreviewTableColumns"
    | "visiblePrizePreviewColumns"
    | "displayPrizePreviewRows"
    | "prizeV2Summary"
    | "prizeV2LeaderRow"
    | "prizeV2TopSponsorRow"
    | "prizeV2TotalSponsorCash"
    | "prizeV2SelectedTeamSummary"
    | "prizeV2SwingRow"
    | "prizeV2RiskRow"
    | "prizeV2FactorRows"
  > & {
    prizePreviewRows: FoundationPrizeV2PanelProps["displayPrizePreviewRows"];
    selectedPrizePreviewRow: FoundationPrizeV2PanelProps["prizeForecastRankRow"];
    selectedRoster: import("@/lib/data/olyDataTypes").RosterEntry[];
    selectedStandingRow: FoundationPrizeV2PanelProps["seasonEndChampionRow"];
    prizePreviewSort: FoundationPrizeV2PanelProps["tableSorts"]["prizePreview"];
    tableColumnPreferences: Record<string, { columnOrder?: string[] } | undefined>;
    isTableColumnVisible: FoundationPrizeV2PanelProps["isTableColumnVisible"];
    getTablePinnedLeftIds: (tableId: string) => string[];
    getTablePinnedRightIds: (tableId: string) => string[];
  };
};

/**
 * Prize finance host (Strangler Phase 2). Mounts sponsors or prize sub-panels
 * only while `activeView === "prize"`. Prize V2 derivations run in
 * `usePrizeV2PanelModel` when the prize sub-tab is active.
 */
export default function FoundationPrizeFinanceHost({
  prizeFinanceTab,
  sponsorsPanelProps,
  prizePanelBaseProps,
}: FoundationPrizeFinanceHostProps) {
  if (prizeFinanceTab === "sponsors") {
    return <FoundationSponsorsPanel {...sponsorsPanelProps} prizeFinanceTab={prizeFinanceTab} />;
  }

  return <FoundationPrizeV2HostInner {...prizePanelBaseProps} />;
}
