/**
 * Finanzkonzept V2, Stufe 1: KI-Ruecklage nach Finanzwert des Teams.
 *
 * Chris am 18.11.: Die Ruecklage richtet sich nach dem FINANZWERT des Teams in der Team-Matrix (1 bis 10,
 * `identity.finances`), NICHT nach Budget oder Geldmenge. Hoher Finanzwert: 15 bis 25 Prozent des Budgets
 * als Cash, niedriger: 5 bis 10 Prozent. Untergrenze aus dem Konzept: mindestens 0,35 x Zielgehalt.
 *
 *   Ruecklage = max( q x Budget , 0,35 x Zielgehalt )      q = 5 % + 20 % x (Finanzwert - 1) / 9
 *
 * Budget = Kasse + Marktwert des Kaders zu Beginn des Kaufs. In Saison 1 ist der Kader leer, dort ist das
 * schlicht das Startbudget; in den Folgesaisons "Kasse + Kaderwert" (Konzept, Abschnitt 5.2).
 *
 * Reine Funktionen, kein Spielstand-Zugriff ausser den uebergebenen Zahlen.
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { projectSalaryAtPlannerTarget } from "@/lib/ai/salary-projection";

/** Anteil am Budget bei Finanzwert 1. */
export const KI_RUECKLAGE_Q_MIN = 0.05;
/** Anteil am Budget bei Finanzwert 10. */
export const KI_RUECKLAGE_Q_MAX = 0.25;
/** Untergrenze: Anteil des Zielgehalts (Konzept 5.2; entspricht `RESERVE_SALARY_FACTOR` im Draft-Adapter). */
export const KI_RUECKLAGE_GEHALTS_FAKTOR = 0.35;

/**
 * Schalter fuer den A/B-Vergleich. Standard AN; mit `OLY_KI_RUECKLAGE_V2=0` verhaelt sich der Draft-Adapter
 * bit-gleich zum Stand vor Finanzkonzept V2.
 */
export function istKiRuecklageV2Aktiv(): boolean {
  return process.env.OLY_KI_RUECKLAGE_V2 !== "0";
}

/** Finanzwert aus der Identitaet auf 1 bis 10 normieren (Altwerte 0 bis 100 werden durch 10 geteilt). */
export function normalisiereFinanzwert(finances: number | null | undefined): number {
  if (typeof finances !== "number" || !Number.isFinite(finances)) return 5;
  const skaliert = finances > 10 ? finances / 10 : finances;
  return Math.min(10, Math.max(1, skaliert));
}

/** Ruecklagenquote q (0,05 bis 0,25) je Finanzwert. */
export function ruecklagenQuote(finances: number | null | undefined): number {
  const f = normalisiereFinanzwert(finances);
  return KI_RUECKLAGE_Q_MIN + (KI_RUECKLAGE_Q_MAX - KI_RUECKLAGE_Q_MIN) * ((f - 1) / 9);
}

export type KiRuecklageErgebnis = {
  /** Die Ruecklage in C. */
  ruecklage: number;
  quote: number;
  finanzwert: number;
  budget: number;
  zielgehalt: number;
  /** Die Gehalts-Untergrenze (0,35 x Zielgehalt). */
  gehaltsUntergrenze: number;
  /** Welche der beiden Groessen gebunden hat. */
  bindend: "quote" | "gehalt";
};

export function berechneKiRuecklage(input: {
  finances: number | null | undefined;
  budget: number;
  zielgehalt: number;
}): KiRuecklageErgebnis {
  const finanzwert = normalisiereFinanzwert(input.finances);
  const quote = ruecklagenQuote(input.finances);
  const budget = Math.max(0, Number.isFinite(input.budget) ? input.budget : 0);
  const zielgehalt = Math.max(0, Number.isFinite(input.zielgehalt) ? input.zielgehalt : 0);
  const ausQuote = quote * budget;
  const gehaltsUntergrenze = KI_RUECKLAGE_GEHALTS_FAKTOR * zielgehalt;
  const bindend = gehaltsUntergrenze > ausQuote ? "gehalt" : "quote";
  return {
    ruecklage: Math.round(Math.max(ausQuote, gehaltsUntergrenze) * 100) / 100,
    quote,
    finanzwert,
    budget,
    zielgehalt,
    gehaltsUntergrenze,
    bindend,
  };
}

/**
 * Ruecklage fuer ein Team im Spielstand: Budget = Kasse + Marktwert des Kaders, Zielgehalt =
 * `projectSalaryAtPlannerTarget` (Kader auf Soll-Groesse, nicht das Gehalt des gerade leeren Kaders).
 */
export function resolveKiRuecklageFuerTeam(
  gameState: GameState,
  teamId: string,
  eingaben: { cash: number; rosterSalaryTotal: number; rosterMarketValue: number; finances: number | null | undefined },
): KiRuecklageErgebnis {
  const zielgehalt = projectSalaryAtPlannerTarget({
    gameState,
    teamId,
    currentSalary: eingaben.rosterSalaryTotal,
  });
  return berechneKiRuecklage({
    finances: eingaben.finances,
    budget: eingaben.cash + eingaben.rosterMarketValue,
    zielgehalt,
  });
}
