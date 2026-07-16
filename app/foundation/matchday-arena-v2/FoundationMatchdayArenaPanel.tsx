"use client";

import dynamic from "next/dynamic";

import type { ComponentProps, ReactNode } from "react";

import { formatGameFlowBlockerList } from "@/lib/foundation/game-flow-blocker-labels";

const MatchdayArenaV2Client = dynamic(() => import("@/app/foundation/matchday-arena-v2/MatchdayArenaV2Client"), {
  ssr: false,
  loading: () => <p className="foundation-view-loading">Arena wird geladen …</p>,
});

type MatchdayArenaV2ClientProps = ComponentProps<typeof MatchdayArenaV2Client>;

export type FoundationMatchdayArenaPanelProps = {
  active: boolean;
  ready: boolean;
  sourceBadgeLabel: string;
  contextLabel: string;
  blockerSummary: {
    primaryReason: string | null;
    reasons: string[];
  };
  blockerGapDetail: string | null;
  onOpenLineup: () => void;
  clientKey: string;
  client: MatchdayArenaV2ClientProps;
  resultSummary: ReactNode;
};

export default function FoundationMatchdayArenaPanel({
  active,
  ready,
  sourceBadgeLabel,
  contextLabel,
  blockerSummary,
  blockerGapDetail,
  onOpenLineup,
  clientKey,
  client,
  resultSummary,
}: FoundationMatchdayArenaPanelProps) {
  if (!active) {
    return null;
  }

  if (!ready) {
    return (
      <section className="panel foundation-matchday-arena-panel" id="foundation-matchday-arena">
        <p className="muted">Arena-Kontext fehlt — Save und Team wählen.</p>
      </section>
    );
  }

  return (
    <section className="panel foundation-matchday-arena-panel" id="foundation-matchday-arena">
      <div className="foundation-view-source-row">
        <span className="pill foundation-source-pill">{sourceBadgeLabel}</span>
        <span className="muted">{contextLabel}</span>
      </div>
      {blockerSummary.primaryReason ? (
        <div className="transfer-callout is-warning" data-testid="arena-lineup-blocker" style={{ marginTop: 12 }}>
          <strong>Arena noch nicht bereit</strong>
          <span>
            {formatGameFlowBlockerList(blockerSummary.reasons)}
            {blockerGapDetail ? ` (${blockerGapDetail})` : null}
          </span>
          <div className="foundation-save-actions save-summary-actions" style={{ marginTop: 8 }}>
            <button className="primary-button inline-button" type="button" onClick={onOpenLineup}>
              {blockerSummary.primaryReason === "lineup_not_submitted" ? "Lineup bestätigen" : "Zur Einsatzliste"}
            </button>
          </div>
        </div>
      ) : null}
      <MatchdayArenaV2Client key={clientKey} {...client} />
      {resultSummary}
    </section>
  );
}
