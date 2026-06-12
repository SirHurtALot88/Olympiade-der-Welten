import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Team, Player, RosterEntry, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

const persistenceState = {
  sourceSave: null as { saveId: string; name: string; status: "archived" | "active"; gameState: GameState } | null,
  targetSave: null as { saveId: string; name: string; status: "archived" | "active"; gameState: GameState } | null,
  saveCalls: [] as Array<{ saveId: string; gameState: GameState }>,
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.targetSave ?? persistenceState.sourceSave,
      gameState: (persistenceState.targetSave ?? persistenceState.sourceSave)?.gameState ?? null,
      created: false,
    }),
    getActiveSave: () => persistenceState.targetSave,
    getSaveById: (saveId: string) => {
      if (persistenceState.sourceSave?.saveId === saveId) return persistenceState.sourceSave;
      if (persistenceState.targetSave?.saveId === saveId) return persistenceState.targetSave;
      return null;
    },
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      persistenceState.saveCalls.push({ saveId, gameState });
      if (persistenceState.sourceSave?.saveId === saveId) {
        persistenceState.sourceSave = { ...persistenceState.sourceSave, gameState };
        return persistenceState.sourceSave;
      }
      if (persistenceState.targetSave?.saveId === saveId) {
        persistenceState.targetSave = { ...persistenceState.targetSave, gameState };
        return persistenceState.targetSave;
      }
      return null;
    },
  }),
}));

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "C-C",
    shortCode: partial?.shortCode ?? partial?.teamId ?? "C-C",
    name: partial?.name ?? "Cash Creators",
    budget: partial?.budget ?? 200,
    cash: partial?.cash ?? 100,
    identityId: partial?.identityId ?? partial?.teamId ?? "C-C",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 50,
    marketValue: partial?.marketValue ?? 20,
    salaryDemand: partial?.salaryDemand ?? 4,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 20,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 4,
    pps: partial?.pps ?? null,
    ovr: partial?.ovr ?? null,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Scout",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "neutral",
    gender: partial?.gender ?? "n/a",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? {},
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings ?? {},
  };
}

function createRosterEntry(id: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId: partial?.teamId ?? "C-C",
    playerId,
    contractLength: partial?.contractLength ?? 2,
    salary: partial?.salary ?? 4,
    upkeep: partial?.upkeep ?? partial?.salary ?? 4,
    purchasePrice: partial?.purchasePrice ?? 20,
    currentValue: partial?.currentValue ?? 20,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createTransfer(id: string, playerId: string, toTeamId: string, partial?: Partial<TransferHistoryEntry>): TransferHistoryEntry {
  return {
    id,
    playerId,
    seasonId: partial?.seasonId ?? "season-1",
    seasonLabel: partial?.seasonLabel ?? "Season 1",
    transferType: partial?.transferType ?? "buy",
    fromTeamId: partial?.fromTeamId ?? null,
    toTeamId,
    fee: partial?.fee ?? 20,
    salary: partial?.salary ?? 4,
    marketValue: partial?.marketValue ?? partial?.fee ?? 20,
    remainingContractLength: partial?.remainingContractLength ?? 2,
    happenedAt: partial?.happenedAt ?? "2026-06-07T12:00:00.000Z",
    matchdayId: partial?.matchdayId ?? "matchday-1",
    phase: partial?.phase ?? "manual_transfer_window",
    source: partial?.source ?? "ai_roster_fill",
  };
}

function createGameState(input?: {
  teams?: Team[];
  players?: Player[];
  rosters?: RosterEntry[];
  transferHistory?: TransferHistoryEntry[];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamControlSettings: {},
      teamStrategyProfiles: {},
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: teams.map((team) => ({
      teamId: team.teamId,
      pow: 25,
      spe: 25,
      men: 25,
      soc: 25,
      ambition: 50,
      finances: 50,
      boardConfidence: 50,
      harmony: 50,
      manners: 50,
      popularity: 50,
      cooperation: 50,
      playerMin: 7,
      playerOpt: 10,
    })),
    players: input?.players ?? [],
    disciplines: [],
    rosters: input?.rosters ?? [],
    contracts: [],
    transferListings: [],
    transferHistory: input?.transferHistory ?? [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

describe("ai pick import service", () => {
  beforeEach(() => {
    persistenceState.saveCalls = [];
    persistenceState.sourceSave = {
      saveId: "source-save",
      name: "Source",
      status: "archived",
      gameState: createGameState({
        teams: [createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators", cash: 100 })],
        players: [
          createPlayer("source-picked", { name: "Imported Pick", marketValue: 20, displayMarketValue: 20, salaryDemand: 4, displaySalary: 4 }),
        ],
        rosters: [createRosterEntry("source-roster", "source-picked", { teamId: "C-C", salary: 4, purchasePrice: 20, currentValue: 20 })],
        transferHistory: [createTransfer("source-transfer", "source-picked", "C-C", { source: "ai_roster_fill", fee: 20, salary: 4 })],
      }),
    };
    persistenceState.targetSave = {
      saveId: "target-save",
      name: "Target",
      status: "active",
      gameState: createGameState({
        teams: [createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators", cash: 100 })],
        players: [
          createPlayer("target-reset", { name: "Resettable Pick", marketValue: 15, displayMarketValue: 15, salaryDemand: 3, displaySalary: 3 }),
          createPlayer("source-picked", { name: "Imported Pick", marketValue: 20, displayMarketValue: 20, salaryDemand: 4, displaySalary: 4 }),
        ],
        rosters: [createRosterEntry("target-roster", "target-reset", { teamId: "C-C", salary: 3, purchasePrice: 15, currentValue: 15 })],
        transferHistory: [createTransfer("target-transfer", "target-reset", "C-C", { source: "ai_roster_fill", fee: 15, salary: 3 })],
      }),
    };
  });

  it("previews reset-and-import save scoped without touching manual transfers", async () => {
    const { runAiPickImportReplace } = await import("@/lib/ai/ai-pick-import-service");

    const result = await runAiPickImportReplace({
      source: "sqlite",
      sourceSaveId: "source-save",
      targetSaveId: "target-save",
      seasonId: "season-1",
      dryRun: true,
    });

    expect(result.status).toBe("ready");
    expect(result.executed).toBe(false);
    expect(result.summary.sourceTransferCount).toBe(1);
    expect(result.summary.targetResettableTransfers).toBe(1);
    expect(result.summary.importableTransfers).toBe(1);
    expect(result.saveContext.sourceSave.resolvedSaveId).toBe("source-save");
    expect(result.saveContext.targetSave.resolvedSaveId).toBe("target-save");
    expect(result.teams[0]?.teamId).toBe("C-C");
    expect(result.transfers[0]?.playerId).toBe("source-picked");
    expect(result.transfers[0]?.status).toBe("ready");
    expect(persistenceState.saveCalls).toHaveLength(0);
  });

  it("executes reset first and then replays the source buys into the target save", async () => {
    const { runAiPickImportReplace } = await import("@/lib/ai/ai-pick-import-service");

    const result = await runAiPickImportReplace({
      source: "sqlite",
      sourceSaveId: "source-save",
      targetSaveId: "target-save",
      seasonId: "season-1",
      dryRun: false,
      confirmToken: "IMPORT_AI_TEST_BUYS_INTO_CURRENT_SAVE",
    });

    expect(result.executed).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.summary.importedTransfers).toBe(1);
    expect(result.resetExecution.revertedTransferIds).toContain("target-transfer");
    expect(result.transfers[0]?.status).toBe("imported");
    expect(result.transfers[0]?.importedTransferId).toBeTruthy();

    const targetState = persistenceState.targetSave!.gameState;
    expect(targetState.rosters.some((entry) => entry.playerId === "source-picked" && entry.teamId === "C-C")).toBe(true);
    expect(targetState.rosters.some((entry) => entry.playerId === "target-reset")).toBe(false);
    expect(targetState.transferHistory.some((entry) => entry.playerId === "source-picked" && entry.source === "imported_ai_roster_fill")).toBe(true);
    expect(targetState.transferHistory.some((entry) => entry.playerId === "target-reset" && entry.transferType === "sell" && entry.source === "reset_ai_roster_fill")).toBe(true);
  });
});
