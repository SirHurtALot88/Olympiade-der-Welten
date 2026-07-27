import { beforeEach, describe, expect, it, vi } from "vitest";

import { SaveResolutionError } from "@/lib/persistence/resolve-local-save";

// Regression coverage for today's S4 strict-save-id change: `requireLocalPersistedSave` now
// throws `SaveResolutionError` (400 save_id_required / 404 save_not_found) instead of silently
// falling back to the active save. Six `app/api/lineups/legacy/**` routes call into that resolver
// transitively via `lib/lineups/legacy-lineup-local-service.ts` and, until this fix, did not catch
// the throw -- an unresolvable/stale saveId produced an unhandled 500 with a non-JSON body instead
// of a clean 400/404. These tests assert each route now maps the error the same way the sibling
// `ai-batch-apply` route already did (`{ error: code, message }` with the resolver's status).

const getLocalLegacyLineupDraft = vi.fn();
const saveLocalLegacyLineupDraft = vi.fn();
const calculateLocalLegacyLineupPreview = vi.fn();
const generateLocalLegacyFormCardsForSeason = vi.fn();
const saveLocalLegacyFormCardPlan = vi.fn();
const ensureLocalLegacyFormCardsForSeason = vi.fn();
const loadLocalLegacyLineupContext = vi.fn();

vi.mock("@/lib/lineups/legacy-lineup-local-service", () => ({
  getLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraft,
  calculateLocalLegacyLineupPreview,
  generateLocalLegacyFormCardsForSeason,
  saveLocalLegacyFormCardPlan,
  ensureLocalLegacyFormCardsForSeason,
  loadLocalLegacyLineupContext,
}));

const buildLegacyLineupPreview = vi.fn();
vi.mock("@/lib/lineups/legacy-lineup-context-loader", () => ({
  buildLegacyLineupPreview,
  LegacyLineupContextLoader: class {
    loadLegacyLineupContext = vi.fn();
  },
}));

vi.mock("@/lib/lineups/legacy-lineup-service", () => ({
  LegacyLineupService: class {
    getLegacyLineupDraft = vi.fn();
    calculateLegacyLineupPreview = vi.fn();
  },
}));

const getSaveById = vi.fn();
const getSaveVersionMetadata = vi.fn();
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById,
    getSaveVersionMetadata,
  }),
}));

const authorizeServerRoomWrite = vi.fn();
vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite,
}));

vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({
  notifyRoomGameplayWrite: vi.fn(),
}));

const buildAiLegacyLineupModifiers = vi.fn();
vi.mock("@/lib/ai/ai-legacy-lineup-batch-apply-service", () => ({
  buildAiLegacyLineupModifiers,
  applyAiLegacyLineupBatchLocally: vi.fn(),
}));

const buildAiLegacyLineupPreview = vi.fn();
vi.mock("@/lib/ai/ai-legacy-lineup-engine", () => ({
  buildAiLegacyLineupPreview,
}));

describe("legacy lineup routes map SaveResolutionError instead of crashing", () => {
  beforeEach(() => {
    getLocalLegacyLineupDraft.mockReset();
    saveLocalLegacyLineupDraft.mockReset();
    calculateLocalLegacyLineupPreview.mockReset();
    generateLocalLegacyFormCardsForSeason.mockReset();
    saveLocalLegacyFormCardPlan.mockReset();
    ensureLocalLegacyFormCardsForSeason.mockReset();
    loadLocalLegacyLineupContext.mockReset();
    buildLegacyLineupPreview.mockReset();
    getSaveById.mockReset();
    getSaveVersionMetadata.mockReset();
    authorizeServerRoomWrite.mockReset();
    authorizeServerRoomWrite.mockReturnValue({ allowed: true, warnings: [] });
    buildAiLegacyLineupModifiers.mockReset();
    buildAiLegacyLineupPreview.mockReset();
  });

  it("GET /api/lineups/legacy maps save_not_found to 404", async () => {
    getLocalLegacyLineupDraft.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save stale-save could not be resolved.");
    });

    const { GET } = await import("@/app/api/lineups/legacy/route");
    const response = await GET(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=stale-save&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
    expect(typeof body.message).toBe("string");
  });

  it("PUT /api/lineups/legacy maps save_not_found to 404 (race between existence check and write)", async () => {
    // Simulates the multi-tab race called out in the bug report: the save still existed for the
    // pre-write `getSaveById` check, but was pruned/replaced before `saveLocalLegacyLineupDraft`
    // (which re-resolves strictly) actually ran.
    getSaveById.mockReturnValue({
      saveId: "save-1",
      gameState: {
        gamePhase: "season_active",
        season: { id: "season-1", currentMatchday: 5 },
        matchdayState: { matchdayId: "matchday-1", status: "open" },
      },
    });
    saveLocalLegacyLineupDraft.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save save-1 could not be resolved.");
    });

    const { PUT } = await import("@/app/api/lineups/legacy/route");
    const response = await PUT(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "PUT", body: JSON.stringify({ entries: [] }) },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
  });

  it("GET /api/lineups/legacy/preview maps save_id_required to 400", async () => {
    calculateLocalLegacyLineupPreview.mockImplementation(() => {
      throw new SaveResolutionError("save_id_required", "A saveId is required for this write.");
    });

    const { GET } = await import("@/app/api/lineups/legacy/preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/lineups/legacy/preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("save_id_required");
  });

  it("POST /api/lineups/legacy/preview maps save_not_found to 404", async () => {
    calculateLocalLegacyLineupPreview.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save save-1 could not be resolved.");
    });

    const { POST } = await import("@/app/api/lineups/legacy/preview/route");
    const response = await POST(
      new Request(
        "http://localhost/api/lineups/legacy/preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "POST", body: JSON.stringify({ entries: [] }) },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
  });

  it("POST /api/lineups/legacy/form-cards maps save_not_found to 404", async () => {
    generateLocalLegacyFormCardsForSeason.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save save-1 could not be resolved.");
    });

    const { POST } = await import("@/app/api/lineups/legacy/form-cards/route");
    const response = await POST(
      new Request(
        "http://localhost/api/lineups/legacy/form-cards?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "POST" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
    expect(authorizeServerRoomWrite).toHaveBeenCalled();
  });

  it("PUT /api/lineups/legacy/form-card-plan maps save_id_required to 400", async () => {
    saveLocalLegacyFormCardPlan.mockImplementation(() => {
      throw new SaveResolutionError("save_id_required", "A saveId is required for this write.");
    });

    const { PUT } = await import("@/app/api/lineups/legacy/form-card-plan/route");
    const response = await PUT(
      new Request(
        "http://localhost/api/lineups/legacy/form-card-plan?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "PUT", body: JSON.stringify({ disciplineSide: "d1" }) },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("save_id_required");
  });

  it("POST /api/lineups/legacy/finalize-transfers maps save_not_found to 404", async () => {
    ensureLocalLegacyFormCardsForSeason.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save save-1 could not be resolved.");
    });

    const { POST } = await import("@/app/api/lineups/legacy/finalize-transfers/route");
    const response = await POST(
      new Request(
        "http://localhost/api/lineups/legacy/finalize-transfers?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "POST" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
  });

  it("GET /api/lineups/legacy/ai-preview maps save_not_found to 404", async () => {
    loadLocalLegacyLineupContext.mockImplementation(() => {
      throw new SaveResolutionError("save_not_found", "Save save-1 could not be resolved.");
    });

    const { GET } = await import("@/app/api/lineups/legacy/ai-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/lineups/legacy/ai-preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("save_not_found");
    expect(buildAiLegacyLineupPreview).not.toHaveBeenCalled();
  });

  it("GET /api/lineups/legacy/ai-preview maps save_id_required to 400", async () => {
    loadLocalLegacyLineupContext.mockImplementation(() => {
      throw new SaveResolutionError("save_id_required", "A saveId is required for this write.");
    });

    const { GET } = await import("@/app/api/lineups/legacy/ai-preview/route");
    const response = await GET(
      new Request(
        "http://localhost/api/lineups/legacy/ai-preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("save_id_required");
  });

  it("a valid saveId still succeeds unchanged on all six routes", async () => {
    getLocalLegacyLineupDraft.mockReturnValue({
      lineupId: "lineup-1",
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      status: "draft",
      entries: [],
      createdAt: "2026-06-04T12:00:00.000Z",
      updatedAt: "2026-06-04T12:00:00.000Z",
    });
    const { GET: getDraft } = await import("@/app/api/lineups/legacy/route");
    const draftResponse = await getDraft(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    expect(draftResponse.status).toBe(200);

    getSaveById.mockReturnValue({
      saveId: "save-1",
      gameState: {
        gamePhase: "season_active",
        season: { id: "season-1", currentMatchday: 5 },
        matchdayState: { matchdayId: "matchday-1", status: "open" },
      },
    });
    getSaveVersionMetadata.mockReturnValue({ saveVersion: 1, contentSignature: "sig" });
    saveLocalLegacyLineupDraft.mockReturnValue({
      ok: true,
      draft: { lineupId: "lineup-1", entries: [] },
      warnings: [],
    });
    const { PUT } = await import("@/app/api/lineups/legacy/route");
    const putResponse = await PUT(
      new Request(
        "http://localhost/api/lineups/legacy?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "PUT", body: JSON.stringify({ entries: [] }) },
      ),
    );
    expect(putResponse.status).toBe(200);

    calculateLocalLegacyLineupPreview.mockReturnValue({ ok: true, warnings: [], validation: { isValid: true, errors: [], warnings: [] } });
    const { GET: getPreview } = await import("@/app/api/lineups/legacy/preview/route");
    const previewResponse = await getPreview(
      new Request(
        "http://localhost/api/lineups/legacy/preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    expect(previewResponse.status).toBe(200);

    generateLocalLegacyFormCardsForSeason.mockReturnValue({
      ok: true,
      seasonId: "season-1",
      rosterPlayerCount: 0,
      coveredPlayerCount: 0,
      coveredTeamCount: 0,
      generatedCardCount: 0,
      replacedCardCount: 0,
      scrubbedSelectionCount: 0,
      warnings: [],
    });
    const { POST: postFormCards } = await import("@/app/api/lineups/legacy/form-cards/route");
    const formCardsResponse = await postFormCards(
      new Request(
        "http://localhost/api/lineups/legacy/form-cards?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "POST" },
      ),
    );
    expect(formCardsResponse.status).toBe(200);

    saveLocalLegacyFormCardPlan.mockReturnValue({ ok: true, plans: [], errors: [], warnings: [] });
    const { PUT: putFormCardPlan } = await import("@/app/api/lineups/legacy/form-card-plan/route");
    const formCardPlanResponse = await putFormCardPlan(
      new Request(
        "http://localhost/api/lineups/legacy/form-card-plan?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "PUT", body: JSON.stringify({ disciplineSide: "d1" }) },
      ),
    );
    expect(formCardPlanResponse.status).toBe(200);

    ensureLocalLegacyFormCardsForSeason.mockReturnValue({
      ok: true,
      seasonId: "season-1",
      generatedCardCount: 0,
      existingCardCount: 0,
      warnings: [],
    });
    const { POST: postFinalizeTransfers } = await import("@/app/api/lineups/legacy/finalize-transfers/route");
    const finalizeResponse = await postFinalizeTransfers(
      new Request(
        "http://localhost/api/lineups/legacy/finalize-transfers?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
        { method: "POST" },
      ),
    );
    expect(finalizeResponse.status).toBe(200);

    loadLocalLegacyLineupContext.mockReturnValue({
      ok: true,
      warnings: [],
      context: { teamId: "A-A", team: { name: "Alpha" }, matchdayId: "matchday-1", captainRule: { seasonCaptainSlots: 3 } },
    });
    buildAiLegacyLineupModifiers.mockReturnValue({ d1: {}, d2: {} });
    buildAiLegacyLineupPreview.mockReturnValue({
      d1: { disciplineSide: "d1", warnings: [], missingSlots: 0, selectedPlayers: 2, requiredPlayers: 2, expectedScore: 10, captainSelectionStatus: "ok", captainName: null },
      d2: { disciplineSide: "d2", warnings: [], missingSlots: 0, selectedPlayers: 2, requiredPlayers: 2, expectedScore: 10, captainSelectionStatus: "ok", captainName: null },
      warnings: [],
      captainSlotsRemaining: 3,
      entries: [],
    });
    const { GET: getAiPreview } = await import("@/app/api/lineups/legacy/ai-preview/route");
    const aiPreviewResponse = await getAiPreview(
      new Request(
        "http://localhost/api/lineups/legacy/ai-preview?saveId=save-1&seasonId=season-1&matchdayId=matchday-1&teamId=A-A",
      ),
    );
    expect(aiPreviewResponse.status).toBe(200);
  }, 20000);
});
