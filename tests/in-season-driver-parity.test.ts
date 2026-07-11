import { describe, expect, it, vi } from "vitest";

const runTransferWindowSessionLegacy = vi.hoisted(() => vi.fn());

// Mock the session-service module so the V2 driver's delegation target is a controlled spy. This
// proves the V2 driver forwards the exact input to the proven legacy orchestration and returns its
// result verbatim — i.e. structural parity by construction while the flag is off in production.
vi.mock("@/lib/ai/ai-transfer-window-session-service", () => ({
  runTransferWindowSessionLegacy,
}));

import { runTransferWindowSessionV2 } from "@/lib/ai/ai-transfer-window-session-v2-service";

describe("in-season V2 driver — delegation parity", () => {
  it("forwards the input verbatim to the legacy orchestration and returns its result", async () => {
    const sentinelResult = { phase: "season_end", appliedSells: 3, appliedBuys: 0 } as never;
    runTransferWindowSessionLegacy.mockResolvedValue(sentinelResult);

    const input = { saveId: "save-1", seasonId: "season-2", phase: "season_end" } as never;
    const result = await runTransferWindowSessionV2(input);

    expect(runTransferWindowSessionLegacy).toHaveBeenCalledTimes(1);
    expect(runTransferWindowSessionLegacy).toHaveBeenCalledWith(input);
    expect(result).toBe(sentinelResult);
  });
});
