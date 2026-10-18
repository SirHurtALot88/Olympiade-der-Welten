/**
 * DIE IMPACT-KURVE — EIN GEMEINSAMES MODUL FUER ARENA UND PPS-DUELL-BRUECKE (Opus-Auflage 18.10.,
 * PR #1284-Review: "Code-Dopplung auflösen ... zwei Kopien laufen sonst bei der nächsten
 * Kalibrierung auseinander").
 *
 * Bis hierher lebte dieselbe Formel ZWEIMAL: `ppsAusArenaImpact()`
 * (`lib/resolve/battle-mode-arena-team-points.ts`) und `ppsAusDuellWert()`
 * (`lib/resolve/battle-mode-pps-duell.ts`) — bewusst dupliziert, weil `battle-mode-arena-team-
 * points.ts` ueber `arena-headless-runner.ts` Playwright/`node:fs` mitzieht, die
 * `battle-mode-pps-duell.ts` laut ihrem eigenen Dateikopf-Vertrag NICHT importieren darf (sie muss
 * rein/synchron bleiben, damit `legacy-matchday-resolve-engine.ts` sie importieren kann).
 *
 * DIESE DATEI LOEST DEN WIDERSPRUCH: sie haelt NUR die Kurve selbst (reine Mathematik, keine
 * einzige Zeile Referenz-Beschaffung, kein Datei-/Netzwerkzugriff) — kein Import irgendeiner Art,
 * damit sie von BEIDEN Seiten importierbar bleibt, ohne die Playwright-Grenze zu verletzen. Die
 * beiden Aufrufer bleiben fuer ihre eigenen Regler (`max`/`anteilMitte`) und ihre eigene gezogene
 * Referenz (Arena: `data/generated/<disziplin>-pps-referenz.json`; Bruecke:
 * `data/generated/pps-duell-bruecke-individuell-referenz.json`) unveraendert zustaendig — nur die
 * FORMEL selbst (und ihre Rundung) ist jetzt EINE Quelle.
 *
 * `PPs = MAX * min(1, (max(0,I)/I_krass)^gamma)`, `gamma = ln(a_mitte) / ln(I_mittel / I_krass)`.
 * Geht per Konstruktion durch zwei benannte Anker — `I_mittel -> a_mitte*MAX` ("ein
 * mittelmaessiger Auftritt") und `I_krass -> MAX` ("ein krasser Auftritt"), beide aus der
 * gezogenen Referenz. `min(1, …)` ist ein DECKEL, keine Asymptote. `max(0, I)` ist derselbe Boden
 * bei 0 wie in `distributeByValues()` (`rank-to-points.ts`). Eine entartete Referenz
 * (`iKrass <= iMittel`) liefert 0 statt NaN/Infinity durchzureichen.
 *
 * Herleitung/Entscheidungsgrundlage der Formel selbst: Opus-Dokument Abschnitt 4.1 (zitiert in
 * `battle-mode-arena-team-points.ts`s Dateikopf), hier bewusst NICHT wiederholt — diese Datei ist
 * die Mathematik, nicht ihre Begruendung.
 */

export type ImpactKurvenReferenz = { iMittel: number; iKrass: number };

/** Rundung auf zwei Nachkommastellen — dieselbe Praezision wie bisher an beiden Aufrufstellen. */
export function rundeImpactPps(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ppsAusImpact(
  wert: number,
  referenz: ImpactKurvenReferenz,
  max: number,
  anteilMitte: number,
): number {
  const { iMittel, iKrass } = referenz;
  if (!(iKrass > 0) || !(iMittel > 0) || iMittel >= iKrass) return 0;
  const gamma = Math.log(anteilMitte) / Math.log(iMittel / iKrass);
  const basis = Math.max(0, wert) / iKrass;
  const anteil = basis <= 0 ? 0 : Math.min(1, Math.pow(basis, gamma));
  return rundeImpactPps(max * anteil);
}
