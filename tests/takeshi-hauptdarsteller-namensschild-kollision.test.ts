import { describe, expect, it } from "vitest";

import {
  NAMENSSCHILD_MINDESTABSTAND,
  NAMENSSCHILD_STAPEL_SCHRITT,
  kuerzeNamensschild,
  schaetzeNamensschildBreite,
  versetzeKollidierendeHauptdarstellerNamen,
} from "@/app/foundation/discipline-stage/arena/disciplines/takeshi";

/**
 * Option D, `docs/design/takeshi-uebersichtlichkeit-konzept-15-10.md` Abschnitt 3.4: das
 * 14.10.-Papier maß, dass Hauptdarsteller-Namensschilder kollidieren (0,0 → 0,3 Paare/Frame),
 * wenn zwei Hauptdarsteller horizontal nah beieinanderliegen. Reparatur: eine Stapel-/
 * Ausweichlogik auf den immer schon vorhandenen Positionsdaten — reine Layout-Prüfung, kein
 * `rr()`, kein Einfluss auf `score`/`rank` (hier gar nicht erst importiert/angefasst).
 */
describe("Takeshi's Castle: Namensschild-Ausweichen (Option D, 15.10.)", () => {
  it("lässt weit auseinanderliegende Hauptdarsteller unangetastet (Ebene 0)", () => {
    const ebenen = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 100, label: "Weltraumaffen" },
      { idx: 2, x: 400, label: "Schlammkoenige" },
    ]);
    expect(ebenen.get(1)).toBe(0);
    expect(ebenen.get(2)).toBe(0);
  });

  it("versetzt das ZWEITE (niedriger priorisierte) Schild vertikal, wenn beide kollidieren würden", () => {
    // Zwei Namen dicht nebeneinander (12 px Abstand) — deutlich enger als ihre kombinierte
    // Textbreite, also genau der am 14.10. gemessene Kollisionsfall.
    const ebenen = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 300, label: "Donnerkeile" }, // Priorität 1 (z. B. Führender) — bleibt unten
      { idx: 2, x: 312, label: "Sumpfdrachen" }, // Priorität 2 — weicht aus
    ]);
    expect(ebenen.get(1)).toBe(0);
    expect(ebenen.get(2)).toBe(1);
  });

  it("stapelt eine dritte Kollision eine Ebene höher als die zweite", () => {
    // Drei Hauptdarsteller dicht beieinander — Priorität 1 bleibt unten, 2 weicht auf Ebene 1
    // aus, 3 kollidiert mit BEIDEN (1 und 2) und muss darum auf Ebene 2.
    const ebenen = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 200, label: "AAAAAAAA" },
      { idx: 2, x: 210, label: "BBBBBBBB" },
      { idx: 3, x: 205, label: "CCCCCCCC" },
    ]);
    expect(ebenen.get(1)).toBe(0);
    expect(ebenen.get(2)).toBe(1);
    expect(ebenen.get(3)).toBe(2);
  });

  it("respektiert die Priorität: wer in `leadIdxs`-Reihenfolge zuerst kommt, bleibt immer unten", () => {
    // Reihenfolge der Einträge entspricht der Prioritätsreihenfolge (Führender zuerst usw.) —
    // vertauscht man sie, verschiebt sich auch, wer ausweicht. Das ist beabsichtigt: die
    // Funktion selbst trifft keine Prioritätsentscheidung, sie respektiert nur die Reihenfolge,
    // die der Aufrufer (TakeshiField, aus `leadIdxs`) ihr gibt.
    const ebenenA = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 300, label: "Erster" },
      { idx: 2, x: 305, label: "Zweiter" },
    ]);
    const ebenenB = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 2, x: 305, label: "Zweiter" },
      { idx: 1, x: 300, label: "Erster" },
    ]);
    expect(ebenenA.get(1)).toBe(0);
    expect(ebenenA.get(2)).toBe(1);
    expect(ebenenB.get(2)).toBe(0);
    expect(ebenenB.get(1)).toBe(1);
  });

  it("bleibt bei exakt der Kollisionsschwelle (Mindestabstand) auf Ebene 0 — erst DARUNTER weicht es aus", () => {
    const label = "ABCDEFGH"; // 8 Zeichen, beide Schilder gleich breit
    const breite = schaetzeNamensschildBreite(label);
    const schwelle = breite + NAMENSSCHILD_MINDESTABSTAND; // halbbreite + halbbreite + Mindestabstand = volle Breite + Mindestabstand

    const genauAnDerSchwelle = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 0, label },
      { idx: 2, x: schwelle, label }, // Abstand == Schwelle → KEINE Kollision (strikt <)
    ]);
    expect(genauAnDerSchwelle.get(2)).toBe(0);

    const knappDarunter = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 0, label },
      { idx: 2, x: schwelle - 0.01, label },
    ]);
    expect(knappDarunter.get(2)).toBe(1);
  });

  it("ein einzelner Hauptdarsteller kollidiert nie mit sich selbst", () => {
    const ebenen = versetzeKollidierendeHauptdarstellerNamen([{ idx: 1, x: 123, label: "Alleinstehend" }]);
    expect(ebenen.get(1)).toBe(0);
  });

  it("kuerzt lange Namen deterministisch auf dieselbe Länge wie das bisherige Inline-Verhalten", () => {
    expect(kuerzeNamensschild("Kurzername")).toBe("Kurzername");
    expect(kuerzeNamensschild("EinSehrSehrLangerTeamname")).toBe("EinSehrSehrLang…");
    expect(kuerzeNamensschild("EinSehrSehrLangerTeamname").length).toBe(16);
  });

  it("der vertikale Versatz pro Ebene ist ein fester, positiver Schritt (deterministisch, kein Zufall)", () => {
    expect(NAMENSSCHILD_STAPEL_SCHRITT).toBeGreaterThan(0);
    const ebenen = versetzeKollidierendeHauptdarstellerNamen([
      { idx: 1, x: 0, label: "XXXXXXXX" },
      { idx: 2, x: 1, label: "XXXXXXXX" },
    ]);
    // y-Versatz (wie in TakeshiField gerechnet): -(r + 22 + ebene * SCHRITT) — hier nur geprüft,
    // dass die Ebene selbst, mit dem festen Schritt multipliziert, einen klar sichtbaren
    // Zeilenabstand ergibt (> Fontgröße 10.5, sonst würde die obere Zeile die untere berühren).
    const ebene2 = ebenen.get(2) ?? 0;
    expect(ebene2 * NAMENSSCHILD_STAPEL_SCHRITT).toBeGreaterThan(10.5);
  });
});
