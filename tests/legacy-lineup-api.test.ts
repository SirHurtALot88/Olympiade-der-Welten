import { beforeEach, describe, expect, it, vi } from "vitest";

const getLocalLegacyLineupDraft = vi.fn();
const saveLocalLegacyLineupDraft = vi.fn();
const calculateLocalLegacyLineupPreview = vi.fn();
const buildLegacyLineupPreview = vi.fn();
const getLegacyLineupDraft = vi.fn();
const calculateLegacyLineupPreview = vi.fn();

vi.mock("@/lib/lineups/legacy-lineup-local-service", () => ({
  getLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraft,
  calculateLocalLegacyLineupPreview,
}));

vi.mock("@/lib/lineups/legacy-lineup-context-loader", () => ({
  buildLegacyLineupPreview,
}));

vi.mock("@/lib/lineups/legacy-lineup-service", () => ({
  LegacyLineupService: class {
    getLegacyLineupDraft = getLegacyLineupDraft;
    calculateLegacyLineupPreview = calculateLegacyLineupPreview;
  },
}));

const legacyLineupRouteModulePromise = import("@/app/api/lineups/legacy/route");
const legacyLineupPreviewRouteModulePromise = import("@/app/api/lineups/legacy/preview/route");

describe("legacy lineup api routes", () => {
  beforeEach(() => {
    getLocalLegacyLineupDraft.mockReset();
    saveLocalLegacyLineupDraft.mockReset();
    calculateLocalLegacyLineupPreview.mockReset();
    buildLegacyLineupPreview.mockReset();
    getLegacyLineupDraft.mockReset();
    calculateLegacyLineupPreview.mockReset();
  });

  it("reads local sqlite draft data by default", async () => {
    getLocalLegacyLineupDraft.mockReturnValue({
      lineupId: "lineup-1",
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      status: "draft",
      entries: [],
      createdAt: "2026-06-04T12:00:00.000Z",
      updatedAt: "2026-06-04T12:00:00.000Z",
    });

    const { GET } = await legacyLineupRouteModulePromise;
    const response = await GET(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=save-local&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("sqlite");
    expect(body.readOnly).toBe(false);
    expect(getLocalLegacyLineupDraft).toHaveBeenCalledTimes(1);
    expect(getLegacyLineupDraft).not.toHaveBeenCalled();
  }, 20000);

  it("blocks prisma lineup writes", async () => {
    const { PUT } = await legacyLineupRouteModulePromise;
    const response = await PUT(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=save-initial&seasonId=season-1&matchdayId=matchday-1&teamId=A-A&source=prisma",
        {
          method: "PUT",
          body: JSON.stringify({ entries: [] }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("read-only");
    expect(saveLocalLegacyLineupDraft).not.toHaveBeenCalled();
  });

  it("uses local sqlite preview by default", async () => {
    calculateLocalLegacyLineupPreview.mockReturnValue({
      ok: true,
      contextMeta: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        teamId: "A-A",
        d1DisciplineId: "mini-dm",
        d2DisciplineId: "fechten",
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      disciplineSideScores: [],
      scorePreview: {
        entries: [],
        baseScore: 42,
        captainBonusTotal: 0,
        totalScore: 42,
        missingScores: [],
        validationWarnings: [],
      },
      warnings: [],
    });

    const { POST } = await legacyLineupPreviewRouteModulePromise;
    const response = await POST(
      new Request(
        "http://localhost/api/lineups/legacy/preview?saveId=save-local&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        {
          method: "POST",
          body: JSON.stringify({ entries: [] }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("sqlite");
    expect(body.readOnly).toBe(false);
    expect(calculateLocalLegacyLineupPreview).toHaveBeenCalledTimes(1);
    expect(buildLegacyLineupPreview).not.toHaveBeenCalled();
  }, 20000);
});
