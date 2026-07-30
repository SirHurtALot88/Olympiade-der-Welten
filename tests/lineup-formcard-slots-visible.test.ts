import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const LINEUP = readFileSync(
  join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
  "utf8",
);

/**
 * Der Formkarten-Block verschwand komplett, sobald es nichts mehr auszuwaehlen gab
 * ("sonst kein Clutter"). Am Saisonende — wenn alle Karten der Saison gespielt sind —
 * sah das aus, als sei das Feature kaputt: die Slots waren weg, ohne jede Erklaerung.
 * Genau so ist es gemeldet worden ("formkarten slots sind weg? bitte fixen!").
 *
 * Ein leeres Feld MIT Begruendung ist eine Information; ein fehlendes Feld ist ein
 * Raetsel. Der Block bleibt deshalb stehen und sagt, warum nichts zu waehlen ist.
 */
describe("Einsatzliste: Formkarten-Slots bleiben sichtbar", () => {
  it("blendet den Block nicht mehr aus, wenn nichts wählbar ist", () => {
    // Frueher: `if (!hasAnything) return null;` — genau diese Zeile war der Bug.
    expect(LINEUP).not.toContain("if (!hasAnything) return null;");
    expect(LINEUP).toContain("const hasAnything =");
  });

  it("nennt den Grund statt einfach leer zu bleiben", () => {
    expect(LINEUP).toContain("Keine Formkarte mehr verfügbar — alle Karten dieser Saison sind gespielt.");
    // Der Tooltip erklaert die Regel dahinter, nicht nur den Zustand.
    expect(LINEUP).toContain("Formkarten werden pro Saison vergeben und sind mit dem Ausspielen verbraucht.");
  });

  it("zeigt die Auswahlfelder weiterhin, sobald es etwas zu wählen gibt", () => {
    expect(LINEUP).toContain("{hasAnything ? (");
    expect(LINEUP).toContain('renderFormCardSelect("primary", "Primär", control.primarySelectedId, control.primaryOptions)');
    expect(LINEUP).toContain('renderFormCardSelect("secondary", "Sekundär (+)", control.secondarySelectedId, control.secondaryOptions)');
  });

  it("lässt den Block ohne Controls weiterhin ganz weg", () => {
    // Ohne durchgereichte Controls gibt es keine Disziplin — dann ist auch kein
    // leerer Kasten sinnvoll.
    expect(LINEUP).toContain("const control = formCardControlsBySide?.[disciplineSide] ?? null;");
    expect(LINEUP).toContain("if (!control) return null;");
  });
});
