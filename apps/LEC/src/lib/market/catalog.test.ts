import { describe, expect, it } from "vitest";
import { buildCatalogIndex, resolveMarket, type CmPrice } from "./catalog";

const price = (idProduct: number, trend: number | null, extra: Partial<CmPrice> = {}): CmPrice => ({
  idProduct, avg: null, low: null, trend, avg1: null, avg7: null, avg30: null, ...extra,
});

const ygo = [
  { name: "Mystical Space Typhoon", card_sets: [{ set_code: "RA02-EN048" }, { set_code: "LOB-EN119" }] },
  { name: "Red-Eyes Fusion", card_sets: [{ set_code: "BROL-EN067" }] },
  { name: "Dark Magician", card_sets: [{ set_code: "RA02-EN001" }] },
];
const products = [
  // RA02 = Expansion 50: MST in zwei Varianten (mehrdeutig), Dark Magician einmal
  { idProduct: 1, name: "Mystical Space Typhoon", idExpansion: 50 },
  { idProduct: 2, name: "Mystical Space Typhoon", idExpansion: 50 },
  { idProduct: 3, name: "Dark Magician", idExpansion: 50 },
  // dieselben Namen in anderen Expansionen duerfen die Abstimmung nicht kippen
  { idProduct: 4, name: "Mystical Space Typhoon", idExpansion: 10 },
  { idProduct: 5, name: "Red-Eyes Fusion", idExpansion: 70 },
];
const prices = [price(1, 0.5), price(2, 40), price(3, 1.2), price(4, 0.1), price(5, null, { avg30: 2.5 })];
const index = buildCatalogIndex(ygo, products, prices);

describe("resolveMarket", () => {
  it("deutscher Set-Code, eindeutige Variante", () => {
    const r = resolveMarket(index, "RA02-DE001");
    expect(r).toMatchObject({ quality: "eindeutig", idProduct: 3 });
  });

  it("mehrere gleichnamige Varianten im Set: Spanne statt Einzelwert", () => {
    expect(resolveMarket(index, "RA02-DE048")).toEqual({ quality: "mehrdeutig", variants: 2, trendMin: 0.5, trendMax: 40 });
  });

  it("Expansion per Abstimmung ueber das Set", () => {
    expect(index.expansionByPrefix.get("RA02")).toBe(50);
    expect(resolveMarket(index, "BROL-DE067")).toMatchObject({ quality: "eindeutig", idProduct: 5 });
  });

  it("ohne oder mit unbekanntem Set-Code: kein Marktwert", () => {
    expect(resolveMarket(index, null)).toEqual({ quality: "keiner", reason: "kein_set_code" });
    expect(resolveMarket(index, "AC11-DE012")).toEqual({ quality: "keiner", reason: "set_code_unbekannt" });
  });
});
