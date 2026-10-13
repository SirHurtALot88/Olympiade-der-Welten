import { describe, expect, it } from "vitest";
import { countMarketFilters, marketBucket, matchesMarketFilter, type MarketFilter, type MarketVerdict } from "./marketFilter";

const v = (status: MarketVerdict["status"], extra: Partial<MarketVerdict> = {}): MarketVerdict => ({ rated: true, status, ekAboveMarket: false, ...extra });
const sel = (...f: MarketFilter[]) => new Set(f);

describe("marketBucket", () => {
  it("ohne Marktwert oder ohne Urteil = offen", () => {
    expect(marketBucket(null)).toBe("offen");
    expect(marketBucket(v("zu_teuer", { rated: false }))).toBe("offen");
  });
  it("mit Urteil der Status", () => {
    expect(marketBucket(v("zu_guenstig"))).toBe("zu_guenstig");
    expect(marketBucket(v("im_korridor"))).toBe("im_korridor");
  });
});

describe("matchesMarketFilter", () => {
  it("leere Auswahl zeigt alles", () => {
    expect(matchesMarketFilter(null, sel())).toBe(true);
  });
  it("zu guenstig / zu teuer filtern genau diese", () => {
    expect(matchesMarketFilter(v("zu_guenstig"), sel("zu_guenstig"))).toBe(true);
    expect(matchesMarketFilter(v("zu_teuer"), sel("zu_guenstig"))).toBe(false);
    expect(matchesMarketFilter(v("zu_teuer"), sel("zu_teuer"))).toBe(true);
    expect(matchesMarketFilter(null, sel("zu_teuer"))).toBe(false);
  });
  it("mehrere Auswahlen sind ein ODER (zu guenstig ODER zu teuer = alle Abweichungen)", () => {
    const both = sel("zu_guenstig", "zu_teuer");
    expect(matchesMarketFilter(v("zu_guenstig"), both)).toBe(true);
    expect(matchesMarketFilter(v("zu_teuer"), both)).toBe(true);
    expect(matchesMarketFilter(v("im_korridor"), both)).toBe(false);
  });
  it("EK ueber Markt ist ein eigenes Merkmal, unabhaengig vom Urteil", () => {
    expect(matchesMarketFilter(v("im_korridor", { ekAboveMarket: true }), sel("ek_ueber"))).toBe(true);
    expect(matchesMarketFilter(v("im_korridor"), sel("ek_ueber"))).toBe(false);
    // zusammen mit zu guenstig: Vereinigung
    expect(matchesMarketFilter(v("zu_guenstig"), sel("ek_ueber", "zu_guenstig"))).toBe(true);
  });
});

describe("countMarketFilters", () => {
  it("zaehlt Eimer und EK ueber Markt", () => {
    const c = countMarketFilters([v("zu_guenstig"), v("zu_guenstig", { ekAboveMarket: true }), v("zu_teuer"), v("im_korridor"), null, v("im_korridor", { rated: false })]);
    expect(c).toEqual({ zu_guenstig: 2, zu_teuer: 1, im_korridor: 1, ek_ueber: 1, offen: 2 });
  });
});
