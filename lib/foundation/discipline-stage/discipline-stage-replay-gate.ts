/**
 * WAS EIN ZURUECKSETZEN DER BUEHNE BEDEUTET — EINE STELLE, ZWEI ANLAESSE.
 *
 * GEMELDET VON CHRIS: „top spieler und verletzen marke auch einbauen! warum ist das immernoch
 * nicht da".
 *
 * NACHGEMESSEN IM BROWSER (Save `fresh-season-1-1786550453715`, Saison 2, Spieltag 4, beide
 * Disziplinen gebucht, Arena frisch geoeffnet): die Arena wusste `activeSideScoredInSave = true`,
 * meldete aber `disciplineEnded = false`. Damit fehlte der komplette Endscreen — Top-Spieler-Liste,
 * Highlights und der Weiter-Block. Die Rechnung war da (`matchdayTopPlayers` stand bereit), die
 * Anzeige nicht.
 *
 * URSACHE: `DisciplineStageNativeArena` setzt sich beim MOUNT zurueck und meldete das dem Host
 * ueber dieselbe Rueckmeldung wie der Knopf „↻ Neu". Der Host las daraus „der Nutzer laesst die
 * Disziplin gerade nochmal laufen" (`replayingDisciplineId = disciplineId`) — und genau diese
 * Zusage hebt das Aufdecken wieder auf:
 *
 *   disciplineEnded = ... || (activeSideScoredInSave && replayingDisciplineId !== disciplineId)
 *
 * Wer die Arena zu einer laengst gewerteten Disziplin oeffnete, galt damit dauerhaft als
 * „spielt gerade nach". Das Replay-Gate ist richtig — es bekam nur den falschen Anlass gemeldet.
 *
 * DESHALB DIESE DATEI: der Anlass ist ein Wert, kein Nebeneffekt, und was er bedeutet, steht an
 * genau einer Stelle. Der Kindkomponente gehoert die Beobachtung („ich wurde zurueckgesetzt, und
 * zwar deshalb"), dem Host die Deutung.
 */

/** Warum die Buehne zurueckgesetzt wurde. */
export type ArenaResetAnlass =
  /** Die Buehne ist frisch montiert (Seitenaufruf, Disziplinwechsel, Reload). Kein Nachspielen. */
  | "mount"
  /** Der Nutzer hat „↻ Neu" gedrueckt und sieht den Durchlauf noch einmal an. */
  | "knopf";

/**
 * Welche Disziplin gilt nach diesem Reset als „wird gerade nachgespielt"?
 *
 * `null` heisst: keine. Nur der Knopf ist ein Replay — ein Mount ist die normale Art, die Seite zu
 * betreten, und darf ein im Spielstand gewertetes Ergebnis nicht wieder verdecken.
 */
export function replayNachArenaReset(anlass: ArenaResetAnlass, disciplineId: string): string | null {
  return anlass === "knopf" ? disciplineId : null;
}
