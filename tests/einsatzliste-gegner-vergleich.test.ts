import { describe, expect, it } from "vitest";

import { baueGruppenStand, duellStand, spannenMitte } from "@/lib/lineups/einsatzliste-gegner-vergleich";

describe("Einsatzliste: Gegner-Vergleich", () => {
  it("duellStand: vorn/hinten nur außerhalb der Spanne, innen gleich", () => {
    expect(duellStand(70, { min: 50, max: 60 })).toEqual({ stand: "vorn", abstand: 15 });
    expect(duellStand(40, { min: 50, max: 60 })).toEqual({ stand: "hinten", abstand: -15 });
    expect(duellStand(55, { min: 50, max: 60 })).toEqual({ stand: "gleich", abstand: 0 });
    expect(duellStand(60, { min: 50, max: 60 }).stand).toBe("gleich");
  });

  it("duellStand: ohne Wert oder ohne Spanne offen, nie eine erfundene Zahl", () => {
    expect(duellStand(null, { min: 1, max: 2 })).toEqual({ stand: "offen", abstand: null });
    expect(duellStand(50, null)).toEqual({ stand: "offen", abstand: null });
    expect(spannenMitte(null)).toBeNull();
  });

  it("baueGruppenStand: sortiert nach Mitte, eigene Zahl exakt, Teams ohne Schätzung am Ende", () => {
    const zeilen = baueGruppenStand([
      { teamId: "a", name: "A", wir: false, wert: null, spanne: { min: 40, max: 50 }, prognose: true },
      { teamId: "wir", name: "Wir", wir: true, wert: 52, spanne: null, prognose: false },
      { teamId: "b", name: "B", wir: false, wert: null, spanne: null, prognose: true },
      { teamId: "c", name: "C", wir: false, wert: null, spanne: { min: 56, max: 64 }, prognose: false },
    ]);
    expect(zeilen.map((z) => z.teamId)).toEqual(["c", "wir", "a", "b"]);
    expect(zeilen.map((z) => z.platz)).toEqual([1, 2, 3, 4]);
    expect(zeilen[0]!.unschaerfe).toBe(4);
    expect(zeilen[1]!.unschaerfe).toBeNull();
    expect(zeilen[3]!.mitte).toBeNull();
  });
});
