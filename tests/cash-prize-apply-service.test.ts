import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  CASH_PRIZE_APPLY_CONFIRM_TOKEN,
  executeCashPrizeApply,
  previewCashPrizeApply,
} from "@/lib/season/cash-prize-apply-service";

const { buildPrizeMoneyPreview } = vi.hoisted(() => ({
  buildPrizeMoneyPreview: vi.fn(),
}));

vi.mock("@/lib/season/prize-money-preview", () => ({
  buildPrizeMoneyPreview,
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
          "W-W": { points: 22, rank: 1 },
          "P-S": { points: 19, rank: 2 },
        },
        matchdayResults: [{ id: "result-1" } as never],
        cashPrizeApplyLogs: [],
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 100, cash: 37.9, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "P-S", shortCode: "P-S", name: "Project Suicide", budget: 100, cash: 49.8, identityId: "b", humanControlled: true, rosterLimit: 12 },
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
  buildPrizeMoneyPreview.mockResolvedValue({
    items: [
      {
        teamId: "W-W",
        teamCode: "W-W",
        teamName: "Wicked Wizards",
        rank: 1,
        points: 22,
        currentCash: 37.9,
        prizeMoney: 91.4,
        projectedCash: 129.3,
        status: "ready",
        warnings: [],
      },
      {
        teamId: "P-S",
        teamCode: "P-S",
        teamName: "Project Suicide",
        rank: 2,
        points: 19,
        currentCash: 49.8,
        prizeMoney: 88,
        projectedCash: 137.8,
        status: "ready",
        warnings: [],
      },
    ],
    blockedRules: [],
    globalWarnings: [],
    summary: {
      totalTeams: 2,
      calculableTeams: 2,
      prizeRowsCount: 32,
      blockedItemsCount: 0,
    },
    source: {
      mode: "sqlite",
      standings: "local_save",
      prizeTable: "normalized_sheet",
    },
    scope: {
      saveId: "save-local",
      seasonId: "season-1",
    },
  });
}

describe("cash prize apply service", () => {
  beforeEach(() => {
    buildPrizeMoneyPreview.mockReset();
  });

  it("uses dry run by default and writes nothing", async () => {
    const { save, persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await previewCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.canApply).toBe(true);
    expect(result.plannedChanges[0]?.newCash).toBe(129.3);
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    expect(save.gameState.teams[0]?.cash).toBe(37.9);
  });

  it("execute writes only local team cash and keeps standings untouched", async () => {
    const { save, persistence } = createPersistenceMock();
    mockHealthyPreview();
    const standingsBefore = structuredClone(save.gameState.seasonState.standings);
    const resultsBefore = structuredClone(save.gameState.seasonState.matchdayResults);

    const result = await executeCashPrizeApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        execute: true,
        confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
      },
      persistence as never,
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(save.gameState.teams.find((team) => team.teamId === "W-W")?.cash).toBe(129.3);
    expect(save.gameState.teams.find((team) => team.teamId === "P-S")?.cash).toBe(137.8);
    expect(save.gameState.seasonState.standings).toEqual(standingsBefore);
    expect(save.gameState.seasonState.matchdayResults).toEqual(resultsBefore);
    expect(save.gameState.seasonState.cashPrizeApplyLogs).toHaveLength(1);
    expect(save.gameState.seasonState.seasonSnapshots ?? []).toHaveLength(0);
  });

  it("blocks prisma mode as read-only", async () => {
    const { persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await previewCashPrizeApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        source: "prisma",
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.blockingReasons[0]).toContain("read-only");
  });

  it("blocks duplicate apply for the same save and season", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.seasonState.cashPrizeApplyLogs = [
          {
            id: "cash-log-1",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            action: "apply",
            payload: {
          idempotencyKey: "cash-prize-apply:save-local:season-1:matchday-1",
              totalTeams: 2,
              appliedTeams: 2,
              totalPrizeMoney: 179.4,
        },
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    mockHealthyPreview();

    const result = await previewCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1" },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.duplicateDetected).toBe(true);
    expect(result.blockingReasons).toContain("duplicate_apply_for_save_season_block");
  });

  it("blocks preview in matchday phase because cash apply is season-end only", async () => {
    const { persistence } = createPersistenceMock();
    mockHealthyPreview();

    const result = await previewCashPrizeApply(
      {
        saveId: "save-local",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "matchday",
      },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.canApply).toBe(false);
    expect(result.blockingReasons).toContain("blockedRule:season_end_only");
    expect(result.warnings).toContain("season_end_only");
  });

  it("blocks when a team has no safe projected cash", async () => {
    const { persistence } = createPersistenceMock();
    buildPrizeMoneyPreview.mockResolvedValue({
      items: [
        {
          teamId: "W-W",
          teamCode: "W-W",
          teamName: "Wicked Wizards",
          rank: null,
          points: 22,
          currentCash: 37.9,
          prizeMoney: null,
          projectedCash: null,
          status: "missing_rank",
          warnings: ["missing_rank"],
        },
      ],
      blockedRules: [],
      globalWarnings: [],
      summary: {
        totalTeams: 1,
        calculableTeams: 0,
        prizeRowsCount: 32,
        blockedItemsCount: 1,
      },
      source: {
        mode: "sqlite",
        standings: "local_save",
        prizeTable: "normalized_sheet",
      },
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
      },
    });

    const result = await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", matchdayId: "matchday-1", execute: true },
      persistence as never,
    );

    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain("missing_rank:W-W");
    expect(result.blockingReasons).toContain("missing_projected_cash:W-W");
  });
});
