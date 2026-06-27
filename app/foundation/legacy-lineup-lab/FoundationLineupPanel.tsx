"use client";

import dynamic from "next/dynamic";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { ComponentProps } from "react";

const LegacyLineupLabClient = dynamic(() => import("@/app/foundation/legacy-lineup-lab/LegacyLineupLabClient"), {
  ssr: false,
  loading: () => <p className="foundation-view-loading">Einsatzliste wird geladen …</p>,
});

type LegacyLineupLabClientProps = ComponentProps<typeof LegacyLineupLabClient>;

export type FoundationLineupPanelProps = {
  active: boolean;
  teamTooltip: string;
  clientKey: string;
  client: LegacyLineupLabClientProps;
};

export default function FoundationLineupPanel({ active, teamTooltip, clientKey, client }: FoundationLineupPanelProps) {
  if (!active) {
    return null;
  }

  return (
    <section className="panel foundation-lineup-panel" data-testid="foundation-lineup" id="foundation-lineup">
      <div className="panel-header">
        <div className="stack season-panel-head">
          <TooltipHeading as="h2" tooltip={teamTooltip}>
            Einsatzliste
          </TooltipHeading>
        </div>
      </div>
      <LegacyLineupLabClient key={clientKey} {...client} />
    </section>
  );
}
