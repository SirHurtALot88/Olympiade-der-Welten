/**
 * WIE VIEL GEHALT EIN TEAM ABBAUEN MÜSSTE — das Ziel, aus dem sich die Verkaufsauswahl ergibt.
 *
 * GEMELDET VON CHRIS: „wissen die teuren teams denn zb beim verkaufen am ende der season dass sie
 * wie H-R und M-M stark über den aprons sind um ggf. zu reagieren und zu senken? weil sie müssen ja
 * im besten Falle drumherum arbeiten."
 *
 * WARUM EIN TEAM-ZIEL UND NICHT DREISSIG EINZELBEWERTUNGEN: „drumherum arbeiten" ist ein Plan. Ein
 * Team 7,3 über seiner Decke braucht die Aussage „7,3 Gehalt muss weg", aus der sich dann die
 * Auswahl ergibt — nicht dreissig unabhängige Bewertungen, von denen jede ein bisschen mehr
 * Verkaufslust hat und die zusammen entweder zu wenig oder den halben Kader abgeben.
 *
 * WANN DAS ZIEL WIRKT — der Zeitpunkt ist nicht beliebig, sondern erzwungen: die Apron-Abrechnung
 * läuft INNERHALB von `runSeasonCompletion` (`season-completion-service.ts`, Schritt
 * `apron_settlement` nach der Sponsor-Abrechnung), verkauft wird erst danach in
 * `season_end_management` / `transfer_sell_phase` (`transfer-window-policy.ts`). Einen
 * In-Season-Verkaufspfad gibt es nicht. Ein Abbau senkt deshalb NIE die gerade gebuchte Abgabe,
 * sondern die der NÄCHSTEN Saison. Das ist die richtige Schleife für eine Luxussteuer — man reagiert
 * auf die Rechnung, die man bekommen hat — aber es MUSS in den Begründungstexten stehen, sonst liest
 * sich die eben gebuchte Abgabe wie ein ignorierter Verkaufsgrund.
 *
 * DIE LINIEN SIND DIE DER ABGELAUFENEN SAISON. Die der nächsten kennt zum Verkaufszeitpunkt niemand
 * — sie frieren erst nach dem Kaderbau der neuen Saison ein (`resolveSeasonApronLines` +
 * `hasSeasonBeenPlayed`). Der Fehler dieser Schätzung ist einseitig: steigen die Linien, war der
 * Abbau zu grosszügig. Er ist aber durch die Decke gedeckelt (grösster Fall im Save: 7,3) und durch
 * die Bagatellgrenze unten weiter gedämpft. Brauchbar als obere Schranke, nicht als Punktschätzung.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveTeamApronSalaryCeiling } from "@/lib/ai/ai-cash-salary-target-service";
import {
  apronLevyForSalary,
  getTeamApronSalaryBase,
  resolveApronSalaryFactor,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";

/**
 * Unterhalb dieses Überschusses lohnt der Abbau nicht.
 *
 * Begründung aus der Messung: Cold Steel läge mit 0,6 über seiner Decke. Bei einer Vorausschau, die
 * auf den Linien der VORSAISON rechnet, ist der Schätzfehler dort grösser als der Nutzen — man
 * verkauft einen Spieler gegen eine Abgabe, die nächste Saison vielleicht gar nicht anfällt.
 */
export const APRON_ABBAU_BAGATELLGRENZE = 2;

/**
 * Feinabstand, mit dem ein Team unter seine Decke zielt, wenn die Decke die 1. Linie IST.
 *
 * DIE EMPFÄNGERKLIPPE: Ausgleich bekommt nur, wer STRENG unter Linie 1 liegt (`computeApronSettlement`
 * — ein Team GENAU auf der Linie zahlt nichts UND bekommt nichts). Wer also exakt auf Linie 1
 * abbaut, verschenkt seinen Anteil am Topf — im gemessenen Save 2,1. Ein einziger kleiner Verkauf
 * mehr hätte ihn geholt. Bei Teams, deren Decke die 2. Linie ist, gibt es diese Klippe nicht: dort
 * ist die Zone-1-Abgabe ausdrücklich eingepreist.
 *
 * 0,1 ist die Auflösung, in der die Gehaltssummen ohnehin gerundet werden (`round1` im
 * Apron-Service) — ein kleinerer Abstand wäre unter der Messgenauigkeit.
 */
const LINIEN_ABSTAND = 0.1;

export type ApronAbbauZiel = {
  teamId: string;
  /** Geglättete Gehaltssumme — die Zahl, die besteuert wird. */
  basis: number;
  /** Ambitionsabhängige Decke: bis hierher ist die Abgabe gewollt. */
  decke: number;
  /** Basis, die das Team anpeilt (Decke, bei Decke = Linie 1 knapp darunter — siehe Empfängerklippe). */
  zielBasis: number;
  /** Wie viel Gehalt weg müsste. 0, wenn nichts zu tun ist oder der Rest Bagatelle wäre. */
  ueberschuss: number;
  /** Abgabe, die der vollständige Abbau bis `zielBasis` einspart. */
  reliefBisZiel: number;
  line1: number;
  line2: number;
  salaryFactor: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * VERANKERT AN DER AMBITIONSDECKE, NICHT AN LINIE 1.
 *
 * `resolveTeamApronSalaryCeiling` gibt einem Titelanwärter (Ambition ≥ 8) die 2. Linie frei, weil
 * „die höhere Abgabe eingepreist ist". So ein Team SOLL zahlen und den Kader behalten — es soll
 * nicht seine Stars abgeben, um unter eine Linie zu kommen, für die es sich nie entschieden hat.
 *
 * Der Unterschied ist gross, am Save gemessen: mit der Decke als Anker bauen 5 statt 8 Teams ab,
 * zusammen 19,4 statt 62,5 Gehalt. Hell Raisers (Ambition 9) haben Überschuss 7,3 statt 17,8; Zero
 * Heroes, Project Suicide und Black Panthers haben gar keinen und zahlen weiter — womit der Topf am
 * Leben bleibt, statt sich durch den Abbau selbst abzuschaffen.
 */
export function buildApronAbbauZiel(gameState: GameState, teamId: string): ApronAbbauZiel {
  const lines = resolveSeasonApronLines(gameState);
  const salaryFactor = resolveApronSalaryFactor(gameState);
  const basis = getTeamApronSalaryBase(gameState, teamId);
  const decke = resolveTeamApronSalaryCeiling(gameState, teamId);
  // Nur wer die 1. Linie als Decke hat, steht vor der Empfängerklippe.
  const zielBasis = Math.abs(decke - lines.line1) < 0.001 ? decke - LINIEN_ABSTAND : decke;
  const rohUeberschuss = Math.max(0, basis - zielBasis);
  const ueberschuss = rohUeberschuss >= APRON_ABBAU_BAGATELLGRENZE ? round2(rohUeberschuss) : 0;
  const levy = (salary: number) =>
    apronLevyForSalary({ salary, line1: lines.line1, line2: lines.line2, salaryFactor });
  return {
    teamId,
    basis,
    decke,
    zielBasis,
    ueberschuss,
    reliefBisZiel: ueberschuss > 0 ? round2(Math.max(0, levy(basis) - levy(zielBasis))) : 0,
    line1: lines.line1,
    line2: lines.line2,
    salaryFactor,
  };
}

/**
 * Was der Abgang DIESES Gehalts an Abgabe spart — reine Arithmetik auf dem bereits gebauten Ziel.
 *
 * Bewusst OHNE `gameState`: `getTeamApronSalaryBase` läuft über alle Kader-Einträge, und diese Frage
 * wird je Spieler je Team gestellt. Einmal je Team bauen, dann rechnen.
 *
 * `restBasis` erlaubt der Auswahlschleife, den bereits geplanten Abbau mitzuführen — der zweite
 * Verkauf spart weniger als der erste, sobald der erste die Basis Richtung Decke gedrückt hat.
 */
export function apronReliefFuerGehalt(
  ziel: ApronAbbauZiel,
  expectedSalary: number | null | undefined,
  restBasis?: number,
): number {
  const weg = Number(expectedSalary ?? 0);
  if (!Number.isFinite(weg) || weg <= 0) return 0;
  if (ziel.ueberschuss <= 0) return 0;
  const basis = restBasis ?? ziel.basis;
  const nachher = Math.max(basis - weg, ziel.zielBasis);
  if (nachher >= basis) return 0;
  const levy = (salary: number) =>
    apronLevyForSalary({ salary, line1: ziel.line1, line2: ziel.line2, salaryFactor: ziel.salaryFactor });
  return round2(Math.max(0, levy(basis) - levy(nachher)));
}
