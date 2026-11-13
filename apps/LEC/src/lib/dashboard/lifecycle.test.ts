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
