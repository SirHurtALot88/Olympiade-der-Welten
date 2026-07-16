"use client";

import type { ReactNode } from "react";

export default function LineupExpertPanels({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) {
    return null;
  }

  return (
    <div className="legacy-lineup-expert-panels" data-testid="legacy-lineup-expert-panels">
      {children}
    </div>
  );
}
