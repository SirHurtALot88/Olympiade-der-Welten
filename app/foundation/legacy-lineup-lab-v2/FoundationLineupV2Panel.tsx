"use client";

import dynamic from "next/dynamic";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { ComponentProps } from "react";

const LegacyLineupLabClient = dynamic(() => import("@/app/foundation/legacy-lineup-lab/LegacyLineupLabClient"), {
  ssr: false,
  loading: () => <p className="foundation-view-loading">Einsatzliste v2 wird geladen …</p>,
});

type LegacyLineupLabClientProps = ComponentProps<typeof LegacyLineupLabClient>;

export type FoundationLineupV2PanelProps = {
  active: boolean;
  teamTooltip: string;
  clientKey: string;
  client: LegacyLineupLabClientProps;
  onSwitchToClassic?: () => void;
};

export default function FoundationLineupV2Panel({
  active,
  teamTooltip,
  clientKey,
  client,
  onSwitchToClassic,
}: FoundationLineupV2PanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel foundation-lineup-panel foundation-lineup-v2-panel" data-testid="foundation-lineup-v2" id="foundation-lineup-v2">
      <div className="panel-header">
        <div className="stack season-panel-head">
          <TooltipHeading as="h2" tooltip={teamTooltip}>
            Einsatzliste v2
          </TooltipHeading>
          <small className="muted">Preview · Focus Mode mit kompakter Slot-Rail und aktivem Fokus-Panel.</small>
        </div>
        {onSwitchToClassic ? (
          <button type="button" className="secondary-button inline-button" onClick={onSwitchToClassic}>
            Klassische Ansicht
          </button>
        ) : null}
      </div>
      <LegacyLineupLabClient key={clientKey} {...client} uiVariant="focusV2" onSwitchToClassic={onSwitchToClassic} />
    </section>
  );
}
