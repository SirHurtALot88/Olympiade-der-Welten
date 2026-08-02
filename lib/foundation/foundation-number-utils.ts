/**
 * Geteilte, reine Zahlen-Helfer fuer die Foundation-Views.
 *
 * Diese Helfer wurden zuvor als private Top-Level-Funktionen in vielen
 * einzelnen Dateien byte-identisch (bzw. nachweislich verhaltensgleich)
 * dupliziert (siehe `npm run audit:ui`, Signal `duplicateFunctionNames`,
 * Kriterium B1 in `docs/ui-audit-checklist.md`). Hier liegt die eine
 * gemeinsame Implementierung, damit neue Kopien nicht wieder entstehen.
 *
 * Achtung beim Erweitern: mehrere Dateien im Repo haben Funktionen mit
 * gleichem Namen, aber ABWEICHENDEM Rundungsverhalten (z.B. `roundValue`
 * via `Math.round(value * factor) / factor` statt `Number(value.toFixed(digits))`).
 * Nicht blind zusammenlegen, ohne die Implementierungen zeichengenau zu
 * vergleichen.
 */

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rundet ueber `Number(value.toFixed(digits))`. Default ist 1 Nachkommastelle
 * (deckt zugleich das `round1`-Verhalten der Dateien ab, die
 * `Number(value.toFixed(1))` nutzen).
 */
export function roundValue(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

/**
 * Rundet ueber `Math.round(value * 10 ** digits) / 10 ** digits`.
 * Nicht mit `roundValue` austauschbar: beide Formeln liefern bei manchen
 * Werten (u.a. negative Zahlen nahe der Rundungsgrenze) unterschiedliche
 * Ergebnisse. Deckt das Verhalten der Dateien ab, die diese Formel nutzen
 * (u.a. `use-history-v2-derivations.ts`, `use-market-sell-derivations.ts`,
 * `use-prize-v2-panel-model.ts`, `use-teams-contract-derivations.ts`).
 */
export function roundViewNumberByFactor(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Rundet auf 1 Nachkommastelle ueber `Math.round(value * 10) / 10`.
 * Deckt das `round1`-Verhalten von `DisciplineStageNativeArena.tsx`,
 * `discipline-stage-from-preview.ts` und `player-matchday-training-history.ts`
 * ab. NICHT identisch mit `roundValue(value, 1)` (das nutzt `toFixed`) — bei
 * negativen Werten nahe der Rundungsgrenze weichen beide Formeln voneinander
 * ab, siehe Kommentar oben.
 */
export function round1ByMathRound(value: number): number {
  return Math.round(value * 10) / 10;
}
