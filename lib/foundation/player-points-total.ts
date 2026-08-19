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

/**
 * DER MUTATOR-AUFSCHLAG EINES TEAMS AN EINEM SPIELTAG.
 *
 * GEMELDET VON CHRIS (19.08., zwei Meldungen im Abstand von zwei Minuten):
 *   „die Spieltagsranks oder Saisonstand Ranks passen nicht wirklich ueberein. Nach MD1 hat Z-H
 *    Platz 1 im Spieltag geholt, soll in der Saison aber nur 2. sein. ich tippe mal darauf es
 *    liegt an den Mutatorpunkten!"
 *   „mein Verdacht ist bestaetigt, im Saisonstand sind die Mutatorpunkte mit 0,3 gar nicht drin!"
 *
 * NACHGEMESSEN an seinem Spielstand (Saison 1, Spieltag 8): bei ALLEN 32 Teams ist die Differenz
 * zwischen Tabellenpunkten und Ledger-Punkten exakt der Mutator-Betrag des Teams —
 * H-R 100,2 gegen 105,6 bei 5,4 Mutator, L-R 98,5 gegen 103,3 bei 4,8, C-S 92,3 gegen 98,0 bei
 * 5,7. Ligaweit fehlten 101,40 Punkte, und die Tabelle stand dadurch an vier Plaetzen falsch.
 *
 * WARUM ES AUSEINANDERLIEF: die Spieltagsansicht rechnet je Spieler
 * `pointsAwarded + mutatorPpsBonus` (`matchday-mvp-scoring-service`), die Saisontabelle dagegen
 * auf TEAM-Ebene `d1Points + d2Points` aus dem Disziplin-Ergebnis. Der Aufschlag steht aber nur
 * am einzelnen Spieler (`PlayerDisciplinePerformanceRecord.mutatorPpsBonus`) — auf Team-Ebene
 * gibt es ihn schlicht nicht, also konnte die Tabelle ihn nie sehen.
 *
 * Diese Funktion ist die fehlende Bruecke: sie summiert den Aufschlag eines Teams fuer EINEN
 * gebuchten Spieltag. Sie steht bewusst neben `resolveAwardedPlayerPoints` — beide beantworten
 * dieselbe Frage („was zaehlt wirklich"), nur auf verschiedenen Ebenen.
 */
export function resolveTeamMutatorPpsBonus(input: {
  performances: readonly { matchdayResultId: string; teamId: string; mutatorPpsBonus?: number | null }[];
  matchdayResultId: string | null | undefined;
  teamId: string;
}): number {
  if (!input.matchdayResultId) {
    return 0;
  }
  let summe = 0;
  for (const performance of input.performances) {
    if (performance.matchdayResultId !== input.matchdayResultId) continue;
    if (performance.teamId !== input.teamId) continue;
    const bonus = performance.mutatorPpsBonus;
    if (typeof bonus === "number" && Number.isFinite(bonus)) {
      summe += bonus;
    }
  }
  return roundPoints(summe);
}
