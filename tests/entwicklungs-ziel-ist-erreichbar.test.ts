/**
 * EIN SAISONZIEL MUSS ERREICHBAR SEIN — die Entwicklungs-Achse war es nicht.
 *
 * GEMELDET VON CHRIS (`u3wlh4`): „Als Ziel Entwicklung - 20 Spieler sollen sich entwickeln und
 * 6 MW dazu gewinnen? 6 MW schaffen wir nicht wenn 2-3 Mio maximum für top playre ist! Dazu kommt
 * 20 spieler kann man gar nicht haben???? Bitte das dringend fixen und auf unsere systeme anpassen
 * und messen."
 *
 * ZWEI BEHAUPTUNGEN, AN 339 ENTWICKLUNGS-EREIGNISSEN AUS DREI LIVE-SPIELSTAENDEN NACHGEMESSEN:
 *
 *  1. „20 Spieler kann man gar nicht haben" — RICHTIG, und schlimmer als vermutet. Ein Kader fasst
 *     hoechstens `DEFAULT_ROSTER_MAX` = 14. Ein Ziel von 20 war selbst dann unerreichbar, wenn
 *     JEDER Spieler springt. Gemessen kam kein Team ueber 14 Spruenge, Median 10.
 *
 *  2. „6 MW schaffen wir nicht" — FALSCH, und zwar deutlich: der Median-Zuwachs liegt bei 21,9,
 *     p90 bei 35,7, Maximum 77,2. **326 von 339 Spielern (96 %) reissen die Schwelle von 6.** Sie
 *     siebte also gar nichts aus; die Achse mass in Wahrheit die Kadergroesse.
 *
 * Beide Befunde zeigen auf dieselbe Stelle: Schwelle und Ziel gehoerten nie zusammen. Neu
 * kalibriert auf Schwelle 25 / Ziel 8 — Ø Erfuellung 49 %, mittig im dokumentierten Korridor
 * 35–65 %, Ziel unter der Kadergrenze und vom hoechsten gemessenen Wert (9) tatsaechlich
 * uebertroffen.
 *
 * DIESER TEST HAELT DIE ERREICHBARKEIT FEST, nicht die konkreten Zahlen um ihrer selbst willen:
 * die Kalibrierung darf sich aendern, aber ein Ziel oberhalb der Kadergrenze darf nie wiederkommen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_ROSTER_MAX } from "@/lib/foundation/roster-limits";

const ACHSEN = readFileSync(join(process.cwd(), "lib/sponsor/sponsor-v4-axes.ts"), "utf8");

/** Der `entwicklung`-Block — nur dort darf gemessen werden. */
const ENTWICKLUNG = (() => {
  const start = ACHSEN.indexOf("  entwicklung: {");
  return ACHSEN.slice(start, ACHSEN.indexOf("\n  kaderpflege: {", start));
})();

function zahlAus(quelle: string, muster: RegExp): number {
  const treffer = quelle.match(muster);
  expect(treffer, `Muster ${muster} nicht gefunden`).toBeTruthy();
  return Number(treffer![1]);
}

describe("Die Entwicklungs-Achse", () => {
  it("verlangt NIE mehr Spieler, als ein Kader fassen kann", () => {
    // DER KERN DER MELDUNG. Ein Ziel oberhalb von `DEFAULT_ROSTER_MAX` ist auch dann nicht voll
    // erfuellbar, wenn jeder einzelne Spieler springt.
    const ziel = zahlAus(ENTWICKLUNG, /scale:\s*(\d+)/);
    expect(ziel).toBeLessThanOrEqual(DEFAULT_ROSTER_MAX);
  });

  it("zaehlt Spieler, nicht Punkte — die Einheit sagt das auch", () => {
    expect(ENTWICKLUNG).toContain('unit: "Spieler"');
  });

  it("die Marktwert-Schwelle siebt ueberhaupt etwas aus", () => {
    // Bei 6 rissen 96 % aller gemessenen Spieler die Schwelle — sie war wirkungslos. Der Median
    // der gemessenen Zuwaechse liegt bei 21,9; darunter misst die Achse nur die Kadergroesse.
    const schwelle = zahlAus(ACHSEN, /const AXIS_TALENT_JUMP_MV = (\d+);/);
    expect(schwelle).toBeGreaterThan(21.9);
  });

  it("das Ziel bleibt in Reichweite des gemessenen Bestwerts", () => {
    // Bei Schwelle 25 lag das gemessene Maximum bei 9 Spruengen. Ein Ziel darueber waere wieder
    // nur theoretisch erreichbar — genau der Ausgangsfehler, nur kleiner.
    const ziel = zahlAus(ENTWICKLUNG, /scale:\s*(\d+)/);
    expect(ziel).toBeLessThanOrEqual(9);
  });

  it("die Begruendung nennt die Messung, nicht nur die Zahl", () => {
    // Ohne sie wiederholt die naechste Kalibrierung den Fehler: die Nachkalibrierung von
    // 2026-08-03 hat den Erfuellungsgrad korrekt getroffen und die Kadergrenze uebersehen.
    expect(ENTWICKLUNG).toContain("DEFAULT_ROSTER_MAX");
    expect(ACHSEN).toContain("326 von 339 Spielern");
  });
});
