import type { StandingRecord } from "@/lib/data/olyDataTypes";

/**
 * Rang-Bewegung gegenüber der LETZTEN Wertung — direkt aus `seasonState.standings`.
 *
 * Warum es diese zweite Quelle neben dem Feld-Rennen-Ledger gibt:
 *
 * Der Ledger (`build-field-race-ledger.ts`) rechnet die Bewegung aus den
 * Spieltags-Ergebnissen der ganzen Saison. Auf dem Saisonstand steht er aber
 * nicht zur Verfügung, und zwar aus zwei voneinander unabhängigen Gründen:
 *
 * 1. `useSeasonDerivations` läuft nur, wenn eine Ansicht sie ausdrücklich
 *    anfordert (`shouldLoadSeasonDerivations`) — das ist die Teams-Ansicht, nicht
 *    der Saisonstand. Sonst liefert der Hook `EMPTY_DERIVATIONS`, also ein
 *    Punkte-Ledger ganz ohne `pointEntries`.
 * 2. Selbst wenn man ihn dort neu bauen wollte, ginge es nicht: der Foundation-
 *    Client hält nur den kompakten Payload, und der beschneidet
 *    `seasonState.matchdayResults` auf den AKTIVEN Spieltag
 *    (`compactFoundationInitialGameState`). Aus einem einzigen Spieltag lässt
 *    sich kein "gegenüber dem Spieltag davor" ableiten.
 *
 * Ergebnis war eine Rang-Spalte, die die ganze Saison über gar keine Bewegung
 * zeigte: das Spieltags-Delta war `null`, und die Rückfallebene `rankDiff` wird
 * erst beim Saisonabschluss geschrieben.
 *
 * `standings` überlebt den kompakten Payload dagegen vollständig — und trägt
 * bereits alles Nötige: `matchdayBaselinePoints` ist der Punktestand VOR dem
 * zuletzt gewerteten Spieltag, geschrieben von `standings-apply-service.ts` für
 * jedes Team bei jeder Wertung. Punktestand davor und Punktestand jetzt ergeben
 * zwei Ranglisten, deren Differenz genau die gesuchte Bewegung ist.
 *
 * Rein lesend, keine neue Spiel-Logik, keine Persistenz — dieselbe Zahl, die der
 * Ledger liefern würde, nur aus der Quelle, die auf dieser Seite wirklich da ist.
 */

export type StandingsRankDeltaTeam = {
  teamId: string;
  /** Nur für den Gleichstand-Vergleich — identisch zum Ledger (`localeCompare`, "de"). */
  teamName: string;
};

/**
 * Ordnet Teams nach Punkten (absteigend), bei Gleichstand alphabetisch.
 *
 * Bewusst dieselbe Regel wie `rankByPoints` im Feld-Rennen-Ledger: Vorher-Rang und
 * Nachher-Rang müssen nach exakt derselben Regel entstehen, sonst erzeugt allein
 * ein anders aufgelöster Gleichstand eine Bewegung, die es nie gab.
 */
function rankTeamsByPoints(
  teams: StandingsRankDeltaTeam[],
  pointsByTeamId: Map<string, number>,
): Map<string, number> {
  return new Map(
    [...teams]
      .sort((left, right) => {
        const pointDiff = (pointsByTeamId.get(right.teamId) ?? 0) - (pointsByTeamId.get(left.teamId) ?? 0);
        if (pointDiff !== 0) return pointDiff;
        return left.teamName.localeCompare(right.teamName, "de");
      })
      .map((team, index) => [team.teamId, index + 1] as const),
  );
}

/**
 * Δ Rang je Team gegenüber dem Stand vor der letzten Wertung.
 * > 0 = Plätze gutgemacht, < 0 = abgerutscht, 0 = Platz gehalten.
 *
 * `null` (für ALLE Teams), solange noch nichts gewertet wurde: ohne Baseline gibt
 * es keinen "Stand davor". Dann lieber gar keine Angabe als ein erfundenes ±0 —
 * "keine Bewegung" und "noch keine Daten" dürfen nicht gleich aussehen.
 */
export function buildStandingsMatchdayRankDelta(
  teams: StandingsRankDeltaTeam[],
  standings: Record<string, StandingRecord | undefined> | null | undefined,
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  if (teams.length === 0) {
    return result;
  }

  const standingsById = standings ?? {};
  const hasAnyBaseline = teams.some((team) => standingsById[team.teamId]?.matchdayBaselineId != null);
  if (!hasAnyBaseline) {
    for (const team of teams) result.set(team.teamId, null);
    return result;
  }

  const currentPoints = new Map<string, number>();
  const previousPoints = new Map<string, number>();
  for (const team of teams) {
    const record = standingsById[team.teamId] ?? null;
    const points = typeof record?.points === "number" && Number.isFinite(record.points) ? record.points : 0;
    currentPoints.set(team.teamId, points);
    // Ohne eigene Baseline (Team erst nach der Wertung dazugekommen) zählt der
    // aktuelle Stand auch als Stand davor — das ergibt ±0 statt eines Sprungs,
    // den es nie gab.
    const baseline = standingsById[team.teamId]?.matchdayBaselinePoints;
    previousPoints.set(
      team.teamId,
      record?.matchdayBaselineId != null && typeof baseline === "number" && Number.isFinite(baseline)
        ? baseline
        : points,
    );
  }

  const currentRanks = rankTeamsByPoints(teams, currentPoints);
  const previousRanks = rankTeamsByPoints(teams, previousPoints);

  for (const team of teams) {
    const before = previousRanks.get(team.teamId);
    const now = currentRanks.get(team.teamId);
    result.set(team.teamId, before != null && now != null ? before - now : null);
  }
  return result;
}
