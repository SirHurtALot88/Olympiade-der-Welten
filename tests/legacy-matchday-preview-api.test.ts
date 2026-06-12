import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLocalLegacyLineupContext = vi.fn();
const buildLegacyMatchdayReadiness = vi.fn();
const buildLegacyMatchdayResolvePreview = vi.fn();
const buildResolveLabSummary = vi.fn();
const buildResolveLabTeamDetails = vi.fn();
const buildResolveLabTopPlayersBySide = vi.fn();
const getTopPlayerNameForTeam = vi.fn();
const getHighlightCandidatesForTeam = vi.fn();
const createPersistenceService = vi.fn();
const loadLegacyLineupContext = vi.fn();

vi.mock("@/lib/lineups/legacy-lineup-local-service", () => ({
  loadLocalLegacyLineupContext,
}));

vi.mock("@/lib/lineups/legacy-matchday-readiness", () => ({
  buildLegacyMatchdayReadiness,
}));

vi.mock("@/lib/resolve/legacy-matchday-resolve-engine", () => ({
  buildLegacyMatchdayResolvePreview,
}));

vi.mock("@/lib/resolve/legacy-resolve-lab", () => ({
  buildResolveLabSummary,
  buildResolveLabTeamDetails,
  buildResolveLabTopPlayersBySide,
  getTopPlayerNameForTeam,
  getHighlightCandidatesForTeam,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService,
}));

vi.mock("@/lib/lineups/legacy-lineup-context-loader", () => ({
  LegacyLineupContextLoader: class {
    loadLegacyLineupContext = loadLegacyLineupContext;
  },
}));

vi.mock("@/lib/lineups/legacy-lineup-repository", () => ({
  LegacyLineupRepository: class {},
}));

vi.mock("@/src/server/db", () => ({
  db: {
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
  },
}));

function createOkContext(teamId: string, teamName: string) {
  return {
    ok: true as const,
    warnings: [],
    context: {
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId,
      entries: [],
      disciplinePlayerCounts: {},
      activePlayers: [],
      disciplineScores: [],
      save: { id: "save-local", name: "Local Save", status: "active" },
      season: { id: "season-1", saveId: "save-local", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
      matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
      team: { id: teamId, shortCode: teamId, name: teamName },
      teamSeasonState: { id: `tss-${teamId}`, saveId: "save-local", seasonId: "season-1", teamId, cash: 100, budget: 100, rosterLimit: 10 },
      teamIdentity: { pow: 1, spe: 1, men: 1, soc: 1 },
      rosterPlayers: [],
      disciplines: [],
      disciplineWeights: [],
      seasonDisciplineConfigs: [],
      existingDraft: null,
      contextMeta: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        teamId,
        d1DisciplineId: "mini-dm",
        d2DisciplineId: "fechten",
      },
    },
  };
}

describe("legacy matchday preview api", () => {
  beforeEach(() => {
    vi.resetModules();
    loadLocalLegacyLineupContext.mockReset();
    buildLegacyMatchdayReadiness.mockReset();
    buildLegacyMatchdayResolvePreview.mockReset();
    buildResolveLabSummary.mockReset();
    buildResolveLabTeamDetails.mockReset();
    buildResolveLabTopPlayersBySide.mockReset();
    getTopPlayerNameForTeam.mockReset();
    getHighlightCandidatesForTeam.mockReset();
    createPersistenceService.mockReset();
    loadLegacyLineupContext.mockReset();
  });

  it("uses local sqlite source by default", async () => {
    createPersistenceService.mockReturnValue({
      bootstrapSingleplayerSave: () => ({
        save: {
          saveId: "save-local",
          gameState: {
            season: { id: "season-1", matchdayIds: ["matchday-1"], name: "Season 1", year: 1 },
            matchdayState: { matchdayId: "matchday-1" },
            teams: [{ teamId: "A-A" }, { teamId: "B-B" }],
          },
        },
      }),
      getActiveSave: () => ({
        saveId: "save-local",
        gameState: {
          season: { id: "season-1", matchdayIds: ["matchday-1"], name: "Season 1", year: 1 },
          matchdayState: { matchdayId: "matchday-1" },
          teams: [{ teamId: "A-A" }, { teamId: "B-B" }],
        },
      }),
      getSaveById: () => null,
    });

    loadLocalLegacyLineupContext
      .mockReturnValueOnce(createOkContext("A-A", "Alpha"))
      .mockReturnValueOnce(createOkContext("B-B", "Beta"));
    buildLegacyMatchdayReadiness.mockImplementation((context) => ({
      teamId: context.team.id,
      teamName: context.team.name,
      readinessStatus: "ready",
      reasonCodes: [],
      shortReason: "ok",
      activePlayersCount: 0,
      requiredTotalUniquePlayers: 0,
      missingPlayersToRequirement: 0,
      validationWarnings: [],
    }));
    buildLegacyMatchdayResolvePreview.mockReturnValue({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      status: "ready",
      disciplinePreviews: [],
      teamResults: [],
      warnings: [],
      missingLineups: [],
      incompleteLineups: [],
      missingScores: [],
    });
    buildResolveLabSummary.mockReturnValue({
      teamsTotal: 2,
      teamsWithLineup: 0,
      teamsReady: 2,
      teamsUnderfilled: 0,
      missingLineups: 0,
      teamsMissingLineup: 0,
      teamsInvalidLineup: 0,
      teamsMissingScoreCoverage: 0,
      warningsCount: 0,
      d1DisciplineId: "mini-dm",
      d1DisciplineName: "Mini DM",
      d2DisciplineId: "fechten",
      d2DisciplineName: "Fechten",
    });
    buildResolveLabTeamDetails.mockReturnValue([]);
    buildResolveLabTopPlayersBySide.mockReturnValue({ d1: [], d2: [] });
    getTopPlayerNameForTeam.mockReturnValue(null);
    getHighlightCandidatesForTeam.mockReturnValue([]);

    const { GET } = await import("@/app/api/resolve/legacy-matchday-preview/route");
    const response = await GET(new Request("http://localhost/api/resolve/legacy-matchday-preview"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("sqlite");
    expect(loadLocalLegacyLineupContext).toHaveBeenCalledTimes(2);
    expect(loadLegacyLineupContext).not.toHaveBeenCalled();
  });

  it("uses prisma context loader when source=prisma", async () => {
    const { db } = await import("@/src/server/db");
    vi.mocked(db.save.findUnique).mockResolvedValueOnce({ id: "save-initial" } as never);
    vi.mocked(db.season.findFirst).mockResolvedValueOnce({ id: "season-1", saveId: "save-initial", year: 1 } as never);
    vi.mocked(db.matchday.findFirst).mockResolvedValueOnce({ id: "matchday-1", seasonId: "season-1", index: 1 } as never);
    vi.mocked(db.teamSeasonState.findMany).mockResolvedValueOnce([{ teamId: "A-A" }, { teamId: "B-B" }] as never);

    loadLegacyLineupContext
      .mockResolvedValueOnce(createOkContext("A-A", "Alpha"))
      .mockResolvedValueOnce(createOkContext("B-B", "Beta"));
    buildLegacyMatchdayReadiness.mockImplementation((context) => ({
      teamId: context.team.id,
      teamName: context.team.name,
      readinessStatus: "ready",
      reasonCodes: [],
      shortReason: "ok",
      activePlayersCount: 0,
      requiredTotalUniquePlayers: 0,
      missingPlayersToRequirement: 0,
      validationWarnings: [],
    }));
    buildLegacyMatchdayResolvePreview.mockReturnValue({
      saveId: "save-initial",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      status: "missing_sources",
      disciplinePreviews: [],
      teamResults: [],
      warnings: [],
      missingLineups: [],
      incompleteLineups: [],
      missingScores: [],
    });
    buildResolveLabSummary.mockReturnValue({
      teamsTotal: 2,
      teamsWithLineup: 0,
      teamsReady: 2,
      teamsUnderfilled: 0,
      missingLineups: 0,
      teamsMissingLineup: 0,
      teamsInvalidLineup: 0,
      teamsMissingScoreCoverage: 0,
      warningsCount: 0,
      d1DisciplineId: "mini-dm",
      d1DisciplineName: "Mini DM",
      d2DisciplineId: "fechten",
      d2DisciplineName: "Fechten",
    });
    buildResolveLabTeamDetails.mockReturnValue([]);
    buildResolveLabTopPlayersBySide.mockReturnValue({ d1: [], d2: [] });
    getTopPlayerNameForTeam.mockReturnValue(null);
    getHighlightCandidatesForTeam.mockReturnValue([]);

    const { GET } = await import("@/app/api/resolve/legacy-matchday-preview/route");
    const response = await GET(new Request("http://localhost/api/resolve/legacy-matchday-preview?source=prisma"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("prisma");
    expect(loadLegacyLineupContext).toHaveBeenCalledTimes(2);
    expect(loadLocalLegacyLineupContext).not.toHaveBeenCalled();
  });
});
