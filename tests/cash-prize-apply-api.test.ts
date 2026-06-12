import { beforeEach, describe, expect, it, vi } from "vitest";

const previewCashPrizeApply = vi.fn();
const executeCashPrizeApply = vi.fn();

vi.mock("@/lib/season/cash-prize-apply-service", () => ({
  previewCashPrizeApply,
  executeCashPrizeApply,
}));

describe("cash prize apply api", () => {
  beforeEach(() => {
    previewCashPrizeApply.mockReset();
    executeCashPrizeApply.mockReset();
  });

  it("validates required parameters", async () => {
    const { POST } = await import("@/app/api/season/cash-prize-apply/route");
    const response = await POST(
      new Request("http://localhost/api/season/cash-prize-apply", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns dry-run preview without writes", async () => {
    previewCashPrizeApply.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: true,
      applied: false,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      plannedChanges: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/season/cash-prize-apply/route");
    const response = await POST(
      new Request("http://localhost/api/season/cash-prize-apply", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(previewCashPrizeApply).toHaveBeenCalled();
    expect(executeCashPrizeApply).not.toHaveBeenCalled();
    expect(body.dryRun).toBe(true);
  });

  it("returns execute summary when confirm is present", async () => {
    executeCashPrizeApply.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: false,
      applied: true,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      plannedChanges: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: "cash-prize-apply-audit__save-local__season-1__matchday-1",
    });

    const { POST } = await import("@/app/api/season/cash-prize-apply/route");
    const response = await POST(
      new Request("http://localhost/api/season/cash-prize-apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          execute: true,
          confirm: "APPLY_LOCAL_CASH_PRIZE",
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.applied).toBe(true);
  });

  it("blocks prisma mode as read-only", async () => {
    previewCashPrizeApply.mockResolvedValue({
      ok: false,
      source: "prisma",
      dryRun: true,
      applied: false,
      canApply: false,
      blockingReasons: ["Prisma/Supabase mode is read-only. Cash Apply is only allowed in the local SQLite test save."],
      warnings: [],
      plannedChanges: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/season/cash-prize-apply/route");
    const response = await POST(
      new Request("http://localhost/api/season/cash-prize-apply", {
        method: "POST",
        body: JSON.stringify({ saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1", source: "prisma" }),
      }),
    );

    expect(response.status).toBe(409);
  });

  it("passes the explicit season-end phase through to the preview service", async () => {
    previewCashPrizeApply.mockResolvedValue({
      ok: true,
      source: "sqlite",
      dryRun: true,
      applied: false,
      canApply: true,
      blockingReasons: [],
      warnings: [],
      plannedChanges: [],
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
      duplicateDetected: false,
      auditLogId: null,
    });

    const { POST } = await import("@/app/api/season/cash-prize-apply/route");
    await POST(
      new Request("http://localhost/api/season/cash-prize-apply", {
        method: "POST",
        body: JSON.stringify({
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          phase: "season_end",
        }),
      }),
    );

    expect(previewCashPrizeApply).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "season_end",
      }),
    );
  });
});
