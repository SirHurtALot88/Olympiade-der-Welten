import { beforeEach, describe, expect, it, vi } from "vitest";

const previewMatchdayAdvance = vi.fn();
const executeMatchdayAdvance = vi.fn();

vi.mock("@/lib/season/matchday-progress-service", () => ({
  previewMatchdayAdvance,
  executeMatchdayAdvance,
}));

describe("matchday progress api", () => {
  beforeEach(() => {
    previewMatchdayAdvance.mockReset();
    executeMatchdayAdvance.mockReset();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/season/advance-matchday/route");
    const response = await POST(
      new Request("http://localhost/api/season/advance-matchday", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns dry-run preview without writes", async () => {
    previewMatchdayAdvance.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: true,
      applied: false,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        currentMatchdayId: "matchday-1",
        nextMatchdayId: "matchday-2",
      },
      summary: {
        currentMatchdayIndex: 1,
        nextMatchdayIndex: 2,
        currentMatchdayLabel: "Spieltag 1",
        nextMatchdayLabel: "Spieltag 2",
        lockedLineups: 32,
        resolvedFixtures: 1,
        resultApplied: true,
        standingsApplied: true,
        cashApplied: true,
      },
      duplicateDetected: false,
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/season/advance-matchday/route");
    const response = await POST(
      new Request("http://localhost/api/season/advance-matchday", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local", seasonId: "season-1" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewMatchdayAdvance).toHaveBeenCalled();
    expect(executeMatchdayAdvance).not.toHaveBeenCalled();
    expect(body.dryRun).toBe(true);
  });

  it("returns execute summary when confirm is present", async () => {
    executeMatchdayAdvance.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: false,
      applied: true,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        currentMatchdayId: "matchday-1",
        nextMatchdayId: "matchday-2",
      },
      summary: {
        currentMatchdayIndex: 1,
        nextMatchdayIndex: 2,
        currentMatchdayLabel: "Spieltag 1",
        nextMatchdayLabel: "Spieltag 2",
        lockedLineups: 32,
        resolvedFixtures: 1,
        resultApplied: true,
        standingsApplied: true,
        cashApplied: true,
      },
      duplicateDetected: false,
      auditLogId: "matchday-advance-audit__save-local__season-1__matchday-1__matchday-2",
    });

    const { POST } = await import("@/app/api/season/advance-matchday/route");
    const response = await POST(
      new Request("http://localhost/api/season/advance-matchday", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          execute: true,
          confirm: "ADVANCE_LOCAL_MATCHDAY",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.applied).toBe(true);
  });

  it("blocks prisma mode as read-only", async () => {
    previewMatchdayAdvance.mockResolvedValue({
      ok: false,
      source: "prisma",
      dryRun: true,
      applied: false,
      canApply: false,
      blockingReasons: ["Prisma/Supabase mode is read-only. Matchday progress is only allowed in the local SQLite test save."],
      warnings: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        currentMatchdayId: "",
        nextMatchdayId: null,
      },
      summary: {
        currentMatchdayIndex: 0,
        nextMatchdayIndex: null,
        currentMatchdayLabel: "—",
        nextMatchdayLabel: null,
        lockedLineups: 0,
        resolvedFixtures: 0,
        resultApplied: false,
        standingsApplied: false,
        cashApplied: false,
      },
      duplicateDetected: false,
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/season/advance-matchday/route");
    const response = await POST(
      new Request("http://localhost/api/season/advance-matchday", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local", seasonId: "season-1", source: "prisma" }),
      }),
    );

    expect(response.status).toBe(409);
  });
});
