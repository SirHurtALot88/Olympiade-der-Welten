import type { GameState } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { getLeagueSponsorIncome } from "@/lib/season/prize-money-preview";

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

  /**
   * SPONSOREN UND GUV KOMMEN AUS DER ECHTEN ABRECHNUNG — dieselbe Quelle wie
   * `app/api/season/standings-overview/route.ts` (`getLeagueSponsorIncome` +
   * `resolveSeasonGuvByTeam`, die EINE GuV aus `lib/finance/season-end-guv.ts`).
   *
   * BEFUND (#493/#498): `buildTeamSeasonOverviewRows` liest Sponsor/GuV standardmäßig aus
   * `gameState.seasonState.standings`, und die trägt beide Felder erst NACH der
   * Saisonende-Buchung (`cash-prize-apply-service.ts`, Phase `season_end`). Diese Slice ist
   * aber genau der Zeilen-Pfad, den der "Neuer Look"-Saisonstand für die LAUFENDE Saison im
   * Browser tatsächlich nimmt (`hydrateTeamOverviewSliceRows`,
   * `lib/foundation/tabs/use-season-stand-rows.ts:222`) — ohne diese Überlagerung blieben
   * SPONSOREN und GUV dort leer, obwohl die Live-Vorschau längst Werte liefert. Nachgemessen
   * am Saisonstand-Beleg (`buildTeamOverviewSlice` ohne Überlagerung: 0/32 Teams mit
   * `sponsorTotal`/`guv`).
   *
   * Nur für die LAUFENDE Saison: eine archivierte `seasonId` hat keine Live-Vorschau (das
   * `gameState` gehört zur aktuellen Saison) und läuft im Browser ohnehin nicht über diesen
   * Pfad (`isArchivedSeasonView` in `use-season-stand-rows.ts` erzwingt dort den leichten
   * Pfad mit dem Standings-Feed).
   */
  const isCurrentSeason = seasonId === input.gameState.season.id;
  const standingsByTeamId = isCurrentSeason
    ? (() => {
        const sponsorIncome = getLeagueSponsorIncome(input.gameState, input.saveId);
        const seasonGuvByTeamId = resolveSeasonGuvByTeam(input.gameState, {
          sponsorCashByTeamId: sponsorIncome.sponsorCashByTeamId,
        });
        return Object.fromEntries(
          input.gameState.teams.map((team) => {
            const existing = input.gameState.seasonState.standings?.[team.teamId] ?? null;
            const liveSponsorCash = sponsorIncome.sponsorCashByTeamId.get(team.teamId) ?? null;
            const liveGuv = seasonGuvByTeamId.get(team.teamId) ?? null;
            return [
              team.teamId,
              {
                rank: existing?.rank ?? null,
                points: existing?.points ?? null,
                cash: team.cash,
                cashFc: existing?.cashFc ?? null,
                startplatz: existing?.startplatz ?? null,
                rankDiff: existing?.rankDiff ?? null,
                sponsorBasis: existing?.sponsorBasis ?? null,
                sponsorRank: existing?.sponsorRank ?? null,
                sponsorSeason: existing?.sponsorSeason ?? null,
                sponsorTotal: liveSponsorCash ?? existing?.sponsorTotal ?? null,
                guv: liveGuv?.guv ?? existing?.guv ?? null,
                guvPosten: liveGuv?.posten ?? existing?.guvPosten ?? null,
                cashTotal: existing?.cashTotal ?? null,
              },
            ] as const;
          }),
        );
      })()
    : undefined;

  const rows = buildTeamSeasonOverviewRows({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    standingsByTeamId,
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
