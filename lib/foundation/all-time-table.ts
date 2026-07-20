import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableFromSnapshots, resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/**
 * "Ewige Tabelle" (All-Time Table) — mehr-Saison-Team-Auswertung über alle
 * archivierten Saisons (`gameState.seasonState.seasonSnapshots`) plus die
 * laufende Saison (optional, wenn der Aufrufer `liveStandingsByTeamId`
 * mitgibt — dieses Modul ist pur/ohne React und kennt die Live-Feeds selbst
 * nicht).
 *
 * Grounding notes:
 * - Medaillen/Ø-Rang/Best-Rang/Anzahl-Saisons kommen 1:1 aus dem bestehenden
 *   Selektor `buildAllTimeTableFromSnapshots` (season-snapshot-helpers) —
 *   keine Zweit-Implementierung. Diese Aggregate sind bewusst archiv-only
 *   (Titel = #1-Finishes über archivierte Saisons), die laufende Saison
 *   zählt hier nicht mit, weil sie noch nicht final ist.
 * - "Punkte" = Liga-Punkte aus `SeasonSnapshotTeamRecord.points` (Rang-
 *   bestimmend), NICHT die Diszi-Punkte-Summe (`disciplinePoints`).
 * - MW/Cash bevorzugen die "Total"-Variante (`marketValueTotalEnd`/
 *   `cashTotal`), fallen ehrlich auf die einfache Variante zurück, wenn die
 *   Total-Variante fehlt (ältere Snapshots).
 * - Fehlt ein Datenpunkt, bleibt das Feld `null` statt eines erfundenen
 *   Werts — auch bei den Aggregat-"Leadern" (mostTitles/biggestMwGrowth/
 *   richestEver): ohne mindestens einen echten Wert bleibt das Feld `null`.
 */

export type AllTimeSeasonPoint = {
  seasonId: string;
  seasonLabel: string;
  /** true = laufende (noch nicht archivierte) Saison. */
  isLive: boolean;
  rank: number | null;
  points: number | null;
  marketValue: number | null;
  cash: number | null;
};

export type AllTimeTableMedals = {
  gold: number;
  silver: number;
  bronze: number;
  top5: number;
  top10: number;
};

export type AllTimeTableRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  /** Aufsteigend nach Saison, laufende Saison (falls vorhanden) zuletzt. */
  seasons: AllTimeSeasonPoint[];
  /** Summe der Liga-Punkte über alle Saisons inkl. laufender Saison. */
  cumulativePoints: number;
  /** Ø-Rang über archivierte Saisons (aus buildAllTimeTableFromSnapshots). */
  avgRank: number | null;
  /** Bester Rang über archivierte Saisons. */
  bestRank: number | null;
  /** #1-Finishes über archivierte Saisons. */
  titles: number;
  medals: AllTimeTableMedals;
  /** Aktuellster bekannter Marktwert (laufende Saison, sonst letzte archivierte). */
  mwNow: number | null;
  /** Höchster je erreichter Marktwert über alle Saisons. */
  mwPeak: number | null;
  /** Marktwert der ersten bekannten Saison (Baseline für Wachstum). */
  mwFirst: number | null;
  mwGrowthAbs: number | null;
  mwGrowthPct: number | null;
  /** Höchster je erreichter Cash-Stand über alle Saisons. */
  cashPeak: number | null;
  /** Aktuellster bekannter Cash-Stand. */
  cashNow: number | null;
  /** 1-basierter Rang in der Ewigen Tabelle (nach `rows`-Sortierung). */
  allTimeRank: number;
};

export type AllTimeTableModel = {
  rows: AllTimeTableRow[];
  /** Ewiger Leader = Rang 1 nach kumulierten Punkten (inkl. Tie-Breaks). */
  leader: AllTimeTableRow | null;
  mostTitles: AllTimeTableRow | null;
  biggestMwGrowth: AllTimeTableRow | null;
  richestEver: AllTimeTableRow | null;
  /** Saison-Labels aufsteigend (für Chart-Achsen), laufende Saison ggf. zuletzt. */
  seasonLabels: string[];
  archivedSeasonCount: number;
  /** false nur während des Compact-Loads, bevor das Archiv nachgeladen wurde. */
  hasArchive: boolean;
  hasHistory: boolean;
};

export type LiveTeamStanding = {
  rank: number | null;
  points: number | null;
  marketValue: number | null;
  cash: number | null;
};

export interface BuildAllTimeTableModelInput {
  gameState: GameState;
  selectedTeamId?: string | null;
  /**
   * Live-Stand der laufenden Saison je Team (Rang/Punkte/MW/Cash), z. B. aus
   * dem Season-Standings-Feed. Optional — ohne diesen Input enthält das
   * Modell nur archivierte Saisons (kein erfundener Live-Wert).
   */
  liveStandingsByTeamId?: Record<string, LiveTeamStanding> | null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sortSnapshotsAsc(snapshots: SeasonSnapshotRecord[]): SeasonSnapshotRecord[] {
  return [...snapshots].sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }));
}

function seasonLabelOf(input: { seasonId: string; seasonName?: string | null }): string {
  return getCanonicalSeasonLabel({ seasonId: input.seasonId, seasonName: input.seasonName ?? null });
}

function compareAllTimeRows(left: Omit<AllTimeTableRow, "allTimeRank">, right: Omit<AllTimeTableRow, "allTimeRank">): number {
  if (right.cumulativePoints !== left.cumulativePoints) {
    return right.cumulativePoints - left.cumulativePoints;
  }
  if (right.titles !== left.titles) {
    return right.titles - left.titles;
  }
  if (right.medals.gold !== left.medals.gold) {
    return right.medals.gold - left.medals.gold;
  }
  if (right.medals.silver !== left.medals.silver) {
    return right.medals.silver - left.medals.silver;
  }
  if (right.medals.bronze !== left.medals.bronze) {
    return right.medals.bronze - left.medals.bronze;
  }
  const leftBestRank = left.bestRank ?? Number.POSITIVE_INFINITY;
  const rightBestRank = right.bestRank ?? Number.POSITIVE_INFINITY;
  if (leftBestRank !== rightBestRank) {
    return leftBestRank - rightBestRank;
  }
  const leftAvgRank = left.avgRank ?? Number.POSITIVE_INFINITY;
  const rightAvgRank = right.avgRank ?? Number.POSITIVE_INFINITY;
  if (leftAvgRank !== rightAvgRank) {
    return leftAvgRank - rightAvgRank;
  }
  return left.teamName.localeCompare(right.teamName, "de");
}

/** Zeile mit dem höchsten (echten, endlichen) Wert eines Selektors — `null`, wenn keine Zeile einen Wert hat. */
function pickBestRow(
  rows: AllTimeTableRow[],
  selector: (row: AllTimeTableRow) => number | null,
): AllTimeTableRow | null {
  let best: AllTimeTableRow | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = selector(row);
    if (!isFiniteNumber(value)) {
      continue;
    }
    if (best == null || value > bestValue) {
      best = row;
      bestValue = value;
    }
  }
  return best;
}

export function buildAllTimeTableModel(input: BuildAllTimeTableModelInput): AllTimeTableModel {
  const { gameState, liveStandingsByTeamId } = input;
  const rawSnapshots = gameState.seasonState.seasonSnapshots;
  const hasArchive = rawSnapshots !== undefined;
  const snapshots = sortSnapshotsAsc(
    (rawSnapshots ?? []).filter((snapshot) => resolveSeasonSnapshotTeamRecords(snapshot).length > 0),
  );
  const archivedSeasonCount = snapshots.length;
  const hasHistory = archivedSeasonCount > 0;

  const allTimeAggregateByTeamId = new Map(
    buildAllTimeTableFromSnapshots(snapshots, gameState.teams).map((row) => [row.teamId, row] as const),
  );

  const archivedSeasonIds = new Set(snapshots.map((snapshot) => snapshot.seasonId));
  const liveSeasonId = gameState.season.id;
  const liveSeasonIncluded =
    liveStandingsByTeamId != null && liveSeasonId !== "loading" && !archivedSeasonIds.has(liveSeasonId);
  const liveSeasonLabel = liveSeasonIncluded
    ? seasonLabelOf({ seasonId: liveSeasonId, seasonName: gameState.season.name })
    : null;

  // Team-Identitäten: aktuelle Liga-Teams + jedes Team, das nur in einem
  // archivierten Snapshot auftaucht (z. B. inzwischen ersetztes Team).
  const teamMap = new Map<string, { teamId: string; teamCode: string; teamName: string }>();
  for (const team of gameState.teams) {
    teamMap.set(team.teamId, { teamId: team.teamId, teamCode: team.shortCode, teamName: team.name });
  }
  for (const snapshot of snapshots) {
    for (const record of resolveSeasonSnapshotTeamRecords(snapshot)) {
      if (!teamMap.has(record.teamId)) {
        teamMap.set(record.teamId, { teamId: record.teamId, teamCode: record.teamCode, teamName: record.teamName });
      }
    }
  }

  const rowsUnranked: Omit<AllTimeTableRow, "allTimeRank">[] = Array.from(teamMap.values()).map((team) => {
    const seasons: AllTimeSeasonPoint[] = [];

    for (const snapshot of snapshots) {
      const record = resolveSeasonSnapshotTeamRecords(snapshot).find((entry) => entry.teamId === team.teamId);
      if (!record) {
        continue;
      }
      seasons.push({
        seasonId: snapshot.seasonId,
        seasonLabel: seasonLabelOf({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName }),
        isLive: false,
        rank: record.rank ?? null,
        points: record.points ?? null,
        marketValue: record.marketValueTotalEnd ?? record.marketValueEnd ?? null,
        cash: record.cashTotal ?? record.cashEnd ?? null,
      });
    }

    if (liveSeasonIncluded && liveSeasonLabel != null) {
      const live = liveStandingsByTeamId?.[team.teamId];
      if (live) {
        seasons.push({
          seasonId: liveSeasonId,
          seasonLabel: liveSeasonLabel,
          isLive: true,
          rank: live.rank ?? null,
          points: live.points ?? null,
          marketValue: live.marketValue ?? null,
          cash: live.cash ?? null,
        });
      }
    }

    const cumulativePoints = seasons.reduce((sum, season) => sum + (season.points ?? 0), 0);

    const aggregate = allTimeAggregateByTeamId.get(team.teamId) ?? null;
    const medals: AllTimeTableMedals = {
      gold: aggregate?.gold ?? 0,
      silver: aggregate?.silver ?? 0,
      bronze: aggregate?.bronze ?? 0,
      top5: aggregate?.top5 ?? 0,
      top10: aggregate?.top10 ?? 0,
    };
    const titles = medals.gold;
    const avgRank = aggregate?.avgRank ?? null;
    const bestRank = aggregate?.bestRank ?? null;

    const marketValues = seasons.map((season) => season.marketValue).filter(isFiniteNumber);
    const cashValues = seasons.map((season) => season.cash).filter(isFiniteNumber);
    const firstWithMw = seasons.find((season) => isFiniteNumber(season.marketValue)) ?? null;
    const lastWithMw = [...seasons].reverse().find((season) => isFiniteNumber(season.marketValue)) ?? null;
    const lastWithCash = [...seasons].reverse().find((season) => isFiniteNumber(season.cash)) ?? null;

    const mwFirst = firstWithMw ? firstWithMw.marketValue : null;
    const mwNow = lastWithMw ? lastWithMw.marketValue : null;
    const mwPeak = marketValues.length > 0 ? Math.max(...marketValues) : null;
    const mwGrowthAbs =
      isFiniteNumber(mwNow) && isFiniteNumber(mwFirst) ? Number((mwNow - mwFirst).toFixed(2)) : null;
    const mwGrowthPct =
      isFiniteNumber(mwGrowthAbs) && isFiniteNumber(mwFirst) && mwFirst !== 0
        ? Number(((mwGrowthAbs / mwFirst) * 100).toFixed(1))
        : null;
    const cashPeak = cashValues.length > 0 ? Math.max(...cashValues) : null;
    const cashNow = lastWithCash ? lastWithCash.cash : null;

    return {
      teamId: team.teamId,
      teamCode: team.teamCode,
      teamName: team.teamName,
      seasons,
      cumulativePoints,
      avgRank,
      bestRank,
      titles,
      medals,
      mwNow,
      mwPeak,
      mwFirst,
      mwGrowthAbs,
      mwGrowthPct,
      cashPeak,
      cashNow,
    };
  });

  const rows: AllTimeTableRow[] = [...rowsUnranked]
    .sort(compareAllTimeRows)
    .map((row, index) => ({ ...row, allTimeRank: index + 1 }));

  const leader = rows[0] ?? null;
  const mostTitles = pickBestRow(rows, (row) => (row.titles > 0 ? row.titles : null));
  const biggestMwGrowth = pickBestRow(rows, (row) => row.mwGrowthAbs);
  const richestEver = pickBestRow(rows, (row) => row.cashPeak);

  const seasonLabels = snapshots.map((snapshot) =>
    seasonLabelOf({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName }),
  );
  if (liveSeasonIncluded && liveSeasonLabel != null) {
    seasonLabels.push(liveSeasonLabel);
  }

  return {
    rows,
    leader,
    mostTitles,
    biggestMwGrowth,
    richestEver,
    seasonLabels,
    archivedSeasonCount,
    hasArchive,
    hasHistory,
  };
}
