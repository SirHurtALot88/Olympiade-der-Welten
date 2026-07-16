import { describe, expect, it } from "vitest";
import { extractSetCode, hasSetCode } from "./setCode";

describe("extractSetCode", () => {
  it("erkennt Standard-4-Buchstaben-Set-Codes", () => {
    expect(extractSetCode("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st")).toBe(
      "RA04-DE050"
    );
    expect(extractSetCode("3x Yu-Gi-Oh! BROL-DE067 Rotaeugige Fusion Ultra Rare NM 1st")).toBe(
      "BROL-DE067"
    );
  });

  it("erkennt kurze 2-3-stellige Set-Praefixe", () => {
    expect(extractSetCode("Yu-Gi-Oh! YS17-DE036 Ring der Zerstoerung Common NM 1st")).toBe(
      "YS17-DE036"
    );
  });

  it("erkennt Set-Codes mit Buchstaben-Suffix vor der Nummer", () => {
    expect(extractSetCode("MP24-DE015 Das Siegel von Orichalcos SecR")).toBe("MP24-DE015");
  });

  it("erkennt EN-Sprachcodes", () => {
    expect(extractSetCode("GFTP-EN011 Galaxy-Eyes Cipher X Dragon")).toBe("GFTP-EN011");
  });

  it("normalisiert die Gross-/Kleinschreibung des Treffers", () => {
    expect(extractSetCode("ra04-de050 irgendwas")).toBe("RA04-DE050");
  });

  it("gibt null zurueck, wenn kein Set-Code vorhanden ist", () => {
    expect(extractSetCode("250 YuGiOh! Karten Sammlung Deutsch 30 Holos")).toBeNull();
    expect(extractSetCode("Silberkette 925 Sterling (Privatverkauf)")).toBeNull();
  });

  it("hasSetCode spiegelt extractSetCode", () => {
    expect(hasSetCode("RA04-DE050 Karte")).toBe(true);
    expect(hasSetCode("Mystery Pack")).toBe(false);
  });
});
