"use client";

import type { ReactNode } from "react";

export type FoundationTeamsViewPanelProps = {
  active: boolean;
  teamTab?: string;
  children?: ReactNode;
};

export default function FoundationTeamsViewPanel({ active, teamTab, children }: FoundationTeamsViewPanelProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      className="foundation-teams-view-panel foundation-teams-view-shell"
      data-testid="foundation-teams-view"
      data-team-tab={teamTab}
    >
      {children}
    </div>
  );
}
