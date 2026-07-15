import { describe, expect, it } from "vitest";
import { ManualMarketPriceProvider, type MarketPriceQuote } from "./marketPrice";

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
