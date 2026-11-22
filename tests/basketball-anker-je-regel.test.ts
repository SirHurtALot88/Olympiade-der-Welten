/**
 * ANKER JE BASKETBALL-PUSTE-REGEL (22.11., docs/design/basketball-puste-22-11.md Abschnitt 6): die C2- und E1-Anker der
 * neuen Regel sind aus der Motor-Nachrechnung abgeleitet; Spieltage, die mit der alten Regel gebucht oder aufgeloest
 * werden, rechnen mit den alten, unveraenderten Ankern (gezeigt = gebucht).
 */
import { describe, expect, it } from "vitest";

import { ergebnisSkalaAnker } from "@/lib/resolve/ergebnis-skala";
import { ppSkalaAnker, skaliereUngedeckelt } from "@/lib/resolve/pp-skala";

describe("Basketball-Anker je Puste-Regel", () => {
  it("PP: 'pusteAlt' behaelt die alten Anker (Disziplin-weit rTop 6,67 / rMed 1,43; n=4: 8,05), die neue Regel hat eigene", () => {
    const alt = ppSkalaAnker("basketball", null, "pusteAlt")!;
    const neu = ppSkalaAnker("basketball", null)!;
    expect(alt.rTop).toBe(6.67);
    expect(alt.rMed).toBe(1.43);
    expect(ppSkalaAnker("basketball", 4, "pusteAlt")!.rTop).toBe(8.05);
    expect(neu.rTop).toBeLessThan(alt.rTop);
    expect(neu.rMed).toBeLessThan(alt.rMed);
    // Hockey-Variante und andere Disziplinen bleiben unberuehrt.
    expect(ppSkalaAnker("basketball", 6, "torwartAlt")).toEqual(ppSkalaAnker("basketball", 6));
    expect(ppSkalaAnker("tennis", 4, "pusteAlt")).toEqual(ppSkalaAnker("tennis", 4));
  });

  it("PP: derselbe Rohwert ergibt je Regel verschiedene Skalenwerte, ohne Variante gilt die neue Regel", () => {
    const alt = skaliereUngedeckelt("basketball", 3, 0, { modus: "an", playerCount: 4, variante: "pusteAlt" });
    const neu = skaliereUngedeckelt("basketball", 3, 0, { modus: "an", playerCount: 4 });
    expect(neu).toBeGreaterThan(alt);
  });

  it("E1: 'pusteAlt' liefert die alten Duell-Knoten (n=96), Standard die neuen; Pod unberuehrt", () => {
    const alt = ergebnisSkalaAnker("basketball", "duell", null, "pusteAlt")!;
    const neu = ergebnisSkalaAnker("basketball", "duell", null)!;
    expect(alt.knoten).toEqual([2, 2, 4, 8, 13, 18, 21, 25.6, 34, 39, 49.9, 68.1, 79.925]);
    expect(neu.knoten).not.toEqual(alt.knoten);
    expect(neu.knoten[neu.knoten.length - 1]!).toBeLessThan(alt.knoten[alt.knoten.length - 1]!);
    expect(ergebnisSkalaAnker("hockey", "duell", null, "pusteAlt")).toEqual(ergebnisSkalaAnker("hockey", "duell", null));
  });
});
