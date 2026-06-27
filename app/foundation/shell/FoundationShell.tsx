"use client";

import type { ReactNode } from "react";

import FoundationSidebar from "@/app/foundation/shell/FoundationSidebar";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

type FoundationShellProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
  onPrefetchView?: (view: FoundationViewId) => void;
  headerActions?: ReactNode;
  subNav?: ReactNode;
  children: ReactNode;
  isPending?: boolean;
};

export default function FoundationShell({
  activeView,
  onNavigate,
  onPrefetchView,
  headerActions,
  subNav,
  children,
  isPending = false,
}: FoundationShellProps) {
  return (
    <div className={`foundation-shell-layout${isPending ? " is-nav-pending" : ""}`} data-testid="foundation-shell-layout">
      <FoundationSidebar activeView={activeView} onNavigate={onNavigate} onPrefetchView={onPrefetchView} />
      <div className="foundation-shell-main">
        <header className="foundation-shell-header">
          <div className="foundation-shell-header-actions">{headerActions}</div>
        </header>
        {subNav}
        <div className="foundation-shell-content">{children}</div>
      </div>
    </div>
  );
}
