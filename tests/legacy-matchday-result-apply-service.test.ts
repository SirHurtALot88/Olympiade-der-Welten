import { describe, expect, it, vi } from "vitest";

import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  APPLY_CONFIRM_TOKEN,
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";

function createContext(input: {
  teamId: string;
  teamName: string;
  activePlayersCount: number;
  d1Scores: number[];
  d2Scores: number[];
  withLineup?: boolean;
}): LegacyLineupLoadedContext {
  const withLineup = input.withLineup ?? true;
  const draftEntries = withLineup
    ? [
        ...input.d1Scores.map((score, index) => ({
          disciplineId: "mini-dm",
          disciplineSide: "d1" as const,
          slotIndex: index + 1,
          playerId: `${input.teamId}-d1-${index}`,
          activePlayerId: `${input.teamId}-active-d1-${index}`,
        })),
        ...input.d2Scores.map((score, index) => ({
          disciplineId: "fechten",
          disciplineSide: "d2" as const,
          slotIndex: index + 1,
          playerId: `${input.teamId}-d2-${index}`,
          activePlayerId: `${input.teamId}-active-d2-${index}`,
        })),
      ]
    : [];

  return {
    saveId: "save-local",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    entries: draftEntries,
    disciplinePlayerCounts: {
      "mini-dm": 2,
      fechten: 2,
    },
    disciplineSidePlayerCounts: {
      "mini-dm::d1": 2,
      "fechten::d2": 2,
    },
    activePlayers: Array.from({ length: input.activePlayersCount }, (_, index) => ({
      id: `${input.teamId}-active-${index}`,
      saveId: "save-local",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: draftEntries[index]?.playerId ?? `${input.teamId}-bench-${index}`,
      upkeep: 10,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}`,
        disciplineId: "mini-dm",
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: "fechten",
        score,
      })),
    ],
    save: { id: "save-local", name: "Local", status: "active" },
    season: {
      id: "season-1",
      saveId: "save-local",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      status: "active",
    },
    matchday: {
      id: "matchday-1",
      seasonId: "season-1",
      index: 1,
      label: "Matchday 1",
      status: "planning",
    },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamName },
    teamSeasonState: {
      id: `tss-${input.teamId}`,
      saveId: "save-local",
      seasonId: "season-1",
      teamId: input.teamId,
      cash: 100,
      budget: 100,
      rosterLimit: 12,
      playerOpt: 10,
    },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: draftEntries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: "mini-dm", name: "Mini DM", category: "mental" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "mini-dm", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
    ],
    existingDraft: withLineup
      ? {
          lineupId: `lineup-${input.teamId}`,
          saveId: "save-local",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          teamId: input.teamId,
          status: "draft",
          entries: draftEntries,
          createdAt: "2026-06-03T00:00:00.000Z",
          updatedAt: "2026-06-03T00:00:00.000Z",
        }
      : null,
    contextMeta: {
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId: "mini-dm",
      d2DisciplineId: "fechten",
    },
    fatigueByPlayerId: {},
    fatigueSourceStatus: "mapped",
    formCardSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "Local legacy form card pool",
      warnings: [],
    },
    mutatorSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "MVP forced mutator mode",
      warnings: [],
    },
    formCards: [],
    mutatorTraitOptions: [],
  };
}

function createPersistenceMock() {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
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
        standings: {},
        lineupDrafts: [],
        matchdayResults: [],
        disciplineResults: [],
        playerDisciplinePerformances: [],
        disciplineHighlights: [],
        resultAuditLogs: [],
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "A-A", shortCode: "A-A", name: "Alpha", budget: 100, cash: 100, identityId: "id-A", humanControlled: true, rosterLimit: 12 },
        { teamId: "B-B", shortCode: "B-B", name: "Beta", budget: 100, cash: 100, identityId: "id-B", humanControlled: true, rosterLimit: 12 },
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
        generatedAt: "2026-06-03T00:00:00.000Z",
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

  return {
    save,
    persistence: {
      bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
      getActiveSave: vi.fn(() => save),
      getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
      saveSingleplayerState: vi.fn((saveId: string, gameState: GameState) => {
        save.gameState = gameState;
        save.updatedAt = "2026-06-04T00:00:00.000Z";
        return save;
      }),
      createSave: vi.fn(),
      createFreshSeasonOneSave: vi.fn(),
      cloneSave: vi.fn(),
      activateSave: vi.fn(),
      listSaves: vi.fn(() => []),
    },
  };
}

describe("legacy matchday result apply service", () => {
  it("uses dry run by default and writes nothing", async () => {
    const { save, persistence } = createPersistenceMock();
    const localLoader = vi
      .fn()
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "A-A", teamName: "Alpha", activePlayersCount: 7, d1Scores: [20, 18], d2Scores: [15, 14] }) })
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "B-B", teamName: "Beta", activePlayersCount: 7, d1Scores: [19, 17], d2Scores: [10, 9] }) });

    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, localLoader);
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dryRun).toBe(true);
      expect(result.applied).toBe(false);
      expect(result.source).toBe("sqlite");
      expect(result.previewStatus).toBe("ready");
    }
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    expect(save.gameState.seasonState.matchdayResults).toHaveLength(0);
  });

  it("executes only with explicit confirm and writes local result snapshots", async () => {
    const { save, persistence } = createPersistenceMock();
    const localLoader = vi
      .fn()
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "A-A", teamName: "Alpha", activePlayersCount: 7, d1Scores: [20, 18], d2Scores: [15, 14] }) })
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "B-B", teamName: "Beta", activePlayersCount: 7, d1Scores: [19, 17], d2Scores: [10, 9] }) });

    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, localLoader);
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dryRun).toBe(false);
      expect(result.applied).toBe(true);
      expect(result.resultsWritten).toBe(4);
    }
    expect(persistence.saveSingleplayerState).toHaveBeenCalledOnce();
    expect(save.gameState.seasonState.matchdayResults).toHaveLength(1);
    expect(save.gameState.seasonState.disciplineResults).toHaveLength(4);
    expect(save.gameState.seasonState.playerDisciplinePerformances?.length).toBeGreaterThan(0);
    expect(save.gameState.seasonState.disciplineHighlights?.length).toBeGreaterThan(0);
    expect(save.gameState.seasonState.resultAuditLogs).toHaveLength(1);
    expect(save.gameState.teams[0]?.cash).toBe(100);
  });

  it("persists visible MVP mutator PP bonuses in local player performances", async () => {
    const { save, persistence } = createPersistenceMock();
    const localLoader = vi
      .fn()
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "A-A", teamName: "Alpha", activePlayersCount: 7, d1Scores: [20, 18], d2Scores: [15, 14] }) })
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "B-B", teamName: "Beta", activePlayersCount: 7, d1Scores: [19, 17], d2Scores: [10, 9] }) });

    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, localLoader);
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
      resolveOptions: {
        modifierMode: "mvp_forced_mutators",
        captainMode: "missing_source",
      },
    });

    expect(result.ok).toBe(true);
    const performanceRows = save.gameState.seasonState.playerDisciplinePerformances ?? [];
    expect(performanceRows.length).toBeGreaterThan(0);
    expect(performanceRows.some((entry) => entry.mutatorPpsBonus === 0.3)).toBe(true);
  });

  it("blocks duplicate apply without forceReplace", async () => {
    const { save, persistence } = createPersistenceMock();
    save.gameState.seasonState.matchdayResults = [
      {
        id: "matchday-result__save-local__season-1__matchday-1",
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
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      },
    ];
    const localLoader = vi
      .fn()
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "A-A", teamName: "Alpha", activePlayersCount: 7, d1Scores: [20, 18], d2Scores: [15, 14] }) })
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "B-B", teamName: "Beta", activePlayersCount: 7, d1Scores: [19, 17], d2Scores: [10, 9] }) });

    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, localLoader);
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already exists");
    }
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("blocks incomplete lineups without explicit override", async () => {
    const { persistence } = createPersistenceMock();
    const localLoader = vi
      .fn()
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "A-A", teamName: "Alpha", activePlayersCount: 7, d1Scores: [20], d2Scores: [15, 14] }) })
      .mockReturnValueOnce({ ok: true, warnings: [], context: createContext({ teamId: "B-B", teamName: "Beta", activePlayersCount: 7, d1Scores: [19, 17], d2Scores: [10, 9] }) });

    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, localLoader);
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      execute: true,
      confirm: APPLY_CONFIRM_TOKEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("incomplete");
    }
  });

  it("blocks prisma mode because it is read-only", async () => {
    const { persistence } = createPersistenceMock();
    const service = new LegacyMatchdayResultApplyService(undefined as never, { loadLegacyLineupContext: vi.fn() }, persistence as never, vi.fn());
    const result = await service.applyLegacyMatchdayResult({
      saveId: "save-local",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      source: "prisma",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("read-only");
    }
  });
});
