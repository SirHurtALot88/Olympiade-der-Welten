/**
 * BROWSERSEITE der Team-Overview-Slice: nur Typen und reine Funktionen.
 *
 * Der Bau der Slice steht bewusst in `team-overview-slice-build.ts` — er liest die echte
 * Abrechnung und damit ueber `prize-money-preview` die Persistenz (`node:fs`,
 * `better-sqlite3`). Diese Datei hier importiert der Browser (`use-season-stand-rows.ts`,
 * Shell-Router); stuenden beide zusammen, zoege der Client-Import den Server-Code mit in das
 * Bundle. Genau daran ist der Next-Build einmal gescheitert („Module not found: Can't resolve
 * 'fs'"). Beim Erweitern also darauf achten, auf welcher Seite der Trennlinie der neue Code
 * landet.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";

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
