import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * WIE VIELE VERSCHIEDENE SPIELER VERLANGT EIN SPIELTAG — eine Rechenstelle.
 *
 * Ein Spieltag setzt zwei Disziplinen an, und ein Spieler kann nicht in beiden stehen. Der Bedarf
 * ist deshalb die SUMME der beiden Spielerzahlen, nicht die groessere von beiden.
 *
 * CHRIS' AUSLEGUNG, woertlich: „min 4 - max 12 pro spieltag deswegen haben wir ja auch das max der
 * spieler auf 14 hoch gesetzt damit man theoretisch alles bedienen kann selbst mit 2 verletzungen."
 * Der Kader ist also bewusst gegen den Spieltagsbedarf bemessen — und jede Rechnung, die „wie tief
 * ist dieser Kader" beantworten will, muss denselben Bedarf kennen.
 *
 * WARUM DAS EINE EIGENE DATEI IST: die Zahl wurde bisher nirgends zentral gebildet. Die
 * Ermuedungs-Schonschwelle (`resolveFatigueRestFloor`) rechnete deshalb mit einer festen 7, und
 * beide Aufrufer reichten den echten Wert nicht durch — die Konstante war nicht der Notnagel,
 * sondern die Regel. Ein Neunmannkader an einem Elferspieltag galt damit als „zwei Ersatzspieler"
 * und schonte zu spaet.
 *
 * Der Spielplan ist die einzige Quelle. Fehlt der Eintrag, gibt die Funktion `null` zurueck statt
 * einer geratenen Zahl — der Aufrufer entscheidet dann, in welche Richtung er irren will.
 */
export function resolveMatchdayPlayerDemand(
  gameState: Pick<GameState, "seasonState">,
  matchdayId: string | null | undefined,
): number | null {
  if (!matchdayId) {
    return null;
  }
  const eintrag = (gameState.seasonState.disciplineSchedule ?? []).find(
    (zeile) => zeile.matchdayId === matchdayId,
  );
  if (!eintrag) {
    return null;
  }
  const d1 = Number(eintrag.discipline1?.playerCount ?? 0);
  const d2 = Number(eintrag.discipline2?.playerCount ?? 0);
  const summe = (Number.isFinite(d1) ? d1 : 0) + (Number.isFinite(d2) ? d2 : 0);
  // Eine 0 ist kein Bedarf, sondern ein unvollstaendiger Spielplan — und sie waere die
  // gefaehrlichste Antwort: sie liesse jeden Kader unendlich tief aussehen.
  return summe > 0 ? summe : null;
}
