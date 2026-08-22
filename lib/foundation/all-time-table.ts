import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { isFiniteNumber } from "@/lib/foundation/foundation-number-utils";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
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
  /**
   * ERSATZ FUER DEN BROWSER — gemeldet als „1 Season ist rum aber kein team hat seine medallien
   * bekommen". Die Anfangsladung streicht `seasonSnapshots` (siehe
   * `foundation-initial-compact-state`), also zaehlte diese Tabelle ihre Medaillen ueber eine leere
   * Liste: null Gold, null Silber, null Bronze, dazu kein Ø-Rang und keine kumulierten Punkte der
   * Vorsaison. Die mitgefahrene Kurzfassung traegt die Raenge, aus denen die Medaillen entstehen.
   *
   * Der Vorrang ist wichtig herum: liegen die vollen Schnappschuesse vor (Server, Tests), gewinnen
   * sie. Die Kurzfassung springt nur ein, wenn gestrichen wurde.
   *
   * DIESE STELLE HAT DIE KURZFASSUNG NIE ERREICHT. Hier stand `seasonSnapshots ?? …`, und `??`
   * greift nur bei `null`/`undefined`. Gestrichen wird aber nicht mit `undefined`, sondern mit
   * einer LEEREN LISTE (`withCompactSeasonArchiveSentinel`,
   * `lib/foundation/apply-compact-season-archive-sentinel.ts`) — und `[]` ist nicht nullish. Der
   * Ersatzzweig war damit toter Code: die Projektion fuhr mit, kam aber nie zum Zug, und die
   * Ewige Tabelle meldete im Browser weiterhin „keine archivierten Saisons".
   *
   * Deshalb liest sie jetzt ueber `leseSaisonSchnappschuesse` — die eine Stelle, die den Vorrang
   * an der LAENGE entscheidet statt an `null`. Ein zweites `??` kann hier nicht wieder entstehen.
   */
  const rawSnapshots = leseSaisonSchnappschuesse(gameState);
  // `hasArchive` behaelt seine urspruengliche Bedeutung: „es liegt eine ANTWORT vor" — auch die
  // Antwort „null archivierte Saisons". Deshalb hier weiter am Feld selbst gepruft (`undefined`
  // = noch nichts geladen) und nicht an der Laenge; die Kurzfassung kann zusaetzlich eine Antwort
  // liefern, wo das Feld leer geblieben ist.
  const hasArchive = gameState.seasonState.seasonSnapshots !== undefined || rawSnapshots.length > 0;
  const snapshots = sortSnapshotsAsc(
    rawSnapshots.filter((snapshot) => resolveSeasonSnapshotTeamRecords(snapshot).length > 0),
  );
  const archivedSeasonCount = snapshots.length;
  const hasHistory = archivedSeasonCount > 0;

  const allTimeAggregateByTeamId = new Map(
    buildAllTimeTableFromSnapshots(snapshots, gameState.teams).map((row) => [row.teamId, row] as const),
  );

  /**
   * DIE LAUFENDE SAISON GEHOERT NICHT HINEIN — gemeldet (`6l1b0i`): „in der ewigen Tabelle sollen
   * wirklich nur vergangene abgeschlossene Seasons getrackt werden!"
   *
   * Vorher stand hier ein `liveSeasonIncluded`, das die laufende Saison als eigene Zeile
   * dazuschrieb, sobald ein Standings-Feed geladen war. Zwei Dinge sprechen dagegen, und Chris hat
   * beide gemeldet:
   *
   *  1. INHALTLICH: eine Ewige Tabelle, die eine halb gespielte Saison mitzaehlt, vergleicht
   *     Aepfel mit Birnen — der Rang eines Teams an Spieltag 1 ist keine Saisonleistung.
   *  2. GEMESSEN: genau daraus entstand `bia63a` („in S2 MD1 haben alle Teams doppelte Punkte").
   *     Der Standings-Feed traegt am Saisonanfang noch den Stand der eben beendeten Saison; die
   *     stand damit zweimal in der Liste — einmal als Snapshot, einmal als „live". Am Abbild
   *     nachgezaehlt liegt je Saison genau EIN Snapshot (kein Doppel-Schreiben), die Verdopplung
   *     entstand also erst hier beim Rechnen.
   *
   * `liveStandingsByTeamId` bleibt im Eingang stehen: der Aufrufer soll nicht umgebaut werden
   * muessen, und der Wert traegt weiter die Live-Sicht anderer Ansichten. Hier wird er nur nicht
   * mehr zu einer Saisonzeile.
   */

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
        /**
         * WELCHER STAND HIER STEHT — Chris' Vorgabe: „die snapshots für Cash und Marktwert sollen
         * ja auch erst am anfang der Saison nach den Käufen stattfinden für die ewige Tabelle /
         * Finanzen." Gemeint ist der Eintrittsstand der FOLGESAISON: Kader gefüllt, Käufe getätigt,
         * Kredite aufgenommen — das ist der Stand, mit dem das Team wirklich weiterspielt.
         *
         * Den schreibt `patchCompletedSeasonSnapshotAfterPreseasonBuy` in `marketValueTotalEnd`
         * (Marktwert) und `cashEntry` (Cash). Ob er gelaufen ist, sagt `entryRosterPatchedAt` —
         * ungepatchte Snapshots (Altsaves, oder die noch laufende letzte Saison) haben ihn nicht.
         *
         * FALLBACK OHNE PATCH, und warum genau in dieser Reihenfolge:
         *   Marktwert → `marketValueSeasonEnd` (Stand nach dem Trainings-Apply, der echte
         *   Saisonabschluss). `marketValueTotalEnd` traegt dann noch den Stand VOR der Entwicklung
         *   und waere die schlechtere Zahl.
         *   Cash → `cashEnd` (echter Kontostand zum Snapshot). `cashTotal` ist `projectedCash` aus
         *   dem Cash-Apply, eine PROGNOSE vor Sponsoren, Krediten, Gebaeuden und Backstop — sie
         *   stand hier einmal vorne, daher Chris' Meldung „in der ewigen Tabelle stehen auch noch
         *   die alten Cash-Werte". Deshalb ganz hinten.
         */
        marketValue: snapshot.entryRosterPatchedAt
          ? (record.marketValueTotalEnd ?? record.marketValueEnd ?? record.marketValueSeasonEnd ?? null)
          : (record.marketValueSeasonEnd ?? record.marketValueTotalEnd ?? record.marketValueEnd ?? null),
        // `cashCarryOver` steht zwischen den beiden: der Kontostand an der Saisongrenze (nach der
        // Vertragsalterung, vor den Kaeufen). Fehlt der Eintritts-Patch noch, ist das die naechste
        // ehrliche Antwort auf „womit ging das Team weiter" — `cashEnd` liegt eine Vertragsrunde
        // davor und `cashTotal` ist nur eine Prognose.
        cash: record.cashEntry ?? record.cashCarryOver ?? record.cashEnd ?? record.cashTotal ?? null,
      });
    }

    // Hier stand der Live-Saison-Eintrag. Er ist raus — Begruendung oben bei `liveSeasonIncluded`.

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
