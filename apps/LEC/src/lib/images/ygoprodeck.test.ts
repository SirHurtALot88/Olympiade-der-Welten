import { describe, expect, it } from "vitest";
import { buildSetCodeIndex, lookupCardImageId, toEnglishSetCode, ygoImageUrl } from "./ygoprodeck";

describe("toEnglishSetCode", () => {
  it("tauscht DE gegen EN, die Nummer bleibt", () => {
    expect(toEnglishSetCode("RA02-DE048")).toBe("RA02-EN048");
    expect(toEnglishSetCode("ygld-deb02")).toBe("YGLD-ENB02");
    expect(toEnglishSetCode("GFTP-EN011")).toBe("GFTP-EN011");
  });
});

describe("buildSetCodeIndex", () => {
  const json = {
    data: [
      { card_sets: [{ set_code: "RA02-EN048" }, { set_code: "LOB-EN119" }], card_images: [{ id: 5318639 }] },
      { card_sets: [{ set_code: "BROL-EN067" }], card_images: [{ id: 6172122 }] },
      { card_sets: [{ set_code: "XXXX-EN001" }], card_images: [] },
    ],
  };
  const index = buildSetCodeIndex(json);

  it("findet deutsche Codes ueber den englischen", () => {
    expect(lookupCardImageId(index, "RA02-DE048")).toBe(5318639);
    expect(lookupCardImageId(index, "BROL-DE067")).toBe(6172122);
  });

  it("liefert null fuer unbekannte Codes und Karten ohne Bild", () => {
    expect(lookupCardImageId(index, "AC11-DE012")).toBeNull();
    expect(lookupCardImageId(index, "XXXX-DE001")).toBeNull();
  });

  it("baut die Bild-URL", () => {
    expect(ygoImageUrl(5318639)).toBe("https://images.ygoprodeck.com/images/cards/5318639.jpg");
  });
});
