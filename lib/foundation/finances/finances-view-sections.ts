/**
 * Anordnung der Finanzen-Ansicht: welche Reiter es gibt und in welcher Reihenfolge die Blöcke
 * eines Reiters stehen.
 *
 * WARUM eine eigene Datei statt nur JSX-Verschachtelung: Chris' Wunsch („auf der finanzseite bitte
 * erst den liga team vergleich und das apron thema als eigenen reiter!") ist eine Aussage über die
 * ANORDNUNG. Steckt die nur in der Schachtelung von `FoundationFinancesNewLook.tsx`, kann ein Test
 * sie bloß über Zeichenketten im Quelltext prüfen — in diesem Repo eine bekannte Plage, die nichts
 * aussagt. Als exportierte Liste ist die Reihenfolge echte Prüfdaten, und die Ansicht rendert
 * genau diese Liste (kein zweiter Ort, an dem eine abweichende Reihenfolge stehen könnte).
 *
 * Client-safe: reine Konstanten, keine Persistenz-Importe (node:fs / better-sqlite3) — die Datei
 * landet im Browser-Bundle (Regel wie bei `team-overview-slice.ts` gegen `-build.ts`).
 */

/** Reiter der Finanzen-Ansicht (Sub-Tabs oben, Muster `NlSubTabs` wie im Scouting-Center). */
export type FinancesTabId = "uebersicht" | "apron";

/** Ein Block der Übersicht — jede Id wird in der Ansicht auf genau eine Karte abgebildet. */
export type FinancesOverviewBlockId =
  | "liga-vergleich"
  | "cashflow"
  | "kredite"
  | "transfers"
  | "cash-abgleich"
  | "verlauf"
  | "einnahmen-ausgaben";

/** Ein Block des Apron-Reiters. */
export type FinancesApronBlockId = "apron-linien" | "apron-liga";

/**
 * Reihenfolge der Übersicht. `liga-vergleich` steht bewusst ZUERST (Chris: „erst den liga team
 * vergleich") — vorher stand er ganz unten. Der Apron taucht hier absichtlich NICHT auf: er hat
 * seinen eigenen Reiter.
 */
export const FINANCES_OVERVIEW_BLOCK_ORDER: readonly FinancesOverviewBlockId[] = [
  "liga-vergleich",
  "cashflow",
  "kredite",
  "transfers",
  "cash-abgleich",
  "verlauf",
  "einnahmen-ausgaben",
];

/** Reihenfolge im Apron-Reiter: erst die eigenen Linien, dann der liga-weite Ausweis. */
export const FINANCES_APRON_BLOCK_ORDER: readonly FinancesApronBlockId[] = ["apron-linien", "apron-liga"];

/** Beschriftung der Reiter-Leiste. */
export const FINANCES_TABS: readonly { id: FinancesTabId; label: string }[] = [
  { id: "uebersicht", label: "Übersicht" },
  { id: "apron", label: "Apron" },
];

/** Der Reiter, mit dem die Seite aufgeht. */
export const FINANCES_DEFAULT_TAB: FinancesTabId = "uebersicht";
