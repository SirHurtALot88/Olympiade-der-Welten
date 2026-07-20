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
  seasonLabel?: string | null;
  matchdayDisplayLabel?: string | null;
  currentMatchday?: number | null;
  headerActions?: ReactNode;
  breadcrumb?: ReactNode;
  subNav?: ReactNode;
  children: ReactNode;
  isPending?: boolean;
  activities?: FoundationActivityItem[];
  // Compact "Aktives Team"-Umschalter, top-left in der Sidebar neben dem
  // Neuer-Look-Toggle statt im großen Context-Banner (siehe Owner-Feedback:
  // Banner + Titel fraßen die halbe Seite). Wiring bleibt bei der Router-Body,
  // hier nur Platzierung.
  teamPicker?: ReactNode;
};

function buildSeasonContextLabel(
  seasonLabel: string,
  matchdayDisplayLabel: string,
  currentMatchday?: number | null,
) {
  const seasonNumber = seasonLabel.match(/Season (\d+)/i)?.[1];
  const seasonPart = seasonNumber ? `S${seasonNumber}` : seasonLabel;
  const matchdayPart =
    typeof currentMatchday === "number" && Number.isFinite(currentMatchday)
      ? `MD ${currentMatchday}`
      : matchdayDisplayLabel.replace(/^Spieltag\s+/i, "MD ");
  return `${seasonPart} · ${matchdayPart}`;
}

export default function FoundationShell({
  activeView,
  onNavigate,
  onPrefetchView,
  attentionByViewId,
  seasonLabel,
  matchdayDisplayLabel,
  currentMatchday,
  headerActions,
  breadcrumb,
  subNav,
  children,
  isPending = false,
  activities = [],
  teamPicker,
}: FoundationShellProps) {
  const seasonContextLabel =
    seasonLabel && matchdayDisplayLabel
      ? buildSeasonContextLabel(seasonLabel, matchdayDisplayLabel, currentMatchday)
      : null;

  return (
    <div className={`foundation-shell-layout${isPending ? " is-nav-pending" : ""}`} data-testid="foundation-shell-layout">
      <FoundationSidebar
        activeView={activeView}
        onNavigate={onNavigate}
        onPrefetchView={onPrefetchView}
        attentionByViewId={attentionByViewId}
        seasonContextLabel={seasonContextLabel}
        teamPicker={teamPicker}
      />
      <div className="foundation-shell-main" id="foundation-main-content" tabIndex={-1}>
        <FoundationActivityStrip activities={activities} />
        <header className="foundation-shell-header">
          {breadcrumb ? <div className="foundation-shell-breadcrumb-slot">{breadcrumb}</div> : null}
          <div className="foundation-shell-header-actions">{headerActions}</div>
        </header>
        {subNav}
        {/* key={activeView}: der Content-Wrapper wird bei jedem echten
            View-Wechsel neu gemountet, damit die `foundation-view-enter`-
            Animation (Fade + sanftes Aufsteigen) erneut spielt und sich mit
            dem panelinternen `.nl-reveal`-Stagger überlagert. Reduced-Motion
            schaltet das per CSS ab. */}
        <div key={activeView} className="foundation-shell-content foundation-view-enter">
          {children}
        </div>
      </div>
    </div>
  );
}
