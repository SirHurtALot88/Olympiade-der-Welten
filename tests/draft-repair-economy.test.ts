import { describe, expect, it } from "vitest";

import { resolveGmDraftBufferPct } from "@/lib/ai/ai-needs-picks-compare-service";
import { resolvePreseasonRepairMarketValueCap } from "@/lib/ai/chunked-redraft-topup-service";

describe("draft and repair economy helpers", () => {
  it("halves GM draft buffer corridor vs legacy max", () => {
    const buffer = resolveGmDraftBufferPct(null, 0.93);
    expect(buffer).toBeLessThanOrEqual(0.075);
    expect(buffer).toBeGreaterThanOrEqual(0.04);
  });

  it("scales preseason repair cap with team cash", () => {
    expect(resolvePreseasonRepairMarketValueCap(40)).toBe(15);
    expect(resolvePreseasonRepairMarketValueCap(120)).toBe(30);
    expect(resolvePreseasonRepairMarketValueCap(300)).toBe(40);
  });
});
