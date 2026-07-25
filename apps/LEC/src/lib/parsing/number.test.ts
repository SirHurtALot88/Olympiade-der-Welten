import { describe, expect, it } from "vitest";
import { parseGermanNumber } from "./number";

describe("parseGermanNumber", () => {
  it("parst reine Punkt-Dezimalzahlen (gebrochene Alt-Blätter)", () => {
    expect(parseGermanNumber("3.79")).toBeCloseTo(3.79);
  });

  it("parst deutsche Komma-Dezimalzahlen", () => {
    expect(parseGermanNumber("27,94")).toBeCloseTo(27.94);
  });

  it("parst Excel-Buchhaltungsformat für Null", () => {
    expect(parseGermanNumber("- 0 €")).toBe(0);
    expect(parseGermanNumber("- €")).toBe(0);
  });

  it("parst deutsche Tausendertrennung mit Komma-Dezimalstellen", () => {
    expect(parseGermanNumber("1.234,56 €")).toBeCloseTo(1234.56);
  });

  it("parst mehrstellige Tausendergruppen ohne Komma als Ganzzahl", () => {
    expect(parseGermanNumber("12.345.678")).toBe(12345678);
  });

  it("parst einzelnen Punkt mit 3 Nachkommastellen als Tausendertrennzeichen", () => {
    expect(parseGermanNumber("1.234")).toBe(1234);
  });

  it("behandelt negative Beträge korrekt", () => {
    expect(parseGermanNumber("-47,0 %")).toBeCloseTo(-47.0);
    expect(parseGermanNumber("-89,97 €")).toBeCloseTo(-89.97);
  });

  it("gibt 0 für leere/undefinierte Werte zurück", () => {
    expect(parseGermanNumber("")).toBe(0);
    expect(parseGermanNumber(undefined)).toBe(0);
    expect(parseGermanNumber(null)).toBe(0);
  });

  it("lässt bereits numerische Werte unverändert (z. B. aus xlsx-Zellen)", () => {
    expect(parseGermanNumber(89.97)).toBe(89.97);
    expect(parseGermanNumber(0)).toBe(0);
  });

  it("ignoriert Prozentzeichen und Leerzeichen", () => {
    expect(parseGermanNumber("48,7 %")).toBeCloseTo(48.7);
  });
});
