/**
 * DIE GRUNDGESAMTHEIT FUER "GEHALT GEGEN UEBLICH" — die ganze Liga, nicht der eigene Kader.
 *
 * Warum ligaweit: die Schaetzung soll beantworten, was ein Spieler dieser Leistung AUF DIESEM
 * MARKT kostet. Nur den eigenen Kader zu befragen hiesse, sich am eigenen Gehaltsgefuege zu
 * messen — ein durchweg ueberzahlter Kader saehe dann normal aus, und ein sparsamer wuerde sich
 * selbst fuer teuer halten. Aus acht Vertraegen laesst sich ausserdem keine belastbare Gerade
 * ziehen (siehe SALARY_BENCHMARK_MIN_STICHPROBE).
 *
 * Die Trennung von `salary-benchmark.ts` ist Absicht: dort steht die reine Rechnung ohne
 * Spielmodell, hier das Einsammeln aus dem Spielstand. So bleibt die Rechnung ohne GameState
 * testbar.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import {
  buildSalaryBenchmark,
  type SalaryBenchmarkModel,
  type SalaryBenchmarkSample,
} from "@/lib/contracts/salary-benchmark";

/**
 * Welches Leistungsmass in die Schaetzung geht. MVS ist die Vorgabe: er ist im Spiel
 * ausdruecklich der Wert fuer "ist der Spieler sein Gehalt wert" und faengt Rolle und
 * Einsatzkontext bereits mit ein. PPs bleibt als Alternative erreichbar, weil es die
 * nachrechenbare Groesse ist — wer die Kennzahl pruefen will, kommt mit MVS nicht weit.
 */
export type SalaryBenchmarkLeistungsmass = "mvs" | "pps";

export function leseLeistung(
  rating: PlayerRatingContractRow | null | undefined,
  mass: SalaryBenchmarkLeistungsmass,
): number | null {
  if (!rating) return null;
  const wert = mass === "pps" ? rating.ppsSeason : rating.mvs;
  return wert != null && Number.isFinite(wert) ? wert : null;
}

/**
 * Sammelt (Gehalt, Leistung) ueber ALLE Kader ein und schaetzt daraus die uebliche Gehaltskurve.
 * Spieler ohne Leistungswert fallen heraus statt als Null mitgezaehlt zu werden: eine fehlende
 * Saisonleistung ist keine schwache Saisonleistung, und als Null wuerde sie die Gerade nach
 * unten ziehen und alle uebrigen Spieler faelschlich teuer aussehen lassen.
 */
export function buildLeagueSalaryBenchmark(input: {
  gameState: Pick<GameState, "rosters">;
  ratingsById: Map<string, PlayerRatingContractRow>;
  mass?: SalaryBenchmarkLeistungsmass;
}): SalaryBenchmarkModel | null {
  const mass = input.mass ?? "mvs";
  const stichprobe: SalaryBenchmarkSample[] = [];
  for (const eintrag of input.gameState.rosters ?? []) {
    const salary = eintrag.salary;
    if (!Number.isFinite(salary) || salary <= 0) continue;
    const leistung = leseLeistung(input.ratingsById.get(eintrag.playerId), mass);
    if (leistung == null) continue;
    stichprobe.push({ salary, leistung });
  }
  return buildSalaryBenchmark(stichprobe);
}
