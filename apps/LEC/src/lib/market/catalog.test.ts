import { describe, expect, it } from "vitest";
import { buildCatalogIndex, resolveMarket, type CmPrice, type RarityMap } from "./catalog";

const price = (idProduct: number, avg7: number | null, extra: Partial<CmPrice> = {}): CmPrice => ({
  idProduct, avg: null, low: null, trend: null, avg1: null, avg7, avg30: null, ...extra,
});

const ygo = [
  { name: "Mystical Space Typhoon", card_sets: [{ set_code: "RA02-EN048" }, { set_code: "LOB-EN119" }] },
  { name: "Red-Eyes Fusion", card_sets: [{ set_code: "BROL-EN067" }] },
  { name: "Dark Magician", card_sets: [{ set_code: "RA02-EN001" }] },
];
const products = [
  // RA02 = Expansion 50: MST in drei Varianten, Dark Magician einmal
  { idProduct: 1, name: "Mystical Space Typhoon", idExpansion: 50 },
  { idProduct: 2, name: "Mystical Space Typhoon", idExpansion: 50 },
  { idProduct: 6, name: "Mystical Space Typhoon", idExpansion: 50 },
  { idProduct: 3, name: "Dark Magician", idExpansion: 50 },
  // dieselben Namen in anderen Expansionen duerfen die Abstimmung nicht kippen
  { idProduct: 4, name: "Mystical Space Typhoon", idExpansion: 10 },
  { idProduct: 5, name: "Red-Eyes Fusion", idExpansion: 70 },
];
const prices = [price(1, 0.5), price(2, 40), price(6, 40.5), price(3, 1.2), price(4, 0.1), price(5, 2.5)];
const index = buildCatalogIndex(ygo, products, prices);

const rarityMap: RarityMap = {
  RA02: { "048": { "super rare": 1, "ultra rare": 2, "secret rare": [2, 6], "ultimate rare": [1, 2] } },
};

describe("resolveMarket", () => {
  it("deutscher Set-Code, einzige Variante im Set", () => {
    expect(resolveMarket(index, "RA02-DE001", "Yu-Gi-Oh! RA02-DE001 Dunkler Magier Ultra Rare NM", rarityMap)).toMatchObject({
      quality: "eindeutig", idProduct: 3, how: "einzige_variante",
    });
    expect(resolveMarket(index, "BROL-DE067", null, rarityMap)).toMatchObject({ quality: "eindeutig", idProduct: 5 });
  });

  it("mehrere Varianten: Seltenheit aus dem Titel waehlt das Produkt", () => {
    const t = (r: string) => `Yu-Gi-Oh! RA02-DE048 Mystischer Raum-Taifun ${r} NM 1st`;
    expect(resolveMarket(index, "RA02-DE048", t("SR"), rarityMap)).toMatchObject({ quality: "eindeutig", idProduct: 1, how: "seltenheit" });
    expect(resolveMarket(index, "RA02-DE048", t("Ultra Rare"), rarityMap)).toMatchObject({ quality: "eindeutig", idProduct: 2 });
  });

  it("gleichpreisige Varianten: eine Zahl, solange die Preise heute beieinanderliegen", () => {
    // Secret Rare = [2 (40,00), 6 (40,50)] -> gleicher Preis, eindeutig; erstes Produkt
    expect(resolveMarket(index, "RA02-DE048", "X Secret Rare NM", rarityMap)).toMatchObject({ quality: "eindeutig", idProduct: 2 });
  });

  it("gleichpreisige Varianten, die inzwischen auseinanderlaufen: Spanne statt Raten", () => {
    // Ultimate Rare = [1 (0,50), 2 (40,00)]
    expect(resolveMarket(index, "RA02-DE048", "X Ultimate Rare NM", rarityMap)).toEqual({
      quality: "mehrdeutig", variants: 2, trendMin: 0.5, trendMax: 40, why: "preise_weichen_ab",
    });
  });

  it("ohne Seltenheit im Titel oder ohne Eintrag: Spanne ueber alle Varianten", () => {
    expect(resolveMarket(index, "RA02-DE048", "X ohne Angabe NM", rarityMap)).toEqual({
      quality: "mehrdeutig", variants: 3, trendMin: 0.5, trendMax: 40.5, why: "keine_seltenheit_im_titel",
    });
    expect(resolveMarket(index, "RA02-DE048", "X Starlight Rare NM", rarityMap)).toMatchObject({
      quality: "mehrdeutig", why: "nicht_in_zuordnung",
    });
  });

  it("Rarity-Collection: Chris' \"Ultimate Rare\" ist bei Cardcluster die Prismatic Ultimate Rare", () => {
    const m: RarityMap = { RA02: { "048": { "prismatic ultimate rare": 2 } } };
    expect(resolveMarket(index, "RA02-DE048", "X Ultimate Rare NM", m)).toMatchObject({ quality: "eindeutig", idProduct: 2 });
  });

  it("Expansion per Abstimmung ueber das Set", () => {
    expect(index.expansionsByPrefix.get("RA02")).toEqual([50]);
  });

  it("ohne oder mit unbekanntem Set-Code: kein Marktwert", () => {
    expect(resolveMarket(index, null, null, rarityMap)).toEqual({ quality: "keiner", reason: "kein_set_code" });
    expect(resolveMarket(index, "AC11-DE012", "x", rarityMap)).toEqual({ quality: "keiner", reason: "set_code_unbekannt" });
  });
});
