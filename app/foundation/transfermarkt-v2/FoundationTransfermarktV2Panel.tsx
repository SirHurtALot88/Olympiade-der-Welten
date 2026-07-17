"use client";

import dynamic from "next/dynamic";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
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
  marketVisibleFeedCount,
  marketActiveFreeAgentCount,
  sourceBadgeLabel,
  activeSaveName,
  seasonId,
  selectedTeamLabel,
  formatGamePhaseLabel,
  clientKey,
  client,
}: FoundationTransfermarktV2PanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel transfer-market-panel foundation-transfermarkt-v2-panel" data-testid="transfer-market" id="transfer-market">
      <div className="panel-header">
        <TooltipHeading
          as="h2"
          tooltip={`Sortierung: Marktwert ↓ · sichtbarer Feed ${marketVisibleFeedCount} / aktive Free Agents ${marketActiveFreeAgentCount}.`}
        >
          Transfermarkt
        </TooltipHeading>
        <span className="pill foundation-source-pill">source: active local save</span>
      </div>
      {/* Der Transferfenster-Status wird jetzt einzig vom Neuer-Look-Client
          (marketWindowNotice) angezeigt — das fruehere Legacy-Callout hier war
          ein zweites, redundantes "Transferfenster geschlossen"-Banner direkt
          darueber. */}
      <div className="foundation-view-source-row">
        <span className="pill foundation-source-pill">{sourceBadgeLabel}</span>
        <span className="muted">
          {activeSaveName} · {seasonId} · Aktives Team {selectedTeamLabel}
        </span>
      </div>
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
