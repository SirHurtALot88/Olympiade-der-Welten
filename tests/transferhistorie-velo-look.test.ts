/**
 * VeloDivergingBar bleibt eine Katalog-Komponente (`components/foundation/velo-ui`).
 *
 * HINWEIS (18.11., Historie modern): die Transferhistorie hat den Velo-Look verlassen und folgt dem Mockup
 * `public/mockups/historie-modern-18-11.html` (`components/foundation/historie/`). Die Klassen-Wache fuer
 * `nl-thist-*` und die Pruefungen des alten Markups sind mit `TransferHistoryV2NewLook` entfallen; der Balken
 * selbst wird weiter vom Katalog gefuehrt und hier geprueft.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const BAR = quelle("components/foundation/velo-ui/VeloDivergingBar.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");

describe("VeloDivergingBar ist eine Katalog-Komponente, kein Einzelfall", () => {
  it("steht im Velo-Katalog mit einer Wann-benutzen-Zeile", () => {
    expect(KATALOG).toContain("VeloDivergingBar");
    expect(KATALOG).toContain("gegenlaeufige Groessen");
  });

  it("rundet die Balkenanteile, statt Fließkomma-Reste ins Markup zu schreiben", () => {
    expect(BAR).toContain("Math.round(Math.min(1, value / scale) * 10000) / 100");
  });

  it("behandelt kaputte Eingaben defensiv (negative/nicht-endliche Werte zählen als 0)", () => {
    expect(BAR).toContain("Number.isFinite(left) ? Math.max(0, left) : 0");
    expect(BAR).toContain("Number.isFinite(right) ? Math.max(0, right) : 0");
  });
});
