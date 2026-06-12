import { beforeEach, describe, expect, it, vi } from "vitest";

const runAiPicksExecutePreview = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview,
}));

describe("ai picks run api", () => {
  beforeEach(() => {
    runAiPicksExecutePreview.mockReset();
  });

  it("passes preview params through to the service", async () => {
    runAiPicksExecutePreview.mockResolvedValue({
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "ready",
      scope: { saveId: "save-1", seasonId: "season-1", teamScope: "all", allowSetupAllTeams: true },
      saveContext: null,
      preflight: null,
      qualityGate: null,
      globalPreview: null,
      globalExecution: null,
      teams: [],
      historyCheck: null,
      warnings: [],
      blockingReasons: [],
    });

    const { POST } = await import("@/app/api/ai/picks-run/route");
    const request = new Request("http://localhost/api/ai/picks-run?saveId=save-1&seasonId=season-1", {
      method: "POST",
      body: JSON.stringify({
        dryRun: true,
        teamScope: "all",
        allowSetupAllTeams: true,
        stepsPerTeam: 4,
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(runAiPicksExecutePreview).toHaveBeenCalledWith({
      source: "sqlite",
      saveId: "save-1",
      seasonId: "season-1",
      dryRun: true,
      confirmToken: null,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: 4,
      runMode: "default",
    });
  });

  it("requires the explicit execute confirm token", async () => {
    const { POST } = await import("@/app/api/ai/picks-run/route");
    const request = new Request("http://localhost/api/ai/picks-run?saveId=save-1&seasonId=season-1", {
      method: "POST",
      body: JSON.stringify({
        dryRun: false,
        teamScope: "all",
        allowSetupAllTeams: true,
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "AI picks execute requires the explicit confirm token.",
      confirmTokenRequired: "EXECUTE_AI_PICK_RUN",
    });
  });
});
