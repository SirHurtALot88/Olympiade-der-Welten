import { beforeEach, describe, expect, it, vi , afterEach} from "vitest";

const runAiPicksExecutePreview = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview,
}));

describe("ai picks run api", () => {
  // Legacy-Pfad-Suite: organic (jetzt Default-ON) hier per Opt-out (=0) ab.
  beforeEach(() => {
    process.env.OLY_ORGANIC_SQUAD_BUILDER = "0";
    runAiPicksExecutePreview.mockReset();
  });
  afterEach(() => {
    delete process.env.OLY_ORGANIC_SQUAD_BUILDER;
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
