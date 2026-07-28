import type { SeasonState } from "@/lib/data/olyDataTypes";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";

/**
 * Salary-Factor-Ausblick für den Finanzen-Reiter.
 *
 * Der Salary Factor ist der Liga-Ökonomiefaktor einer Season (ein Wert PRO Season, kein
 * rollierender Spieltags-Wert): er skaliert die Einnahmenseite der Liga relativ zur
 * Liga-Gehaltssumme — der Sponsor-Topf wird über `salarySum * salaryFactor` gelöst
 * (sponsor-v2-offer-service), Preisgeld-Referenz und Meilenstein-Leitern skalieren ebenso
 * mit (prize-money / sponsor-economy-calibration). Die Gehälter selbst kommen aus den
 * Marktwert-Formeln und werden NICHT direkt mit dem Faktor multipliziert.
 *
 * Die "Richtung" ist hier KEINE Prognose: `getSeasonEconomyFactorWindow` liefert ein
 * 5er-Fenster [Aktuell, +1, +2, +3, +4], dessen Zukunftswerte bereits deterministisch
 * pro Save ausgerollt (bzw. persistiert) sind und dem Spieler im Season-Briefing als
 * "futureFactors" offen gezeigt werden. Dieselbe Quelle nutzt auch die KI
 * (`salaryFactors5` in retool-ai2-pick-engine via chunked-redraft-topup-service) —
 * Anzeige und Engine teilen also dieselbe Wahrheit.
 */

export type SalaryFactorDirection = "up" | "down" | "flat";

export type SalaryFactorOutlook = {
  /** Faktor der laufenden Season (Horizont "Aktuell") — null, wenn kein valider Wert vorliegt. */
  currentFactor: number | null;
  /** Bereits ausgerollter Faktor der nächsten Season (Horizont +1) — null, wenn nicht vorhanden. */
  nextFactor: number | null;
  /**
   * Richtung aktuell → nächste Season. null, sobald einer der beiden Werte fehlt —
   * dann wird ehrlich KEINE Tendenz gezeigt statt eine zu konstruieren.
   */
  direction: SalaryFactorDirection | null;
  /** nextFactor − currentFactor (nur wenn beide vorhanden), auf 2 Stellen gerundet. */
  delta: number | null;
};

/**
 * Unterhalb dieser Schwelle gilt die Änderung als "stabil". Die Fenster-Faktoren sind auf
 * 2 Nachkommastellen gerundet (round2 in season-economy-factors), d. h. jede echte Änderung
 * ist ≥ 0.01 — die Schwelle fängt also nur Float-Rauschen ab, verschluckt aber keine reale Drift.
 */
const FLAT_EPSILON = 0.005;

function toFiniteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Reine Ableitung: nimmt die Faktoren des Season-Ökonomie-Fensters in Horizont-Reihenfolge
 * ([Aktuell, +1, ...]) und bestimmt Wert + Richtung. Positionsbezogen — ein fehlender/ungültiger
 * Wert an Position 0 bzw. 1 wird NICHT durch spätere Horizonte ersetzt, weil das die Richtung
 * verfälschen würde (Season +2 ist nicht "die nächste" Season).
 */
export function deriveSalaryFactorOutlook(
  factors: ReadonlyArray<number | null | undefined>,
): SalaryFactorOutlook {
  const currentFactor = toFiniteOrNull(factors[0]);
  const nextFactor = toFiniteOrNull(factors[1]);

  if (currentFactor == null || nextFactor == null) {
    return { currentFactor, nextFactor, direction: null, delta: null };
  }

  const delta = round2(nextFactor - currentFactor);
  const direction: SalaryFactorDirection =
    Math.abs(nextFactor - currentFactor) < FLAT_EPSILON ? "flat" : nextFactor > currentFactor ? "up" : "down";

  return { currentFactor, nextFactor, direction, delta };
}

/**
 * Verdrahtung: zieht das kanonische 5er-Fenster (persistiert in
 * `seasonState.seasonEconomyFactors`, sonst deterministischer Seed-Roll pro Save) und leitet
 * daraus den Ausblick ab. Gleiche Aufrufform wie im Season-Briefing
 * (use-foundation-cross-tab-season-briefing) und in der KI-Pipeline.
 */
export function buildSalaryFactorOutlook(input: {
  saveId: string;
  seasonId: string;
  seasonState?: Pick<SeasonState, "seasonEconomyFactors">;
}): SalaryFactorOutlook {
  const window = getSeasonEconomyFactorWindow({
    saveId: input.saveId,
    seasonId: input.seasonId,
    seasonState: input.seasonState,
  });
  return deriveSalaryFactorOutlook(window.map((entry) => entry.factor));
}
