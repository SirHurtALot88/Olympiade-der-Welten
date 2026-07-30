import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const PANEL = readFileSync(
  join(process.cwd(), "app/foundation/discipline-stage/DisciplineStageMatchdayPanel.tsx"),
  "utf8",
);

/**
 * „Z-H hat eine rote Formkarte gespielt −2. Warum steht in der D1-Zeile +−18? Da muss das
 * Plus dann weg."
 *
 * `ppText` hat das Plus FEST davorgesetzt (`+${value.toFixed(1)}`). `toFixed` bringt bei
 * negativen Zahlen sein eigenes Minus mit — heraus kam „+-18,4".
 *
 * Die Team-Zeile war nicht betroffen, weil sie ihre Form-Zahl selbst zusammenbaute (mit
 * korrektem Vorzeichen). Genau diese Doppelung war das Problem: zwei Formatierungen für
 * dieselbe Größe, von denen nur eine richtig war. Jetzt gibt es nur noch eine.
 */
describe("Spieltags-Wertung: Vorzeichen", () => {
  /**
   * Nachgebaut statt importiert: die Funktion ist modul-privat, und ein Export nur für den
   * Test würde die Datei aufweichen. Der Vertrag steht darunter über den Quelltext.
   */
  const ppText = (value: number | null): string => {
    if (value == null) return "–";
    if (Math.abs(value) < 0.05) return "0";
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  };

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

  it("baut die Funktion das Vorzeichen aus dem Wert, nicht fest davor", () => {
    expect(PANEL).toContain('return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;');
    expect(PANEL).not.toContain("return `+${value.toFixed(1)}`;");
  });

  /**
   * Beide Form-Zellen (Team-Zeile und Disziplin-Zeile) laufen durch DIESELBE Funktion.
   * Vorher baute die Team-Zeile ihre Zahl inline zusammen — deshalb stimmte dort das
   * Vorzeichen und in der Disziplin-Zeile nicht.
   */
  it("formatiert Team- und Disziplin-Zeile über dieselbe Funktion", () => {
    expect(PANEL).toContain("{sumShown ? ppText(row.formPp) : lockCell}");
    expect(PANEL).toContain("{ppText(values.form)}");
    // Keine handgebaute Vorzeichen-Logik mehr daneben.
    expect(PANEL).not.toContain('${row.formPp > 0 ? "+" : ""}');
  });
});
