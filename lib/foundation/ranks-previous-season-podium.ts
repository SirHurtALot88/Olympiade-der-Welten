import type { GameState } from "@/lib/data/olyDataTypes";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
import { buildHistoricalLeagueTierLookup, getLeagueLevel } from "@/lib/season/league-history";
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
  /**
   * Liga der Vorsaison (`liga<N>`), `null` ohne Liga-Trennung. Bei Liga-Split traegt jede Liga ihr
   * eigenes Podium (Rang 1..3 je Liga) — ohne Liga staenden zwei „Meister" ununterscheidbar
   * untereinander (Chris, 02.11.).
   */
  leagueTier?: string | null;
};

export type PreviousSeasonPodium = {
  seasonId: string;
  seasonLabel: string;
  entries: PreviousSeasonPodiumEntry[];
};

export function buildPreviousSeasonPodium(gameState: GameState): PreviousSeasonPodium | null {
  // Wie in `all-time-table.ts`: hier stand `seasonSnapshots ?? …`, und `??` greift nur bei
  // `null`/`undefined`. Gestrichen wird aber mit einer LEEREN LISTE, also war der Ersatzzweig
  // unerreichbar und das Vorsaison-Podium im Ranks-Reiter verschwand im Browser ganz.
  const rawSnapshots = leseSaisonSchnappschuesse(gameState);
  if (rawSnapshots.length === 0) {
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

  const leagueTierOf = buildHistoricalLeagueTierLookup(gameState);
  const entries = resolveSeasonSnapshotTeamRecords(last)
    .filter(
      (record): record is typeof record & { rank: number } =>
        record.rank != null && Number.isFinite(record.rank) && record.rank >= 1 && record.rank <= 3,
    )
    .map((record) => ({
      teamId: record.teamId,
      teamCode: record.teamCode,
      teamName: record.teamName,
      rank: record.rank,
      points: record.points != null && Number.isFinite(record.points) ? record.points : null,
      leagueTier: record.leagueTier !== undefined ? record.leagueTier : leagueTierOf(last.seasonId, record.teamId),
    }))
    // Erst nach Liga (Liga 1 oben), dann nach Rang — ohne Liga-Split bleibt es die reine Rangfolge.
    .sort(
      (left, right) =>
        (getLeagueLevel(left.leagueTier) ?? 0) - (getLeagueLevel(right.leagueTier) ?? 0) || left.rank - right.rank,
    );
  if (entries.length === 0) {
    return null;
  }

  return {
    seasonId: last.seasonId,
    seasonLabel: getCanonicalSeasonLabel({ seasonId: last.seasonId, seasonName: last.seasonName ?? null }),
    entries,
  };
}
