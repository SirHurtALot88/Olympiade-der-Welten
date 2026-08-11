import { describe, expect, it } from "vitest";

import { ppText, scoreText } from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";

/**
 * „Z-H hat eine rote Formkarte gespielt −2. Warum steht in der D1-Zeile +−18? Da muss das
 * Plus dann weg."
 *
 * `ppText` hat das Plus FEST davorgesetzt (`+${value.toFixed(1)}`). `toFixed` bringt bei
 * negativen Zahlen sein eigenes Minus mit — heraus kam „+-18,4".
 *
 * Die Team-Zeile war nicht betroffen, weil sie ihre Form-Zahl selbst zusammenbaute (mit
 * korrektem Vorzeichen). Genau diese Doppelung war das Problem: zwei Formatierungen für
 * dieselbe Größe, von denen nur eine richtig war.
 *
 * AUDIT 11.08.2026 — dieser Test baute `ppText` selbst nach und prüfte den Vertrag
 * anschließend über Quelltext-Strings (`expect(PANEL).toContain("{sumShown ? ppText(...)}")`).
 * Das ist die Fehlerklasse „Test prüft Quelltext statt Werte": der Nachbau konnte richtig
 * bleiben, während das Original driftet, und jede Umformatierung der Zelle machte ihn rot,
 * ohne dass sich ein Wert geändert hätte. Beide Formatierer sind jetzt exportiert und werden
 * hier an ihren Rückgabewerten geprüft.
 */
describe("Spieltags-Wertung: Vorzeichen", () => {
  it("setzt kein Plus vor eine negative Zahl", () => {
    expect(ppText(-18.4)).toBe("-18.4");
    expect(ppText(-2)).toBe("-2.0");
    expect(ppText(-0.6)).toBe("-0.6");
    // Und schon gar nicht beides.
    expect(ppText(-18.4)).not.toContain("+-");
  });

  it("behält das Plus bei positiven Zahlen", () => {
    expect(ppText(12.4)).toBe("+12.4");
    expect(ppText(0.3)).toBe("+0.3");
  });

  it("zeigt die Null vorzeichenlos", () => {
    // Weder „+0" noch „-0" — eine Null ist keine Richtung.
    expect(ppText(0)).toBe("0");
    expect(ppText(0.02)).toBe("0");
    expect(ppText(-0.02)).toBe("0");
  });

  it("unterscheidet 'nicht gewertet' von 'null'", () => {
    expect(ppText(null)).toBe("–");
  });

  /**
   * Der Score-Formatierer trägt dieselbe Vorzeichenregel — er ist keine zweite, eigene
   * Rechenstelle, sondern derselbe Text in Klammern. Sonst hätte die Reparatur der
   * Einheiten-Verwechslung genau den Fehler wiederholt, den dieser Test bewacht.
   */
  it("der Score-Formatierer erbt dieselbe Vorzeichenregel", () => {
    for (const value of [-18.4, -2, -0.6, 0, 0.02, 12.4, 0.3, 184.3]) {
      expect(scoreText(value)).toBe(`(${ppText(value)})`);
    }
    expect(scoreText(-18.4)).not.toContain("+-");
    // „nicht gewertet" bleibt in beiden derselbe Strich, ohne Klammern.
    expect(scoreText(null)).toBe("–");
    expect(ppText(null)).toBe("–");
  });

  /**
   * Und die beiden sind an jedem Wert voneinander unterscheidbar — das ist der Zweck der
   * Klammer: Punkte und Score standen vorher in derselben Schreibweise nebeneinander.
   */
  it("Punkte und Score sind an jeder Zahl auseinanderzuhalten", () => {
    for (const value of [26.4, 184.3, -11.4, 0]) {
      expect(scoreText(value)).not.toBe(ppText(value));
    }
  });
});
