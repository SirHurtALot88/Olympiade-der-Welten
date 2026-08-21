import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

/**
 * WO STEHT DIE GEHALTSSUMME EINES TEAMS, WENN DER KADER WIEDER VOLL IST?
 *
 * Die Extrapolation lag bislang nur in `projectExpectedSalaryAtPlannerTarget`
 * (ai-team-cash-reserve-service.ts) und war dort fest mit der CASH-Sicht der Gehaelter verdrahtet.
 * Der Apron misst aber eine andere Groesse (`getTeamApronSalaryBase` — das verhandelte Jahresgehalt),
 * und beide Fragen brauchen dieselbe Hochrechnung.
 *
 * DESHALB HIER, MIT DER BASIS ALS PARAMETER, UND NICHT ZWEIMAL GESCHRIEBEN. Eine Kopie der Formel
 * waere genau der Fehler, den dieses Projekt beim Apron schon einmal teuer bezahlt hat: die KI
 * pruefte ihre Zurueckhaltung gegen eine andere Zahl, als die Abrechnung besteuerte (siehe den
 * Kommentar an `isTeamOverApronSalaryCeiling`). Zwei Formeln driften; eine Formel mit zwei Basen
 * kann es nicht.
 *
 * WARUM ES DIESE HOCHRECHNUNG UEBERHAUPT BRAUCHT: im Kaufmoment sind die Vertraege gerade
 * ausgelaufen, die Kader stehen bei 8–11 von 10–14 Plaetzen. Wer dort die IST-Gehaltssumme gegen
 * eine Grenze haelt, vergleicht einen halben Kader mit einer Grenze fuer einen ganzen — gemessen in
 * docs/BEFUND-APRON-BREMSE-KAUFMOMENT.md.
 *
 * DIE FORMEL: fehlende Plaetze werden mit dem eigenen Durchschnittsgehalt aufgefuellt, nach unten
 * begrenzt durch einen Sockel aus Zielkadergroesse und Finanzkraft (ein leerer Kader hat kein
 * Durchschnittsgehalt, aus dem sich hochrechnen liesse).
 */
export function projectSalaryAtPlannerTarget(input: {
  gameState: GameState;
  teamId: string;
  /** IST-Summe in der Basis, die die aufrufende Frage misst (Cash-Sicht oder Apron-Basis). */
  currentSalary: number;
  /** Zielkadergroesse; ohne Angabe die Optimalgroesse des Teams. */
  plannerTarget?: number;
}): number {
  const { gameState, teamId, currentSalary } = input;
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const { playerOpt } = deriveRosterTargets(team, identity);
  const target = input.plannerTarget ?? playerOpt;
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
  const finances = identity?.finances ?? 5;
  const salaryFloor = target * (3.6 + finances * 0.1);
  if (rosterCount <= 0) return round2(Math.max(salaryFloor, currentSalary));
  const avgSalary = currentSalary / rosterCount;
  const missing = Math.max(0, target - rosterCount);
  return round2(Math.max(currentSalary + avgSalary * missing, salaryFloor));
}

function round2(value: number) {
  return Number(value.toFixed(2));
}
