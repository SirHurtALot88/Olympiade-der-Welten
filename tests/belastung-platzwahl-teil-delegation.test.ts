/**
 * Teil-Delegation unter Belastungsregel v2 (Review 21.11.): Die KI füllt nur die freien Plätze. Die Platzwahl muss
 * die Rollen DIESER Plätze der vollen Kaderzahl nutzen, nicht die eines verkleinerten Teams (Plätze 0..k-1).
 */
import { describe, expect, it } from "vitest";

import { ordneSpielerAufPlaetze } from "@/lib/ai/ai-belastung-platzwahl";

const spieler = (playerId: string, wert: number) => ({
  playerId,
  attributeStats: { power: wert, speed: 100 - wert, stamina: wert, health: 100 - wert, will: wert, spirit: 100 - wert, dexterity: wert, intelligence: 100 - wert, charisma: wert, torment: 100 - wert, conviction: wert, mind: 100 - wert } as never,
  lastFaktor: 1,
});

describe("KI-Platzwahl mit echten Platznummern", () => {
  const basis = { disciplineId: "hockey", disciplineName: "Hockey", altGrundlast: 16 };
  const drei = [spieler("a", 90), spieler("b", 20), spieler("c", 55)];

  it("ohne Platznummern = Plätze 0..n-1 (bisheriges Verhalten)", () => {
    const ohne = ordneSpielerAufPlaetze({ ...basis, slotCount: 3, spieler: drei });
    const mit = ordneSpielerAufPlaetze({ ...basis, slotCount: 3, spieler: drei, platzNummern: [0, 1, 2] });
    expect(mit).toEqual(ohne);
  });

  it("liefert eine Permutation der KI-Spieler, auch für hintere Plätze einer vollen Aufstellung", () => {
    const res = ordneSpielerAufPlaetze({ ...basis, slotCount: 6, spieler: drei, platzNummern: [3, 4, 5] });
    expect([...res].sort()).toEqual(["a", "b", "c"]);
  });

  it("falsche Länge der Platznummern fällt auf 0..n-1 zurück", () => {
    const ohne = ordneSpielerAufPlaetze({ ...basis, slotCount: 3, spieler: drei });
    expect(ordneSpielerAufPlaetze({ ...basis, slotCount: 3, spieler: drei, platzNummern: [4] })).toEqual(ohne);
  });
});
