import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  ADVANCE_MATCHDAY_CONFIRM_TOKEN,
  executeMatchdayAdvance,
  previewMatchdayAdvance,
} from "@/lib/season/matchday-progress-service";

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
        matchdayIds: ["matchday-1", "matchday-2"],
      },
      seasonState: {
        seasonId: "season-1",
        schedule: [
          { id: "fixture-1", homeTeamId: "A-A", awayTeamId: "B-B", matchdayId: "matchday-1", status: "scheduled" },
          { id: "fixture-2", homeTeamId: "A-A", awayTeamId: "B-B", matchdayId: "matchday-2", status: "scheduled" },
        ],
        standings: {
          "A-A": { points: 10, rank: 1 },
          "B-B": { points: 8, rank: 2 },
        },
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            teamId: "A-A",
            status: "draft",
            entries: [],
            createdAt: "2026-06-04T00:00:00.000Z",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        matchdayResults: [{ id: "result-1", seasonId: "season-1", matchdayId: "matchday-1" } as never],
        standingsApplyLogs: [
          {
            id: "standings-audit-1",
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
        ],
        cashPrizeApplyLogs: [
          {
            id: "cash-audit-1",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            action: "apply",
            payload: {
              idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
              totalTeams: 2,
              appliedTeams: 2,
              totalPrizeMoney: 100,
            },
            createdAt: "2026-06-04T00:00:00.000Z",
          },
        ],
        matchdayAdvanceLogs: [],
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "b", humanControlled: true, rosterLimit: 12 },
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

describe("matchday progress service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a dry run for advancing to the next local matchday", async () => {
    const { persistence } = createPersistenceMock();
    const result = await previewMatchdayAdvance({ saveId: "save-local", seasonId: "season-1" }, persistence as never);

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.canApply).toBe(true);
    expect(result.summary.currentMatchdayIndex).toBe(1);
    expect(result.summary.nextMatchdayIndex).toBe(2);
    expect(result.summary.lockedLineups).toBe(1);
  });

  it("execute advances the local save, resolves current lineups and opens the next matchday", async () => {
    const { save, persistence } = createPersistenceMock();
    const result = await executeMatchdayAdvance(
      {
        saveId: "save-local",
        seasonId: "season-1",
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(save.gameState.season.currentMatchday).toBe(2);
    expect(save.gameState.gamePhase).toBe("season_active");
    expect(save.gameState.matchdayState.matchdayId).toBe("matchday-2");
    expect(save.gameState.matchdayState.pendingTeamIds).toHaveLength(2);
    expect(save.gameState.seasonState.lineupDrafts?.[0]?.status).toBe("resolved");
    expect(save.gameState.seasonState.matchdayAdvanceLogs).toHaveLength(1);
    expect(save.gameState.logs.at(-1)?.type).toBe("season");
  });

  it("allows matchday advance without cash apply because prize money is season-end gated", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.seasonState.cashPrizeApplyLogs = [];

    const result = await previewMatchdayAdvance({ saveId: "save-local", seasonId: "season-1" }, persistence as never);
    expect(result.ok).toBe(true);
    expect(result.canApply).toBe(true);
    expect(result.summary.cashApplied).toBe(false);
    expect(result.blockingReasons).not.toContain("cash_apply_missing_for_current_matchday");
  });

  it("resolves the final matchday as season-end instead of blocking on a missing next matchday", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.season.currentMatchday = 2;
    save.gameState.matchdayState.matchdayId = "matchday-2";
    save.gameState.seasonState.matchdayResults = [{ id: "result-2", seasonId: "season-1", matchdayId: "matchday-2" } as never];
    save.gameState.seasonState.standingsApplyLogs = [
      {
        id: "standings-audit-2",
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-2",
        action: "apply",
        payload: {
          idempotencyKey: "standings-apply:save-local:season-1:matchday-2",
          totalTeams: 2,
          appliedTeams: 2,
          tieGroupsCount: 0,
          previewWarningsCount: 0,
        },
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];

    const result = await executeMatchdayAdvance(
      {
        saveId: "save-local",
        seasonId: "season-1",
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.scope.nextMatchdayId).toBeNull();
    expect(save.gameState.matchdayState.matchdayId).toBe("matchday-2");
    expect(save.gameState.matchdayState.status).toBe("resolved");
    expect(save.gameState.gamePhase).toBe("season_completed");
    expect(result.blockingReasons).not.toContain("no_next_matchday_configured");
  });

  it("blocks prisma as read-only", async () => {
    const { persistence } = createPersistenceMock();
    const result = await previewMatchdayAdvance(
      { saveId: "save-local", seasonId: "season-1", source: "prisma" },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.blockingReasons[0]).toContain("read-only");
  });
});
