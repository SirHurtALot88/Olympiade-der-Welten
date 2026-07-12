"use client";

import dynamic from "next/dynamic";
import type { Dispatch, SetStateAction } from "react";

import FoundationPanelSkeleton from "@/components/foundation/FoundationPanelSkeleton";
import type { GameState, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";
import type { MatchdayArenaBlockerSummary } from "@/lib/foundation/matchday-arena-blocker-summary";
import type { MatchdaySummary } from "@/lib/foundation/matchday-summary";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import { useFoundationShared } from "@/lib/foundation/foundation-shared-context";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { useMatchdayArenaDerivations } from "@/lib/foundation/tabs/use-matchday-arena-derivations";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

const FoundationMatchdayArenaPanel = dynamic(
  () => import("@/app/foundation/matchday-arena-v2/FoundationMatchdayArenaPanel"),
  {
    ssr: false,
    loading: () => (
      <FoundationPanelSkeleton
        variant="default"
        label="Arena wird geladen…"
        id="foundation-matchday-arena"
        sectionClassName="foundation-section-visible"
      />
    ),
  },
);

export type FoundationMatchdayArenaShellHostProps = {
  gameState: GameState;
  activeSaveId: string;
  activeSaveName: string;
  activeManagerTeamId: string | null;
  selectedTeamId: string | null;
  selectedTeam: Team | null;
  saveSummaryCount: number;
  sourceBadgeLabel: string;
  blockerSummary: MatchdayArenaBlockerSummary;
  blockerGapDetail: string | null;
  matchdaySummary: MatchdaySummary;
  readOnly: boolean;
  teamControlDraft: Record<string, TeamControlSettings>;
  roomContext: FoundationRoomContext | null;
  setActiveView: Dispatch<SetStateAction<FoundationViewId>>;
  setSelectedMatchdaySummaryId: Dispatch<SetStateAction<string | null>>;
  openPlayerDrawerById: (playerId: string, activePlayerId?: string | null) => void;
  openTeamDrawerById: (teamId: string) => void;
  runFinishMatchdaySimple: () => Promise<void>;
  triggerGlobalNext: () => void | Promise<void>;
};

/**
 * Matchday arena shell host (Strangler Phase 5.3). Mounts arena-only derivations and panel
 * wiring only while the arena tab is active.
 */
export default function FoundationMatchdayArenaShellHost({
  gameState,
  activeSaveId,
  activeSaveName,
  activeManagerTeamId,
  selectedTeamId,
  selectedTeam,
  saveSummaryCount,
  sourceBadgeLabel,
  blockerSummary,
  blockerGapDetail,
  matchdaySummary,
  readOnly,
  teamControlDraft,
  roomContext,
  setActiveView,
  setSelectedMatchdaySummaryId,
  openPlayerDrawerById,
  openTeamDrawerById,
  runFinishMatchdaySimple,
  triggerGlobalNext,
}: FoundationMatchdayArenaShellHostProps) {
  const { cockpitBusyKey } = useFoundationShared();
  const { clientKey, contextLabel, panelReady, shouldShowBackToLineup, activeTeamMatchdaySummaryRow } =
    useMatchdayArenaDerivations({
      activeSaveId,
      activeSaveName,
      gameState,
      activeManagerTeamId,
      selectedTeamId,
      saveSummaryCount,
      matchdaySummary,
      selectedTeam,
      blockerSummary,
    });

  return (
    <FoundationMatchdayArenaPanel
      active
      ready={panelReady}
      sourceBadgeLabel={sourceBadgeLabel}
      contextLabel={contextLabel}
      blockerSummary={blockerSummary}
      blockerGapDetail={blockerGapDetail}
      onOpenLineup={() => setFoundationView("lineup", setActiveView)}
      clientKey={clientKey}
      client={{
        initialSource: "sqlite",
        defaultSaveId: activeSaveId,
        defaultSeasonId: gameState.season.id,
        defaultMatchdayId: gameState.matchdayState.matchdayId,
        defaultTeamId: activeManagerTeamId,
        playerCatalog: gameState.players,
        teams: gameState.teams,
        teamControlSettingsMap: teamControlDraft,
        roomContext,
        onOpenPlayerDetails: (payload) => openPlayerDrawerById(payload.playerId, payload.activePlayerId),
        onOpenTeam: openTeamDrawerById,
        onBackToLineup: shouldShowBackToLineup ? () => setFoundationView("lineup", setActiveView) : null,
        onOpenMatchdayResult: () => {
          setSelectedMatchdaySummaryId(gameState.matchdayState.matchdayId);
          window.setTimeout(() => {
            document.getElementById("arena-result-summary")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 40);
        },
        onOpenSeason: () => setFoundationView("seasonV2", setActiveView),
        onOpenTraining: () => setFoundationView("trainingCompact", setActiveView),
        onAdvanceMatchday: () => void triggerGlobalNext(),
      }}
      resultSummary={
        <section className="panel arena-result-summary" id="arena-result-summary" data-testid="arena-result-summary">
          <div className="panel-header">
            <div className="stack">
              <h2>Spieltagsergebnis</h2>
              <span className="muted">
                {matchdaySummary.seasonId} · Spieltag {matchdaySummary.matchdayNumber ?? "—"} · direkt aus gespeicherten Matchday-Results
              </span>
            </div>
            <div className="matchday-result-actions">
              <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("matchdayArena", setActiveView)}>
                Zur Arena
              </button>
              <button className="secondary-button inline-button" type="button" onClick={() => setFoundationView("seasonV2", setActiveView)}>
                Saisonstand ansehen
              </button>
              {matchdaySummary.hasResult ? (
                <button className="primary-button inline-button" type="button" onClick={() => void triggerGlobalNext()}>
                  Weiter
                </button>
              ) : (
                <button
                  className="primary-button inline-button"
                  type="button"
                  data-testid="arena-finish-matchday-button"
                  disabled={readOnly || cockpitBusyKey != null}
                  onClick={() => void runFinishMatchdaySimple()}
                  title="Berechnet alle Ergebnisse, schreibt Wertung und wechselt zum naechsten Spieltag."
                >
                  {cockpitBusyKey === "matchday-auto-run-execute" ? "Laeuft..." : "Spieltag abschliessen"}
                </button>
              )}
            </div>
          </div>
          {matchdaySummary.topTeams.length === 0 && matchdaySummary.bottomTeams.length === 0 ? (
            <div className="transfer-callout is-warning arena-result-empty-state">
              <strong>Noch kein Spieltagsergebnis vorhanden</strong>
              <span>Nach dem finalen Reveal erscheinen hier Tageswertung, Rangänderung und Top Player.</span>
            </div>
          ) : (
            <div className="matchday-result-hero-grid">
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
                <small>{activeTeamMatchdaySummaryRow?.seasonRankBeforeMatchday ?? "—"} → {activeTeamMatchdaySummaryRow?.seasonRankAfterMatchday ?? "—"}</small>
              </article>
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
            </div>
          )}
        </section>
      }
    />
  );
}
