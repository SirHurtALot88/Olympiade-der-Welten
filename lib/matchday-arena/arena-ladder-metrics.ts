/**
 * MASSE DER ARENA-TABELLE („Ladder") — die eine Stelle, an der ihre Zeilenhoehe entsteht.
 *
 * GEMELDET VON CHRIS: „climbing bitte gleiche hoehe wie die tabelle rechts daneben - das gilt
 * fuer alle disziplinen das soll auf einer linie sein".
 *
 * Die Ladder bekommt ihre AUSSENhoehe von der gemessenen Hauptspalte (`ladderMaxH`, per
 * ResizeObserver) und rechnet mit `box-sizing: border-box`. Fuer die Zeilen bleibt davon der
 * Innenraum — also abzueglich Polster (2x10px) UND Rahmen (2x1px). Der Rahmen fehlte in der
 * Rechnung, was die Zeilen um 2px zu hoch ansetzte und die Liste ueber den unteren Rand schob.
 *
 * Im Browser nachgemessen (Chromium, Arena-Inhalt 420px, Liste mit 32 Zeilen):
 *   stretch + gemessen        main 1038 / ladder 1038  → gleich, aber 618px tote Flaeche
 *   flex-start + gemessen     main  420 / ladder  436  → buendig, aber NICHT gleich
 *   flex-start + border-box   main  420 / ladder  420  → beides
 *
 * Die Rechnung steht hier statt in der Komponente, damit sie ueber WERTE pruefbar ist: vitest
 * faehrt ohne jsdom, ein Flex-Layout gibt es im Test nicht — eine Zahl schon.
 */

/** Polster des Ladder-Containers, oben + unten je 10px. */
export const ARENA_LADDER_PAD_Y = 10;
/** Rahmen des Ladder-Containers, oben + unten je 1px. */
export const ARENA_LADDER_BORDER_Y = 1;
/** Unter ~17px werden Teamkuerzel und Punkte unlesbar. */
export const ARENA_LADDER_ROW_MIN_H = 17;
/** Ueber ~34px zerfaellt die Liste optisch. */
export const ARENA_LADDER_ROW_MAX_H = 34;
/** Solange nichts gemessen ist, ist dies die Ausgangshoehe einer Zeile. */
export const ARENA_LADDER_ROW_FALLBACK_H = 25;

/**
 * Zeilenhoehe der Ladder aus der gemessenen Aussenhoehe.
 *
 * `null`/0 heisst „noch nicht gemessen" — dann gilt der Rueckfallwert, NICHT die Minimalhoehe.
 * Passt die Zeilenzahl auch bei Minimalhoehe nicht, bleibt der Innen-Scroll als ehrlicher
 * Notnagel; deshalb wird hier nach unten gekappt statt aufgegeben.
 */
export function resolveArenaLadderRowHeight(input: {
  /** Gemessene AUSSENhoehe der Ladder (== Hoehe der Arena-Hauptspalte), `null` vor der Messung. */
  ladderMaxH: number | null | undefined;
  /** Hoehe des Tabellenkopfs. */
  ladderHeadH: number;
  /** Anzahl der Zeilen. */
  rowCount: number;
}): number {
  const { ladderMaxH, ladderHeadH, rowCount } = input;
  if (ladderMaxH == null || !Number.isFinite(ladderMaxH) || ladderHeadH <= 0) {
    return ARENA_LADDER_ROW_FALLBACK_H;
  }
  const available = ladderMaxH - ladderHeadH - ARENA_LADDER_PAD_Y * 2 - ARENA_LADDER_BORDER_Y * 2;
  if (available <= 0 || rowCount <= 0) {
    return ARENA_LADDER_ROW_MIN_H;
  }
  return Math.max(ARENA_LADDER_ROW_MIN_H, Math.min(ARENA_LADDER_ROW_MAX_H, available / rowCount));
}

/**
 * Was die Zeilen zusammen mit Kopf, Polster und Rahmen tatsaechlich in Anspruch nehmen.
 * Genau diese Zahl muss `ladderMaxH` treffen, sonst laeuft die Liste unten ueber oder
 * laesst ein Loch — das ist die Invariante hinter „auf einer Linie".
 */
export function getArenaLadderOuterHeight(input: { rowHeight: number; ladderHeadH: number; rowCount: number }) {
  return (
    input.rowHeight * input.rowCount +
    input.ladderHeadH +
    ARENA_LADDER_PAD_Y * 2 +
    ARENA_LADDER_BORDER_Y * 2
  );
}
