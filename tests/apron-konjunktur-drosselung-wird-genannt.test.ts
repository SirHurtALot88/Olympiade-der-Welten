/**
 * DIE APRON-DROSSELUNG WIRD GENANNT — auch wenn sie nur TEILWEISE greift.
 *
 * GEMELDET VON CHRIS (`6fv43h`): „Apron scheint nicht korrekt zu ziehen! M-M hat Gehalt 123,5 Mio
 * und die 2. Linie ist 67,3 Mio! Die müssten fast 60 mio Strafe zahlen!"
 *
 * DER APRON RECHNET RICHTIG. Gedrosselt wird er vom Konjunkturhebel
 * `k(f) = clamp((f − 0,95) / 0,29, 0, 1)` — Absicht, siehe `apron-service.ts`. Die ERKLAERUNG dazu
 * war aber alles oder nichts: sie erschien nur bei `k === 0`.
 *
 * NACHGEMESSEN an den fuenf Live-Spielstaenden (laufende und kommende Saison, zehn Beobachtungen):
 *
 *   f = 0,84 → k = 0      f = 0,87 → k = 0      f = 0,92 → k = 0
 *   f = 0,96 → k = 0,03   f = 0,99 → k = 0,14   f = 1,03 → k = 0,28
 *   f = 1,05 → k = 0,34   f = 1,08 → k = 0,45   f = 1,12 → k = 0,59   f = 1,19 → k = 0,83
 *
 * Die Haelfte liegt bei k ≤ 0,14 — hoechstens 14 % der nominalen Abgabe, und die Oberflaeche sagte
 * kein Wort. Chris' Fall ist genau der: in seiner Saison 2 steht f bei 0,96, also k = 0,03. Ein
 * Team weit ueber der Linie zahlt drei Prozent, ohne dass irgendwo stuende warum.
 *
 * DIESER TEST HAELT DEN MITTLEREN BEREICH FEST. Der Fall `k === 0` war schon abgedeckt; ihn allein
 * zu pruefen war der Grund, warum die Luecke so lange offen blieb.
 */
import { describe, expect, it } from "vitest";

import { apronKonjunkturKurzhinweis, apronKonjunkturSatz } from "@/lib/finance/apron-konjunktur-hinweis";

describe("Teilweise Drosselung wird benannt", () => {
  it("nennt bei Hebel 0,03 die Drosselung mit Prozentwert — der gemeldete Fall", () => {
    const kurz = apronKonjunkturKurzhinweis({ konjunkturhebel: 0.03, salaryFactor: 0.96 });
    expect(kurz).toContain("3 %");
    expect(kurz).toContain("0,96");
  });

  it("auch im ganzen Satz der Finanzen-Karte", () => {
    const satz = apronKonjunkturSatz({ konjunkturhebel: 0.03, salaryFactor: 0.96 });
    expect(satz).toContain("3 %");
    expect(satz).toContain("gedrosselt");
  });

  it("bei Hebel 0 bleibt die alte, staerkere Aussage", () => {
    // „gedrosselt auf 0 %" waere schwaecher als „abgeschaltet" — und irrefuehrend, weil unterhalb
    // der Schwelle NIEMAND zahlt, egal wie weit ueber den Linien.
    expect(apronKonjunkturKurzhinweis({ konjunkturhebel: 0, salaryFactor: 0.84 })).toContain("keine Abgabe");
    expect(apronKonjunkturSatz({ konjunkturhebel: 0, salaryFactor: 0.84 })).toContain("abgeschaltet");
  });

  it("bei voller Wirkung schweigt der Hinweis", () => {
    // Sonst staende neben JEDER Apron-Zahl eine Erklaerung, die nichts erklaert.
    expect(apronKonjunkturKurzhinweis({ konjunkturhebel: 1, salaryFactor: 1.24 })).toBeNull();
    expect(apronKonjunkturSatz({ konjunkturhebel: 1, salaryFactor: 1.24 })).toBe("");
  });

  it("ohne bekannten Hebel wird nichts behauptet", () => {
    expect(apronKonjunkturKurzhinweis({ konjunkturhebel: null, salaryFactor: 1 })).toBeNull();
    expect(apronKonjunkturKurzhinweis({ konjunkturhebel: Number.NaN, salaryFactor: 1 })).toBeNull();
  });

  it("ohne bekannten Salary Factor nennt er die Drosselung trotzdem, nur ohne Ursache", () => {
    const kurz = apronKonjunkturKurzhinweis({ konjunkturhebel: 0.14, salaryFactor: null });
    expect(kurz).toContain("14 %");
    expect(kurz).not.toContain("Salary Factor");
  });
});

describe("Die Erklaerung haengt an EINER Quelle", () => {
  it("alle vier Anzeigen benutzen den geteilten Hinweis", () => {
    // Vier eigene Formulierungen fuer eine Regel driften auseinander, sobald jemand die Schwelle
    // anfasst — genau daran ist die Luecke oben entstanden.
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const quellen = [
      "app/foundation/finances/FoundationFinancesNewLook.tsx",
      "lib/finance/guv-breakdown.ts",
      "lib/finance/season-end-guv.ts",
    ];
    for (const datei of quellen) {
      const inhalt = readFileSync(join(process.cwd(), datei), "utf8");
      expect(inhalt).toMatch(/apronKonjunktur(Kurzhinweis|Satz)/);
      // Die alte Alles-oder-nichts-Pruefung darf nicht zurueckkehren.
      expect(inhalt).not.toContain("konjunkturhebel === 0");
      expect(inhalt).not.toContain("apronKonjunkturhebel === 0");
    }
  });
});
