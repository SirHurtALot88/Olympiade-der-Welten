import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeServerRoomWrite = vi.fn();

vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite,
}));

vi.mock("@/lib/ai/ai-legacy-lineup-batch-apply-service", () => ({
  applyAiLegacyLineupBatchLocally: vi.fn(() => ({ ok: true, dryRun: true })),
}));

describe("ai batch apply route guard", () => {
  beforeEach(() => {
    authorizeServerRoomWrite.mockReset();
    authorizeServerRoomWrite.mockReturnValue({
      allowed: false,
      status: 403,
      reason: "host_only_action",
      warnings: [],
    });
  });

  it("blocks writes when room guard rejects host-only batch apply", async () => {
    const { POST } = await import("@/app/api/lineups/legacy/ai-batch-apply/route");
    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=room-save&seasonId=season-1&matchdayId=md-1&roomCode=ABCD", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
    );

    expect(response.status).toBe(403);
    expect(authorizeServerRoomWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        saveId: "room-save",
        action: "lineup_ai_batch_apply",
        dryRun: true,
      }),
    );
  });
});
