/**
 * PUNKTEVERHAELTNIS IN DER TABELLE (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md).
 *
 * Die Saisonspalte `verhaeltnis` ist die Summe der ±D-Werte aller gebuchten Battle-Duelle eines
 * Teams (`DisciplineResultRecord.verhaeltnis`). Sie wird bei jedem Lesen AUS DEN GEBUCHTEN
 * ERGEBNISZEILEN NEU SUMMIERT, nicht inkrementell fortgeschrieben: ein `forceReplace` desselben
 * Spieltags ersetzt dessen Zeilen (`legacy-matchday-result-apply-service.ts`), die Summe ist damit
 * automatisch idempotent — ohne eine zweite Baseline-Mechanik neben `matchdayBaselinePoints`.
 *
 * `null` statt einer leeren Map, wenn in der Saison KEINE Zeile ein Verhaeltnis traegt — jeder
 * Manager-Save (und jeder Battle-Save vor dieser Aenderung) bleibt damit in Sortierung und
 * geschriebenem Stand bit-identisch.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

export function summiereSaisonVerhaeltnis(
  gameState: Pick<GameState, "seasonState">,
  seasonId: string,
  options: { zusaetzlicheMatchdayResultId?: string | null } = {},
): Map<string, number> | null {
  const gewerteteIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter(
        (result) =>
          result.seasonId === seasonId &&
          (result.status === "preview_applied" || result.id === options.zusaetzlicheMatchdayResultId),
      )
      .map((result) => result.id),
  );
  if (gewerteteIds.size === 0) return null;
  const summe = new Map<string, number>();
  let gefunden = false;
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (!gewerteteIds.has(row.matchdayResultId)) continue;
    if (typeof row.verhaeltnis !== "number" || !Number.isFinite(row.verhaeltnis)) continue;
    gefunden = true;
    summe.set(row.teamId, (summe.get(row.teamId) ?? 0) + row.verhaeltnis);
  }
  return gefunden ? summe : null;
}
