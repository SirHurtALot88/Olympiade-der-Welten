import { describe, expect, it } from "vitest";

import {
  APRON_LEVY_MAX_PASS_INTENT,
  APRON_LEVY_PASS_INTENT_SLOPE,
} from "@/lib/ai/ai-buy-decision-engine";

/**
 * CHRIS: „die AI teams müssen das auch besser verstehen und bessere verträge verhandeln! das ist
 * überlebenswichtig!!!"
 *
 * DIE KAUF-BREMSE WAR GEGEN EINE GEDROSSELTE ABGABE KALIBRIERT. Mit der alten Rampe kostete ein
 * Zugang ein Team ueber der 2. Linie rund 2 bis 5 Abgabe (Anteil ~10 % an der Abloese, Bremse ~6).
 * Seit der Stufe zieht die Abgabe voll: am Live-Abbild 9,60 / 16,00 / 22,40 fuer drei realistische
 * Zugaenge, also 45 bis 48 % der Abloese.
 *
 * Der Deckel bei 18 machte daraus DREIMAL DENSELBEN WERT. Die KI konnte einen Zugang, der sie 9,60
 * kostet, nicht mehr von einem unterscheiden, der 22,40 kostet — ausgerechnet bei den Teams, die
 * die Bremse am noetigsten haben.
 *
 * Der Test haelt die EIGENSCHAFT fest, nicht die Zahl 30: im gemessenen Bereich muss die Bremse
 * unterscheiden, und sie darf eine volle Mindestkader-Luecke nie ueberwiegen.
 */

/** Dieselbe Formel wie im Kaufentscheider — bewusst nachgebildet, siehe Kommentar unten. */
function bremse(levy: number, preis: number): number {
  const anteil = preis > 0 ? levy / preis : 1;
  return Math.max(1, Math.min(APRON_LEVY_MAX_PASS_INTENT, Math.round(anteil * APRON_LEVY_PASS_INTENT_SLOPE)));
}

/**
 * Kauf-Absicht bei ZWEI fehlenden Kaderstellen: `clamp(2 * 14, 14, 42)` im Kaufentscheider.
 *
 * Bewusst nicht die 42 der vollen Luecke: mein erster Entwurf deckelte bei 30 und haette damit den
 * Bestandsfall „ein Mindestkader-Notkauf setzt sich trotz Abgabe durch" umgeworfen. Die bindende
 * Grenze ist der ZWEI-Slot-Notstand, nicht der schlimmstmoegliche.
 */
const NOTKAUF_ABSICHT = 28;

describe("Luxussteuer-Bremse der KI", () => {
  it("unterscheidet im real gemessenen Bereich, statt am Deckel zu kleben", () => {
    // Die drei am Live-Abbild gemessenen Faelle fuer ein Team ueber der 2. Linie.
    const faelle = [
      { levy: 9.6, preis: 20 },
      { levy: 16.0, preis: 35 },
      { levy: 22.4, preis: 50 },
    ];
    const werte = faelle.map((f) => bremse(f.levy, f.preis));
    expect(
      new Set(werte).size,
      `alle drei Faelle ergeben ${werte.join("/")} — die Bremse unterscheidet nicht mehr`,
    ).toBeGreaterThan(1);
    for (const wert of werte) {
      expect(wert).toBeLessThan(APRON_LEVY_MAX_PASS_INTENT + 1);
    }
  });

  it("überwiegt eine volle Mindestkader-Lücke nicht — verzögern, nicht verhindern", () => {
    expect(APRON_LEVY_MAX_PASS_INTENT).toBeLessThan(NOTKAUF_ABSICHT);
  });

  it("lässt ein Team unter der Linie unberührt", () => {
    // R-L am Abbild: keine Abgabe bzw. kleine Anteile — dort war nie ein Deckel im Spiel.
    expect(bremse(0.0001, 20)).toBe(1);
    expect(bremse(2.8, 35)).toBe(4);
    expect(bremse(6.0, 50)).toBe(5);
  });
});
