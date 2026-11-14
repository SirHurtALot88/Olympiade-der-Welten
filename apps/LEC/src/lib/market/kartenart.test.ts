import { describe, expect, it } from "vitest";
import { kartenartOf, ordnerOf, ORDNER } from "./kartenart";

describe("kartenartOf", () => {
  it("ordnet YGOPRODeck-Typen zu", () => {
    expect(kartenartOf("Synchro Tuner Monster")).toBe("Synchro");
    expect(kartenartOf("XYZ Monster")).toBe("Xyz");
    expect(kartenartOf("Fusion Monster")).toBe("Fusion");
    expect(kartenartOf("Link Monster")).toBe("Link");
    expect(kartenartOf("Ritual Effect Monster")).toBe("Ritual");
    expect(kartenartOf("Pendulum Effect Monster")).toBe("Pendel");
    expect(kartenartOf("Normal Monster")).toBe("Normal");
    expect(kartenartOf("Effect Monster")).toBe("Effekt");
    expect(kartenartOf("Spell Card")).toBe("Zauber");
    expect(kartenartOf("Trap Card")).toBe("Falle");
    expect(kartenartOf(null)).toBeNull();
  });
});

describe("ordnerOf (Chris' Ordnerstruktur)", () => {
  it("hohe Seltenheiten zuerst, egal welche Kartenart", () => {
    expect(ordnerOf("Starlight Rare", "Synchro")).toBe(ORDNER.hoch);
    expect(ordnerOf("Platinum Secret Rare", "Zauber")).toBe(ORDNER.hoch);
    expect(ordnerOf("Collector's Rare", null)).toBe(ORDNER.hoch);
  });
  it("Secret-Monster, farbige Monster, normale Monster, Zauber/Fallen", () => {
    expect(ordnerOf("Secret Rare", "Effekt")).toBe(ORDNER.secretMonster);
    expect(ordnerOf("Ultra Rare", "Synchro")).toBe(ORDNER.farbig);
    expect(ordnerOf("Ultra Rare", "Effekt")).toBe(ORDNER.monster);
    expect(ordnerOf("Common", "Normal")).toBe(ORDNER.monster);
    expect(ordnerOf("Secret Rare", "Falle")).toBe(ORDNER.zf);
    expect(ordnerOf("Super Rare", "Zauber")).toBe(ORDNER.zf);
  });
  it("ohne Kartenart und ohne hohe Seltenheit unbekannt", () => {
    expect(ordnerOf("Ultra Rare", null)).toBeNull();
  });
});
