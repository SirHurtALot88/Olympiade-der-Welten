import { describe, expect, it } from "vitest";
import { conditionFactor, conditionOf } from "./condition";

describe("conditionOf", () => {
  it("erkennt Kuerzel und Woerter", () => {
    expect(conditionOf("Yu-Gi-Oh! RA05-DE101 Trishula Ultra Rare NM 1st")).toBe("NM");
    expect(conditionOf("Yu-Gi-Oh! HA03-DE012 Naturia-Felsen Secret Rare GD 1st")).toBe("GD");
    expect(conditionOf("Yu-Gi-Oh! SKE-001 Blue-Eyes White Dragon Super Rare LP")).toBe("LP");
    expect(conditionOf("Reißender Tribut Ultra Rare Played")).toBe("PL");
    expect(conditionOf("Reißender Tribut Ultra Rare Light Played")).toBe("LP");
    expect(conditionOf("Karte Poor")).toBe("PO");
    expect(conditionOf("Karte EX")).toBe("EX");
  });
  it("ohne Angabe NM, Abschlaege fallen von EX bis Poor", () => {
    expect(conditionOf("Yu-Gi-Oh! LOB-DE001 Blauäugiger w. Drache")).toBe("NM");
    expect(conditionFactor("x NM")).toBe(1);
    expect(conditionFactor("x EX")).toBeGreaterThan(conditionFactor("x GD"));
    expect(conditionFactor("x GD")).toBeGreaterThan(conditionFactor("x LP"));
    expect(conditionFactor("x LP")).toBeGreaterThan(conditionFactor("x PL"));
    expect(conditionFactor("x PL")).toBeGreaterThan(conditionFactor("x Poor"));
  });
});
