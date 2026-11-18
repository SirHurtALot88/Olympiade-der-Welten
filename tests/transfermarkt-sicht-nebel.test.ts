import { describe, expect, it } from "vitest";

import {
  baueSichtWert,
  baueSpielerSicht,
  bauWege,
  erfuelltEignungsMinimum,
  erwartetePp,
  erwartetePpSpanne,
  sortiereNachSicht,
  spannenHalbbreite,
  tierBereichSortWert,
} from "@/lib/market/transfermarkt-sicht";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

/** Minimaler Feed-Eintrag: nur die Felder, die die Sicht liest, plus ein paar WAHRE Werte, die sie nie zeigen darf. */
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

describe("Scouting-Nebel des Transfermarkts (18.11.)", () => {
  it("Ungescoutet: die Eignung ist eine Spanne, exakt erst ab Stufe 5", () => {
    const stufe0 = baueSichtWert(70, 0);
    expect(stufe0.exakt).toBe(false);
    expect(stufe0.von).toBe(Math.round(70 - spannenHalbbreite(0)));
    expect(stufe0.bis).toBe(Math.round(70 + spannenHalbbreite(0)));
    const stufe5 = baueSichtWert(70, 5);
    expect(stufe5).toEqual({ schaetzung: 70, von: 70, bis: 70, exakt: true });
    const breiten = [0, 1, 2, 3, 4, 5].map((stufe) => spannenHalbbreite(stufe));
    expect([...breiten].sort((a, b) => b - a)).toEqual(breiten);
  });

  it("Sortierung darf den wahren Wert nicht widerspiegeln: gleiche sichtbare Spanne, anderer wahrer Wert, gleiche Reihenfolge", () => {
    const staerker = eintrag({ playerId: "p-b", name: "Berta", pow: 94.5, ovr: 91.1, mvs: 33.3 });
    const schwaecher = eintrag({ playerId: "p-a", name: "Anton", pow: 41.5, ovr: 52.2, mvs: 3.3 });
    const zeilen = [staerker, schwaecher].map((item) => ({ item, sicht: baueSpielerSicht(item) }));

    const vorwaerts = sortiereNachSicht(zeilen, (z) => z.sicht.disziplinen.hockey?.schaetzung ?? null).map((z) => z.item.name);
    expect(vorwaerts).toEqual(["Anton", "Berta"]);

    // Tauscht man die wahren Werte, bleibt die Reihenfolge: sie hängt nur am Namen, nie am wahren Wert.
    const getauscht = [
      eintrag({ playerId: "p-b", name: "Berta", pow: 41.5, ovr: 52.2, mvs: 3.3 }),
      eintrag({ playerId: "p-a", name: "Anton", pow: 94.5, ovr: 91.1, mvs: 33.3 }),
    ].map((item) => ({ item, sicht: baueSpielerSicht(item) }));
    const nachTausch = sortiereNachSicht(getauscht, (z) => z.sicht.disziplinen.hockey?.schaetzung ?? null).map((z) => z.item.name);
    expect(nachTausch).toEqual(vorwaerts);

    const nachAchse = sortiereNachSicht(zeilen, (z) => z.sicht.achsen.pow.sortWert).map((z) => z.item.name);
    expect(nachAchse).toEqual(["Anton", "Berta"]);
  });

  it("Die Sicht enthält keinen der wahren Rohwerte", () => {
    const sicht = baueSpielerSicht(eintrag({ playerId: "p-1", name: "Cora" }));
    const text = JSON.stringify(sicht);
    for (const roh of ["71.37", "66.11", "78.9", "60.2", "77.77", "12.34"]) {
      expect(text).not.toContain(roh);
    }
  });

  it("Unterschiedliche sichtbare Schätzung ordnet nach der Schätzung, Unbekanntes steht am Ende", () => {
    const a = eintrag({ playerId: "a", name: "Alma", disciplineEstimates: { hockey: 80 } });
    const b = eintrag({ playerId: "b", name: "Bruno", disciplineEstimates: { hockey: 60 } });
    const c = eintrag({ playerId: "c", name: "Cleo", disciplineEstimates: {} });
    const zeilen = [c, b, a].map((item) => ({ item, sicht: baueSpielerSicht(item) }));
    const absteigend = sortiereNachSicht(zeilen, (z) => z.sicht.disziplinen.hockey?.schaetzung ?? null, -1).map((z) => z.item.name);
    expect(absteigend).toEqual(["Alma", "Bruno", "Cleo"]);
    const aufsteigend = sortiereNachSicht(zeilen, (z) => z.sicht.disziplinen.hockey?.schaetzung ?? null, 1).map((z) => z.item.name);
    expect(aufsteigend).toEqual(["Bruno", "Alma", "Cleo"]);
  });

  it("Mindest-Eignung filtert nur über die obere Spannengrenze (kann reichen), nie über den wahren Wert", () => {
    const sicht = baueSpielerSicht(eintrag({ playerId: "p", name: "Dora", disciplineEstimates: { hockey: 70 } }));
    const bis = sicht.disziplinen.hockey.bis ?? 0;
    expect(erfuelltEignungsMinimum(sicht, "hockey", bis)).toBe(true);
    expect(erfuelltEignungsMinimum(sicht, "hockey", bis + 1)).toBe(false);
    expect(erfuelltEignungsMinimum(sicht, "unbekannt", 1)).toBe(false);
  });

  it("Achsen und Attribute: ungescoutet als Bereich, mit hoher Sicherheit exakt", () => {
    const unscharf = baueSpielerSicht(eintrag({ playerId: "p", name: "Emil" }));
    expect(unscharf.achsen.pow.anzeige).toBe("B-C");
    expect(unscharf.achsen.pow.exakt).toBe(false);
    const scharf = baueSpielerSicht(eintrag({ playerId: "p", name: "Emil", scoutingLevel: 5, scoutingConfidence: 80 }));
    expect(scharf.achsen.pow.anzeige).toBe("B");
    expect(scharf.achsen.pow.exakt).toBe(true);
    expect(tierBereichSortWert("B-C")).toBe(3.5);
    expect(tierBereichSortWert("S-S+")).toBe(6.5);
    expect(tierBereichSortWert(null)).toBeNull();
  });

  it("Wege zum Erfolg: nur aufgedeckte Attribute zählen, sonst offen", () => {
    const fremd = baueSpielerSicht(eintrag({ playerId: "p", name: "Fina" }));
    const wege = bauWege(fremd, "hockey");
    expect(wege.zeilen.length).toBeGreaterThan(0);
    expect(wege.zeilen[0].gewicht).toBeGreaterThanOrEqual(wege.zeilen[wege.zeilen.length - 1].gewicht);
    const verdeckt = Object.values(fremd.attribute).filter((attribut) => !attribut.aufgedeckt);
    expect(verdeckt.length).toBe(8);
    expect(verdeckt.every((attribut) => attribut.anzeige === null && attribut.prozent === null)).toBe(true);
    const voll = baueSpielerSicht(eintrag({ playerId: "p", name: "Fina", scoutingLevel: 5, scoutingConfidence: 80 }));
    expect(Object.values(voll.attribute).every((attribut) => attribut.aufgedeckt)).toBe(true);
    expect(["primaer", "neben", "kein"]).toContain(bauWege(voll, "hockey").urteil.art);
  });

  it("Erwartete PP: Näherung auf der Skala 0..5, als Spanne bei unscharfer Eignung", () => {
    expect(erwartetePp(28)).toBe(0);
    expect(erwartetePp(200)).toBe(5);
    expect(erwartetePp(null)).toBeNull();
    const spanne = erwartetePpSpanne(baueSichtWert(70, 0));
    expect(spanne).not.toBeNull();
    expect(spanne!.von).toBeLessThan(spanne!.bis);
    expect(erwartetePpSpanne(baueSichtWert(70, 5))!.exakt).toBe(true);
  });
});
