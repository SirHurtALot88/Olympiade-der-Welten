/**
 * LIGA-RANG AUS EINER KENNZAHL — eine Rechnung, eine Wahrheit.
 *
 * Diese Funktion lag als lokale Hilfe in `SeasonStandingsNewLook.tsx`. Sie muss hier liegen, weil
 * die Sponsoren-Ziele denselben Rang lesen sollen wie die Tabelle: ein Achsen-Ziel („halte deinen
 * POW-Rang") wird am Saisonende gegen genau die Zahl geprueft, die der Spieler im Saisonstand
 * gesehen hat. Zwei getrennte Rechnungen wuerden frueher oder spaeter auseinanderlaufen — und der
 * Spieler saehe eine Zielmarke, die seine eigene Tabelle nicht bestaetigt. Genau diese Sorte Fehler
 * gab es hier schon mehrfach.
 *
 * DIE GLEICHSTANDS-REGEL ist bewusst die pessimistische: bei Gleichstand bekommen alle beteiligten
 * Teams den SCHLECHTESTEN Rang der Gruppe. Zwei Teams mit demselben Wert an der Spitze stehen also
 * beide auf 2, nicht beide auf 1. Wer ein Ziel „Rang 1" traegt, hat es damit bei Gleichstand nicht
 * erfuellt — was strenger ist als die uebliche Sportregel, aber die einzige Lesart, die kein Ziel
 * durch einen Gleichstand geschenkt bekommt.
 *
 * Werte, die keine endliche Zahl sind, fallen heraus und bekommen gar keinen Rang: „hat nichts
 * geholt" ist etwas anderes als „steht auf dem letzten Platz".
 */

export function buildValueRanks<T>(
  rows: readonly T[],
  getTeamId: (row: T) => string,
  getValue: (row: T) => number | null | undefined,
): Map<string, number> {
  const ranked = new Map<string, number>();
  const scored = rows
    .map((row) => ({ teamId: getTeamId(row), value: getValue(row) }))
    .filter(
      (entry): entry is { teamId: string; value: number } =>
        typeof entry.value === "number" && Number.isFinite(entry.value),
    )
    .sort((left, right) => right.value - left.value);

  let groupStart = 0;
  while (groupStart < scored.length) {
    let groupEnd = groupStart;
    while (groupEnd + 1 < scored.length && scored[groupEnd + 1]!.value === scored[groupStart]!.value) {
      groupEnd += 1;
    }
    const worstRank = groupEnd + 1;
    for (let index = groupStart; index <= groupEnd; index += 1) {
      ranked.set(scored[index]!.teamId, worstRank);
    }
    groupStart = groupEnd + 1;
  }

  return ranked;
}
