/**
 * Die EINE Antwort auf „wie viele Player-Points hat dieser Spieler in dieser
 * Disziplin bekommen?".
 *
 * Die Engine liefert zwei getrennte Groessen:
 *  - `pointsAwarded` — der Anteil an den Team-Punkten, verteilt anteilig am
 *    finalen Spieler-Score (`distributeRankPointsToPlayers`),
 *  - `mutatorPpsBonus` — die „0,3er" fuer getroffene Disziplin-Mutatoren, 1:1
 *    dem Spieler gutgeschrieben und NICHT im Anteil enthalten.
 *
 * Der Saison-Ledger schreibt seit jeher die SUMME gut
 * (`season-points-ledger.ts`: `points = basePoints + mutatorPpsBonus`). Die
 * Arena zeigte dagegen nur `pointsAwarded` und den Mutator-Anteil daneben in
 * Klammern — im Playtest stand also „0,2 PP (+0,6 Mut)", waehrend dem Spieler
 * tatsaechlich 0,8 PP gutgeschrieben wurden. Die angezeigte Waehrung war eine
 * andere als die gebuchte.
 *
 * Deshalb rechnet diese Funktion die Summe, und alle PP-Anzeigen der Buehne
 * gehen durch sie. Die Klammer bleibt als AUFSCHLUESSELUNG erhalten (woher
 * kommt der Aufschlag), nicht mehr als Zusatzposten.
 */
export function resolveAwardedPlayerPoints(input: {
  /** Anteil an den Team-Punkten (Engine: `pointsAwarded`). */
  pointsAwarded: number | null | undefined;
  /** Mutator-Aufschlag (Engine: `mutatorPpsBonus`). */
  mutatorPpsBonus: number | null | undefined;
}): number | null {
  const base = Number.isFinite(input.pointsAwarded) ? (input.pointsAwarded as number) : null;
  const mutator = Number.isFinite(input.mutatorPpsBonus) ? (input.mutatorPpsBonus as number) : 0;
  // Kein Anteil UND kein Aufschlag = noch nicht gewertet. `null` bleibt `null`,
  // damit die Anti-Spoiler-Logik der Buehne weiter greift ("noch offen" statt 0).
  if (base == null) {
    return mutator !== 0 ? roundPoints(mutator) : null;
  }
  return roundPoints(base + mutator);
}

/** Gleiche Rundung wie der Ledger (`roundValue(..., 4)`), damit nichts auseinanderläuft. */
function roundPoints(value: number) {
  return Number(value.toFixed(4));
}

/** Ist ein Mutator-Aufschlag gross genug, um ihn ueberhaupt auszuweisen? */
export function hasVisibleMutatorPoints(mutatorPpsBonus: number | null | undefined): boolean {
  return Number.isFinite(mutatorPpsBonus) && Math.abs(mutatorPpsBonus as number) >= 0.05;
}
