/**
 * ANKER JE HOCKEY-TORWART-REGEL (22.11., docs/design/hockey-torwart-22-11.md Abschnitt 8): die C2- und E1-Anker
 * der neuen Regel sind neu gemessen; Spieltage, die mit der alten Regel gebucht oder aufgeloest werden, rechnen
 * mit den alten, unveraenderten Ankern (gezeigt = gebucht).
 */
import { describe, expect, it } from "vitest";

import { ergebnisSkalaAnker } from "@/lib/resolve/ergebnis-skala";
import { ppSkalaAnker, skaliereUngedeckelt } from "@/lib/resolve/pp-skala";

describe("Hockey-Anker je Torwart-Regel", () => {
  it("PP: 'torwartAlt' behaelt die alten Anker (Disziplin-weit rTop 6,84 / rMed 1,34; n=5: 6,84), die neue Regel hat eigene", () => {
    const alt = ppSkalaAnker("hockey", null, "torwartAlt")!;
    const neu = ppSkalaAnker("hockey", null)!;
    expect(alt.rTop).toBe(6.84);
    expect(alt.rMed).toBe(1.34);
    expect(ppSkalaAnker("hockey", 5, "torwartAlt")!.rTop).toBe(6.84);
    expect(neu.rTop).not.toBe(alt.rTop);
    // Andere Disziplinen kennen keine Variante.
    expect(ppSkalaAnker("basketball", 6, "torwartAlt")).toEqual(ppSkalaAnker("basketball", 6));
  });

  it("PP: derselbe Rohwert ergibt je Regel verschiedene Skalenwerte, ohne Variante gilt die neue Regel", () => {
    const alt = skaliereUngedeckelt("hockey", 3, 0, { modus: "an", playerCount: 5, variante: "torwartAlt" });
    const neu = skaliereUngedeckelt("hockey", 3, 0, { modus: "an", playerCount: 5 });
    expect(alt).not.toBe(neu);
    expect(neu).toBeGreaterThan(alt);
  });

  it("E1: 'torwartAlt' liefert die alten Duell-Knoten (n=87), Standard die neuen; Pod unberuehrt", () => {
    const alt = ergebnisSkalaAnker("hockey", "duell", null, "torwartAlt")!;
    const neu = ergebnisSkalaAnker("hockey", "duell", null)!;
    expect(alt.knoten).toEqual([1, 1, 2, 2, 3, 4, 4, 6, 8, 10.8, 16.4, 21.1, 24.7]);
    expect(neu.knoten).not.toEqual(alt.knoten);
    expect(ergebnisSkalaAnker("basketball", "duell", null, "torwartAlt")).toEqual(ergebnisSkalaAnker("basketball", "duell", null));
  });
});
