"use client";

import type { Dispatch, SetStateAction } from "react";

import { TooltipHeading } from "@/components/ui/TooltipHeading";
import type { Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import type { MatchdaySummary, MatchdaySummaryTeamRow } from "@/lib/foundation/matchday-summary";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import { useMatchdayResultDerivations } from "@/lib/foundation/tabs/use-matchday-result-derivations";
import { useNewLook } from "@/lib/ui/new-look-preference";
import MatchdayResultNewLook from "@/app/foundation/matchday-result-v2/MatchdayResultNewLook";

function joinClassNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getOwnerTeamHighlightClass(settings: TeamControlSettings | null | undefined) {
  if (settings?.controlMode !== "manual") {
    return "";
  }
  if (settings.ownerId === DEFAULT_ACTIVE_OWNER_ID) {
    return "is-owner-user-team";
  }
  if (settings.ownerId === "franky_remote_placeholder") {
    return "is-owner-franky-team";
  }
  return "";
}

export type MatchdaySummaryOption = {
  matchdayId: string;
  matchdayNumber: number | null;
  resultId: string;
};

export type FoundationMatchdayResultShellHostProps = {
  sourceBadgeLabel: string;
  matchdaySummary: MatchdaySummary;
  activeMatchdaySummaryId: string;
  matchdaySummaryOptions: MatchdaySummaryOption[];
  activeTeamMatchdaySummaryRow: MatchdaySummaryTeamRow | null;
  activeManagerTeamId: string | null;
  selectedTeam: Team | null;
  resolvedTeamControlSettings: Record<string, TeamControlSettings>;
  setSelectedMatchdaySummaryId: Dispatch<SetStateAction<string | null>>;
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>;
  openTeamProfileById: (teamId: string) => void;
  /** Kanonische "Weiter"-Aktion (schließt den Loop / startet den nächsten Spieltag). */
  triggerGlobalNext: () => void | Promise<void>;
};

/**
 * Matchday result shell host (Strangler Phase 5.3). Mounts result-only tab state
 * and full Spieltagsergebnis panel only while the matchdayResult tab is active.
 */
export default function FoundationMatchdayResultShellHost(props: FoundationMatchdayResultShellHostProps) {
  const { matchdaySummaryTab, setMatchdaySummaryTab } = useMatchdayResultDerivations();
  // "Neuer Look" Flag-Gate (additiv): Flag an => Ergebnis-Bühne + Board mit
  // denselben Props; Flag aus => bestehendes Layout unverändert.
  const [newLook] = useNewLook();
  if (newLook) return <MatchdayResultNewLook {...props} />;

  const {
    sourceBadgeLabel,
    matchdaySummary,
    activeMatchdaySummaryId,
    matchdaySummaryOptions,
    activeTeamMatchdaySummaryRow,
    activeManagerTeamId,
    selectedTeam,
    resolvedTeamControlSettings,
    setSelectedMatchdaySummaryId,
    setActiveView,
    openTeamProfileById,
  } = props;

  return (
    <section className="panel" id="foundation-matchday-result" data-testid="foundation-matchday-result">
      <div className="panel-header">
        <div className="stack">
          <TooltipHeading
            as="h2"
            tooltip="Spieltagsranking nutzt nur die gespeicherten D1+D2-Ergebnisse dieses Matchdays. Saisonstand zeigt kumulierte Punkte bis zu diesem Spieltag."
          >
            Spieltagsergebnis
          </TooltipHeading>
          <span className="muted">
            {matchdaySummary.seasonId} · Spieltag {matchdaySummary.matchdayNumber ?? "—"} · {matchdaySummary.matchdayId}
          </span>
        </div>
        <div className="matchday-result-actions">
          <span className="pill foundation-source-pill">{sourceBadgeLabel}</span>
          <label className="filter-field compact-filter">
            <span>Matchday</span>
            <select
              className="input"
              value={activeMatchdaySummaryId}
              onChange={(event) => setSelectedMatchdaySummaryId(event.target.value)}
            >
              {matchdaySummaryOptions.length ? (
                matchdaySummaryOptions.map((option) => (
                  <option key={option.matchdayId} value={option.matchdayId}>
                    MD {option.matchdayNumber ?? "—"} · {option.matchdayId}
                  </option>
                ))
              ) : (
                <option value={activeMatchdaySummaryId}>Keine gespeicherten Results</option>
              )}
            </select>
          </label>
          <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("matchdayArena", setActiveView)}>
            Zur Arena
          </button>
          <button className="primary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
            Saisonstand anzeigen
          </button>
        </div>
      </div>

      <div className="matchday-result-hero-grid">
        <article className="metric-card">
          <span>D1</span>
          <strong>{matchdaySummary.d1.disciplineName ?? "—"}</strong>
          <small>{matchdaySummary.d1.disciplineId ?? "missing_source"}</small>
        </article>
        <article className="metric-card">
          <span>D2</span>
          <strong>{matchdaySummary.d2.disciplineName ?? "—"}</strong>
          <small>{matchdaySummary.d2.disciplineId ?? "missing_source"}</small>
        </article>
        <article className="metric-card">
          <span>Aktives Team</span>
          <strong>{activeTeamMatchdaySummaryRow?.teamShortCode ?? selectedTeam?.shortCode ?? "—"}</strong>
          <small>
            Tagesrang {activeTeamMatchdaySummaryRow?.matchdayRank ?? "—"} · {activeTeamMatchdaySummaryRow?.matchdayPoints ?? "—"} Pkt
          </small>
        </article>
        <article className="metric-card">
          <span>Rangänderung</span>
          <strong className={activeTeamMatchdaySummaryRow?.rankDirection === "up" ? "text-positive" : activeTeamMatchdaySummaryRow?.rankDirection === "down" ? "text-negative" : undefined}>
            {activeTeamMatchdaySummaryRow?.rankDelta != null
              ? activeTeamMatchdaySummaryRow.rankDelta > 0
                ? `↑ +${activeTeamMatchdaySummaryRow.rankDelta}`
                : activeTeamMatchdaySummaryRow.rankDelta < 0
                  ? `↓ ${activeTeamMatchdaySummaryRow.rankDelta}`
                  : "0"
              : "—"}
          </strong>
          <small>
            {activeTeamMatchdaySummaryRow?.seasonRankBeforeMatchday ?? "—"} → {activeTeamMatchdaySummaryRow?.seasonRankAfterMatchday ?? "—"}
          </small>
        </article>
      </div>

      {matchdaySummary.warnings.length ? (
        <div className="transfer-callout is-warning">
          <strong>Quellen/Warnungen</strong>
          <span>{matchdaySummary.warnings.slice(0, 6).join(" · ")}</span>
        </div>
      ) : null}

      <div className="matchday-result-tabs" role="tablist" aria-label="Spieltag oder Saisonstand">
        <button
          className={`secondary-button inline-button${matchdaySummaryTab === "matchday" ? " is-selected" : ""}`}
          type="button"
          onClick={() => setMatchdaySummaryTab("matchday")}
        >
          Spieltag
        </button>
        <button
          className={`secondary-button inline-button${matchdaySummaryTab === "season" ? " is-selected" : ""}`}
          type="button"
          onClick={() => setMatchdaySummaryTab("season")}
        >
          Saisonstand
        </button>
      </div>

      {matchdaySummaryTab === "season" ? (
        <div className="table-shell matchday-result-table-shell">
          <table className="team-table matchday-result-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Tagesrang</th>
                <th>Tagespunkte</th>
                <th>D1 Score</th>
                <th>D2 Score</th>
                <th>Rang vorher</th>
                <th>Rang nachher</th>
                <th>Δ Rang</th>
                <th>Kumuliert</th>
              </tr>
            </thead>
            <tbody>
              {matchdaySummary.teamRows.map((row) => (
                <tr
                  key={`matchday-summary-row-${row.teamId}`}
                  className={joinClassNames(
                    row.teamId === activeManagerTeamId && "is-active-team-row",
                    getOwnerTeamHighlightClass(resolvedTeamControlSettings[row.teamId]),
                  )}
                  onClick={() => openTeamProfileById(row.teamId)}
                >
                  <td><strong>{row.teamShortCode}</strong> · {row.teamName}</td>
                  <td>{row.matchdayRank ?? "—"}</td>
                  <td>{row.matchdayPoints ?? "—"}</td>
                  <td>{row.d1Score != null ? formatLocalePoints(row.d1Score, 1) : "—"}</td>
                  <td>{row.d2Score != null ? formatLocalePoints(row.d2Score, 1) : "—"}</td>
                  <td>{row.seasonRankBeforeMatchday ?? "—"}</td>
                  <td>{row.seasonRankAfterMatchday ?? "—"}</td>
                  <td className={row.rankDirection === "up" ? "text-positive" : row.rankDirection === "down" ? "text-negative" : undefined}>
                    {row.rankDelta != null ? (row.rankDelta > 0 ? `↑ +${row.rankDelta}` : row.rankDelta < 0 ? `↓ ${row.rankDelta}` : "0") : "—"}
                  </td>
                  <td>{row.cumulativePoints ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h3>Highlights</h3>
          <button className="primary-button inline-button" type="button" onClick={() => void props.triggerGlobalNext()}>
            Weiter zum nächsten Schritt
          </button>
        </div>
        {matchdaySummary.highlights.length ? (
          <div className="matchday-result-highlight-grid">
            {matchdaySummary.highlights.map((highlight) => (
              <article key={highlight.id} className="metric-card">
                <span>{highlight.label}</span>
                <strong>{highlight.value}</strong>
                <small>{highlight.source}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Keine Highlight-Karten ohne gespeicherte Highlight-Quelle.</p>
        )}
      </section>
    </section>
  );
}
