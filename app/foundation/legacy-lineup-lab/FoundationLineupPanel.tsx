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
};

export default function FoundationLineupPanel({
  active,
  teamTooltip,
  clientKey,
  client,
  uiVariant = "focusV2",
}: FoundationLineupPanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section
      className="panel foundation-lineup-panel foundation-lineup-v2-panel"
      data-testid="foundation-lineup"
      id="foundation-lineup-v2"
    >
      <div className="panel-header" data-testid="foundation-lineup-v2">
        <div className="stack season-panel-head">
          <TooltipHeading as="h2" tooltip={teamTooltip}>
            Einsatzliste
          </TooltipHeading>
        </div>
      </div>
      <LegacyLineupLabClient key={clientKey} {...client} uiVariant={uiVariant} />
    </section>
  );
}
