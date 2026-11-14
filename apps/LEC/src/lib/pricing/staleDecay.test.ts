import { describe, expect, it } from "vitest";
import { applyStaleDiscount, staleDiscountPct } from "./staleDecay";

describe("Ladenhüter-Abschlag", () => {
  it("erst ab 120 Tagen, in 5-%-Schritten, höchstens 30 %", () => {
    expect(staleDiscountPct(119, 3)).toBe(0);
    expect(staleDiscountPct(120, 3)).toBeCloseTo(0.05);
    expect(staleDiscountPct(150, 3)).toBeCloseTo(0.1);
    expect(staleDiscountPct(1000, 3)).toBeCloseTo(0.3);
  });
  it("kein Abschlag ohne Bestand oder ohne bekannten Verkauf", () => {
    expect(staleDiscountPct(400, 0)).toBe(0);
    expect(staleDiscountPct(null, 5)).toBe(0);
  });
  it("sinkt, aber nicht unter die Kostendeckung", () => {
    expect(applyStaleDiscount({ min: 20, opt: 25 }, 0.1, 10)).toEqual({ min: 18, opt: 22.5 });
    const t = applyStaleDiscount({ min: 20, opt: 25 }, 0.3, 17);
    expect(t.min).toBe(17);
    expect(t.opt).toBeCloseTo(17.5);
  });
  it("Untergrenze über dem Ziel: Ziel bleibt", () => {
    expect(applyStaleDiscount({ min: 6, opt: 7 }, 0.3, 9)).toEqual({ min: 6, opt: 7 });
  });
});
