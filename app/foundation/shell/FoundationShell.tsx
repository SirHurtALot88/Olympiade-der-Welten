"use client";

import type { ReactNode } from "react";

import type { FoundationNavAttentionMap } from "@/lib/foundation/foundation-nav-attention";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";
import FoundationActivityStrip from "@/app/foundation/shell/FoundationActivityStrip";
import FoundationSidebar from "@/app/foundation/shell/FoundationSidebar";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

type FoundationShellProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
  onPrefetchView?: (view: FoundationViewId) => void;
  attentionByViewId?: FoundationNavAttentionMap;
  headerActions?: ReactNode;
  subNav?: ReactNode;
  children: ReactNode;
  isPending?: boolean;
  activities?: FoundationActivityItem[];
};

export default function FoundationShell({
  activeView,
  onNavigate,
  onPrefetchView,
  attentionByViewId,
  headerActions,
  subNav,
  children,
  isPending = false,
  activities = [],
}: FoundationShellProps) {
  return (
    <div className={`foundation-shell-layout${isPending ? " is-nav-pending" : ""}`} data-testid="foundation-shell-layout">
      <FoundationSidebar
        activeView={activeView}
        onNavigate={onNavigate}
        onPrefetchView={onPrefetchView}
        attentionByViewId={attentionByViewId}
      />
      <div className="foundation-shell-main">
        <FoundationActivityStrip activities={activities} />
        <header className="foundation-shell-header">
          <div className="foundation-shell-header-actions">{headerActions}</div>
        </header>
        {subNav}
        <div className="foundation-shell-content">{children}</div>
      </div>
    </div>
  );
}
