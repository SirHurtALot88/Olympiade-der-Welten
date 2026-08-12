/**
 * WAS EIN KAUF AN LUXUSSTEUER KOSTET — die Zahl, die der KI bisher fehlte.
 *
 * GEMELDET VON CHRIS: „für den planner oder pick agent muss das berücksichtigt werden dass AI weiß
 * oh wenn ich jetzt noch nen teuren spieler kaufe muss ich luxussteuer zahlen! das ist sau wichtig."
 *
 * WAS VORHER DA WAR — und warum es nicht reichte: der Apron erreichte die KI ausschließlich über die
 * Cash-Reserve (`ai-team-cash-reserve-service.ts` skaliert die Rücklage mit
 * `resolveApronTighteningMultiplier`). Das ist eine ZUSTANDS-Bremse: sie greift, NACHDEM ein Team
 * seine Decke gerissen hat, und sie wirkt auf alle Käufe gleich. Was fehlte, war der Preis des
 * EINZELNEN Zugangs — die Frage „was kostet mich genau DIESER Spieler zusätzlich zu seinem
 * Kaufpreis?". Ohne sie sind ein Zugang mit 2 Gehalt und einer mit 14 Gehalt für die Kaufentscheidung
 * gleich teuer, obwohl der zweite ein Team über die Linie schiebt und der erste nicht.
 *
 * BEMESSUNGSGRUNDLAGE: `getTeamApronSalaryBase` — seit dem 12.08.2026 die Summe der bei
 * UNTERSCHRIFT VERHANDELTEN Jahresgehälter, also exakt die Zahl, gegen die die Abrechnung am
 * Saisonende bemisst (Kopfkommentar von `apron-service.ts`). Sie wird hier nicht nachgebaut,
 * sondern importiert und weiterexportiert — eine Rechenstelle, keine zweite.
 * Der ZUGANG geht mit `candidate.salary` ein: ein Spieler ohne Vertrag hat noch keine Front-/
 * Back-Loading-Verteilung und kein Verhandlungs-Benchmark; sein `salary` ist die Zahl, die bei
 * einer Unterschrift zum Benchmark WÜRDE. Für einen frischen Zugang ist die Grundlage damit
 * dieselbe wie nach der Unterschrift.
 *
 * DIE ABGABE IST WIEDERKEHREND, DER KAUFPREIS EINMALIG. Diese Datei liefert die Abgabe EINER Saison.
 * Wer sie mit dem Kaufpreis verrechnet, vergleicht damit bewusst konservativ (ein Vertrag über
 * mehrere Jahre kostet die Abgabe mehrfach) — die KI unterschätzt die Steuer also eher, als dass sie
 * sie überschätzt. Ein Aufschlag über die Restlaufzeit wäre die genauere, aber auch die viel
 * zittrigere Zahl: die Linien wandern jede Saison mit dem Median, und über drei Saisons hinweg ist
 * jede Hochrechnung geraten.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  apronLevyForSalary,
  getTeamApronSalaryBase,
  resolveApronDecisionSalaryFactor,
  resolveApronSalaryFactor,
  resolveSeasonApronLines,
} from "@/lib/season/apron-service";
import { resolveTeamApronSalaryCeiling } from "@/lib/ai/ai-cash-salary-target-service";

export { getTeamApronSalaryBase };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Abgabe, die dieses Team bei der gegebenen Gehaltssumme zahlen würde (ohne Deckel, siehe apron-service).
 *
 * `salaryFactor` überschreibt den Faktor der LAUFENDEN Saison für Fragen, die eine ANDERE Saison
 * betreffen (Verkäufe wirken auf die nächste — siehe `estimateApronReliefFromShedding`). Weglassen
 * heisst „laufende Saison", und das ist für den KAUF der richtige Wert: gekauft wird ausschliesslich
 * in der bereits gestarteten neuen Saison (`isEarlySeasonTransferSetup`), deren Abgabe an ihrem Ende
 * gebucht wird. Kein zweiter Lesepfad und keine zweite Formel — nur ein durchgereichter Faktor.
 */
export function estimateApronLevyAtSalary(gameState: GameState, salary: number, salaryFactor?: number): number {
  const lines = resolveSeasonApronLines(gameState);
  return apronLevyForSalary({
    salary,
    line1: lines.line1,
    line2: lines.line2,
    salaryFactor: salaryFactor ?? resolveApronSalaryFactor(gameState),
  });
}

/**
 * DIE ZAHL, UM DIE ES GEHT: was ein Zugang mit `additionalSalary` Gehalt dieses Team ZUSÄTZLICH an
 * Abgabe kostet — Abgabe nachher minus Abgabe vorher.
 *
 * Sie ist absichtlich nicht linear: ein Team weit unter der Linie zahlt für denselben Zugang 0, ein
 * Team knapp darunter zahlt nur den Teil, der über die Linie ragt, und ein Team über der 2. Linie
 * zahlt den doppelten Satz. Genau diese Nichtlinearität ist der Grund, warum eine pauschale
 * Cash-Bremse den Fall nicht abdeckt.
 */
export function estimateMarginalApronLevy(
  gameState: GameState,
  teamId: string,
  additionalSalary: number | null | undefined,
): number {
  const zusatz = Number(additionalSalary ?? 0);
  if (!Number.isFinite(zusatz) || zusatz <= 0) return 0;
  const basis = getTeamApronSalaryBase(gameState, teamId);
  const vorher = estimateApronLevyAtSalary(gameState, basis);
  const nachher = estimateApronLevyAtSalary(gameState, basis + zusatz);
  return round2(Math.max(0, nachher - vorher));
}

/**
 * DIE ANDERE RICHTUNG: was ein Team an Abgabe SPART, wenn es dieses Gehalt abgibt.
 *
 * GEMELDET VON CHRIS: „wissen die teuren teams denn zb beim verkaufen am ende der season dass sie
 * wie H-R und M-M stark über den aprons sind um ggf. zu reagieren und zu senken? weil sie müssen ja
 * im besten Falle drumherum arbeiten." — Sie wussten es nicht. Die Verkaufsbewertung sah nicht
 * einmal das Gehalt des Spielers; verkauft wurde aus Cash-Not oder sportlichen Gründen, die Abgabe
 * kam in keiner Begründung vor.
 *
 * Nicht symmetrisch zum Kauf, und das ist der Punkt: die Ersparnis fällt DIGITAL an. Ein Team 2 über
 * der Grenze spart mit einem 10er Gehalt nur die 2, die es überragt; ein Team 20 darüber spart die
 * vollen 10. Deshalb gerechnet und nicht am Gehalt geschätzt.
 *
 * GEKLEMMT AN DER AMBITIONSDECKE, nicht an Linie 1 — der Fehler, den diese Klemme verhindert, stammt
 * aus der Gegenprüfung des Entwurfs: ohne sie erzeugt die Ersparnis Verkaufsdruck bis hinunter zu
 * Linie 1, also genau in der Zone, die `resolveTeamApronSalaryCeiling` einem Titelanwärter
 * ausdrücklich zugesteht („die höhere Abgabe ist eingepreist"). Ein Ambition-9-Team würde Stars
 * abgeben, um eine Abgabe zu vermeiden, für die es sich bewusst entschieden hat. Gemessen bei Hell
 * Raisers: volle Abgabe 16,6, Ersparnis bis zur Decke aber nur 9,7.
 *
 * GERECHNET AUF DEM FAKTOR DER SAISON, DIE DER VERKAUF TRIFFT (`resolveApronDecisionSalaryFactor`).
 * Verkauft wird in der Saisonende-Kette, die Abgabe der abgelaufenen Saison ist da längst gebucht —
 * gespart wird die der NÄCHSTEN. Deren Faktor steht im selben Fenster schon fest; ihn nicht zu lesen
 * war der gemessene Fehler (siehe `apron-abbau-ziel.ts`).
 */
export function estimateApronReliefFromShedding(
  gameState: GameState,
  teamId: string,
  sheddedExpectedSalary: number | null | undefined,
): number {
  const weg = Number(sheddedExpectedSalary ?? 0);
  if (!Number.isFinite(weg) || weg <= 0) return 0;
  const basis = getTeamApronSalaryBase(gameState, teamId);
  const decke = resolveTeamApronSalaryCeiling(gameState, teamId);
  // Unter die Decke zählt kein Abbau mehr — dort ist die Abgabe gewollt.
  const zielBasis = Math.max(basis - weg, decke);
  if (zielBasis >= basis) return 0;
  const { factor } = resolveApronDecisionSalaryFactor(gameState);
  const vorher = estimateApronLevyAtSalary(gameState, basis, factor);
  const nachher = estimateApronLevyAtSalary(gameState, zielBasis, factor);
  return round2(Math.max(0, vorher - nachher));
}

/**
 * Was der Zugang WIRKLICH kostet: Kaufpreis plus die Abgabe, die er auslöst. Der Wert, gegen den die
 * Kauf-Schranke ihren Cash-Puffer prüft — vorher prüfte sie gegen den nackten Preis und übersah die
 * Steuer vollständig.
 */
export function resolveApronAdjustedBuyCost(input: {
  gameState: GameState;
  teamId: string;
  price: number | null;
  candidateSalary: number | null;
}): { price: number; levy: number; total: number } {
  const price = Number.isFinite(Number(input.price)) ? Number(input.price) : 0;
  const levy = estimateMarginalApronLevy(input.gameState, input.teamId, input.candidateSalary);
  return { price, levy, total: round2(price + levy) };
}
