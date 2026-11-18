import { describe, expect, it } from "vitest";

import kalibrierung from "@/data/generated/ergebnis-skala-kalibrierung.json";
import {
  abstandAusMarge,
  berechneDuellErgebnisE1,
  berechnePodErgebnisE1,
  ERGEBNIS_D_MITTE,
  ERGEBNIS_LAGEN,
  ergebnisMitSkalaText,
  ergebnisSkalaAnker,
  lageInVerteilung,
  margeFuerAnker,
  niveauAusLeistung,
  podVerhaeltnisse,
  type ErgebnisSkalaAnker,
} from "@/lib/resolve/ergebnis-skala";

// ERGEBNISSKALA E1 (docs/design/ergebnisskala-18-11.md): Garantien unabhaengig von den Ankern.
const STETIG: ErgebnisSkalaAnker = {
  knoten: [1, 2, 4, 8, 12, 16, 20, 25, 30, 36, 44, 50, 56],
  margeQuelle: "marge",
  leistung: [0.5, 1.5, 3],
};
const STUFEN: ErgebnisSkalaAnker = {
  // ganzzahlige Margen wie TDM/Breaking: 1 (40 %), 2 (40 %), 3 (20 %)
  knoten: [1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
  margeQuelle: "marge",
  leistung: null,
};

describe("Ergebnisskala E1", () => {
  it("Lage in der Verteilung: monoton, Stufen auf ihre Mitte", () => {
    let vorher = -1;
    for (let m = 0; m <= 70; m += 0.25) {
      const u = lageInVerteilung(m, STETIG.knoten);
      expect(u).toBeGreaterThanOrEqual(vorher);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
      vorher = u;
    }
    expect(lageInVerteilung(20, STETIG.knoten)).toBeCloseTo(0.5);
    const u1 = lageInVerteilung(1, STUFEN.knoten);
    const u2 = lageInVerteilung(2, STUFEN.knoten);
    const u3 = lageInVerteilung(3, STUFEN.knoten);
    expect(u1).toBeLessThan(u2);
    expect(u2).toBeLessThan(u3);
    expect(u3).toBeLessThan(1);
  });

  it("Abstand D: Remis 0, jeder Sieg >= 1, Median-Sieg 3, Kantersieg 10, monoton", () => {
    expect(abstandAusMarge({ remis: true, marge: 40, anker: STETIG })).toBe(0);
    expect(abstandAusMarge({ remis: false, marge: 0, anker: STETIG })).toBe(1);
    expect(abstandAusMarge({ remis: false, marge: 20, anker: STETIG })).toBe(ERGEBNIS_D_MITTE);
    expect(abstandAusMarge({ remis: false, marge: 56, anker: STETIG })).toBe(10);
    expect(abstandAusMarge({ remis: false, marge: 500, anker: STETIG })).toBe(10);
    let vorher = 0;
    for (let m = 0; m <= 70; m += 0.5) {
      const d = abstandAusMarge({ remis: false, marge: m, anker: STETIG });
      expect(d).toBeGreaterThanOrEqual(Math.max(1, vorher));
      vorher = d;
    }
    // Stufen: drei Margen, drei verschiedene Abstaende, keiner automatisch 10.
    const stufen = [1, 2, 3].map((m) => abstandAusMarge({ remis: false, marge: m, anker: STUFEN }));
    expect(stufen[0]).toBeLessThan(stufen[1]!);
    expect(stufen[1]).toBeLessThan(stufen[2]!);
    // Ohne Anker: Rueckfall auf den Median-Abstand.
    expect(abstandAusMarge({ remis: false, marge: 999, anker: null })).toBe(ERGEBNIS_D_MITTE);
  });

  it("Niveau: neutral ohne Anker, p5/p50/p95 -> 0,05/0,5/0,95", () => {
    expect(niveauAusLeistung(2, null)).toBe(0.5);
    expect(niveauAusLeistung(0.5, STETIG)).toBeCloseTo(0.05);
    expect(niveauAusLeistung(1.5, STETIG)).toBeCloseTo(0.5);
    expect(niveauAusLeistung(3, STETIG)).toBeCloseTo(0.95);
    expect(niveauAusLeistung(99, STETIG)).toBe(0.95);
  });

  it("Duell: wer im Motor gewinnt, gewinnt auf der Skala; Remis bleibt Remis; beide Sichten passen", () => {
    for (const disziplin of [...Object.keys(kalibrierung.disziplinen ?? {}), "gibt-es-nicht"]) {
      for (const marge of [0, 0.5, 1, 2, 3, 7, 15, 40, 400]) {
        for (const [le, lg] of [
          [0.2, 0.3],
          [1.2, 1.4],
          [4, 0.1],
          [0.1, 4],
        ] as const) {
          const sieg = berechneDuellErgebnisE1({ disciplineId: disziplin, playerCount: 3, outcome: "win", marge, leistungEigen: le, leistungGegner: lg });
          const niederlage = berechneDuellErgebnisE1({ disciplineId: disziplin, playerCount: 3, outcome: "loss", marge, leistungEigen: lg, leistungGegner: le });
          const remis = berechneDuellErgebnisE1({ disciplineId: disziplin, playerCount: 3, outcome: "draw", marge, leistungEigen: le, leistungGegner: lg });
          expect(sieg.ergebnis[0]).toBeGreaterThan(sieg.ergebnis[1]);
          expect(sieg.verhaeltnis).toBe(sieg.ergebnis[0] - sieg.ergebnis[1]);
          expect(niederlage.ergebnis).toEqual([sieg.ergebnis[1], sieg.ergebnis[0]]);
          expect(niederlage.verhaeltnis).toBe(-sieg.verhaeltnis);
          expect(remis.ergebnis[0]).toBe(remis.ergebnis[1]);
          expect(remis.verhaeltnis).toBe(0);
          for (const x of [...sieg.ergebnis, ...remis.ergebnis]) {
            expect(Number.isInteger(x)).toBe(true);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(10);
          }
        }
      }
    }
  });

  it("Pod-Verhaeltnis: eigener Wert minus Mittel der Gegner, streng geordnet, Summe 0 (alle Leitern 0..10)", () => {
    let leitern = 0;
    for (let a = 0; a <= 10; a += 1)
      for (let b = 0; b < a; b += 1)
        for (let c = 0; c < b; c += 1)
          for (let d = 0; d < c; d += 1) {
            const v = podVerhaeltnisse([a, b, c, d]);
            leitern += 1;
            expect(v.reduce((x, y) => x + y, 0)).toBe(0);
            expect(v[0]).toBeGreaterThan(v[1]!);
            expect(v[1]).toBeGreaterThan(v[2]!);
            expect(v[2]).toBeGreaterThan(v[3]!);
            const exakt = (4 * a - (a + b + c + d)) / 3;
            expect(Math.abs(v[0]! - exakt)).toBeLessThanOrEqual(1);
          }
    expect(leitern).toBe(330);
    // Kantersieg im Pod wie ein 10:1-Duell.
    expect(podVerhaeltnisse([10, 2, 1, 0])[0]).toBe(9);
  });

  it("Pod: besserer Platz hat immer den hoeheren Wert, auch bei Luecke 0", () => {
    for (const disziplin of [...Object.keys(kalibrierung.disziplinen ?? {}), "gibt-es-nicht"]) {
      for (const luecken of [
        [0, 0, 0],
        [5, 0, 1],
        [100, 200, 300],
        [0.1, 0.1, 0.1],
      ]) {
        for (const leistung of [0.2, 1.3, 4]) {
          const e = berechnePodErgebnisE1({
            disciplineId: disziplin,
            playerCount: 3,
            sortiert: [{ luecke: 0, leistung }, ...luecken.map((luecke) => ({ luecke, leistung }))],
          });
          expect(e.werte).toHaveLength(4);
          for (let i = 1; i < 4; i += 1) {
            expect(e.werte[i - 1]).toBeGreaterThan(e.werte[i]!);
            expect(e.verhaeltnisse[i - 1]).toBeGreaterThan(e.verhaeltnisse[i]!);
          }
          expect(e.werte[0]).toBeLessThanOrEqual(10);
          expect(e.werte[3]).toBeGreaterThanOrEqual(0);
          expect(e.verhaeltnisse.reduce((x, y) => x + y, 0)).toBe(0);
        }
      }
    }
  });

  it("Kalibrierung: jede Disziplin hat gueltige, nicht fallende Knoten", () => {
    const disziplinen = (kalibrierung.disziplinen ?? {}) as Record<string, Record<string, { knoten?: number[] }>>;
    for (const [d, formate] of Object.entries(disziplinen)) {
      for (const format of Object.keys(formate) as Array<"duell" | "pod">) {
        const anker = ergebnisSkalaAnker(d, format, null);
        expect(anker, `${d}/${format}`).not.toBeNull();
        expect(anker!.knoten).toHaveLength(ERGEBNIS_LAGEN.length);
      }
    }
  });

  it("Margen-Quelle: nativ, relativ (Summen mit wechselnder Groessenordnung), Leistung (Motor ohne Marge)", () => {
    const basis = { outcome: "win" as const, marge: 40, seiten: [120, 80] as const, leistungEigen: 2, leistungGegner: 1.5 };
    expect(margeFuerAnker({ margeQuelle: "marge" }, basis)).toBe(40);
    expect(margeFuerAnker({ margeQuelle: "relativ" }, basis)).toBeCloseTo(0.2);
    // Dieselbe Dominanz bei zehnfacher Groessenordnung gibt dieselbe relative Marge.
    expect(margeFuerAnker({ margeQuelle: "relativ" }, { ...basis, marge: 400, seiten: [1200, 800] })).toBeCloseTo(0.2);
    expect(margeFuerAnker({ margeQuelle: "leistung" }, basis)).toBeCloseTo(0.5);
    expect(margeFuerAnker({ margeQuelle: "leistung" }, { ...basis, outcome: "loss", leistungEigen: 1.5, leistungGegner: 2 })).toBeCloseTo(0.5);
    expect(margeFuerAnker({ margeQuelle: "relativ" }, { ...basis, seiten: [0, 0] })).toBe(0);
  });

  it("Anzeige: native Zahl und Skala aus derselben Zeile", () => {
    expect(ergebnisMitSkalaText({ seiten: [87, 79], skala: [7, 4] })).toBe("87 : 79 → 7 : 4");
    expect(ergebnisMitSkalaText({ seiten: [412.5, 398], skala: null })).toBe("412,5 : 398");
    expect(ergebnisMitSkalaText({ seiten: null, skala: [5, 5] })).toBe("5 : 5");
    expect(ergebnisMitSkalaText({ seiten: null, skala: null })).toBe("");
  });
});
