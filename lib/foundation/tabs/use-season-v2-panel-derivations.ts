import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";

type SeasonSnapshotInput = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];

export type SeasonOverviewOption = {
  seasonId: string;
  seasonName: string;
  status: "active" | "completed" | string;
  archivedAt: string | null;
};

export interface BuildSeasonOverviewOptionsInput {
  gameState: GameState;
  seasonHistorySnapshots: SeasonSnapshotInput[];
  shouldBuildFull: boolean;
}

export function buildSeasonOverviewOptions(input: BuildSeasonOverviewOptionsInput): SeasonOverviewOption[] {
  const { gameState, seasonHistorySnapshots, shouldBuildFull } = input;

  if (!shouldBuildFull) {
    return [
      {
        seasonId: gameState.season.id,
        seasonName: gameState.season.name,
        status: "active",
        archivedAt: null,
      },
    ];
  }

  const snapshotOptions = seasonHistorySnapshots.map((snapshot) => ({
    seasonId: snapshot.seasonId,
    seasonName: snapshot.seasonName,
    status: snapshot.status ?? "completed",
    archivedAt: snapshot.archivedAt ?? null,
  }));
  const hasActiveAsSnapshot = snapshotOptions.some((option) => option.seasonId === gameState.season.id);

  return [
    {
      seasonId: gameState.season.id,
      seasonName: gameState.season.name,
      status: "active",
      archivedAt: null,
    },
    ...snapshotOptions.filter((option) => !hasActiveAsSnapshot || option.seasonId !== gameState.season.id),
  ].sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }));
}

export interface UseSeasonV2PanelDerivationsInput {
  gameState: GameState;
  seasonOverviewSeasonId: string;
  seasonHistorySnapshots: SeasonSnapshotInput[];
}

/**
 * Season V2 panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationSeasonV2Host` is mounted (`activeView === "seasonV2"`).
 */
export function useSeasonV2PanelDerivations(input: UseSeasonV2PanelDerivationsInput) {
  const { gameState, seasonOverviewSeasonId, seasonHistorySnapshots } = input;

  const seasonOverviewOptions = useMemo(
    () =>
      buildSeasonOverviewOptions({
        gameState,
        seasonHistorySnapshots,
        shouldBuildFull: true,
      }),
    [gameState, seasonHistorySnapshots],
  );

  const selectedSeasonSnapshot = useMemo(
    () => seasonHistorySnapshots.find((snapshot) => snapshot.seasonId === seasonOverviewSeasonId) ?? null,
    [seasonHistorySnapshots, seasonOverviewSeasonId],
  );

  const isViewingArchivedSeason = selectedSeasonSnapshot != null && seasonOverviewSeasonId !== gameState.season.id;
  const selectedSeasonOverviewOption =
    seasonOverviewOptions.find((option) => option.seasonId === seasonOverviewSeasonId) ??
    seasonOverviewOptions[0] ??
    null;
  const selectedSeasonOverviewLabel = selectedSeasonOverviewOption?.seasonName ?? seasonOverviewSeasonId;
  const seasonOverviewSourceLabel = isViewingArchivedSeason
    ? `Archiv-Snapshot · ${selectedSeasonSnapshot?.archivedAt ? new Date(selectedSeasonSnapshot.archivedAt).toLocaleString("de-DE") : "lokal"}`
    : "Aktive Season · lokale Results";

  return {
    seasonOverviewOptions,
    selectedSeasonSnapshot,
    isViewingArchivedSeason,
    selectedSeasonOverviewLabel,
    seasonOverviewSourceLabel,
  };
}
