import type { GameState } from "@/lib/data/olyDataTypes";
import { alsSchnappschussErsatz } from "@/lib/persistence/foundation-season-history-projection";
import { resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/**
 * Vorsaison-Podium für den PP-Board-Saisonstart (Paket W1, Muster 3).
 *
 * Am Spieltag 1 steht jedes Team bei 0 PPs — statt Alphabet-Medaillen zeigt das
 * Board dann einen ehrlichen Leerzustand (VeloPendingRanking) plus das ECHTE
 * Podium der letzten abgeschlossenen Saison. Die Daten dafür existieren bereits:
 * `gameState.seasonState.seasonSnapshots` (bzw. die Kurzprojektion
 * `foundationSeasonHistory`, wenn die Anfangsladung die vollen Schnappschüsse
 * gestrichen hat) — exakt derselbe Datenweg wie `buildAllTimeTableModel`
 * (lib/foundation/all-time-table.ts), keine zweite Quelle.
 *
 * Gibt `null` zurück, wenn es keine abgeschlossene Vorsaison gibt (Season 1)
 * oder die Snapshots keine Ränge tragen — dann zeigt das Board nur den
 * Leerzustand, es wird nichts erfunden.
 */

export type PreviousSeasonPodiumEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  /** Endrang der Vorsaison (1–3). */
  rank: number;
  /** Liga-Punkte der Vorsaison, falls im Snapshot vorhanden. */
  points: number | null;
};

export type PreviousSeasonPodium = {
  seasonId: string;
  seasonLabel: string;
  entries: PreviousSeasonPodiumEntry[];
};

export function buildPreviousSeasonPodium(gameState: GameState): PreviousSeasonPodium | null {
  const rawSnapshots =
    gameState.seasonState.seasonSnapshots ??
    (gameState.seasonState.foundationSeasonHistory != null
      ? alsSchnappschussErsatz(gameState.seasonState.foundationSeasonHistory, gameState.teams)
      : undefined);
  if (!rawSnapshots || rawSnapshots.length === 0) {
    return null;
  }

  const liveSeasonId = gameState.season.id;
  const snapshots = rawSnapshots
    .filter(
      (snapshot) =>
        snapshot.seasonId !== liveSeasonId && resolveSeasonSnapshotTeamRecords(snapshot).length > 0,
    )
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }));
  const last = snapshots[snapshots.length - 1];
  if (!last) {
    return null;
  }

  const entries = resolveSeasonSnapshotTeamRecords(last)
    .filter(
      (record): record is typeof record & { rank: number } =>
        record.rank != null && Number.isFinite(record.rank) && record.rank >= 1 && record.rank <= 3,
    )
    .sort((left, right) => left.rank - right.rank)
    .map((record) => ({
      teamId: record.teamId,
      teamCode: record.teamCode,
      teamName: record.teamName,
      rank: record.rank,
      points: record.points != null && Number.isFinite(record.points) ? record.points : null,
    }));
  if (entries.length === 0) {
    return null;
  }

  return {
    seasonId: last.seasonId,
    seasonLabel: getCanonicalSeasonLabel({ seasonId: last.seasonId, seasonName: last.seasonName ?? null }),
    entries,
  };
}
