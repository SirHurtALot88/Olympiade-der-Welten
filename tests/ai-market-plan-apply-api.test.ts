import { beforeEach, describe, expect, it, vi } from "vitest";

const applyAiMarketPlanLocally = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-apply-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/ai-market-plan-apply-service")>(
    "@/lib/ai/ai-market-plan-apply-service",
  );
  return {
    ...actual,
    applyAiMarketPlanLocally,
  };
});

describe("ai market plan apply api", () => {
  beforeEach(() => {
    applyAiMarketPlanLocally.mockReset();
  });

  it("runs local sqlite dry-run by default", async () => {
    applyAiMarketPlanLocally.mockResolvedValue({
      source: "sqlite",
      readOnly: false,
      dryRun: true,
      executed: false,
      status: "ready",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "ai" },
      saveContext: {
        source: "sqlite",
        requestedSaveId: "save-local",
        resolvedSaveId: "save-local",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "Save Local",
        saveStatus: "active",
        scopeWarning: null,
      },
      summary: {
        totalTeams: 1,
        eligibleAiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        plannedSells: 1,
        plannedBuys: 1,
        blockedSells: 0,
        blockedBuys: 0,
        appliedSells: 0,
        appliedBuys: 0,
        warningTeams: 0,
        blockedTeams: 0,
        holdTeams: 0,
        existingHistoryWrites: 0,
        plannedWrites: 2,
        projectedCash: { "A-I": 90 },
        projectedRoster: { "A-I": 3 },
      },
      results: [],
      warnings: [],
      blockingReasons: [],
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/ai/market-plan-apply/route");
    const response = await POST(
      new Request("http://localhost/api/ai/market-plan-apply?saveId=save-local&seasonId=season-1&teamScope=all", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(applyAiMarketPlanLocally).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: null,
      teamScope: "all",
      dryRun: true,
      includeWarningTeams: false,
      confirmToken: null,
      transferPhase: null,
      options: undefined,
    });
    expect(body.dryRun).toBe(true);
  });

  it("blocks prisma mode as read-only", async () => {
    const { POST } = await import("@/app/api/ai/market-plan-apply/route");
    const response = await POST(
      new Request("http://localhost/api/ai/market-plan-apply?saveId=save-ref&seasonId=season-1&source=prisma", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("read-only");
    expect(applyAiMarketPlanLocally).not.toHaveBeenCalled();
  });

  it("requires the explicit confirm token for execute", async () => {
    const { POST } = await import("@/app/api/ai/market-plan-apply/route");
    const response = await POST(
      new Request("http://localhost/api/ai/market-plan-apply?saveId=save-local&seasonId=season-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.confirmTokenRequired).toBe("APPLY_LOCAL_AI_MARKET_PLAN");
    expect(applyAiMarketPlanLocally).not.toHaveBeenCalled();
  });

  it("requires an explicit transfer window phase for execute", async () => {
    const { POST } = await import("@/app/api/ai/market-plan-apply/route");
    const response = await POST(
      new Request("http://localhost/api/ai/market-plan-apply?saveId=save-local&seasonId=season-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: false, confirmToken: "APPLY_LOCAL_AI_MARKET_PLAN" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.transferPhaseRequired).toBe("manual_transfer_window");
    expect(applyAiMarketPlanLocally).not.toHaveBeenCalled();
  });

  it("passes apply options through and supports the market-apply alias route", async () => {
    applyAiMarketPlanLocally.mockResolvedValue({
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "ready",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: "A-I", teamScope: "all" },
      saveContext: {
        source: "sqlite",
        requestedSaveId: "save-local",
        resolvedSaveId: "save-local",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "Save Local",
        saveStatus: "active",
        scopeWarning: null,
      },
      summary: {
        totalTeams: 1,
        eligibleAiTeams: 1,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        plannedSells: 1,
        plannedBuys: 0,
        blockedSells: 0,
        blockedBuys: 0,
        appliedSells: 0,
        appliedBuys: 0,
        warningTeams: 0,
        blockedTeams: 0,
        holdTeams: 0,
        existingHistoryWrites: 0,
        plannedWrites: 1,
        projectedCash: { "A-I": 108 },
        projectedRoster: { "A-I": 3 },
      },
      teams: [],
      results: [],
      warnings: [],
      blockingReasons: [],
      plannedWrites: [],
      appliedAudits: [],
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/ai/market-apply/route");
    const response = await POST(
      new Request("http://localhost/api/ai/market-apply?saveId=save-local&seasonId=season-1&teamCode=A-I", {
        method: "POST",
        body: JSON.stringify({
          dryRun: true,
          options: {
            includeWarningTeams: true,
            applySellSteps: true,
            applyBuySteps: false,
            maxBuysPerTeam: 0,
            stopOnTeamFailure: true,
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(applyAiMarketPlanLocally).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamId: "A-I",
      teamScope: "ai",
      dryRun: true,
      includeWarningTeams: false,
      confirmToken: null,
      transferPhase: null,
      options: {
        includeWarningTeams: true,
        applySellSteps: true,
        applyBuySteps: false,
        maxBuysPerTeam: 0,
        stopOnTeamFailure: true,
      },
    });
  });
});
