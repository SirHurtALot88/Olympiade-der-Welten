/**
 * ANKER JE BATTLEFIELD-FORMAT (Opus-Review 22.11., Punkte 1 und 2): die E1- und PP-Anker aus dem alten Format "orte3"
 * duerfen nicht fuer Fuenf-Punkte-Spieltage gelten (und umgekehrt). Schon im alten Format gebuchte Spieltage rechnen
 * mit den alten, unveraenderten Ankern (gezeigt = gebucht).
 */
import { describe, expect, it } from "vitest";

import { berechnePodErgebnisE1, ergebnisSkalaAnker } from "@/lib/resolve/ergebnis-skala";
import { ppSkalaAnker, skaliereUngedeckelt } from "@/lib/resolve/pp-skala";

const ALT_K4 = [0, 0, 0, 40, 64, 80, 92, 96, 120, 136, 140, 146, 149];

function pod(variante: "orte3" | "standard", spanne: number) {
  return berechnePodErgebnisE1({
    disciplineId: "battlefield",
    playerCount: 4,
    podVariante: variante,
    sortiert: [
      { luecke: 0, leistung: 1.4 },
      { luecke: spanne / 3, leistung: 1.4 },
      { luecke: spanne / 3, leistung: 1.4 },
      { luecke: spanne / 3, leistung: 1.4 },
    ],
  });
}

describe("E1-Anker je Battlefield-Format", () => {
  it("orte3 behaelt die am 18.11. gemessenen Knoten, das Standardformat hat eigene", () => {
    expect(ergebnisSkalaAnker("battlefield", "pod", 4, "orte3")!.knoten).toEqual(ALT_K4);
    const neu = ergebnisSkalaAnker("battlefield", "pod", 4)!;
    expect(neu.knoten).not.toEqual(ALT_K4);
    expect(neu.knoten[6]).toBeGreaterThan(ALT_K4[6]! * 1.3);
    // Andere Disziplinen kennen keine Variante: dieselben Anker.
    expect(ergebnisSkalaAnker("mini-dm", "pod", 4, "orte3")).toEqual(ergebnisSkalaAnker("mini-dm", "pod", 4));
  });

  it("eine Median-Spanne des neuen Formats (150) ist dort ein Median-Pod, im alten Format ein Kantersieg", () => {
    const neu = pod("standard", 150);
    const alt = pod("orte3", 150);
    expect(neu.werte[0]! - neu.werte[3]!).toBeLessThan(alt.werte[0]! - alt.werte[3]!);
    expect(neu.werte[0]! - neu.werte[3]!).toBeLessThanOrEqual(8);
    expect(alt.werte[0]! - alt.werte[3]!).toBeGreaterThanOrEqual(9);
  });

  it("alte Spieltage unveraendert: orte3 rechnet mit den alten Knoten (Median-Spanne 92 -> 7)", () => {
    const e = pod("orte3", 92);
    expect(e.werte[0]! - e.werte[3]!).toBe(7);
  });
});

describe("PP-Anker je Battlefield-Format", () => {
  it("orte3 hat eigene (alte) Anker, das Standardformat die neu gemessenen", () => {
    expect(ppSkalaAnker("battlefield", 4, "orte3")!.rTop).toBe(5.17);
    expect(ppSkalaAnker("battlefield", 4)!.rTop).toBe(4.69);
    expect(ppSkalaAnker("climbing", 4, "orte3")).toEqual(ppSkalaAnker("climbing", 4));
  });

  it("der Tagesbeste bleibt je Format bei 5 PP, der Median-Einsatz bei etwa 1,25", () => {
    expect(skaliereUngedeckelt("battlefield", 5.17, 0, { playerCount: 4, variante: "orte3" })).toBe(5);
    expect(skaliereUngedeckelt("battlefield", 4.69, 0, { playerCount: 4 })).toBe(5);
    expect(skaliereUngedeckelt("battlefield", 1.19, 0, { playerCount: 4 })).toBeCloseTo(1.25, 1);
  });
});
