import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildTransferRecap } from "@/lib/market/transfer-recap-service";

const persistenceState = {
  save: null as
    | {
        saveId: string;
        gameState: GameState;
      }
    | null,
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.save,
      createdFromSeed: false,
    }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
  }),
}));

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 175,
    cash: partial?.cash ?? 175,
    identityId: partial?.identityId ?? "A-A",
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
    marketValue: partial?.marketValue ?? 10,
    salaryDemand: partial?.salaryDemand ?? 2,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 10,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 2,
    pps: partial?.pps ?? null,
    ovr: partial?.ovr ?? null,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Rogue",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 50, d2: 60 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 2,
        above40: 2,
        above60: 1,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
  };
}

function createRosterEntry(id: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 2,
    salary: partial?.salary ?? 2,
    upkeep: partial?.upkeep ?? partial?.salary ?? 2,
    purchasePrice: partial?.purchasePrice ?? 10,
    currentValue: partial?.currentValue ?? 10,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(): GameState {
  const teams = [
    createTeam({ teamId: "A-A", shortCode: "A-A", name: "Armageddon Aftermath", cash: 150 }),
    createTeam({ teamId: "B-B", shortCode: "B-B", name: "Blazing Beasts", cash: 204 }),
  ];

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
      standings: {
        "A-A": { points: 0 },
        "B-B": { points: 0 },
      },
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: [
      createPlayer("fa-1", { name: "Nightowl", rating: 80, marketValue: 25, salaryDemand: 6, className: "Rogue", race: "Elf", disciplineRatings: { d1: 67, d2: 47 } }),
      createPlayer("p-old", { name: "Gearstrike", rating: 60, marketValue: 10, salaryDemand: 4, className: "Warrior", race: "Human", disciplineRatings: { d1: 40, d2: 36 } }),
    ],
    disciplines: [],
    rosters: [createRosterEntry("r-fa-1", "fa-1", { teamId: "A-A", salary: 6, currentValue: 25, purchasePrice: 25 })],
    contracts: [],
    transferListings: [],
    transferHistory: [
      {
        id: "history-buy-fa-1",
        playerId: "fa-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "A-A",
        fee: 25,
        salary: 6,
        marketValue: 25,
        remainingContractLength: 2,
        happenedAt: "2026-06-06T10:00:00.000Z",
      },
      {
        id: "history-sell-old",
        playerId: "p-old",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        seasonLabel: "Season 1",
        transferType: "sell",
        fromTeamId: "B-B",
        toTeamId: null,
        fee: 10,
        salary: 4,
        marketValue: 10,
        remainingContractLength: 1,
        happenedAt: "2026-06-05T10:00:00.000Z",
      },
      {
        id: "history-buy-old",
        playerId: "p-old",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        phase: "manual_transfer_window",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: null,
        toTeamId: "B-B",
        fee: 6,
        salary: 4,
        marketValue: 6,
        remainingContractLength: 2,
        happenedAt: "2026-06-04T10:00:00.000Z",
      },
    ],
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

describe("transfer recap service", () => {
  beforeEach(() => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState(),
    };
  });

  it("builds a read-only local recap with stable top lists and reconstructed before/after values", async () => {
    const result = await buildTransferRecap({
      source: "sqlite",
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      limit: 5,
    });

    expect(result.readOnly).toBe(true);
    expect(result.summary.buys).toBe(2);
    expect(result.summary.sells).toBe(1);
    expect(result.summary.totalSpend).toBe(31);
    expect(result.summary.totalIncome).toBe(10);
    expect(result.topTransfersIn[0]?.playerName).toBe("Nightowl");
    expect(result.biggestProfit[0]?.playerName).toBe("Gearstrike");
    expect(result.biggestProfit[0]?.realizedProfit).toBe(4);
    expect(result.topTransfersIn[0]?.cashBefore).toBe(175);
    expect(result.topTransfersIn[0]?.cashAfter).toBe(150);
    expect(result.topTransfersIn[0]?.rosterBefore).toBe(0);
    expect(result.topTransfersIn[0]?.rosterAfter).toBe(1);
    expect(result.teamSummaries.find((entry) => entry.teamId === "A-A")?.spend).toBe(25);
    expect(result.teamSummaries.find((entry) => entry.teamId === "B-B")?.income).toBe(10);
  });

  it("warns cleanly for an unknown local save instead of silently showing another recap", async () => {
    const result = await buildTransferRecap({
      source: "sqlite",
      saveId: "missing-save",
      seasonId: "season-1",
      limit: 5,
    });

    expect(result.scope.saveId).toBeNull();
    expect(result.summary.buys).toBe(0);
    expect(result.topTransfersIn).toEqual([]);
    expect(result.saveContext?.requestedSaveId).toBe("missing-save");
    expect(result.saveContext?.resolvedSaveId).toBeNull();
    expect(result.saveContext?.scopeWarning).toContain("missing-save");
    expect(result.warnings).toContain("keine Transferhistorie im aktuellen Scope gefunden");
  });
});
