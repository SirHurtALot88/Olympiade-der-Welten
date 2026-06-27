import { describe, expect, it } from "vitest";

import { inferKeepReasonCodes, inferSellReasonCodes } from "@/lib/ai/ai-transfer-reason-codes";

describe("ai-transfer-reason-codes", () => {
  it("infers sell and keep codes from legacy reason strings", () => {
    expect(inferSellReasonCodes(["Performance blieb unter Erwartung"])).toContain("underperformance");
    expect(inferSellReasonCodes(["realisierbarer Gewinn von 4.2"])).toContain("profit_window");
    expect(inferKeepReasonCodes(["Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt"])).toContain(
      "star_core_protection",
    );
  });
});
