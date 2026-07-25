import { describe, expect, it } from "vitest";
import {
  ManualMarketPriceProvider,
  buildCardmarketUrl,
  classifyMarketStatus,
  computeMarketEk,
  type MarketPriceQuote,
} from "./marketPrice";

describe("ManualMarketPriceProvider", () => {
  const quote: MarketPriceQuote = {
    setCode: "BROL-DE067",
    language: "DE",
    available: 2328,
    from: 0.39,
    trend: 0.6,
    avg30: 0.5,
    avg7: 0.55,
    avg1: 0.58,
    offers: [{ price: 0.59, quantity: 500, sellerCountry: "DE" }],
    fetchedAt: new Date("2026-07-15"),
  };
  const provider = new ManualMarketPriceProvider(new Map([["BROL-DE067::DE", quote]]));

  it("liefert eine hinterlegte Preisangabe", async () => {
    const result = await provider.getPrice("BROL-DE067", "DE");
    expect(result).toEqual(quote);
  });

  it("ist case-insensitive beim Set-Code", async () => {
    const result = await provider.getPrice("brol-de067", "DE");
    expect(result?.setCode).toBe("BROL-DE067");
  });

  it("gibt null zurueck, wenn kein Preis hinterlegt ist", async () => {
    const result = await provider.getPrice("UNBEKANNT-DE999", "DE");
    expect(result).toBeNull();
  });
});

describe("buildCardmarketUrl", () => {
  it("haengt die harten DE/DE-Parameter + Pack-Menge an (KONZEPT §7.1)", () => {
    const url = buildCardmarketUrl("https://www.cardmarket.com/de/YuGiOh/Products/Singles/Brothers-of-Legend/Red-Eyes-Fusion", 2);
    expect(url).toBe(
      "https://www.cardmarket.com/de/YuGiOh/Products/Singles/Brothers-of-Legend/Red-Eyes-Fusion?sellerCountry=7&language=3&minCondition=2&amount=2"
    );
  });

  it("rundet die Menge auf mindestens 1", () => {
    const url = buildCardmarketUrl("https://example.com/karte", 0);
    expect(url).toContain("amount=1");
  });
});

describe("computeMarketEk", () => {
  it("multipliziert den guenstigsten Preis mit der Packgroesse und addiert den Einkaufs-Versand", () => {
    // Beispiel aus KONZEPT §7.2: 0,59 EUR x 3er-Pack + Versand.
    expect(computeMarketEk(0.59, 3, 1.3 * 3)).toBeCloseTo(0.59 * 3 + 3.9);
  });
});

describe("classifyMarketStatus", () => {
  it("erkennt 'zu guenstig' deutlich unter dem Trend (> 15 % darunter)", () => {
    expect(classifyMarketStatus(0.4, 1)).toBe("zu_guenstig");
  });

  it("erkennt 'zu teuer' deutlich ueber dem Trend (> 15 % darueber)", () => {
    expect(classifyMarketStatus(1.3, 1)).toBe("zu_teuer");
  });

  it("bewertet +/-15 % um den Trend als neutral", () => {
    expect(classifyMarketStatus(1.1, 1)).toBe("im_korridor");
    expect(classifyMarketStatus(0.9, 1)).toBe("im_korridor");
  });

  it("ist neutral ohne Marktpreis (Trend 0)", () => {
    expect(classifyMarketStatus(5, 0)).toBe("im_korridor");
  });
});
