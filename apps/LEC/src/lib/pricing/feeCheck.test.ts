import { describe, expect, it } from "vitest";
import { feeCheckBands } from "./feeCheck";
import { DEFAULT_COST_SETTINGS } from "./costSettings";

describe("feeCheckBands", () => {
  it("rechnet den echten Satz je Preisband und stellt den Modellsatz daneben", () => {
    const bands = feeCheckBands(
      [
        { qtySold: 10, totalRevenueGross: 100, totalSellingCosts: 20 }, // 10 € je Stueck, 20 %
        { qtySold: 1, totalRevenueGross: 50, totalSellingCosts: 10 },
      ],
      DEFAULT_COST_SETTINGS
    );
    expect(bands[1].actualRate).toBeCloseTo(0.2, 5);
    expect(bands[3].actualRate).toBeCloseTo(0.2, 5);
    expect(bands[0].actualRate).toBeNull();
    expect(bands[1].modelRate).toBeGreaterThan(0.15);
  });
});
