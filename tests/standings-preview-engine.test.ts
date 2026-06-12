import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";

vi.mock("@/lib/standings/season-standings-sheet", () => ({
  inspectSeasonStandingsSheet: vi.fn(async () => ({
    sourceKind: "season_standings",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: [],
    sampleRows: [],
    mappedRows: [],
    expectedExportPaths: [],
    detectedTabKind: "season_standings",
  })),
  inspectRankToPointsSheet: vi.fn(async () => ({
    sourceKind: "rank_to_points",
    access: "local_csv",
    status: "ok",
    reason: null,
    sheetUrl: null,
    headers: ["Spieleranzahl", "1.", "2."],
    sampleRows: [],
    mappedRows: [
      {
        raw: {},
        playerCount: 2,
        pointsByRank: { "1.": 6.6, "2.": 6.2 },
      },
      {
        raw: {},
        playerCount: 5,
        pointsByRank: { "1.": 16.5, "2.": 15.5 },
      },
    ],
    expectedExportPaths: [],
    detectedTabKind: "rank_to_points",
  })),
  mapSeasonStandingsRowsToTeams: vi.fn((rows) => ({
    mappedTeamsCount: rows.length,
    missingInSheet: [],
    missingInDb: [],
    duplicateSheetTeams: [],
    ambiguousMappings: [],
    mappingWarnings: [],
    rows,
  })),
}));

const persistenceState = {
  save: {
    saveId: "save-local",
    name: "Local Save",
    status: "active" as const,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState: {
      season: {
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 1,
        matchdayIds: ["matchday-1"],
      },
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        standings: {
          "A-A": { points: 12 },
          "W-W": { points: 8 },
        },
        disciplineSchedule: [
          {
            seasonId: "season-1",
            matchdayId: "matchday-1",
            matchdayIndex: 1,
            matchdayLabel: "Spieltag 1",
            discipline1: {
              disciplineId: "mini-dm",
              displayName: "Mini DM",
              order: 1,
              playerCount: 2,
              category: "mental",
            },
            discipline2: {
              disciplineId: "fechten",
              displayName: "Fechten",
              order: 2,
              playerCount: 5,
              category: "speed",
            },
            sourceStatus: "test",
            sourceNote: "test",
          },
        ],
        lineupDrafts: [],
        matchdayResults: [
          {
            id: "result-1",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            status: "preview_applied" as const,
            sourceVersion: "legacy-resolve-preview-v1",
            teamsTotal: 2,
            teamsReady: 2,
            teamsUnderfilled: 0,
            teamsMissingLineup: 0,
            teamsInvalidLineup: 0,
            teamsMissingScoreCoverage: 0,
            warningsCount: 0,
            createdAt: "2026-06-04T00:00:00.000Z",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        disciplineResults: [
          {
            id: "dr-1",
            matchdayResultId: "result-1",
            teamId: "A-A",
            disciplineId: "mini-dm",
            disciplineSide: "d1" as const,
            rank: 1,
            baseScore: 55,
            totalScore: 55,
            readinessStatus: "ready" as const,
            warnings: [],
            createdAt: "2026-06-04T00:00:00.000Z",
          },
          {
            id: "dr-2",
            matchdayResultId: "result-1",
            teamId: "A-A",
            disciplineId: "fechten",
            disciplineSide: "d2" as const,
            rank: 1,
            baseScore: 44,
            totalScore: 44,
            readinessStatus: "ready" as const,
            warnings: [],
            createdAt: "2026-06-04T00:00:00.000Z",
          },
          {
            id: "dr-3",
            matchdayResultId: "result-1",
            teamId: "W-W",
            disciplineId: "mini-dm",
            disciplineSide: "d1" as const,
            rank: 2,
            baseScore: 20,
            totalScore: 20,
            readinessStatus: "missing_lineup" as const,
            warnings: ["draft_missing"],
            createdAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        playerDisciplinePerformances: [],
        disciplineHighlights: [],
        resultAuditLogs: [],
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning" as const,
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Armageddon Aftermath", budget: 175, cash: 175, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 160, cash: 160, identityId: "b", humanControlled: false, rosterLimit: 12 },
      ],
      teamIdentities: [],
      players: [],
      disciplines: [],
      rosters: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
      mappingReport: {
        mappingSource: "test",
        teamSource: "test",
        generatedAt: "2026-06-04T00:00:00.000Z",
        processedMappingRows: 0,
        importedPlayerCount: 0,
        matchedRosterCount: 0,
        teamCount: 2,
        unmappedPlayers: [],
        teamsWithoutPlayers: [],
        mappingRowsWithoutPlayerMatch: [],
        duplicateMappedPlayers: [],
        unknownTeamCodes: [],
        duplicateTeamCodes: [],
        warnings: [],
      },
    },
  },
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: vi.fn(() => ({
    bootstrapSingleplayerSave: () => ({ save: persistenceState.save, createdFromSeed: false }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (saveId === persistenceState.save.saveId ? persistenceState.save : null),
    saveSingleplayerState: vi.fn(),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  })),
}));

describe("standings preview engine", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test";
  });

  it("reads stored local results and builds projected points from rank-to-points", async () => {
    const result = await buildStandingsPreview({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });

    expect(result.source.mode).toBe("sqlite");
    expect(result.source.matchdayResult).toBe("local_saved_result");
    expect(result.source.currentPoints).toBe("local_save_standings");
    expect(result.summary.matchdayResultFound).toBe(true);
    expect(result.blockedRules).not.toContain("points_table_missing");

    const alpha = result.items.find((item) => item.teamId === "A-A");
    expect(alpha?.currentPoints).toBe(12);
    expect(alpha?.matchdayScore).toBe(99);
    expect(alpha?.matchdayRank).toBe(1);
    expect(alpha?.pointsDelta).toBe(23.1);
    expect(alpha?.projectedPoints).toBe(35.1);
    expect(alpha?.resultStatus).toBe("ready");

    const beta = result.items.find((item) => item.teamId === "W-W");
    expect(beta?.matchdayScore).toBeNull();
    expect(beta?.resultStatus).toBe("incomplete_result");
    expect(beta?.warnings).toContain("incomplete_result");
  });

  it("shows missing_result warnings when no stored matchday result exists", async () => {
    persistenceState.save.gameState.seasonState.matchdayResults = [];
    persistenceState.save.gameState.seasonState.disciplineResults = [];

    const result = await buildStandingsPreview({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });

    expect(result.summary.matchdayResultFound).toBe(false);
    expect(result.items.every((item) => item.resultStatus === "missing_result")).toBe(true);
    expect(result.items[0]?.warnings).toContain("missing_result_for_matchday");
  });

  it("adds tie warnings and blocks projected rank on real ties", async () => {
    persistenceState.save.gameState.seasonState.standings = {
      "A-A": { points: 12 },
      "W-W": { points: 13.4 },
    };
    persistenceState.save.gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "legacy-resolve-preview-v1",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    persistenceState.save.gameState.seasonState.disciplineResults = [
      {
        id: "dr-1",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 55,
        totalScore: 55,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-2",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 1,
        baseScore: 44,
        totalScore: 44,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-3",
        matchdayResultId: "result-1",
        teamId: "W-W",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 60,
        totalScore: 60,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-4",
        matchdayResultId: "result-1",
        teamId: "W-W",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 2,
        baseScore: 39,
        totalScore: 39,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];

    const result = await buildStandingsPreview({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });

    expect(result.blockedRules).toContain("global_score_tie_breaker_missing");
    expect(result.tieGroups.map((group) => group.type)).toEqual(["totalScore", "projectedPoints"]);
    expect(result.items.find((item) => item.teamId === "A-A")?.projectedRank).toBeNull();
    expect(result.items.find((item) => item.teamId === "A-A")?.resultStatus).toBe("tie_warning");
  });

  it("resolves projectedPoints ties via matchdayScore when totalScore differs", async () => {
    persistenceState.save.gameState.seasonState.standings = {
      "A-A": { points: 12 },
      "W-W": { points: 13.4 },
    };
    persistenceState.save.gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "legacy-resolve-preview-v1",
        teamsTotal: 2,
        teamsReady: 2,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    persistenceState.save.gameState.seasonState.disciplineResults = [
      {
        id: "dr-1",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 55,
        totalScore: 55,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-2",
        matchdayResultId: "result-1",
        teamId: "A-A",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 1,
        baseScore: 44,
        totalScore: 44,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-3",
        matchdayResultId: "result-1",
        teamId: "W-W",
        disciplineId: "mini-dm",
        disciplineSide: "d1",
        rank: 2,
        baseScore: 57,
        totalScore: 57,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
      {
        id: "dr-4",
        matchdayResultId: "result-1",
        teamId: "W-W",
        disciplineId: "fechten",
        disciplineSide: "d2",
        rank: 2,
        baseScore: 31,
        totalScore: 31,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];

    const result = await buildStandingsPreview({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "sqlite",
    });

    expect(result.blockedRules).not.toContain("global_score_tie_breaker_missing");
    expect(result.tieGroups).toHaveLength(0);
    expect(result.items.find((item) => item.teamId === "A-A")?.projectedRank).toBe(1);
    expect(result.items.find((item) => item.teamId === "A-A")?.resultStatus).toBe("ready");
    expect(result.items.find((item) => item.teamId === "W-W")?.projectedRank).toBe(2);
  });

  it("stays read-only and does not write team season state or cash", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/standings/standings-preview-engine.ts",
        "utf8",
      ),
    );

    expect(source).not.toContain("teamSeasonState.update");
    expect(source).not.toContain("cashPrize");
    expect(source).not.toContain("standingsApply");
  });
});
