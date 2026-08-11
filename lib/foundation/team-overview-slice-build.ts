/**
 * SERVERSEITE der Team-Overview-Slice — bewusst eine EIGENE Datei.
 *
 * WARUM DIE TRENNUNG: `team-overview-slice.ts` wird vom Browser importiert
 * (`hydrateTeamOverviewSliceRows` in `lib/foundation/tabs/use-season-stand-rows.ts` und im
 * Shell-Router). Der Bau der Slice liest dagegen die echte Abrechnung
 * (`getLeagueSponsorIncome` → `lib/season/prize-money-preview.ts` → Persistenz → `node:fs`,
 * `better-sqlite3`). Stünden beide in einer Datei, zöge der eine Import den anderen mit: der
 * Next-Build brach mit „Module not found: Can't resolve 'fs'" ab, Importkette
 * `FoundationPageClient` → Shell-Router → `use-season-stand-rows` → diese Slice → Persistenz.
 *
 * Die Regel dahinter ist allgemein und gilt fuer jede weitere Slice: was der Browser importiert,
 * darf nur Typen und reine Funktionen enthalten. Alles, was den Spielstand von der Platte liest,
 * gehoert auf diese Seite der Trennlinie.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import {
  buildTeamSeasonOverviewRows,
  type TeamManagementSnapshotRow,
} from "@/lib/foundation/team-management-overview";
import type { TeamOverviewSliceResponse, TeamOverviewSliceRow } from "@/lib/foundation/team-overview-slice";
import { getLeagueSponsorIncome } from "@/lib/season/prize-money-preview";

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
