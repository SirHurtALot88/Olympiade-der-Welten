import { useMemo } from "react";

import type { Team } from "@/lib/data/olyDataTypes";
import type {
  FoundationPrizePreviewItem,
  FoundationPrizePreviewResponse,
} from "@/lib/foundation/tabs/cockpit-types";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { shouldBuildSeasonEndChampionRow } from "@/lib/foundation/tabs/season-v2-derivations";

export function getPrizePreviewRows(
  prizePreviewFeed: FoundationPrizePreviewResponse | null,
): FoundationPrizePreviewItem[] {
  return prizePreviewFeed?.items ?? [];
}

export function getPrizePreviewGlobalWarnings(prizePreviewFeed: FoundationPrizePreviewResponse | null): string[] {
  return prizePreviewFeed?.globalWarnings ?? [];
}

export function getPrizePreviewHardBlocked(prizePreviewFeed: FoundationPrizePreviewResponse | null): string[] {
  return (prizePreviewFeed?.blockedRules ?? []).filter((rule) =>
    ["prize_money_table_missing", "prize_money_table_invalid", "prize_preview_load_failed"].includes(rule),
  );
}

export function getSelectedPrizePreviewRow(
  prizePreviewRows: FoundationPrizePreviewItem[],
  selectedTeamId: string | null | undefined,
): FoundationPrizePreviewItem | null {
  return prizePreviewRows.find((row) => row.teamId === selectedTeamId) ?? null;
}

export function getSeasonEndChampionRow(
  activeView: FoundationViewId,
  seasonStandRows: TeamManagementSnapshotRow[],
): TeamManagementSnapshotRow | null {
  if (!shouldBuildSeasonEndChampionRow(activeView)) {
    return null;
  }

  return (
    [...seasonStandRows]
      .filter((row) => row.rank != null)
      .sort((left, right) => (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY))[0] ??
    null
  );
}

export interface UsePrizePanelDerivationsInput {
  prizePreviewFeed: FoundationPrizePreviewResponse | null;
  selectedTeam: Team | null;
  seasonStandRows: TeamManagementSnapshotRow[];
  activeView: FoundationViewId;
}

/**
 * Prize panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationPrizeFinanceHost` is mounted (`activeView === "prize"`).
 */
export function usePrizePanelDerivations(input: UsePrizePanelDerivationsInput) {
  const { prizePreviewFeed, selectedTeam, seasonStandRows, activeView } = input;

  const prizePreviewRows = useMemo(() => getPrizePreviewRows(prizePreviewFeed), [prizePreviewFeed]);
  const prizePreviewGlobalWarnings = useMemo(
    () => getPrizePreviewGlobalWarnings(prizePreviewFeed),
    [prizePreviewFeed],
  );
  const prizePreviewHardBlocked = useMemo(
    () => getPrizePreviewHardBlocked(prizePreviewFeed),
    [prizePreviewFeed],
  );
  const selectedPrizePreviewRow = useMemo(
    () => getSelectedPrizePreviewRow(prizePreviewRows, selectedTeam?.teamId),
    [prizePreviewRows, selectedTeam?.teamId],
  );
  const seasonEndChampionRow = useMemo(
    () => getSeasonEndChampionRow(activeView, seasonStandRows),
    [activeView, seasonStandRows],
  );

  return {
    prizePreviewRows,
    prizePreviewGlobalWarnings,
    prizePreviewHardBlocked,
    selectedPrizePreviewRow,
    seasonEndChampionRow,
  };
}
