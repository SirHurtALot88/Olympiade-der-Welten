import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  executeStandingsApply,
  previewStandingsApply,
  STANDINGS_APPLY_CONFIRM_TOKEN,
} from "@/lib/standings/standings-apply-service";

const { buildStandingsPreview } = vi.hoisted(() => ({
  buildStandingsPreview: vi.fn(),
}));

vi.mock("@/lib/standings/standings-preview-engine", () => ({
  buildStandingsPreview,
}));

function createPersistenceMock() {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
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
          "A-A": { points: 12, rank: 2 },
          "B-B": { points: 14, rank: 1 },
        },
        standingsApplyLogs: [],
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "id-a", humanControlled: true, rosterLimit: 12 },
        { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "id-b", humanControlled: true, rosterLimit: 12 },
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
    } as GameState,
  };

  const persistence = {
    bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
    getActiveSave: vi.fn(() => save),
    getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
    saveSingleplayerState: vi.fn((saveId: string, gameState: GameState) => {
      save.gameState = gameState;
      return save;
    }),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  };

  return { save, persistence };
}

function mockHealthyPreview() {
  buildStandingsPreview.mockResolvedValue({
    items: [
      {
        teamId: "A-A",
        teamName: "Alpha",
        currentRank: 2,
        projectedRank: 1,
        currentPoints: 12,
        projectedPoints: 18.6,
        pointsDelta: 6.6,
        matchdayRank: 1,
        d1Score: 55,
        d2Score: 44,
        matchdayScore: 99,
        totalScore: 99,
        cash: 100,
        readinessStatus: "ready",
        resultStatus: "ready",
        warnings: [],
        blockedRules: [],
      },
      {
        teamId: "B-B",
        teamName: "Beta",
        currentRank: 1,
        projectedRank: 2,
        currentPoints: 14,
        projectedPoints: 20.2,
        pointsDelta: 6.2,
        matchdayRank: 2,
        d1Score: 40,
        d2Score: 30,
        matchdayScore: 70,
        totalScore: 70,
        cash: 100,
        readinessStatus: "ready",
        resultStatus: "ready",
        warnings: [],
        blockedRules: [],
      },
    ],
    summary: {
      totalTeams: 2,
      matchdayResultFound: true,
      readyTeams: 2,
      blockedTeamCount: 0,
    },
    blockedRules: [],
    tieGroups: [],
    source: {
      mode: "sqlite",
      matchdayResult: "local_saved_result",
      currentPoints: "local_save_standings",
      standingsRules: "global_total_score_preview",
      fixtureCoverage: "not_required_local_results",
    },
    scope: {
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
    },
  });
}

describe("standings apply service", () => {
  beforeEach(() => {
    buildStandingsPreview.mockReset();
  });

  it("uses dry run by default and writes nothing", async () => {
    const { save, persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await previewStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.canApply).toBe(true);
    expect(result.plannedChanges[0]?.delta).toBe(6.6);
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    expect(save.gameState.seasonState.standings["A-A"]?.points).toBe(12);
  });

  it("execute writes local points and ranks only with explicit confirm", async () => {
    const { save, persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await executeStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        execute: true,
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.auditLogId).toContain("standings-apply-audit");
    expect(persistence.saveSingleplayerState).toHaveBeenCalledOnce();
    expect(save.gameState.seasonState.standings["A-A"]).toEqual({ points: 18.6, rank: 1 });
    expect(save.gameState.seasonState.standings["B-B"]).toEqual({ points: 20.2, rank: 2 });
    expect(save.gameState.seasonState.standingsApplyLogs).toHaveLength(1);
  });

  it("blocks execute without explicit confirm token", async () => {
    const { persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await executeStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        execute: true,
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.canApply).toBe(false);
    expect(result.blockingReasons).toContain("Missing explicit confirm token for execute.");
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("blocks duplicate apply for the same save, season and matchday", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.seasonState.standingsApplyLogs = [
      {
        id: "audit-1",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        action: "apply",
        payload: {
          idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
          totalTeams: 2,
          appliedTeams: 2,
          tieGroupsCount: 0,
          previewWarningsCount: 0,
        },
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    mockHealthyPreview();

    const result = await previewStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.duplicateDetected).toBe(true);
    expect(result.blockingReasons).toContain("duplicate_apply_for_save_season_matchday");
  });

  it("allows controlled replace for the same save, season and matchday", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.seasonState.standingsApplyLogs = [
      {
        id: "audit-1",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        action: "apply",
        payload: {
          idempotencyKey: "standings-apply:save-local:season-1:matchday-1",
          totalTeams: 2,
          appliedTeams: 2,
          tieGroupsCount: 0,
          previewWarningsCount: 0,
        },
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    mockHealthyPreview();

    const result = await executeStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        execute: true,
        confirm: STANDINGS_APPLY_CONFIRM_TOKEN,
        forceReplace: true,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.blockingReasons).not.toContain("duplicate_apply_for_save_season_matchday");
    expect(save.gameState.seasonState.standingsApplyLogs).toHaveLength(1);
    expect(save.gameState.seasonState.standingsApplyLogs?.[0]?.id).toContain("standings-apply-audit__");
  });

  it("blocks tie groups and incomplete preview rows", async () => {
    const { persistence } = createPersistenceMock();
    buildStandingsPreview.mockResolvedValue({
      items: [
        {
          teamId: "A-A",
          teamName: "Alpha",
          currentRank: 2,
          projectedRank: null,
          currentPoints: 12,
          projectedPoints: null,
          pointsDelta: null,
          matchdayRank: null,
          d1Score: 55,
          d2Score: null,
          matchdayScore: null,
          totalScore: null,
          cash: 100,
          readinessStatus: "missing_result",
          resultStatus: "incomplete_result",
          warnings: ["incomplete_result"],
          blockedRules: ["global_score_tie_breaker_missing"],
        },
      ],
      summary: {
        totalTeams: 1,
        matchdayResultFound: true,
        readyTeams: 0,
        blockedTeamCount: 1,
      },
      blockedRules: ["global_score_tie_breaker_missing"],
      tieGroups: [
        {
          type: "totalScore",
          value: 99,
          affectedTeams: [{ teamId: "A-A", teamName: "Alpha" }],
          requiresConfirmedTieBreaker: true,
        },
      ],
      source: {
        mode: "sqlite",
        matchdayResult: "local_saved_result",
        currentPoints: "local_save_standings",
        standingsRules: "global_total_score_preview",
        fixtureCoverage: "not_required_local_results",
      },
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
    });

    const result = await previewStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain("blockedRule:global_score_tie_breaker_missing");
    expect(result.blockingReasons).toContain("tie_groups_require_confirmed_policy");
    expect(result.blockingReasons).toContain("incomplete_result:A-A");
    expect(result.blockingReasons).toContain("missing_preview_value:A-A");
  });

  it("blocks prisma mode as read-only", async () => {
    const { persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await previewStandingsApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        source: "prisma",
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.source).toBe("prisma");
    expect(result.blockingReasons[0]).toContain("read-only");
  });
});
