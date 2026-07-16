import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";

/** Team history LIVE row must always reflect the active season, not saisonstand's selected archive season. */
export function resolveLiveSeasonStandRowsForTeamHistory(input: {
  gameState: GameState;
  seasonStandRows: TeamManagementSnapshotRow[];
  seasonStandRowsSeasonId: string;
  activeSaveId?: string | null;
}): TeamManagementSnapshotRow[] {
  if (input.seasonStandRowsSeasonId === input.gameState.season.id) {
    return input.seasonStandRows;
  }

  return buildTeamSeasonOverviewRows({
    gameState: input.gameState,
    saveId: input.activeSaveId ?? undefined,
    seasonId: input.gameState.season.id,
  });
}
