"use client";

import dynamic from "next/dynamic";

import type { TransfermarktModernProps } from "@/app/foundation/transfermarkt-modern/tm-typen";
import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";

const TransfermarktModern = dynamic(() => import("@/app/foundation/transfermarkt-modern/TransfermarktModern"), {
  ssr: false,
  loading: () => <FoundationPanelSkeleton variant="marketV2" label="Transfermarkt wird geladen…" />,
});

export type TransferWindowStatusView = {
  open: boolean;
  label: string;
  phase: string;
  canSell: boolean;
  canBuy: boolean;
};

export type FoundationTransfermarktV2PanelProps = {
  active: boolean;
  transferWindowStatus: TransferWindowStatusView;
  marketVisibleFeedCount: number;
  marketActiveFreeAgentCount: number;
  sourceBadgeLabel: string;
  activeSaveName: string;
  seasonId: string;
  selectedTeamLabel: string;
  formatGamePhaseLabel: (phase: string) => string;
  clientKey: string;
  client: TransfermarktModernProps;
};

export default function FoundationTransfermarktV2Panel({
  active,
  transferWindowStatus,
  formatGamePhaseLabel,
  clientKey,
  client,
}: FoundationTransfermarktV2PanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel transfer-market-panel foundation-transfermarkt-v2-panel" data-testid="transfer-market" id="transfer-market">
      {/* Die frühere Legacy-Kopfzeile (panel-header mit "Transfermarkt"-Heading
          + source-Pill, plus foundation-view-source-row) ist entfernt — der
          Neuer-Look-Client (TransfermarktV2Client) rendert bereits seine eigene
          velo Kopfkarte, die doppelte Legacy-Chrome darüber war redundant.
          Der Transferfenster-Status wird ebenfalls einzig vom Neuer-Look-Client
          (marketWindowNotice) angezeigt. */}
      <TransfermarktModern
        key={clientKey}
        {...client}
        transferWindow={{
          open: transferWindowStatus.open,
          canBuy: transferWindowStatus.canBuy,
          canSell: transferWindowStatus.canSell,
          phaseLabel: formatGamePhaseLabel(transferWindowStatus.phase),
        }}
      />
    </section>
  );
}
