/**
 * P4 — ECHTE FORMKARTEN UND INTENSITAET IM MOTOR, JE DISZIPLIN FREIGESCHALTET
 * (docs/design/formkarten-motor-p4-11-11.md).
 *
 * Bis P4 nahm der Motor (`public/mockups/battle-mode.engine.js`) in JEDER Motor-Disziplin eine
 * Ersatzkarte aus `zieheFormkarten()` (0/2/4/8 je Spieler, aus einer festen Saat) und die feste
 * Intensitaet "normal". Was der Manager in der Einsatzliste gespielt hat, kam nie an.
 *
 * Eine Disziplin in DIESER Menge bekommt stattdessen die gespielte Wahl: `buildArenaAufstellung()`
 * schreibt je Spieler `form` (= `formPerPlayer` der Seite, genau die Zahl, die
 * `calculateFormModifierForSide()` in der Wertung bildet: Kartenwerte, x2 bei Farbgleichheit, fuer
 * jeden Spieler der Seite gleich) und `intensitaet` in den `place`-Eintrag. Der Motor nimmt den
 * Wert in `breitPunkteVon()` statt der Ersatzkarte. Weil Vorlauf, Pods, Eingabe-Hash und
 * Arena-Anzeige ALLE ueber `buildArenaAufstellung()` laufen, gibt es dafuer genau einen Bauweg.
 *
 * AUFNAHMEREGEL (CLAUDE.md, Pflichtabnahme): eine Disziplin kommt erst hierher, wenn sie MIT echten
 * Karten gemessen besteht — rho je Spiel > 0,80 (`OLY_FORM_MODUS=echt node
 * scripts/miss-alle-disziplinen.mjs 24 <d>`) UND Pp <= 25 in zwei Saatstroemen
 * (`OLY_FORM_MODUS=echt node scripts/messe-arena-einfluss.mjs <d> 48 [--saat-versatz=10000000]`).
 * Jede andere Disziplin bleibt bit-identisch beim alten Verhalten (Ersatzkarte). Rollback einer
 * Disziplin = ihre Zeile hier entfernen.
 *
 * Messprotokoll je Disziplin: Abschnitt 4 des Dokuments oben.
 */
export const FORMKARTEN_ECHT_DISCIPLINE_IDS: ReadonlySet<string> = new Set([
  // PILOT (11.11.): Zeitfahren. Ersatz -> echt: rho je Spiel 0,943 -> 0,917 (Saison 0,951 ->
  // 0,930), Pp 11,4/12,5 -> 12,0/11,6. Beide Pflichtkriterien bestanden.
  "time-trial",
]);

export function nutztEchteFormkarten(disciplineId: string | null | undefined): boolean {
  return disciplineId != null && FORMKARTEN_ECHT_DISCIPLINE_IDS.has(disciplineId);
}
