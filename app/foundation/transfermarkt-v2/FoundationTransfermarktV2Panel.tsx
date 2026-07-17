"use client";

import dynamic from "next/dynamic";

import type { TransfermarktV2ClientProps } from "@/app/foundation/transfermarkt-v2/TransfermarktV2Client";

const TransfermarktV2Client = dynamic(() => import("@/app/foundation/transfermarkt-v2/TransfermarktV2Client"), {
  ssr: false,
  loading: () => <p className="foundation-view-loading">Transfermarkt wird geladen …</p>,
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
  client: TransfermarktV2ClientProps;
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
      <TransfermarktV2Client
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
