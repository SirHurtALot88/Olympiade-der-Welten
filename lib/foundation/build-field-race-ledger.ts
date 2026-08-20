import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { getMatchdaySummaryOptions } from "@/lib/foundation/matchday-summary";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

/**
 * Feld-Rennen-Ledger — pro Team eine Zeitreihe über alle bereits gespielten
 * (`preview_applied`) Spieltage einer Season: Tagespunkte, Tagesrang, kumulative
 * Punkte, kumulativer Rang und die Rang-Änderung gegenüber dem Vor-Spieltag.
 *
 * Rein LESEND aus bereits persistierten Daten abgeleitet — keine neue
 * Spiel-Logik, keine neue Persistenz. Die Rechnung ist exakt die, die
 * `buildMatchdaySummary` bereits für EINEN Spieltag macht, hier in einem
 * Durchlauf über alle Spieltage generalisiert.
 *
 * Fog-of-War-sicher: liest nur realisierte, öffentliche Spieltags-Ergebnisse
 * (Punkte/Ränge). Es wird kein verstecktes Potential berührt.
 *
 * Verwendet von:
 * - D1 Feld-Form-Strip (letzte 5 Spieltage je Team)
 * - D4 Ranks Rang-Movement (Δ Rang vs. letzter Spieltag)
 */

export type FieldRaceLedgerEntry = {
  matchdayId: string;
  /** 1-basierte Spieltag-Nummer in der Season. */
  matchdayNumber: number;
  /** Punkte, die das Team an genau diesem Spieltag geholt hat (null, wenn keine Wertung vorliegt). */
  tagespunkte: number | null;
  /** Rang des Teams gemessen NUR an den Tagespunkten dieses Spieltags. */
  tagesrang: number | null;
  /** Kumulative Season-Punkte nach diesem Spieltag. */
  cumulativePoints: number;
  /** Kumulativer Season-Rang nach diesem Spieltag. */
  cumulativeRank: number | null;
  /** prevRank − thisRank: > 0 = Plätze gutgemacht, < 0 = abgerutscht, null am ersten Spieltag. */
  rankDeltaVsPrev: number | null;
  /**
   * Wurde dieser Spieltag ueberhaupt schon gewertet? Der Ledger laeuft bewusst ueber ALLE
   * Spieltage der Season (auch kuenftige), damit Reihenfolge und Nummerierung stimmen.
   * Kuenftige Spieltage tragen keine Punkte, lassen den kumulativen Rang unveraendert und
   * ergeben damit `rankDeltaVsPrev = 0` — wer blind das Listenende liest, bekommt also
   * "keine Bewegung" und leere Form-Felder. Dieses Flag trennt beides sauber.
   */
  played: boolean;
};

export type FieldRaceLedger = {
  seasonId: string;
  matchdays: Array<{ matchdayId: string; matchdayNumber: number; played: boolean }>;
  rowsByTeamId: Map<string, FieldRaceLedgerEntry[]>;
};

/** Ordnet Teams nach Punkten (desc), Gleichstand alphabetisch — identisch zu matchday-summary. */
function rankByPoints(
  pointsByTeam: Map<string, number | null>,
  teams: Array<{ teamId: string; teamName: string }>,
): Map<string, number | null> {
  return new Map(
    [...teams]
      .map((team) => ({ teamId: team.teamId, teamName: team.teamName, points: pointsByTeam.get(team.teamId) ?? null }))
      .sort((left, right) => {
        const pointDiff =
          (right.points ?? Number.NEGATIVE_INFINITY) - (left.points ?? Number.NEGATIVE_INFINITY);
        if (pointDiff !== 0) return pointDiff;
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map(
        (row, index) =>
          [row.teamId, typeof row.points === "number" && Number.isFinite(row.points) ? index + 1 : null] as const,
      ),
  );
}

export function buildFieldRaceLedger(
  gameState: GameState,
  seasonId = gameState.season?.id ?? "",
  /**
   * Bereits gebautes Punkte-Ledger wiederverwenden (computeSeasonDerivationsFresh
   * baut es ohnehin). Ohne diesen Parameter wird es neu berechnet — das ist teuer
   * und im Hot-Path unnötig doppelt, daher immer den vorhandenen durchreichen.
   */
  precomputedPointsLedger?: SeasonPointsLedger,
): FieldRaceLedger {
  const teams = (gameState.teams ?? []).map((team) => ({ teamId: team.teamId, teamName: team.name }));

  // Defensiv: dieser Ledger läuft im Hot-Path von computeSeasonDerivationsFresh,
  // also auch mit minimalen/teilweise befüllten GameStates aus Tests/Frühphasen.
  // Ohne Spieltag-Reihenfolge oder Ergebnisse gibt es nichts abzuleiten — dann ein
  // leeres Ledger zurückgeben statt zu werfen (ein Throw würde die gesamte
  // Season-Derivation kippen).
  const emptyLedger: FieldRaceLedger = {
    seasonId,
    matchdays: [],
    rowsByTeamId: new Map(teams.map((team) => [team.teamId, [] as FieldRaceLedgerEntry[]])),
  };
  if (!Array.isArray(gameState.season?.matchdayIds) || (gameState.seasonState?.matchdayResults ?? []).length === 0) {
    return emptyLedger;
  }

  const orderedMatchdays = getMatchdaySummaryOptions(gameState, seasonId);
  const ledger = precomputedPointsLedger ?? buildSeasonPointsLedger(gameState, seasonId);

  // Tagespunkte je Spieltag je Team (aus den Punkt-Einträgen des Ledgers).
  const pointsByMatchday = new Map<string, Map<string, number>>();
  for (const entry of ledger.pointEntries) {
    if (entry.matchdayId == null) continue;
    let perTeam = pointsByMatchday.get(entry.matchdayId);
    if (!perTeam) {
      perTeam = new Map();
      pointsByMatchday.set(entry.matchdayId, perTeam);
    }
    // `entry.points` (Rang-Anteil + Mutator), damit das Feld-Rennen dieselbe Summe zeigt wie
    // Saisonstand und Spieltag. Siehe `season-matchday-points.ts` — beide muessen gleich bleiben.
    perTeam.set(entry.teamId, roundValue((perTeam.get(entry.teamId) ?? 0) + entry.points, 4));
  }

  const rowsByTeamId = new Map<string, FieldRaceLedgerEntry[]>();
  for (const team of teams) rowsByTeamId.set(team.teamId, []);

  const cumulative = new Map<string, number>();
  const prevCumulativeRank = new Map<string, number | null>();
  const matchdays: Array<{ matchdayId: string; matchdayNumber: number; played: boolean }> = [];

  orderedMatchdays.forEach((option, index) => {
    const matchdayNumber = option.matchdayNumber ?? index + 1;
    const dayPoints = pointsByMatchday.get(option.matchdayId) ?? new Map<string, number>();
    // Gewertet = es gibt ueberhaupt Punkt-Eintraege fuer diesen Spieltag. Bewusst ligaweit
    // gepruft und nicht pro Team: ein Team mit 0 Punkten hat trotzdem gespielt.
    const played = dayPoints.size > 0;
    matchdays.push({ matchdayId: option.matchdayId, matchdayNumber, played });
    for (const team of teams) {
      cumulative.set(team.teamId, roundValue((cumulative.get(team.teamId) ?? 0) + (dayPoints.get(team.teamId) ?? 0), 4));
    }

    const tagesrangByTeam = rankByPoints(new Map(dayPoints), teams);
    const cumulativeByTeam = new Map<string, number | null>(
      teams.map((team) => [team.teamId, cumulative.get(team.teamId) ?? 0] as const),
    );
    const cumulativeRankByTeam = rankByPoints(cumulativeByTeam, teams);

    for (const team of teams) {
      const cumulativeRank = cumulativeRankByTeam.get(team.teamId) ?? null;
      const previousRank = prevCumulativeRank.get(team.teamId) ?? null;
      const rankDeltaVsPrev = previousRank != null && cumulativeRank != null ? previousRank - cumulativeRank : null;
      rowsByTeamId.get(team.teamId)!.push({
        matchdayId: option.matchdayId,
        matchdayNumber,
        tagespunkte: dayPoints.has(team.teamId) ? roundValue(dayPoints.get(team.teamId) ?? 0, 1) : null,
        tagesrang: tagesrangByTeam.get(team.teamId) ?? null,
        cumulativePoints: roundValue(cumulative.get(team.teamId) ?? 0, 1),
        cumulativeRank,
        rankDeltaVsPrev,
        played,
      });
      prevCumulativeRank.set(team.teamId, cumulativeRank);
    }
  });

  return { seasonId, matchdays, rowsByTeamId };
}

/**
 * Die letzten `count` GEWERTETEN Spieltage eines Teams (Form-Strip).
 *
 * Frueher wurde schlicht das Ende der Liste genommen. Da der Ledger auch die noch nicht
 * gespielten Spieltage enthaelt, zeigte der Strip in laufenden Saisons die LETZTEN
 * Spieltage der Season — alle ohne Wertung, also durchgehend "—". Jetzt zaehlen nur
 * gewertete Spieltage.
 */
export function getFieldRaceRecentForm(
  ledger: FieldRaceLedger,
  teamId: string,
  count = 5,
): FieldRaceLedgerEntry[] {
  const rows = (ledger.rowsByTeamId.get(teamId) ?? []).filter((row) => row.played);
  return rows.slice(Math.max(0, rows.length - count));
}

/**
 * ALLE bereits gewerteten Spieltage der Saison — der Form-Strip zeigt seit
 * dieser Aenderung den ganzen Verlauf statt eines Fensters der letzten fuenf.
 *
 * Bewusst eine eigene Funktion statt `getFieldRaceRecentForm(ledger, teamId,
 * 999)`: eine Zahl, die "alle" bedeuten soll, muss man beim Lesen erst als
 * solche erkennen — und sie waere still falsch, sollte eine Saison je mehr
 * Spieltage bekommen.
 */
export function getFieldRaceSeasonForm(ledger: FieldRaceLedger, teamId: string): FieldRaceLedgerEntry[] {
  return (ledger.rowsByTeamId.get(teamId) ?? []).filter((row) => row.played);
}

/**
 * Rang-Bewegung des Teams am zuletzt GEWERTETEN Spieltag.
 *
 * Der letzte Ledger-Eintrag ist in einer laufenden Season ein kuenftiger Spieltag: keine
 * Punkte, unveraenderter Rang, `rankDeltaVsPrev = 0`. Genau deshalb stand im Cockpit "±0",
 * obwohl das Team zehn Plaetze verloren hatte. Null, solange noch nichts gewertet wurde.
 */
export function getFieldRaceRankMovement(ledger: FieldRaceLedger, teamId: string): number | null {
  const played = (ledger.rowsByTeamId.get(teamId) ?? []).filter((row) => row.played);
  return played.length > 0 ? played[played.length - 1]!.rankDeltaVsPrev : null;
}

/** Anzahl der bereits gewerteten Spieltage — nicht die Laenge des Spielplans. */
export function countPlayedFieldRaceMatchdays(ledger: FieldRaceLedger): number {
  return ledger.matchdays.filter((entry) => entry.played).length;
}
