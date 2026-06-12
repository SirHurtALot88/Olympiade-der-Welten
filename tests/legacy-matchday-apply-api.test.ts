import { beforeEach, describe, expect, it, vi } from "vitest";

const applyLegacyMatchdayResult = vi.fn();

vi.mock("@/lib/resolve/legacy-matchday-result-apply-service", () => ({
  LegacyMatchdayResultApplyService: class {
    applyLegacyMatchdayResult = applyLegacyMatchdayResult;
  },
}));

describe("legacy matchday apply api", () => {
  beforeEach(() => {
    applyLegacyMatchdayResult.mockReset();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/resolve/legacy-matchday-apply/route");
    const response = await POST(
      new Request("http://localhost/api/resolve/legacy-matchday-apply", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-initial" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns success summary on valid apply", async () => {
    applyLegacyMatchdayResult.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: true,
      applied: false,
      previewStatus: "ready",
      canApply: true,
      blockingReasons: [],
      matchdayResultId: "result-1",
      teamsTotal: 32,
      resultsWritten: 64,
      playerPerformancesWritten: 175,
      highlightsWritten: 8,
      warningsCount: 7,
      replacedExisting: false,
      counts: {
        matchdayResults: 1,
        disciplineResults: 64,
        playerPerformances: 175,
        highlights: 8,
        auditLogs: 1,
      },
    });

    const { POST } = await import("@/app/api/resolve/legacy-matchday-apply/route");
    const response = await POST(
      new Request("http://localhost/api/resolve/legacy-matchday-apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-initial",
          seasonId: "season-1",
          matchdayId: "matchday-1",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.summary.matchdayResultId).toBe("result-1");
  });

  it("blocks prisma apply route in read-only mode", async () => {
    applyLegacyMatchdayResult.mockResolvedValue({
      ok: false,
      source: "prisma",
      error: "Prisma/Supabase mode is read-only.",
      previewStatus: "blocked",
      canApply: false,
      blockingReasons: ["Prisma/Supabase mode is read-only."],
    });

    const { POST } = await import("@/app/api/resolve/legacy-matchday-apply/route");
    const response = await POST(
      new Request("http://localhost/api/resolve/legacy-matchday-apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-initial",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          source: "prisma",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.blockingReasons).toHaveLength(1);
  });
});
