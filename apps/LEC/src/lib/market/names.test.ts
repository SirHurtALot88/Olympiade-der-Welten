import { describe, expect, it } from "vitest";
import { buildCodeNames, buildNameIndex, nameKey, suggestCodes, titleNameMismatch } from "./names";

describe("nameKey", () => {
  it("normalisiert Umlaute, Akzente und Zeichen", () => {
    expect(nameKey("Dimensionsgefängnis")).toBe("dimensionsgefaengnis");
    expect(nameKey("Außenmotor-Ryzeal")).toBe("aussenmotorryzeal");
    expect(nameKey("Théorème, ,")).toBe("theoreme");
  });
});

describe("buildCodeNames", () => {
  it("ordnet englischen und deutschen Namen dem Set-Code zu", () => {
    const m = buildCodeNames(
      [{ id: 1, name: "Lightning Storm", card_sets: [{ set_code: "RA04-EN094" }] }],
      [{ id: 1, name: "Blitzschlag" }]
    );
    expect(m.get("RA04-EN094")).toEqual({ en: "Lightning Storm", de: "Blitzschlag" });
  });
  it("kommt ohne deutsche Liste aus", () => {
    expect(buildCodeNames([{ id: 2, name: "Linkuriboh", card_sets: [{ set_code: "RA04-EN291" }] }], null).get("RA04-EN291")).toEqual({
      en: "Linkuriboh",
      de: null,
    });
  });
});

describe("titleNameMismatch", () => {
  const code = { en: "Lightning Storm", de: "Blitzschlag" };
  it("erkennt einen falschen Namen im Titel", () => {
    expect(titleNameMismatch("Mitsurugi Magatama", code)).toBe(true);
  });
  it("akzeptiert deutschen oder englischen Namen", () => {
    expect(titleNameMismatch("Blitzschlag", code)).toBe(false);
    expect(titleNameMismatch("Lightning Storm", code)).toBe(false);
    expect(titleNameMismatch("blitz-schlag Super Rare", code)).toBe(false);
  });
  it("gibt keinen Alarm ohne Urteilsgrundlage", () => {
    expect(titleNameMismatch("Mitsurugi Magatama", { en: null, de: null })).toBe(false);
    expect(titleNameMismatch("", code)).toBe(false);
    // ohne deutschen Namen kein Urteil (der Titel ist deutsch, der englische Name passt nie)
    expect(titleNameMismatch("Phara die Urgöttin", { en: "Phara the Primordial God", de: null })).toBe(false);
  });
  it("toleriert Schreibvarianten (Kommas, Umlaute, kleine Abweichungen)", () => {
    expect(titleNameMismatch("Endloskette Mahdrescher", { en: "Endless Chain", de: "Endloskette Mähdrescher" })).toBe(false);
    expect(titleNameMismatch("Blaster Drachenherrscher des Untergangs", { en: "Blaster, Dragon Ruler of Infernos", de: "Blaster, Drachenherrscher des Untergangs" })).toBe(false);
    expect(titleNameMismatch("Dimensionsverschieber", { en: "Soul of the Magicians", de: "Seelen der Magier" })).toBe(true);
  });
  it("nimmt gekuerzte Titel nicht als Fehler", () => {
    expect(titleNameMismatch("Dimensionsgefängnis", { en: "Dimensional Prison", de: "Dimensionsgefängnis des Zorns" })).toBe(false);
  });
});

describe("suggestCodes", () => {
  const en = [
    {
      id: 7,
      name: "Mitsurugi Magatama",
      card_sets: [
        { set_code: "ALIN-EN060", set_rarity: "Secret Rare" },
        { set_code: "ALIN-EN060", set_rarity: "Super Rare" },
        { set_code: "RA03-EN045", set_rarity: "Super Rare" },
      ],
    },
  ];
  const idx = buildNameIndex(en, [{ id: 7, name: "Mitsurugi-Magatama" }]);
  it("schlaegt Codes mit passender Seltenheit vor", () => {
    expect(suggestCodes(idx, "Mitsurugi Magatama", ["Super Rare"])).toEqual(["ALIN-DE060", "RA03-DE045"]);
  });
  it("faellt ohne passende Seltenheit auf alle Drucke zurueck", () => {
    expect(suggestCodes(idx, "Mitsurugi Magatama", ["Ultra Rare"])).toEqual(["ALIN-DE060", "RA03-DE045"]);
  });
  it("findet auch den deutschen Namen, sonst null", () => {
    expect(suggestCodes(idx, "Mitsurugi-Magatama", [])).not.toBeNull();
    expect(suggestCodes(idx, "Unbekannte Karte", [])).toBeNull();
  });
});
