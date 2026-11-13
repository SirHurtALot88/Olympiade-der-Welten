import { describe, expect, it } from "vitest";
import { assessLifecycle } from "./lifecycle";

const base = { active: true, hidden: false, stock: 3, vk: 4.99, daysSinceSale: 353 };
describe("assessLifecycle", () => {
  it("Mindestpreis, ueber 180 Tage: auslaufen lassen; ueber 365: auslisten", () => {
    expect(assessLifecycle(base)).toBe("auslaufen");
    expect(assessLifecycle({ ...base, daysSinceSale: 400 })).toBe("auslisten");
  });
  it("ueber 6 € und lange ohne Verkauf: Preis senken", () => {
    expect(assessLifecycle({ ...base, vk: 14.99, daysSinceSale: 200 })).toBe("preis_senken");
  });
  it("sonst nichts: juengerer Verkauf, kein Bestand, nie verkauft, ausgeblendet", () => {
    expect(assessLifecycle({ ...base, daysSinceSale: 90 })).toBeNull();
    expect(assessLifecycle({ ...base, stock: 0 })).toBeNull();
    expect(assessLifecycle({ ...base, daysSinceSale: null })).toBeNull();
    expect(assessLifecycle({ ...base, hidden: true })).toBeNull();
  });
});

import { assessSortiment, daysAtPrice } from "./lifecycle";

describe("assessSortiment", () => {
  const base = { active: true, hidden: false, stock: 1, vk: 9.99, units365: 0, unitProfit: null, lastSoldDays: null, lastPriceChangeDays: null, listedDays: null };
  it("schuetzt frisch geaenderte Preise", () => {
    expect(assessSortiment({ ...base, lastSoldDays: 400, lastPriceChangeDays: 10 })?.status).toBe("pruefen");
  });
  it("behaelt Artikel mit zwei Verkaeufen im Jahr", () => {
    expect(assessSortiment({ ...base, units365: 2, lastSoldDays: 40 })?.status).toBe("behalten");
  });
  it("schuetzt nie verkaufte, junge Angebote", () => {
    expect(assessSortiment({ ...base, listedDays: 100 })?.status).toBe("pruefen");
  });
  it("Uhr zaehlt ab dem spaeteren Ereignis", () => {
    expect(daysAtPrice({ lastSoldDays: 300, lastPriceChangeDays: 50, listedDays: null })).toBe(50);
  });
  it("ignoriert inaktive", () => {
    expect(assessSortiment({ ...base, active: false })).toBeNull();
  });
});
