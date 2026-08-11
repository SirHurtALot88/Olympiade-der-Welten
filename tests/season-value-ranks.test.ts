/**
 * Die Rang-Rechnung liegt in der lib, weil zwei Seiten sie brauchen: der Saisonstand zeigt sie,
 * und die Sponsoren-Ziele pruefen dagegen. Diese Suite haelt die Eigenschaften fest, auf die sich
 * beide verlassen — vor allem die Gleichstands-Regel, die ein Ziel nicht geschenkt vergibt.
 */
import { describe, expect, it } from "vitest";

import { buildValueRanks } from "@/lib/season/season-value-ranks";

type Zeile = { teamId: string; wert: number | null };
const rang = (zeilen: Zeile[]) => buildValueRanks(zeilen, (z) => z.teamId, (z) => z.wert);

describe("buildValueRanks", () => {
  it("ordnet absteigend — der hoechste Wert ist Rang 1", () => {
    const ranks = rang([
      { teamId: "A", wert: 10 },
      { teamId: "B", wert: 30 },
      { teamId: "C", wert: 20 },
    ]);
    expect(ranks.get("B")).toBe(1);
    expect(ranks.get("C")).toBe(2);
    expect(ranks.get("A")).toBe(3);
  });

  it("gibt bei Gleichstand allen den SCHLECHTESTEN Rang der Gruppe", () => {
    // Bewusst streng: zwei gleichauf an der Spitze stehen beide auf 2, nicht beide auf 1. Ein Ziel
    // „Rang 1" ist damit bei Gleichstand nicht erfuellt — sonst bekaeme man es geschenkt.
    const ranks = rang([
      { teamId: "A", wert: 30 },
      { teamId: "B", wert: 30 },
      { teamId: "C", wert: 10 },
    ]);
    expect(ranks.get("A")).toBe(2);
    expect(ranks.get("B")).toBe(2);
    // Der naechste Rang wird uebersprungen, nicht neu vergeben.
    expect(ranks.get("C")).toBe(3);
  });

  it("laesst Teams ohne Wert ganz heraus — nichts geholt ist kein letzter Platz", () => {
    const ranks = rang([
      { teamId: "A", wert: 10 },
      { teamId: "B", wert: null },
      { teamId: "C", wert: Number.NaN },
    ]);
    expect(ranks.get("A")).toBe(1);
    expect(ranks.has("B")).toBe(false);
    expect(ranks.has("C")).toBe(false);
    expect(ranks.size).toBe(1);
  });

  it("kommt mit einer leeren Liste klar", () => {
    expect(rang([]).size).toBe(0);
  });

  it("behandelt eine Gruppe aus lauter gleichen Werten als einen einzigen Block", () => {
    const ranks = rang([
      { teamId: "A", wert: 5 },
      { teamId: "B", wert: 5 },
      { teamId: "C", wert: 5 },
    ]);
    for (const teamId of ["A", "B", "C"]) {
      expect(ranks.get(teamId)).toBe(3);
    }
  });
});
