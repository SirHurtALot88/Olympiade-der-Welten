import { describe, expect, it } from "vitest";
import { buildListedIndex, listedDaysAtLeast } from "./listedAge";

const now = Date.parse("2026-11-13T00:00:00Z");
const idx = buildListedIndex([
  { itemId: 300000000000, firstSoldAt: new Date("2023-06-01") },
  { itemId: 350000000000, firstSoldAt: new Date("2024-06-01") },
  { itemId: 390000000000, firstSoldAt: new Date("2026-01-01") },
]);

describe("listedDaysAtLeast", () => {
  it("kleinere Nummer als ein verkaufter Artikel: mindestens so alt wie dessen erster Verkauf", () => {
    // 320... liegt zwischen 300... und 350...: spaetestens 01.06.2024 eingestellt
    expect(listedDaysAtLeast(idx, "320000000000", null, now)).toBe(Math.floor((now - Date.parse("2024-06-01")) / 86_400_000));
  });
  it("nimmt die engste Grenze (min ueber alle groesseren Nummern)", () => {
    // 100... ist kleiner als alle: engste Grenze ist der fruehere Verkauf 2023-06-01
    expect(listedDaysAtLeast(idx, "100000000000", null, now)).toBe(Math.floor((now - Date.parse("2023-06-01")) / 86_400_000));
  });
  it("hoechste Nummer ohne eigenen Verkauf: unbekannt; mit eigenem Verkauf: dieser", () => {
    expect(listedDaysAtLeast(idx, "400000000000", null, now)).toBeNull();
    expect(listedDaysAtLeast(idx, "400000000000", new Date("2026-10-01"), now)).toBe(43);
  });
  it("ungueltige Nummern", () => {
    expect(listedDaysAtLeast(idx, "abc", null, now)).toBeNull();
    expect(listedDaysAtLeast(idx, null, null, now)).toBeNull();
  });
});
