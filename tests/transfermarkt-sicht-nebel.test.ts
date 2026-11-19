import { describe, expect, it } from "vitest";

import {
  baueSichtWert,
  baueSpielerSicht,
  bauWege,
  erfuelltEignungsMinimum,
  erwartetePp,
  erwartetePpSpanne,
  sortiereNachSicht,
  stufenBreite,
  tierBereichSortWert,
} from "@/lib/market/transfermarkt-sicht";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

/** Minimaler Feed-Eintrag: nur die Felder, die die Sicht liest, plus WAHRE Werte, die sie nie zeigen darf. */
function eintrag(over: Record<string, unknown> & { playerId: string; name: string }): TransfermarktFreeAgentItem {
  return {
    scoutingLevel: 0,
    scoutingConfidence: 15,
    topDisciplineScores: [],
    disciplineEstimates: { hockey: 70, tennis: 55 },
    powTier: "B",
    speTier: "C",
    menTier: "A",
    socTier: "D",
    powerRating: "B",
    healthRating: "C",
    staminaRating: "D",
    speedRating: "C",
    dexterityRating: "B",
    intelligenceRating: "A",
    awarenessRating: "B",
    determinationRating: "C",
    charismaRating: "D",
    willRating: "B",
    spiritRating: "C",
    tormentRating: "D",
    pow: 71.37,
    spe: 66.11,
    men: 78.9,
    soc: 60.2,
    ovr: 77.77,
    mvs: 12.34,
    ...over,
  } as unknown as TransfermarktFreeAgentItem;
}

const hockeyKey = (z: { sicht: ReturnType<typeof baueSpielerSicht> }) => z.sicht.disziplinen.hockey?.schaetzung ?? null;
const sicht = (item: TransfermarktFreeAgentItem) => ({ item, sicht: baueSpielerSicht(item) });

describe("Scouting-Nebel des Transfermarkts: feste Stufen (18.11.)", () => {
  it("Stufen: 10er ungescoutet, 5er beobachtet/teilweise, exakt erst gescoutet", () => {
    expect([0, 1, 2, 3, 4, 5].map(stufenBreite)).toEqual([10, 5, 5, 5, 5, 1]);
    expect(baueSichtWert(99, 0).text).toBe("90–99");
    expect(baueSichtWert(90, 0).text).toBe("90–99");
    expect(baueSichtWert(88, 2).text).toBe("85–89");
    expect(baueSichtWert(88, 4).text).toBe("85–89");
    expect(baueSichtWert(88, 5)).toMatchObject({ text: "88", exakt: true, art: "exakt" });
    expect(baueSichtWert(null, 0).text).toBe("?");
  });

  it("Ein Spieler mit wahrer Eignung 99 und einer mit 90 sind ungescoutet nicht unterscheidbar", () => {
    const a = baueSichtWert(99, 0);
    const b = baueSichtWert(90, 0);
    expect(a).toEqual(b);
  });

  it("Innerhalb einer Stufe ist die Reihenfolge alphabetisch, auch wenn die wahren Werte umgekehrt liegen", () => {
    // Zora hat die höhere wahre Eignung, Anton die niedrigere: beide stehen in der Stufe 90–99.
    const zora = sicht(eintrag({ playerId: "z", name: "Zora", disciplineEstimates: { hockey: 99 }, pow: 99.9, ovr: 95.5 }));
    const anton = sicht(eintrag({ playerId: "a", name: "Anton", disciplineEstimates: { hockey: 90 }, pow: 40.1, ovr: 50.5 }));
    expect(sortiereNachSicht([zora, anton], hockeyKey).map((z) => z.item.name)).toEqual(["Anton", "Zora"]);
    // Tauschen der wahren Werte ändert nichts.
    const zora2 = sicht(eintrag({ playerId: "z", name: "Zora", disciplineEstimates: { hockey: 90 } }));
    const anton2 = sicht(eintrag({ playerId: "a", name: "Anton", disciplineEstimates: { hockey: 99 } }));
    expect(sortiereNachSicht([zora2, anton2], hockeyKey).map((z) => z.item.name)).toEqual(["Anton", "Zora"]);
    // Auch absteigend sortiert bleibt der Gleichstand alphabetisch.
    expect(sortiereNachSicht([zora, anton], hockeyKey, 1).map((z) => z.item.name)).toEqual(["Anton", "Zora"]);
  });

  it("Verschiedene Stufen ordnen nach Stufe, Unbekanntes steht am Ende", () => {
    const hoch = sicht(eintrag({ playerId: "h", name: "Hoch", disciplineEstimates: { hockey: 95 } }));
    const mitte = sicht(eintrag({ playerId: "m", name: "Mitte", disciplineEstimates: { hockey: 75 } }));
    const leer = sicht(eintrag({ playerId: "l", name: "Leer", disciplineEstimates: {} }));
    expect(sortiereNachSicht([leer, mitte, hoch], hockeyKey, -1).map((z) => z.item.name)).toEqual(["Hoch", "Mitte", "Leer"]);
    expect(sortiereNachSicht([leer, mitte, hoch], hockeyKey, 1).map((z) => z.item.name)).toEqual(["Mitte", "Hoch", "Leer"]);
  });

  it("Beobachtet (Stufe 1–4): innerhalb der 5er-Stufe alphabetisch, über die Stufe hinaus nach Stufe", () => {
    const x = sicht(eintrag({ playerId: "x", name: "Xaver", scoutingLevel: 4, disciplineEstimates: { hockey: 89 } }));
    const b = sicht(eintrag({ playerId: "b", name: "Berta", scoutingLevel: 4, disciplineEstimates: { hockey: 85 } }));
    const c = sicht(eintrag({ playerId: "c", name: "Cleo", scoutingLevel: 4, disciplineEstimates: { hockey: 84 } }));
    expect(sortiereNachSicht([x, c, b], hockeyKey).map((z) => z.item.name)).toEqual(["Berta", "Xaver", "Cleo"]);
  });

  it("Gescoutet (Stufe 5) ist exakt und ordnet nach dem echten Wert", () => {
    const a = sicht(eintrag({ playerId: "a", name: "Anton", scoutingLevel: 5, disciplineEstimates: { hockey: 90 } }));
    const z = sicht(eintrag({ playerId: "z", name: "Zora", scoutingLevel: 5, disciplineEstimates: { hockey: 99 } }));
    expect(sortiereNachSicht([a, z], hockeyKey).map((e) => e.item.name)).toEqual(["Zora", "Anton"]);
  });

  it("Die Sicht enthält keinen der wahren Rohwerte", () => {
    const text = JSON.stringify(baueSpielerSicht(eintrag({ playerId: "p-1", name: "Cora" })));
    for (const roh of ["71.37", "66.11", "78.9", "60.2", "77.77", "12.34"]) expect(text).not.toContain(roh);
  });

  it("Mindest-Eignung filtert nur über die obere Grenze der Stufe", () => {
    const s = baueSpielerSicht(eintrag({ playerId: "p", name: "Dora", disciplineEstimates: { hockey: 70 } }));
    expect(s.disziplinen.hockey.bis).toBe(79);
    expect(erfuelltEignungsMinimum(s, "hockey", 79)).toBe(true);
    expect(erfuelltEignungsMinimum(s, "hockey", 80)).toBe(false);
    expect(erfuelltEignungsMinimum(s, "unbekannt", 1)).toBe(false);
  });

  it("Achsen: auch ungescoutet die einzelne Note (Chris 19.11.), nie eine Zahl", () => {
    const grob = baueSpielerSicht(eintrag({ playerId: "p", name: "Emil" }));
    expect(grob.achsen.pow.anzeige).toBe("B");
    expect(grob.achsen.pow.exakt).toBe(false);
    expect(grob.achsen.pow.anzeige).not.toMatch(/\d/);
    const fein = baueSpielerSicht(eintrag({ playerId: "p", name: "Emil", scoutingLevel: 4 }));
    expect(fein.achsen.pow.anzeige).toBe("B");
    expect(tierBereichSortWert("B–A")).toBe(4.5);
    expect(tierBereichSortWert("S–S+")).toBe(6.5);
    expect(tierBereichSortWert(null)).toBeNull();
  });

  it("Stufe 4 zeigt Attribute als Note, nicht als Zahl und nicht genauer als die Note", () => {
    const s4 = baueSpielerSicht(eintrag({ playerId: "p", name: "Fina", scoutingLevel: 4 }));
    const text = JSON.stringify(s4.attribute);
    expect(text).not.toMatch(/\d+\.\d+/);
    expect(Object.values(s4.attribute).every((a) => a.anzeige === null || /^[FEDCBAS+]{1,2}$/.test(a.anzeige))).toBe(true);
  });

  it("Wege zum Erfolg: nur aufgedeckte Attribute zählen, sonst offen", () => {
    const fremd = baueSpielerSicht(eintrag({ playerId: "p", name: "Fina" }));
    const wege = bauWege(fremd, "hockey");
    expect(wege.zeilen.length).toBeGreaterThan(0);
    const verdeckt = Object.values(fremd.attribute).filter((a) => !a.aufgedeckt);
    expect(verdeckt.length).toBe(8);
    expect(verdeckt.every((a) => a.anzeige === null && a.prozent === null)).toBe(true);
    const voll = baueSpielerSicht(eintrag({ playerId: "p", name: "Fina", scoutingLevel: 5 }));
    expect(Object.values(voll.attribute).every((a) => a.aufgedeckt)).toBe(true);
    expect(["primaer", "neben", "kein"]).toContain(bauWege(voll, "hockey").urteil.art);
  });

  it("Erwartete PP: grob auf halbe Punkte unter dem Nebel, exakt erst gescoutet", () => {
    expect(erwartetePp(28)).toBe(0);
    expect(erwartetePp(200)).toBe(5);
    expect(erwartetePp(null)).toBeNull();
    const grob = erwartetePpSpanne(baueSichtWert(60, 0));
    expect(grob).not.toBeNull();
    expect(grob!.exakt).toBe(false);
    expect((grob!.von * 2) % 1).toBe(0);
    expect(grob!.text).toMatch(/^≈ \d,\d(–\d,\d)?$/);
    // Oben gedeckelt: die ganze Stufe 90–99 sieht gleich aus, nicht „5,0–5,0“.
    expect(erwartetePpSpanne(baueSichtWert(95, 0))!.text).toBe("≈ 5,0");
    expect(erwartetePpSpanne(baueSichtWert(70, 5))!.exakt).toBe(true);
  });
});
