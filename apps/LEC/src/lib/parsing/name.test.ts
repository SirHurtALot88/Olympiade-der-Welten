import { describe, expect, it } from "vitest";
import { normalizeArticleName, normalizedNameKey } from "./name";

describe("normalizeArticleName", () => {
  it("trimmt und vereinheitlicht Mehrfach-Leerzeichen", () => {
    const result = normalizeArticleName("  Yu-Gi-Oh!   RA04-DE050   Mulreizendes  Fuwalos  ");
    expect(result.displayName).toBe("Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos");
    expect(result.normalized).toBe("yu-gi-oh! ra04-de050 mulreizendes fuwalos");
  });

  it("erkennt den 3x-Mengen-Praefix separat", () => {
    const result = normalizeArticleName("3x Yu-Gi-Oh! BROL-DE067 Rotaeugige Fusion Ultra Rare");
    expect(result.packQty).toBe(3);
    expect(result.displayName).toBe("Yu-Gi-Oh! BROL-DE067 Rotaeugige Fusion Ultra Rare");
    expect(result.normalized.startsWith("3x")).toBe(false);
  });

  it("erkennt den 2x-Praefix auch ohne Leerzeichen", () => {
    const result = normalizeArticleName("2xYu-Gi-Oh! MAGO-DE158 Dimensionsgefaengnis");
    expect(result.packQty).toBe(2);
  });

  it("faellt ohne Praefix auf Menge 1 zurueck", () => {
    const result = normalizeArticleName("Yu-Gi-Oh! RA02-DE021 Rotaeugiger dunkler Dragoner");
    expect(result.packQty).toBe(1);
  });

  it("vereinheitlicht Gross-/Kleinschreibung im Match-Key, nicht im Anzeigenamen", () => {
    const a = normalizeArticleName("YU-GI-OH! RA02-DE021 Rotaeugiger Dunkler Dragoner");
    const b = normalizeArticleName("yu-gi-oh! ra02-de021 rotaeugiger dunkler dragoner");
    expect(a.normalized).toBe(b.normalized);
    expect(a.displayName).not.toBe(b.displayName);
  });

  it("normalizedNameKey liefert denselben Key wie normalizeArticleName().normalized", () => {
    const raw = "3x Yu-Gi-Oh! BROL-DE067 Rotaeugige Fusion";
    expect(normalizedNameKey(raw)).toBe(normalizeArticleName(raw).normalized);
  });

  it("matcht Billbee- und eBay-Schreibweisen desselben Artikels", () => {
    const billbee = "Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st";
    const ebay = "Yu-Gi-Oh! RA04-DE050 Mulreizendes Fuwalos Ultra Rare NM 1st";
    expect(normalizedNameKey(billbee)).toBe(normalizedNameKey(ebay));
  });
});
