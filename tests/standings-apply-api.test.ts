import { beforeEach, describe, expect, it, vi } from "vitest";

const previewStandingsApply = vi.fn();
const executeStandingsApply = vi.fn();

vi.mock("@/lib/standings/standings-apply-service", () => ({
  previewStandingsApply,
  executeStandingsApply,
}));

describe("standings apply api", () => {
  beforeEach(() => {
    previewStandingsApply.mockReset();
    executeStandingsApply.mockReset();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/standings/apply/route");
    const response = await POST(
      new Request("http://localhost/api/standings/apply", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns dry-run summary for local preview", async () => {
    previewStandingsApply.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: true,
      applied: false,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      plannedChanges: [],
      tieGroups: [],
      scope: { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" },
      idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: null,
      summary: { totalTeams: 32, readyTeams: 32, blockedTeams: 0 },
    });

    const { POST } = await import("@/app/api/standings/apply/route");
    const response = await POST(
      new Request("http://localhost/api/standings/apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.summary.idempotencyKey).toBe("standings-apply:save-local:season-1:matchday-1");
    expect(executeStandingsApply).not.toHaveBeenCalled();
  });

  it("returns execute summary when confirm is present", async () => {
    executeStandingsApply.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: false,
      applied: true,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      plannedChanges: [],
      tieGroups: [],
      scope: { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" },
      idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: "standings-apply-audit__save-local__season-1__matchday-1",
      summary: { totalTeams: 32, readyTeams: 32, blockedTeams: 0 },
    });

    const { POST } = await import("@/app/api/standings/apply/route");
    const response = await POST(
      new Request("http://localhost/api/standings/apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          execute: true,
          confirm: "APPLY_LOCAL_STANDINGS",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.applied).toBe(true);
    expect(previewStandingsApply).not.toHaveBeenCalled();
  });

  it("blocks prisma apply route in read-only mode", async () => {
    previewStandingsApply.mockResolvedValue({
      ok: false,
      source: "prisma",
      dryRun: true,
      applied: false,
      canApply: false,
      blockingReasons: ["Prisma/Supabase mode is read-only. Standings Apply is only allowed in the local SQLite test save."],
      warnings: [],
      plannedChanges: [],
      tieGroups: [],
      scope: { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" },
      idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: null,
      summary: { totalTeams: 0, readyTeams: 0, blockedTeams: 0 },
    });

    const { POST } = await import("@/app/api/standings/apply/route");
    const response = await POST(
      new Request("http://localhost/api/standings/apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          source: "prisma",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.blockingReasons[0]).toContain("read-only");
  });
});
