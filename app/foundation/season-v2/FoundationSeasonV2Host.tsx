"use client";

import { useMemo } from "react";

import FoundationSeasonV2Panel, {
  type FoundationSeasonV2PanelProps,
} from "@/app/foundation/season-v2/FoundationSeasonV2Panel";
import { buildSeasonStandingsTopPlayersByTeam } from "@/lib/foundation/season-standings-top-players";
import { buildSeasonFormCardBonusByTeamId } from "@/lib/foundation/season-form-card-bonus";
import {
  useSeasonV2PanelModel,
  type UseSeasonV2PanelModelInput,
} from "@/lib/foundation/tabs/use-season-v2-panel-model";
import { useSeasonV2Data, type UseSeasonV2DataInput } from "@/lib/foundation/tabs/use-season-v2-data";
import {
  useSeasonV2StandingsDerivations,
  type UseSeasonV2StandingsDerivationsInput,
} from "@/lib/foundation/tabs/use-season-v2-standings-derivations";
import { useSeasonV2PanelDerivations } from "@/lib/foundation/tabs/use-season-v2-panel-derivations";

/**
 * Season V2 host (Strangler Phase 4.2). Mounts season top-player derivations
 * and presentation model only while the Season V2 tab is active.
 */
export type FoundationSeasonV2HostProps = Omit<
  UseSeasonV2PanelModelInput,
  "sortedSeasonStandRows" | "sortedSeasonTopPlayerRows" | "archivedSeasonDisciplineLeaderboards"
> &
  Omit<UseSeasonV2DataInput, "selectedSeasonSnapshot"> &
  UseSeasonV2StandingsDerivationsInput &
  Pick<
    FoundationSeasonV2PanelProps,
    | "sourceBadgeLabel"
    | "isLoading"
    | "onChangeSeason"
    | "onOpenTeam"
    | "onOpenPlayer"
    | "viewMode"
    | "onViewModeChange"
    | "onOpenRanks"
    | "onOpenPrize"
  > & {
    seasonOverviewSeasonId: string;
  };

export default function FoundationSeasonV2Host({
  gameState,
  selectedTeamId,
  seasonStandRows,
  seasonFormBonusByTeamId,
  teamTableSort,
  selectedStandingRow,
  seasonHistorySnapshots,
  boardConfidence,
  activeView,
  shouldBuildSeasonV2PlayerRatings,
  shouldFetchSeasonRatingsFromApi,
  seasonRatingsLoading,
  playerRatingsById,
  playerSeasonPerformanceMap,
  seasonPointsLedger,
  seasonTopPlayersSort,
  seasonOverviewSeasonId,
  ...panelProps
}: FoundationSeasonV2HostProps) {
  const {
    seasonOverviewOptions,
    selectedSeasonSnapshot,
    isViewingArchivedSeason,
    selectedSeasonOverviewLabel,
    seasonOverviewSourceLabel,
  } = useSeasonV2PanelDerivations({
    gameState,
    seasonOverviewSeasonId,
    seasonHistorySnapshots,
  });

  const { sortedSeasonStandRows, archivedSeasonDisciplineLeaderboards } = useSeasonV2StandingsDerivations({
    seasonStandRows,
    seasonFormBonusByTeamId,
    teamTableSort,
    selectedSeasonSnapshot,
  });

  const { sortedSeasonTopPlayerRows } = useSeasonV2Data({
    activeView,
    shouldBuildSeasonV2PlayerRatings,
    gameState,
    shouldFetchSeasonRatingsFromApi,
    seasonRatingsLoading,
    playerRatingsById,
    playerSeasonPerformanceMap,
    seasonPointsLedger,
    selectedSeasonSnapshot,
    seasonTopPlayersSort,
  });

  /**
   * Top-3-Spieler je Team für alle 24 Saisonstand-Spalten (4 Achsen + 20
   * Disziplinen) — EINMAL memoisiert statt pro Hover (32 Teams × 24 Spalten).
   * Für archivierte Saisons bewusst `null`: Ratings/Ledger tragen immer die
   * LIVE-Saison — ein "Top 3" aus aktuellen Werten wäre im Archiv gelogen,
   * dort zeigt der Saisonstand deshalb gar kein Hover-Panel.
   */
  const teamTopPlayersByColumn = useMemo(
    () =>
      isViewingArchivedSeason
        ? null
        : buildSeasonStandingsTopPlayersByTeam({
            gameState,
            playerRatingsById,
            seasonPointsLedger,
          }),
    [gameState, isViewingArchivedSeason, playerRatingsById, seasonPointsLedger],
  );

  /**
   * Formkarten-Bilanz je Team für die Saisonstand-Spalte „Formkarten": Summe der
   * NENNWERTE aller in dieser Saison ausgespielten Karten (+8 → 8, −4 → −4).
   * Läuft über `formCards`/`lineupDrafts`, die beide nach `seasonId` gefiltert
   * sind — eine Archiv-Saison ohne erhaltene Aufstellungen liefert deshalb
   * schlicht eine leere Karte (Spalte zeigt „—") statt geratener Werte.
   */
  const teamFormCardBonusByTeamId = useMemo(
    () => buildSeasonFormCardBonusByTeamId(gameState, seasonOverviewSeasonId),
    [gameState, seasonOverviewSeasonId],
  );

  const model = useSeasonV2PanelModel({
    gameState,
    selectedTeamId,
    sortedSeasonStandRows,
    selectedStandingRow,
    sortedSeasonTopPlayerRows,
    seasonHistorySnapshots,
    archivedSeasonDisciplineLeaderboards,
    boardConfidence,
    // Archiv-Ansicht trägt ihre eigenen, abgeschlossenen Zahlen — der Meisterschaftskampf
    // gehört nur zur LIVE-Saison und darf beim Blick in eine alte Saison nie erscheinen,
    // selbst wenn die laufende Saison zufällig gerade im Zeitfenster steckt.
    isViewingArchivedSeason,
  });

  return (
    <FoundationSeasonV2Panel
      {...panelProps}
      active
      selectedSeasonId={seasonOverviewSeasonId}
      selectedSeasonLabel={selectedSeasonOverviewLabel}
      sourceLabel={seasonOverviewSourceLabel}
      isArchived={isViewingArchivedSeason}
      seasonOptions={seasonOverviewOptions}
      selectedTeamSummary={model.selectedTeamSummary}
      leaderTeam={model.leaderTeam}
      momentumTeam={model.momentumTeam}
      pressureTeam={model.pressureTeam}
      topPlayer={model.topPlayers[0] ?? null}
      standingsRows={model.standingsRows}
      topPlayers={model.topPlayers}
      playerRows={model.playerRows}
      teamTopPlayersByColumn={teamTopPlayersByColumn}
      teamFormCardBonusByTeamId={teamFormCardBonusByTeamId}
      gmRows={model.gmRows}
      archiveRows={model.archiveRows}
      disciplineLeaders={model.disciplineLeaders}
      titleRace={model.titleRace}
    />
  );
}
