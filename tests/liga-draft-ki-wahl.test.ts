/**
 * KI-WAHL UNTER DEN TOP 3 (Chris 19.11.: „AI pickt bisher immer den 1. slot“): gewichtet nach Bewertungsabstand, deterministisch.
 */
import { describe, expect, it } from "vitest";

import { LIGA_DRAFT_KI_WAHL_T, waehleKiPlatz } from "@/lib/draft/liga-draft-modell";

function verteilung(nutzen: number[], n = 4000): number[] {
  const zaehler = [0, 0, 0];
  for (let i = 0; i < n; i += 1) zaehler[waehleKiPlatz(nutzen, `saat-${i}`)]! += 1;
  return zaehler.map((z) => z / n);
}

describe("waehleKiPlatz", () => {
  it("gleiche Saat -> gleiche Wahl (reproduzierbar, kein Math.random)", () => {
    for (let i = 0; i < 50; i += 1) expect(waehleKiPlatz([10, 9, 8], `x-${i}`)).toBe(waehleKiPlatz([10, 9, 8], `x-${i}`));
  });

  it("Platz 1 bleibt der haeufigste; typische Abstaende (Median ~1,9) ergeben grob 60/25/15", () => {
    const [p1, p2, p3] = verteilung([10, 8.1, 6.2]);
    expect(p1).toBeGreaterThan(p2!);
    expect(p2).toBeGreaterThan(p3!);
    expect(p1).toBeGreaterThan(0.5);
    expect(p1).toBeLessThan(0.75);
    expect(p3).toBeGreaterThan(0.05);
  });

  it("liegt Platz 1 klar vorne, nimmt die KI fast immer Platz 1; liegen alle gleichauf, verteilt sie sich", () => {
    expect(verteilung([20, 5, 3])[0]).toBeGreaterThan(0.99);
    const gleich = verteilung([10, 10, 10]);
    for (const anteil of gleich) expect(Math.abs(anteil - 1 / 3)).toBeLessThan(0.05);
  });

  it("ein einzelner oder kein Kandidat: Index 0; T ist festgelegt", () => {
    expect(waehleKiPlatz([5], "s")).toBe(0);
    expect(waehleKiPlatz([], "s")).toBe(0);
    expect(LIGA_DRAFT_KI_WAHL_T).toBe(2);
  });
});
