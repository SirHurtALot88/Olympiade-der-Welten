"use client";

import Link from "next/link";

import { FOUNDATION_NAV_GROUPS, isFoundationNavViewActive } from "@/lib/foundation/foundation-nav-config";
import { getDefaultFoundationViewTarget, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";

type FoundationSidebarProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
};

export default function FoundationSidebar({ activeView, onNavigate }: FoundationSidebarProps) {
  return (
    <aside className="foundation-sidebar" data-testid="foundation-sidebar" aria-label="Foundation Navigation">
      <div className="foundation-sidebar-brand">
        <Link className="foundation-sidebar-save-link" href="/">
          Spielstände
        </Link>
        <strong>Oly Manager</strong>
      </div>
      {FOUNDATION_NAV_GROUPS.map((group) => (
        <section key={group.id} className="foundation-sidebar-group">
          <span className="foundation-sidebar-group-label">{group.label}</span>
          <div className="foundation-sidebar-items">
            {group.items.map((item) => {
              const targetView = getDefaultFoundationViewTarget(item.id);
              const isActive = isFoundationNavViewActive(activeView, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`foundation-sidebar-item${isActive ? " is-active" : ""}`}
                  data-testid={`foundation-nav-${item.id}`}
                  title={item.tooltip}
                  onClick={() => onNavigate(targetView)}
                >
                  {item.icon ? <span className="foundation-sidebar-icon" aria-hidden="true">{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}
