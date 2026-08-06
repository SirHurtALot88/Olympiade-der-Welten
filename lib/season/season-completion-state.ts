import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Eine Quelle fuer die Frage "ist die Saison fertig?".
 *
 * Die Frage wurde an vier Stellen unabhaengig voneinander beantwortet (Saisonuebergang,
 * Phasen-Policy, Snapshot-Abdeckung, XP-Abrechnung) — mit vier unterschiedlichen Ergebnissen fuer
 * denselben Spielstand. Das war keine Redundanz, sondern ein Auseinanderdriften: der Saisonuebergang
 * hielt eine Saison fuer beendet, die die Phasen-Policy noch als laufend sah.
 *
 * Dieses Modul buendelt alle Lesarten. Sie bleiben absichtlich getrennte Funktionen — die Aufrufer
 * stellen wirklich verschiedene Fragen —, aber sie stehen jetzt nebeneinander und sind einzeln
 * getestet. Wer eine neue Stelle baut, waehlt hier eine Lesart aus, statt eine fuenfte zu erfinden.
 */

/**
 * Hat der Spielstand die aktive Saisonphase bereits verlassen?
 *
 * Rein die Phasen-Frage: alles ausser `season_active` (und "keine Phase gesetzt" = Altstand) gilt
 * als "die Saison laeuft nicht mehr". Achtung, das schliesst die Phasen der FOLGE-Saison mit ein
 * (`preseason_management` … `next_season_ready`) — wer "die Saison, die gerade lief, ist am Ende
 * angekommen" meint, will `hasFinalMatchdayBeenPlayed`.
 */
export function hasSeasonLeftActivePhase(gameState: GameState): boolean {
  return Boolean(gameState.gamePhase && gameState.gamePhase !== "season_active");
}

/**
 * Ist der letzte Spieltag der laufenden Saison wirklich durchgespielt?
 *
 * Die Daten-Frage, ohne Blick auf die Phase: der aktive Spieltag ist der letzte, er ist aufgeloest,
 * und entweder sind alle seine Partien `resolved` oder es liegen Ergebnis- UND Tabellen-Buchung
 * dafuer vor. Das ist die strengste der hier versammelten Lesarten.
 */
export function hasFinalMatchdayBeenPlayed(gameState: GameState): boolean {
  const matchdayIds = gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? gameState.matchdayState.matchdayId;
  const lastFixtures = gameState.seasonState.schedule.filter((fixture) => fixture.matchdayId === lastMatchdayId);
  const lastFixturesResolved = lastFixtures.length === 0 || lastFixtures.every((fixture) => fixture.status === "resolved");
  const hasLastMatchdayResult = (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === gameState.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeMatchdayIsLast =
    gameState.matchdayState.matchdayId === lastMatchdayId || gameState.season.currentMatchday >= matchdayIds.length;
  const matchdayResolved = gameState.matchdayState.status === "resolved";

  return activeMatchdayIsLast && matchdayResolved && (lastFixturesResolved || (hasLastMatchdayResult && hasLastStandingsApply));
}

/**
 * Die Lesart des Saisonuebergangs: Phase ODER Spieldaten sagen "fertig".
 *
 * Bewusst grosszuegig — der Uebergang muss auch einen Spielstand weiterfuehren koennen, der schon
 * mitten im Saisonende-Ablauf steckt und dessen Spieltagsdaten bereits umgeschrieben wurden.
 */
export function isSeasonComplete(gameState: GameState): boolean {
  return hasSeasonLeftActivePhase(gameState) || hasFinalMatchdayBeenPlayed(gameState);
}

/**
 * Liegt ueberhaupt ein Ergebnis fuer den letzten Spieltag vor?
 *
 * Die schwaechste Lesart: sie fragt nur nach dem gebuchten Ergebnis, nicht nach Tabelle, Phase oder
 * aktivem Spieltag. Die Phasen-Policy benutzt sie als Notausgang, damit ein Spielstand, dessen
 * `gamePhase` nach dem letzten Spieltag noch auf `season_active` haengt, den Saisonabschluss trotzdem
 * starten darf. Fuer alles andere ist sie zu grob.
 */
export function hasFinalMatchdayResult(gameState: GameState): boolean {
  const lastMatchdayId = gameState.season.matchdayIds[gameState.season.matchdayIds.length - 1] ?? null;
  if (!lastMatchdayId) return false;
  return (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
  );
}

/** Abdeckungszahlen, wie der Snapshot-Dienst sie ueber eine Saison bildet. */
export type SeasonCompletionCoverage = {
  totalMatchdays: number;
  resultAppliedMatchdays: number;
  standingsAppliedMatchdays: number;
};

/**
 * Ist die Saison LUECKENLOS abgeschlossen — jeder Spieltag mit Ergebnis und Tabellenbuchung?
 *
 * Die Archiv-Lesart. Ein Snapshot darf keine Loecher einfrieren, deshalb reicht hier "der letzte
 * Spieltag ist durch" nicht: ein uebersprungener Spieltag in der Mitte muss ihn blockieren.
 */
export function isSeasonCoverageComplete(coverage: SeasonCompletionCoverage): boolean {
  return (
    coverage.totalMatchdays > 0 &&
    coverage.resultAppliedMatchdays === coverage.totalMatchdays &&
    coverage.standingsAppliedMatchdays === coverage.totalMatchdays
  );
}

/**
 * Das alte `season.isCompleted`-Flag aus Spielstaenden von vor der Phasen-Umstellung.
 *
 * Kein Ersatz fuer die Lesarten oben — nur der Altlast-Zugriff an einer Stelle gebuendelt, damit die
 * Type-Assertion nicht in drei Dateien einzeln steht.
 */
export function isLegacySeasonCompletedFlagSet(gameState: GameState): boolean {
  return (gameState.season as { isCompleted?: boolean }).isCompleted === true;
}
