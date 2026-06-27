"use client";

import type { ReactNode } from "react";

export type FoundationTeamsViewPanelProps = {
  active: boolean;
  children: ReactNode;
};

export default function FoundationTeamsViewPanel({ active, children }: FoundationTeamsViewPanelProps) {
  if (!active) {
    return null;
  }

  return <div className="foundation-teams-view-panel" data-testid="foundation-teams-view">{children}</div>;
}
