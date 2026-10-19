import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { clampSeasonSnapshotsToCurrentSeason } from "@/lib/foundation/season-history-clamp";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import {
  SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER,
  isSeasonDisciplineKey,
  type SeasonDisciplineAreaId,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";

/**
 * ALL-TIME-BESTENLISTE JE DISZIPLIN/BEREICH — Chris, wörtlich (19.10.):
 *
 * „Diese Top-Listen müssten dann ja eventuell auch mal erweitert werden, dass man da quasi noch
 * filtern kann nach einzelnen Bereichen und einzelnen Disziplinen. […] nach 5 Seasons schon sehen
 * kann, okay, wer war […] der Beste in Fechten? Ja, und auch in Fechten pro Einsatz. […] nicht nur
 * die absoluten Punkte […], sondern auch die pro Einsatz, weil es ja ein Unterschied ist, ob ich
 * 10 Punkte hole mit einem einzigen Einsatz […] oder mit 5 Einsätzen."
 *
 * KEINE NEUE SPIEL-LOGIK: jede Zahl hier ist eine Projektion von Daten, die das Spiel ohnehin
 * schon schreibt und archiviert:
 *
 * - Abgeschlossene Saisons: `snapshot.playerPerformances[].disciplineBreakdown[]` trägt je
 *   Disziplin bereits `appearances` UND `totalContribution` (gebaut in
 *   `season-snapshot-service.ts`, Zeile ~400 ff. — dieselbe Stelle, aus der auch
 *   `player-league-career-stats.ts` seine Summen zieht, dort aber ÜBER alle Disziplinen hinweg
 *   aufsummiert statt je Disziplin getrennt).
 * - Laufende (noch nicht archivierte) Saison: `buildSeasonPointsLedger(gameState).pointEntries`
 *   trägt je Performance eine Zeile mit `disciplineId`/`playerId`/`points` — Gruppieren nach
 *   Spieler+Disziplin liefert dieselbe Form (Anzahl Zeilen = Einsätze, Summe `points` = Punkte).
 *
 * Beide Quellen münden in dieselbe Zellform (`PlayerAllTimeStatCell`), damit eine Saison beim
 * Archivieren (Snapshot entsteht) nahtlos von der Ledger-Quelle auf die Snapshot-Quelle wechselt,
 * ohne dass sich an den Summen etwas verschiebt — exakt das Muster aus
 * `buildPlayerLeagueCareerStatsMap`/`buildDisciplineGlobalRankMaps`, nur zusätzlich mit
 * `appearances` je Disziplin (nicht nur je Spieler insgesamt) und mit Bereichs-Aggregation.
 */

export type PlayerAllTimeStatCell = {
  points: number;
  appearances: number;
  /** `null` ohne einen einzigen Einsatz — eine Rate über 0 Einsätze wäre erfunden. */
  pointsPerAppearance: number | null;
  /** Über wie viele verschiedene Saisons sich die Zahl aufbaut (Transparenz, Chris' Kernpunkt). */
  seasonsPlayed: number;
};

export type PlayerAllTimeDisciplineRow = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  /**
   * Das zuletzt bekannte Team: das aktuelle (`teamId`), sonst das Team aus dem jüngsten
   * archivierten Saison-Snapshot, in dem der Spieler auftauchte. Für den Liga-Filter der
   * All-Time-Liste (Opus-Review PR #1295, Punkt 5): ein vereinsloser Spieler (`teamId` null, z. B.
   * entlassen/auf dem Markt) fiel dort sonst aus JEDER Liga-Ansicht heraus, auch aus der
   * Standardansicht „Liga 1" (am Live-Save tragen 58 von 386 All-Time-Zeilen kein aktuelles Team;
   * jener Save hat noch keinen Liga-Split, jeder Save MIT Split traefe es). `null` nur, wenn es
   * auch kein Snapshot-Team gibt (nur in der laufenden Saison gespielt, schon wieder ohne Verein).
   */
  lastKnownTeamId: string | null;
  /** Saisons mit irgendeinem Einsatz, in irgendeiner Disziplin. */
  seasonsPlayed: number;
  overall: PlayerAllTimeStatCell;
  byArea: Record<SeasonDisciplineAreaId, PlayerAllTimeStatCell>;
  byDiscipline: Partial<Record<SeasonDisciplineKey, PlayerAllTimeStatCell>>;
};

type MutableCell = {
  points: number;
  appearances: number;
  seasonIds: Set<string>;
};

function emptyCell(): PlayerAllTimeStatCell {
  return { points: 0, appearances: 0, pointsPerAppearance: null, seasonsPlayed: 0 };
}

function finalizeCell(cell: MutableCell | undefined): PlayerAllTimeStatCell {
  if (!cell || cell.appearances <= 0) {
    return emptyCell();
  }
  return {
    points: roundValue(cell.points, 1),
    appearances: cell.appearances,
    pointsPerAppearance: roundValue(cell.points / cell.appearances, 2),
    seasonsPlayed: cell.seasonIds.size,
  };
}

function mergeMutableCells(target: MutableCell, points: number, appearances: number, seasonId: string) {
  target.points = roundValue(target.points + points, 1);
  target.appearances += appearances;
  target.seasonIds.add(seasonId);
}

/**
 * Baut die All-Time-Bestenliste: je Spieler Gesamtpunkte + Einsätze + Punkte-pro-Einsatz,
 * aufgeschlüsselt nach Disziplin UND nach Bereich (POW/SPE/MEN/SOC), über ALLE archivierten
 * Saisons plus die laufende.
 */
export function buildPlayerAllTimeDisciplineStats(gameState: GameState): PlayerAllTimeDisciplineRow[] {
  const byPlayerDiscipline = new Map<string, Map<SeasonDisciplineKey, MutableCell>>();

  function add(
    playerId: string | null | undefined,
    disciplineId: string | null | undefined,
    seasonId: string,
    points: number | null | undefined,
    appearances: number,
  ) {
    if (!playerId || !disciplineId || appearances <= 0) {
      return;
    }
    const key = normalizeLineupDisciplineFieldName(disciplineId);
    if (!isSeasonDisciplineKey(key)) {
      return;
    }
    const byDiscipline = byPlayerDiscipline.get(playerId) ?? new Map<SeasonDisciplineKey, MutableCell>();
    const cell = byDiscipline.get(key) ?? { points: 0, appearances: 0, seasonIds: new Set<string>() };
    mergeMutableCells(cell, points ?? 0, appearances, seasonId);
    byDiscipline.set(key, cell);
    byPlayerDiscipline.set(playerId, byDiscipline);
  }

  // --- Archivierte Saisons -------------------------------------------------
  const snapshots = clampSeasonSnapshotsToCurrentSeason(gameState);
  for (const snapshot of snapshots) {
    for (const performance of snapshot.playerPerformances ?? []) {
      for (const entry of performance.disciplineBreakdown ?? []) {
        add(performance.playerId, entry.disciplineId, snapshot.seasonId, entry.totalContribution, entry.appearances ?? 0);
      }
    }
  }

  // --- Laufende Saison (noch kein Snapshot) --------------------------------
  const currentSeasonId = gameState.season.id;
  const hasCurrentSeasonSnapshot = snapshots.some((snapshot) => snapshot.seasonId === currentSeasonId);
  if (!hasCurrentSeasonSnapshot) {
    const ledger = buildSeasonPointsLedger(gameState);
    const grouped = new Map<string, Map<string, { points: number; appearances: number }>>();
    for (const entry of ledger.pointEntries) {
      if (entry.seasonId !== currentSeasonId) continue;
      const byDiscipline = grouped.get(entry.playerId) ?? new Map<string, { points: number; appearances: number }>();
      const group = byDiscipline.get(entry.disciplineId) ?? { points: 0, appearances: 0 };
      group.points = roundValue(group.points + (entry.points ?? 0), 1);
      group.appearances += 1;
      byDiscipline.set(entry.disciplineId, group);
      grouped.set(entry.playerId, byDiscipline);
    }
    for (const [playerId, byDiscipline] of grouped.entries()) {
      for (const [disciplineId, group] of byDiscipline.entries()) {
        add(playerId, disciplineId, currentSeasonId, group.points, group.appearances);
      }
    }
  }

  // --- Identität (Name/Team) — jüngster Stand gewinnt ----------------------
  // Dasselbe Muster wie `buildLeagueRecordsHallOfFame`: erst aus den Snapshots (chronologisch),
  // danach vom aktuellen Kader überschrieben — der aktuelle Kader ist immer der jüngste Stand.
  const latestIdentityByPlayerId = new Map<
    string,
    { playerName: string; teamId: string | null; teamCode: string | null; teamName: string | null }
  >();
  for (const snapshot of snapshots) {
    for (const performance of snapshot.playerPerformances ?? []) {
      latestIdentityByPlayerId.set(performance.playerId, {
        playerName: performance.playerName,
        teamId: performance.teamId ?? null,
        teamCode: performance.teamCode ?? null,
        teamName: performance.teamName ?? null,
      });
    }
  }
  // Das Snapshot-Team VOR dem Ueberschreiben durch den aktuellen Kader merken (`lastKnownTeamId`).
  const snapshotTeamIdByPlayerId = new Map(
    [...latestIdentityByPlayerId].map(([playerId, identity]) => [playerId, identity.teamId] as const),
  );
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const currentTeamIdByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry.teamId] as const));
  for (const player of gameState.players ?? []) {
    if (!byPlayerDiscipline.has(player.id)) continue;
    const teamId = currentTeamIdByPlayerId.get(player.id) ?? null;
    const team = teamId ? teamById.get(teamId) ?? null : null;
    latestIdentityByPlayerId.set(player.id, {
      playerName: player.name,
      teamId,
      teamCode: team?.shortCode ?? null,
      teamName: team?.name ?? null,
    });
  }

  // --- Bereichs-/Gesamtaggregation je Spieler ------------------------------
  const rows: PlayerAllTimeDisciplineRow[] = [];
  for (const [playerId, byDiscipline] of byPlayerDiscipline.entries()) {
    const identity = latestIdentityByPlayerId.get(playerId) ?? null;
    const byDisciplineOut: Partial<Record<SeasonDisciplineKey, PlayerAllTimeStatCell>> = {};
    for (const [key, cell] of byDiscipline.entries()) {
      byDisciplineOut[key] = finalizeCell(cell);
    }

    const byArea = {} as Record<SeasonDisciplineAreaId, PlayerAllTimeStatCell>;
    const overallSeasonIds = new Set<string>();
    let overallPoints = 0;
    let overallAppearances = 0;

    for (const group of SEASON_DISCIPLINE_AREA_GROUPS_IN_STANDARD_ORDER) {
      let areaPoints = 0;
      let areaAppearances = 0;
      const areaSeasonIds = new Set<string>();
      for (const key of group.keys) {
        const cell = byDiscipline.get(key);
        if (!cell) continue;
        areaPoints += cell.points;
        areaAppearances += cell.appearances;
        for (const seasonId of cell.seasonIds) {
          areaSeasonIds.add(seasonId);
          overallSeasonIds.add(seasonId);
        }
      }
      byArea[group.id] = {
        points: roundValue(areaPoints, 1),
        appearances: areaAppearances,
        pointsPerAppearance: areaAppearances > 0 ? roundValue(areaPoints / areaAppearances, 2) : null,
        seasonsPlayed: areaSeasonIds.size,
      };
      overallPoints += areaPoints;
      overallAppearances += areaAppearances;
    }

    rows.push({
      playerId,
      playerName: identity?.playerName ?? playerId,
      teamId: identity?.teamId ?? null,
      teamCode: identity?.teamCode ?? null,
      teamName: identity?.teamName ?? null,
      lastKnownTeamId: identity?.teamId ?? snapshotTeamIdByPlayerId.get(playerId) ?? null,
      seasonsPlayed: overallSeasonIds.size,
      overall: {
        points: roundValue(overallPoints, 1),
        appearances: overallAppearances,
        pointsPerAppearance: overallAppearances > 0 ? roundValue(overallPoints / overallAppearances, 2) : null,
        seasonsPlayed: overallSeasonIds.size,
      },
      byArea,
      byDiscipline: byDisciplineOut,
    });
  }

  return rows
    .filter((row) => row.overall.appearances > 0)
    .sort((left, right) => right.overall.points - left.overall.points);
}
