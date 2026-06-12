import { beforeEach, describe, expect, it, vi } from "vitest";

const runAutoRosterFillForMatchdaySetup = vi.fn();

vi.mock("@/lib/ai/auto-roster-fill-service", () => ({
  runAutoRosterFillForMatchdaySetup,
}));

describe("auto roster fill api", () => {
  beforeEach(() => {
    runAutoRosterFillForMatchdaySetup.mockReset();
  });

  it("requires explicit confirm token for execute", async () => {
    const { POST } = await import("@/app/api/ai/roster-fill/route");

    const response = await POST(
      new Request("http://localhost:3000/api/ai/roster-fill?saveId=save-1&seasonId=season-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      }),
    );

    expect(response.status).toBe(409);
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("runs the local roster-fill service in dry-run mode", async () => {
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "ready",
      saveContext: {
        source: "sqlite",
        requestedSaveId: "save-1",
        resolvedSaveId: "save-1",
        requestedSeasonId: "season-1",
        resolvedSeasonId: "season-1",
        saveName: "Smoke Save",
        saveStatus: "active",
        scopeWarning: null,
      },
      summary: {
        totalTeams: 32,
        targetResolvedTeams: 32,
        missingTargetTeams: 0,
        teamsNeedingBuys: 12,
        alreadyAtTargetTeams: 20,
        filledTeams: 0,
        partialTeams: 0,
        blockedTeams: 0,
        plannedBuys: 18,
        appliedBuys: 0,
        historyWrites: 0,
      },
      teams: [],
      warnings: [],
      blockingReasons: [],
    });

    const { POST } = await import("@/app/api/ai/roster-fill/route");

    const response = await POST(
      new Request("http://localhost:3000/api/ai/roster-fill?saveId=save-1&seasonId=season-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runAutoRosterFillForMatchdaySetup).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-1",
      seasonId: "season-1",
      dryRun: true,
      confirmToken: null,
    });
    expect(body.summary.plannedBuys).toBe(18);
  });
});
