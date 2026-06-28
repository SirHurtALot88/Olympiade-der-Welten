"use client";

import { TooltipHeading } from "@/components/ui/TooltipHeading";

import LegacyLineupLabClient from "@/app/foundation/legacy-lineup-lab/LegacyLineupLabClient";
import type { ComponentProps } from "react";

type LegacyLineupLabClientProps = ComponentProps<typeof LegacyLineupLabClient>;

export type FoundationLineupPanelProps = {
  active: boolean;
  teamTooltip: string;
  clientKey: string;
  client: LegacyLineupLabClientProps;
  uiVariant?: "classic" | "focusV2";
  onSwitchToFocusV2?: () => void;
  onSwitchToClassic?: () => void;
};

export default function FoundationLineupPanel({
  active,
  teamTooltip,
  clientKey,
  client,
  uiVariant = "classic",
  onSwitchToFocusV2,
  onSwitchToClassic,
}: FoundationLineupPanelProps) {
  if (!active) {
    return null;
  }

  const isV2 = uiVariant === "focusV2";

  return (
    <section
      className={`panel foundation-lineup-panel${isV2 ? " foundation-lineup-v2-panel" : ""}`}
      data-testid={isV2 ? "foundation-lineup-v2" : "foundation-lineup"}
      id={isV2 ? "foundation-lineup-v2" : "foundation-lineup"}
    >
      <div className="panel-header">
        <div className="stack season-panel-head">
          <TooltipHeading as="h2" tooltip={teamTooltip}>
            {isV2 ? "Einsatzliste v2" : "Einsatzliste"}
          </TooltipHeading>
          {isV2 ? <small className="muted">Preview · Focus Mode</small> : null}
        </div>
        {isV2 && onSwitchToClassic ? (
          <button type="button" className="secondary-button inline-button" onClick={onSwitchToClassic}>
            Klassische Ansicht
          </button>
        ) : null}
        {!isV2 && onSwitchToFocusV2 ? (
          <button type="button" className="secondary-button inline-button" onClick={onSwitchToFocusV2}>
            v2 Preview
          </button>
        ) : null}
      </div>
      <LegacyLineupLabClient
        key={clientKey}
        {...client}
        uiVariant={uiVariant}
        onSwitchToClassic={onSwitchToClassic}
        onSwitchToFocusV2={onSwitchToFocusV2}
      />
    </section>
  );
}
