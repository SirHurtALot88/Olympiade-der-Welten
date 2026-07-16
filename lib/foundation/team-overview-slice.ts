import type { GameState } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";

export type TeamOverviewSliceRow = Omit<TeamManagementSnapshotRow, "team" | "roster" | "rosterPlayers"> & {
  team: Pick<TeamManagementSnapshotRow["team"], "teamId" | "name" | "shortCode" | "cash" | "budget">;
  rosterCount: number;
  rosterPlayerIds: string[];
};

export type TeamOverviewSliceResponse = {
  scope: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
  };
  rows: TeamOverviewSliceRow[];
};

function serializeTeamOverviewRow(row: TeamManagementSnapshotRow): TeamOverviewSliceRow {
  const { team, roster, rosterPlayers, ...rest } = row;
  return {
    ...rest,
    team: {
      teamId: team.teamId,
      name: team.name,
      shortCode: team.shortCode,
      cash: team.cash,
      budget: team.budget,
    },
    rosterCount: roster.length,
    rosterPlayerIds: roster.map((entry) => entry.playerId),
  };
}

export function hydrateTeamOverviewSliceRows(
  sliceRows: TeamOverviewSliceRow[],
  gameState: GameState,
): TeamManagementSnapshotRow[] {
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, typeof gameState.rosters>();
  for (const entry of gameState.rosters) {
    const existing = rostersByTeamId.get(entry.teamId);
    if (existing) {
      existing.push(entry);
      continue;
    }
    rostersByTeamId.set(entry.teamId, [entry]);
  }

  return sliceRows.map((row) => {
    const team = teamById.get(row.teamId) ?? ({
      teamId: row.teamId,
      name: row.teamName,
      shortCode: row.teamCode,
      cash: row.cash ?? 0,
      budget: row.budget ?? 0,
    } as TeamManagementSnapshotRow["team"]);
    const roster = rostersByTeamId.get(row.teamId) ?? [];
    return {
      ...row,
      team,
      roster,
      rosterPlayers: roster
        .map((entry) => {
          const player = playersById.get(entry.playerId);
          return player ? { entry, player } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    };
  });
}

export function buildTeamOverviewSlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}): TeamOverviewSliceResponse {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const rows = buildTeamSeasonOverviewRows({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
  });

  return {
    scope: {
      saveId: input.saveId,
      seasonId,
      contentSignature,
    },
    rows: rows.map(serializeTeamOverviewRow),
  };
}
