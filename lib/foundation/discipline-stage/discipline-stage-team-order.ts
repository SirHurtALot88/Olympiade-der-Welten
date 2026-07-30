/**
 * ANTI-SPOILER: die Reihenfolge, in der die Arena ihre Teams bekommt.
 *
 * Beide Quellen der Bühne sortieren nach dem ERGEBNIS:
 * - die Resolve-Engine liefert `teamResults` aus `rankDescendingSharedTies(..., result.score)`
 *   (`lib/resolve/legacy-matchday-resolve-engine.ts`) — Sieger zuerst,
 * - das vereinfachte Modell sortiert `b.total - a.total` (`discipline-stage-data.ts`).
 *
 * Wer die Bühne öffnet, sähe damit die Endplatzierung, bevor die erste Etappe gelaufen ist.
 *
 * Die Arena richtet zwar ihre Bahn-Nummerierung (`laneIdx`) am Saisonrang aus — aber nur ein
 * Teil der rund zwanzig Disziplin-Renderer liest den; alle übrigen zeichnen in der
 * Array-Reihenfolge. Daher wurde der Spoiler auch nur in EINIGEN Disziplinen sichtbar.
 *
 * Deshalb wird an der Grenze sortiert, nicht in jedem Renderer: danach stimmen
 * Array-Reihenfolge und `laneIdx` überein, und ein neu hinzukommender Renderer ist ohne
 * Zutun spoilerfrei.
 */

export type StageTeamOrderInput = {
  /** Tabellenrang im aktuellen Saisonstand. Fehlt er, kann die Reihenfolge ihn nicht nutzen. */
  seasonRank?: number | null;
  teamId?: string | null;
  code: string;
};

/**
 * Sortiert nach aktuellem Saisonstand (bester Rang zuerst).
 *
 * Teams ohne auflösbaren Rang landen hinten und dort stabil nach Team-Id — bewusst NICHT in
 * der Reihenfolge, in der sie hereinkamen: die ist die Endplatzierung, und genau die soll
 * hier nirgends mehr durchscheinen, auch nicht im Rest.
 *
 * Die Eingabe wird nicht verändert (`[...teams]`); die Bühne memoisiert ihr Team-Array, und
 * ein In-Place-Sort würde diese Identität unter laufender Simulation umstellen.
 */
export function orderStageTeamsBySeasonRank<T extends StageTeamOrderInput>(teams: readonly T[]): T[] {
  return [...teams].sort((left, right) => {
    const leftRank = left.seasonRank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.seasonRank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.teamId ?? left.code).localeCompare(right.teamId ?? right.code);
  });
}
