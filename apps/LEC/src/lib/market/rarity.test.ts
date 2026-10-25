import { describe, expect, it } from "vitest";
import { parseSetCode, rarityFromTitle } from "./rarity";

describe("rarityFromTitle", () => {
  it.each([
    ["Yu-Gi-Oh! RA03-DE052 Wiedergeburt Ultra Rare NM 1st", "Ultra Rare"],
    ["Yu-Gi-Oh! RA03-DE115 Magischer Zylinder Platinum SecR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA04-DE121 Bodenklappenfalle Plat SecR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA03-DE255 Stream Platinum SecRare NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA04-DE249 Glasflügel-Synchrodrache Platinum SR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA04-DE109 Rotäugiger Schwarzer Drache PSR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA04-DE012 Nixenrüstung Abysshecht 25th QCSR NM 1st", "Quarter Century Secret Rare"],
    ["Yu-Gi-Oh! MP23-DE148 Garura UltimateRare NM 1st", "Ultimate Rare"],
    ["Yu-Gi-Oh! RA03-DE050 Prometheische Prinzessin UltiR NM", "Ultimate Rare"],
    ["Yu-Gi-Oh! RA03-DE050 Prometheische Prinzessin SecR NM", "Secret Rare"],
    ["Yu-Gi-Oh! RA03-DE050 Prometheische Prinzessin CR NM 1st", "Collector's Rare"],
    ["Yu-Gi-Oh! RA03-DE050 Prometheische Prinzessin UR NM 1st", "Ultra Rare"],
    ["3x Yu-Gi-Oh! MZMU-DE029 E-Held Donnergigant SR NM 1st", "Super Rare"],
    ["Yu-Gi-Oh! RA01-DE001 Karte Collectors Rare NM 1st", "Collector's Rare"],
    ["Yu-Gi-Oh! CORI-DE061 Topf der Faulheit Secret Rare NM 1st", "Secret Rare"],
    ["Yu-Gi-Oh! XXXX-DE001 Irgendwas Common NM 1st", "Common"],
    ["Yu-Gi-Oh! RA03-DE133 Chaos-Imperatordrache PlatSecR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! RA04-DE241 Diamant PlatSR NM 1st", "Platinum Secret Rare"],
    ["Yu-Gi-Oh! MP24-DE015 Das Siegel von Orichalcos QCentury NM 1st", "Quarter Century Secret Rare"],
    ["Yu-Gi-Oh! TN19-DE005 Rotäugiger alternativer schwarzer Drache Secret RNM Limited", "Secret Rare"],
  ])("%s -> %s", (title, expected) => {
    expect(rarityFromTitle(title)).toBe(expected);
  });

  it("laengere Namen gewinnen: Ultimate Rare ist nicht Rare, Platinum Secret Rare nicht Secret Rare", () => {
    expect(rarityFromTitle("X Platinum Secret Rare NM")).toBe("Platinum Secret Rare");
    expect(rarityFromTitle("X Ultimate Rare NM")).toBe("Ultimate Rare");
  });

  it("ohne Seltenheit im Titel: null", () => {
    expect(rarityFromTitle("Yu-Gi-Oh! STOR-DE083 Karakuri-Muso Nr. 818 „Haipa“ 1st NM")).toBeNull();
  });
});

describe("parseSetCode", () => {
  it("zerlegt deutsche und englische Codes, auch mit Buchstaben in der Nummer", () => {
    expect(parseSetCode("RA01-DE066")).toEqual({ prefix: "RA01", number: "066" });
    expect(parseSetCode("lavd-del23")).toEqual({ prefix: "LAVD", number: "L23" });
    expect(parseSetCode("BP01-EN105")).toEqual({ prefix: "BP01", number: "105" });
    expect(parseSetCode("kein code")).toBeNull();
  });
});
