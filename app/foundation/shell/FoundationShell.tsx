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
  /**
   * Name der aktiven Ansicht — wird als `<h1>` gerendert, nur fuer Screenreader sichtbar.
   *
   * BEFUND D1 aus `docs/AUDIT-INGAME-2026-08-19.md`: gemessen ueber 14 Ansichten hatten 13 gar
   * KEINE `<h1>`; die einzige im Spiel hiess „Football" — ein Disziplinname, keine
   * Seitenueberschrift. Ein Dokument ohne h1 hat keine Gliederung: Screenreader finden keinen
   * Einstieg, und „Zum Hauptinhalt springen" landet in einem Bereich ohne Titel.
   *
   * WARUM HIER UND NICHT IN 19 ANSICHTEN: der Name steht laengst fest
   * (`getFoundationBreadcrumb`, abgeleitet aus der Nav-Konfiguration). Ihn 19 Mal nachzutragen
   * hiesse, 19 Stellen zu schaffen, die auseinanderlaufen koennen — genau die Fehlerklasse, die
   * dieser Lauf den ganzen Tag repariert.
   *
   * WARUM UNSICHTBAR: die Ansichten tragen ihre Ueberschrift optisch bereits (Breadcrumb,
   * Panel-Titel). Eine zweite sichtbare Zeile waere Doppelung; hier fehlt nur die SEMANTIK.
   */
  viewTitle?: string | null;
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
  viewTitle,
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
        {/* Die Gliederungs-Spitze des Dokuments. Steht VOR allem anderen im Hauptbereich, damit
            „Zum Hauptinhalt springen" (Ziel `#foundation-main-content`) direkt auf sie faellt. */}
        {viewTitle ? <h1 className="sr-only">{viewTitle}</h1> : null}
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
