import { describe, expect, it } from "vitest";

import { baueSpielerSicht } from "@/lib/market/transfermarkt-sicht";
import {
  erfuelltFilter,
  klassenAchse,
  LEERE_FILTER,
  naechsteMindestNote,
  zaehleAktiveFilter,
  type WeitereFilter,
} from "@/lib/market/transfermarkt-weitere-filter";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function eintrag(over: Record<string, unknown>): TransfermarktFreeAgentItem {
  return {
    playerId: "p",
    name: "Test",
    className: "Rogue",
    scoutingLevel: 5,
    topDisciplineScores: [],
    disciplineEstimates: {},
    powTier: "A",
    speTier: "C",
    menTier: "B",
    socTier: "F",
    powerRating: "A",
    healthRating: "B",
    marketValue: 10,
    salary: 4,
    marketValueSalaryRatio: 2.5,
    ...over,
  } as unknown as TransfermarktFreeAgentItem;
}
const filter = (f: Partial<WeitereFilter>): WeitereFilter => ({ ...LEERE_FILTER, ...f });
const passt = (item: TransfermarktFreeAgentItem, f: Partial<WeitereFilter>, nebelAus = true) =>
  erfuelltFilter(item, baueSpielerSicht(item, { nebelAus }), filter(f));

describe("Filter des Transfermarkts (Achsen, Kartenfarbe, Marktwert, Gehalt, Value, Attribute)", () => {
  it("Achsen-Mindestnote filtert wirklich", () => {
    const spieler = eintrag({});
    expect(passt(spieler, { achsenMin: { pow: 4 } })).toBe(true);
    expect(passt(spieler, { achsenMin: { pow: 6 } })).toBe(false);
    expect(passt(spieler, { achsenMin: { soc: 4 } })).toBe(false);
    expect(passt(spieler, { achsenMin: { pow: 4, men: 4 } })).toBe(true);
    expect(passt(spieler, { achsenMin: { pow: 4, spe: 4 } })).toBe(false);
  });

  it("im Nebel zählt die obere Note der Zweier-Gruppe", () => {
    const spieler = eintrag({ scoutingLevel: 0 });
    expect(passt(spieler, { achsenMin: { pow: 5 } }, false)).toBe(true);
    expect(passt(spieler, { achsenMin: { soc: 4 } }, false)).toBe(false);
  });

  it("Reihum-Schalter: aus, D, C, B, A, S, aus (Chris 19.11.: Sekundär-Achsen)", () => {
    expect([undefined, 2, 3, 4, 5, 6].map(naechsteMindestNote)).toEqual([2, 3, 4, 5, 6, undefined]);
  });

  it("Kartenfarbe folgt der Klasse", () => {
    expect(["Rogue", "Mage", "Tank", "Bard", "Unbekannt"].map(klassenAchse)).toEqual(["spe", "men", "pow", "soc", null]);
    expect(passt(eintrag({ className: "Rogue" }), { farben: ["spe"] })).toBe(true);
    expect(passt(eintrag({ className: "Rogue" }), { farben: ["pow", "men"] })).toBe(false);
  });

  it("Marktwert, Gehalt und Value", () => {
    const spieler = eintrag({});
    expect(passt(spieler, { mwMax: 10 })).toBe(true);
    expect(passt(spieler, { mwMax: 9.9 })).toBe(false);
    expect(passt(spieler, { mwMin: 10.1 })).toBe(false);
    expect(passt(spieler, { gehaltMax: 3 })).toBe(false);
    expect(passt(spieler, { valueMin: 2.5 })).toBe(true);
    expect(passt(spieler, { valueMin: 3 })).toBe(false);
  });

  it("Mindestnote je Attribut: Verdecktes und zu Schwaches besteht nicht", () => {
    expect(passt(eintrag({}), { attributMin: { power: 5 } })).toBe(true);
    expect(passt(eintrag({}), { attributMin: { health: 5 } })).toBe(false);
    expect(passt(eintrag({ scoutingLevel: 0 }), { attributMin: { power: 6 } }, false)).toBe(false);
  });

  it("zählt aktive Filter", () => {
    expect(zaehleAktiveFilter(LEERE_FILTER)).toBe(0);
    expect(zaehleAktiveFilter(filter({ achsenMin: { pow: 4 }, farben: ["spe"], mwMax: 5, attributMin: { power: 4 } }))).toBe(4);
  });
});
