import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiLegacyLineupPreview = vi.fn();
const loadLocalLegacyLineupContext = vi.fn();
const loadLocalLegacyLineupContextFromGameState = vi.fn();
const loadLegacyLineupContext = vi.fn();
const createPersistenceService = vi.fn();
const saveLocalLegacyLineupDraft = vi.fn();
const saveLocalLegacyLineupDraftBatch = vi.fn();
const getLocalLegacyLineupDraft = vi.fn();
const calculateLocalLegacyLineupPreview = vi.fn();
const calculateLocalLegacyLineupPreviewFromContext = vi.fn();
const ensureLocalLegacyFormCardsForSeason = vi.fn();

const db = {
  save: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  season: {
    findFirst: vi.fn(),
  },
  matchday: {
    findFirst: vi.fn(),
  },
  teamSeasonState: {
    findMany: vi.fn(),
  },
} as const;

vi.mock("@/lib/ai/ai-legacy-lineup-engine", () => ({
  buildAiLegacyLineupPreview,
}));

vi.mock("@/lib/lineups/legacy-lineup-local-service", () => ({
  loadLocalLegacyLineupContext,
  loadLocalLegacyLineupContextFromGameState,
  saveLocalLegacyLineupDraft,
  saveLocalLegacyLineupDraftBatch,
  getLocalLegacyLineupDraft,
  calculateLocalLegacyLineupPreview,
  calculateLocalLegacyLineupPreviewFromContext,
  ensureLocalLegacyFormCardsForSeason,
}));

vi.mock("@/lib/lineups/legacy-lineup-context-loader", () => ({
  LegacyLineupContextLoader: class {
    loadLegacyLineupContext = loadLegacyLineupContext;
  },
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService,
}));

vi.mock("@/src/server/db", () => ({
  db,
}));

const aiLegacyLineupPreviewRouteModulePromise = import("@/app/api/lineups/legacy/ai-preview/route");
const aiLegacyLineupBatchPreviewRouteModulePromise = import("@/app/api/lineups/legacy/ai-batch-preview/route");
const aiLegacyLineupBatchApplyRouteModulePromise = import("@/app/api/lineups/legacy/ai-batch-apply/route");

describe("ai legacy lineup preview api", () => {
  beforeEach(() => {
    buildAiLegacyLineupPreview.mockReset();
    loadLocalLegacyLineupContext.mockReset();
    loadLocalLegacyLineupContextFromGameState.mockReset();
    loadLegacyLineupContext.mockReset();
    createPersistenceService.mockReset();
    saveLocalLegacyLineupDraft.mockReset();
    saveLocalLegacyLineupDraftBatch.mockReset();
    getLocalLegacyLineupDraft.mockReset();
    calculateLocalLegacyLineupPreview.mockReset();
    calculateLocalLegacyLineupPreviewFromContext.mockReset();
    ensureLocalLegacyFormCardsForSeason.mockReset();
    ensureLocalLegacyFormCardsForSeason.mockReturnValue({
      ok: true,
      warnings: [],
      generatedCardCount: 0,
      existingCardCount: 0,
    });
    loadLocalLegacyLineupContextFromGameState.mockImplementation((gameState, params) =>
      loadLocalLegacyLineupContext(params),
    );
    calculateLocalLegacyLineupPreviewFromContext.mockImplementation((context, entries, modifiers, fatigueByPlayerId) =>
      calculateLocalLegacyLineupPreview(context, entries, modifiers, fatigueByPlayerId),
    );
    saveLocalLegacyLineupDraftBatch.mockImplementation((drafts) => {
      for (const draft of drafts) {
        saveLocalLegacyLineupDraft(draft.params, draft.entries, draft.modifiers);
      }
      return { ok: true, warnings: [], drafts: [] };
    });
    db.save.findUnique.mockReset();
    db.save.findFirst.mockReset();
    db.season.findFirst.mockReset();
    db.matchday.findFirst.mockReset();
    db.teamSeasonState.findMany.mockReset();
  });

  it("uses local sqlite by default and stays read-only", async () => {
    loadLocalLegacyLineupContext.mockReturnValue({
      ok: true,
      warnings: [],
      context: {
        teamId: "A-A",
        team: { name: "Armageddon Aftermath" },
        matchdayId: "matchday-1",
      },
    });
    buildAiLegacyLineupPreview.mockReturnValue({
      source: "sqlite",
      readOnly: true,
      teamId: "A-A",
      teamName: "Armageddon Aftermath",
      matchdayId: "matchday-1",
      captainRuleStatus: "mapped_with_transform",
      expectedScore: 123,
      warnings: [],
      debugReasoning: [],
      d1: { disciplineId: "tdm", disciplineSide: "d1", disciplineName: "TDM", requiredPlayers: 2, selectedPlayers: 2, captainActivePlayerId: "a1", captainPlayerId: "p1", captainName: "Player 1", expectedScore: 60, fatigueWarnings: [], reasoning: [] },
      d2: { disciplineId: "mini-dm", disciplineSide: "d2", disciplineName: "Mini DM", requiredPlayers: 2, selectedPlayers: 2, captainActivePlayerId: "a3", captainPlayerId: "p3", captainName: "Player 3", expectedScore: 63, fatigueWarnings: [], reasoning: [] },
      entries: [],
      scorePreview: { entries: [], totalScore: 123, missingScores: [], validationWarnings: [] },
    });

    const { GET } = await aiLegacyLineupPreviewRouteModulePromise;
    const response = await GET(
      new Request("http://localhost/api/lineups/legacy/ai-preview?saveId=save-local&seasonId=season-1&matchdayId=matchday-1&teamId=A-A"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadLocalLegacyLineupContext).toHaveBeenCalledTimes(1);
    expect(loadLegacyLineupContext).not.toHaveBeenCalled();
    expect(buildAiLegacyLineupPreview).toHaveBeenCalledWith(expect.any(Object), "sqlite");
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("sqlite");
  }, 20000);

  it("supports prisma as read-only reference source", async () => {
    loadLegacyLineupContext.mockResolvedValue({
      ok: true,
      warnings: [],
      context: {
        teamId: "A-A",
        team: { name: "Armageddon Aftermath" },
        matchdayId: "matchday-1",
      },
    });
    buildAiLegacyLineupPreview.mockReturnValue({
      source: "prisma",
      readOnly: true,
      teamId: "A-A",
      teamName: "Armageddon Aftermath",
      matchdayId: "matchday-1",
      captainRuleStatus: "mapped_with_transform",
      expectedScore: 120,
      warnings: [],
      debugReasoning: [],
      d1: { disciplineId: "tdm", disciplineSide: "d1", disciplineName: "TDM", requiredPlayers: 2, selectedPlayers: 2, captainActivePlayerId: null, captainPlayerId: null, captainName: null, expectedScore: 60, fatigueWarnings: [], reasoning: [] },
      d2: { disciplineId: "mini-dm", disciplineSide: "d2", disciplineName: "Mini DM", requiredPlayers: 2, selectedPlayers: 2, captainActivePlayerId: null, captainPlayerId: null, captainName: null, expectedScore: 60, fatigueWarnings: [], reasoning: [] },
      entries: [],
      scorePreview: { entries: [], totalScore: 120, missingScores: [], validationWarnings: [] },
    });

    const { GET } = await aiLegacyLineupPreviewRouteModulePromise;
    const response = await GET(
      new Request("http://localhost/api/lineups/legacy/ai-preview?saveId=save-ref&seasonId=season-1&matchdayId=matchday-1&teamId=A-A&source=prisma"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(loadLegacyLineupContext).toHaveBeenCalledTimes(1);
    expect(loadLocalLegacyLineupContext).not.toHaveBeenCalled();
    expect(buildAiLegacyLineupPreview).toHaveBeenCalledWith(expect.any(Object), "prisma");
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("prisma");
  });

  it("builds a read-only batch preview for all local teams", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"] },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [
              { teamId: "A-A", shortCode: "A-A", name: "Alpha" },
              { teamId: "B-B", shortCode: "B-B", name: "Beta" },
            ],
          },
        },
      }),
      getSaveById: () => null,
      getActiveSave: () => null,
    });

    loadLocalLegacyLineupContext
      .mockReturnValueOnce({ ok: true, warnings: [], context: { teamId: "A-A" } })
      .mockReturnValueOnce({ ok: true, warnings: [], context: { teamId: "B-B" } });
    buildAiLegacyLineupPreview
      .mockReturnValueOnce({
        teamId: "A-A",
        teamCode: "A-A",
        teamName: "Alpha",
        status: "ready",
        explanation: "Alpha ready",
        totalExpectedScore: 222,
        warnings: [],
        d1: { status: "ready", disciplineName: "TDM", selectedPlayers: 3, requiredPlayers: 3, missingSlots: 0, captainName: "Captain A" },
        d2: { status: "ready", disciplineName: "Mini DM", selectedPlayers: 2, requiredPlayers: 2, missingSlots: 0, captainName: "Captain B" },
      })
      .mockReturnValueOnce({
        teamId: "B-B",
        teamCode: "B-B",
        teamName: "Beta",
        status: "incomplete_roster",
        explanation: "Beta warning",
        totalExpectedScore: 120,
        warnings: ["Only 1/2 players available."],
        d1: { status: "ready", disciplineName: "TDM", selectedPlayers: 3, requiredPlayers: 3, missingSlots: 0, captainName: "Captain C" },
        d2: { status: "incomplete_roster", disciplineName: "Mini DM", selectedPlayers: 1, requiredPlayers: 2, missingSlots: 1, captainName: null },
      });

    const { GET } = await aiLegacyLineupBatchPreviewRouteModulePromise;
    const response = await GET(
      new Request("http://localhost/api/lineups/legacy/ai-batch-preview?saveId=save-local&seasonId=season-1&matchdayId=matchday-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("sqlite");
    expect(body.totalTeams).toBe(2);
    expect(body.readyTeams).toBe(1);
    expect(body.warningTeams).toBe(1);
    expect(body.blockedTeams).toBe(0);
    expect(body.teams[0].teamName).toBe("Alpha");
    expect(body.teams[0].d1CaptainName).toBe("Captain A");
    expect(body.teams[1].d2MissingSlots).toBe(1);
    expect(loadLocalLegacyLineupContext).toHaveBeenCalledTimes(2);
  }, 20000);

  it("keeps prisma batch preview read-only", async () => {
    db.save.findUnique.mockResolvedValueOnce({ id: "save-ref" });
    db.season.findFirst.mockResolvedValueOnce({ id: "season-1", saveId: "save-ref" });
    db.matchday.findFirst.mockResolvedValueOnce({ id: "matchday-1", seasonId: "season-1" });
    db.teamSeasonState.findMany.mockResolvedValueOnce([
      { teamId: "A-A", team: { shortCode: "A-A", name: "Alpha" } },
    ]);
    loadLegacyLineupContext.mockResolvedValueOnce({ ok: true, warnings: [], context: { teamId: "A-A" } });
    buildAiLegacyLineupPreview.mockReturnValueOnce({
      teamId: "A-A",
      teamCode: "A-A",
      teamName: "Alpha",
      status: "ready",
      explanation: "Alpha ready",
      totalExpectedScore: 180,
      warnings: [],
      d1: { status: "ready", disciplineName: "TDM", selectedPlayers: 3, requiredPlayers: 3, missingSlots: 0, captainName: "Captain A" },
      d2: { status: "ready", disciplineName: "Mini DM", selectedPlayers: 2, requiredPlayers: 2, missingSlots: 0, captainName: "Captain B" },
    });

    const { GET } = await aiLegacyLineupBatchPreviewRouteModulePromise;
    const response = await GET(
      new Request("http://localhost/api/lineups/legacy/ai-batch-preview?saveId=save-ref&seasonId=season-1&matchdayId=matchday-1&source=prisma"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.readOnly).toBe(true);
    expect(body.source).toBe("prisma");
    expect(loadLegacyLineupContext).toHaveBeenCalledTimes(1);
    expect(loadLocalLegacyLineupContext).not.toHaveBeenCalled();
  });

  it("runs ai batch apply as dry-run without saving", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"] },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [{ teamId: "A-A" }, { teamId: "B-B" }],
            seasonState: {
              teamControlSettings: {
                "A-A": {
                  teamId: "A-A",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
                "B-B": {
                  teamId: "B-B",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
              },
            },
          },
        },
      }),
      getSaveById: () => null,
      getActiveSave: () => null,
    });
    getLocalLegacyLineupDraft.mockReturnValue(null);
    loadLocalLegacyLineupContext
      .mockReturnValueOnce({ ok: true, context: { teamId: "A-A", team: { name: "Alpha" } } })
      .mockReturnValueOnce({ ok: true, context: { teamId: "B-B", team: { name: "Beta" } } });
    buildAiLegacyLineupPreview
      .mockReturnValueOnce({
        teamId: "A-A",
        teamCode: "A-A",
        teamName: "Alpha",
        status: "ready",
        warnings: [],
        entries: [],
      })
      .mockReturnValueOnce({
        teamId: "B-B",
        teamCode: "B-B",
        teamName: "Beta",
        status: "incomplete_roster",
        warnings: ["warn"],
        entries: [],
      });
    calculateLocalLegacyLineupPreview.mockReturnValue({
      ok: true,
      validation: { isValid: true, warnings: [], errors: [] },
    });

    const { POST } = await aiLegacyLineupBatchApplyRouteModulePromise;
    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-local&seasonId=season-1&matchdayId=matchday-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, includeWarningTeams: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dryRun).toBe(true);
    expect(body.summary.wouldSave).toBe(1);
    expect(body.summary.skippedWarning).toBe(1);
    expect(saveLocalLegacyLineupDraft).not.toHaveBeenCalled();
  });

  it("skips existing lineups unless overwriteExisting is explicitly enabled", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"] },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [{ teamId: "A-A" }],
            seasonState: {
              teamControlSettings: {
                "A-A": {
                  teamId: "A-A",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
              },
            },
          },
        },
      }),
      getSaveById: () => null,
      getActiveSave: () => null,
    });
    getLocalLegacyLineupDraft.mockReturnValue({
      lineupId: "lineup-1",
      entries: [{ disciplineId: "tdm" }],
    });
    loadLocalLegacyLineupContext.mockReturnValue({
      ok: true,
      context: {
        teamId: "A-A",
        team: { name: "Alpha" },
        existingDraft: {
          lineupId: "lineup-1",
          entries: [{ disciplineId: "tdm" }],
        },
      },
    });
    buildAiLegacyLineupPreview.mockReturnValue({
      teamId: "A-A",
      teamCode: "A-A",
      teamName: "Alpha",
      status: "ready",
      warnings: [],
      entries: [],
    });
    calculateLocalLegacyLineupPreview.mockReturnValue({
      ok: true,
      validation: { isValid: true, warnings: [], errors: [] },
    });

    const { POST } = await import("@/app/api/lineups/legacy/ai-batch-apply/route");
    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-local&seasonId=season-1&matchdayId=matchday-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, includeWarningTeams: false, overwriteExisting: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.skippedExisting).toBe(1);
    expect(body.summary.wouldSave).toBe(0);
    expect(body.results[0].result).toBe("skipped_existing");
    expect(saveLocalLegacyLineupDraft).not.toHaveBeenCalled();
  });

  it("executes ai batch apply only after explicit confirm and overwrite flag", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"] },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [{ teamId: "A-A" }],
            seasonState: {
              teamControlSettings: {
                "A-A": {
                  teamId: "A-A",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
              },
            },
          },
        },
      }),
      getSaveById: () => null,
      getActiveSave: () => null,
    });
    getLocalLegacyLineupDraft.mockReturnValue({
      lineupId: "lineup-1",
      entries: [{ disciplineId: "tdm" }],
    });
    loadLocalLegacyLineupContext.mockReturnValue({
      ok: true,
      context: {
        teamId: "A-A",
        team: { name: "Alpha" },
        existingDraft: {
          lineupId: "lineup-1",
          entries: [{ disciplineId: "tdm" }],
        },
      },
    });
    buildAiLegacyLineupPreview.mockReturnValue({
      teamId: "A-A",
      teamCode: "A-A",
      teamName: "Alpha",
      status: "ready",
      warnings: [],
      entries: [],
    });
    calculateLocalLegacyLineupPreview.mockReturnValue({
      ok: true,
      validation: { isValid: true, warnings: [], errors: [] },
    });
    saveLocalLegacyLineupDraft.mockReturnValue({
      ok: true,
      draft: { lineupId: "lineup-1", entries: [] },
      warnings: [],
    });

    const { POST } = await import("@/app/api/lineups/legacy/ai-batch-apply/route");
    const blockedResponse = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-local&seasonId=season-1&matchdayId=matchday-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: false, includeWarningTeams: false, confirm: false }),
      }),
    );
    expect(blockedResponse.status).toBe(409);

    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-local&seasonId=season-1&matchdayId=matchday-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: false, includeWarningTeams: false, overwriteExisting: true, confirm: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dryRun).toBe(false);
    expect(body.summary.savedTeams).toBe(1);
    expect(body.summary.overwrittenExisting).toBe(1);
    expect(saveLocalLegacyLineupDraft).toHaveBeenCalledTimes(1);
  });

  it("blocks ai batch apply for prisma", async () => {
    const { POST } = await import("@/app/api/lineups/legacy/ai-batch-apply/route");
    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-ref&seasonId=season-1&matchdayId=matchday-1&source=prisma", {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("read-only");
  });

  it("skips manual and passive teams and only plans eligible ai teams", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"] },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [
              { teamId: "A-A", shortCode: "A-A", name: "Alpha" },
              { teamId: "B-B", shortCode: "B-B", name: "Beta" },
              { teamId: "C-C", shortCode: "C-C", name: "Gamma" },
              { teamId: "D-D", shortCode: "D-D", name: "Delta" },
            ],
            seasonState: {
              teamControlSettings: {
                "A-A": {
                  teamId: "A-A",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: true,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
                "B-B": {
                  teamId: "B-B",
                  controlMode: "manual",
                  aiLineupPreviewEnabled: false,
                  aiLineupAutoApplyEnabled: false,
                  aiTransferPreviewEnabled: false,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: false,
                  aiSellAutoApplyEnabled: false,
                },
                "C-C": {
                  teamId: "C-C",
                  controlMode: "passive",
                  aiLineupPreviewEnabled: false,
                  aiLineupAutoApplyEnabled: false,
                  aiTransferPreviewEnabled: false,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: false,
                  aiSellAutoApplyEnabled: false,
                },
                "D-D": {
                  teamId: "D-D",
                  controlMode: "ai",
                  aiLineupPreviewEnabled: true,
                  aiLineupAutoApplyEnabled: false,
                  aiTransferPreviewEnabled: true,
                  aiTransferAutoApplyEnabled: false,
                  aiSellPreviewEnabled: true,
                  aiSellAutoApplyEnabled: false,
                },
              },
            },
          },
        },
      }),
      getSaveById: () => null,
      getActiveSave: () => null,
    });
    getLocalLegacyLineupDraft.mockReturnValue(null);
    loadLocalLegacyLineupContext.mockReturnValue({ ok: true, context: { teamId: "A-A", team: { name: "Alpha" } } });
    buildAiLegacyLineupPreview.mockReturnValue({
      teamId: "A-A",
      teamCode: "A-A",
      teamName: "Alpha",
      status: "ready",
      warnings: [],
      entries: [],
    });
    calculateLocalLegacyLineupPreview.mockReturnValue({
      ok: true,
      validation: { isValid: true, warnings: [], errors: [] },
    });

    const { POST } = await import("@/app/api/lineups/legacy/ai-batch-apply/route");
    const response = await POST(
      new Request("http://localhost/api/lineups/legacy/ai-batch-apply?saveId=save-local&seasonId=season-1&matchdayId=matchday-1", {
        method: "POST",
        body: JSON.stringify({ dryRun: true, includeWarningTeams: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalTeams).toBe(4);
    expect(body.summary.aiEligibleTeams).toBe(1);
    expect(body.summary.skippedManual).toBe(1);
    expect(body.summary.skippedPassive).toBe(1);
    expect(body.summary.skippedDisabled).toBe(1);
    expect(body.summary.readyToSave).toBe(1);
    expect(body.summary.wouldSave).toBe(1);
    expect(body.results.find((entry: { teamId: string }) => entry.teamId === "B-B")?.result).toBe("skipped_manual");
    expect(body.results.find((entry: { teamId: string }) => entry.teamId === "C-C")?.result).toBe("skipped_passive");
    expect(body.results.find((entry: { teamId: string }) => entry.teamId === "D-D")?.result).toBe("skipped_disabled");
    expect(loadLocalLegacyLineupContext).toHaveBeenCalledTimes(1);
  });
});
