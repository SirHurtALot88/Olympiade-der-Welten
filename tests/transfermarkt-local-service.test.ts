import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type { TeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildPlayerContractPreference,
  buildContractNegotiationPreview,
  buildContractSalarySchedule,
  buildTeamContractSeasonTable,
  calculateOpenBuyoutCost,
} from "@/lib/market/contract-negotiation-preview";

const persistenceState = {
  save: null as
    | {
        saveId: string;
        gameState: GameState;
      }
    | null,
  saveSingleplayerState: vi.fn(),
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({
      save: persistenceState.save,
      createdFromSeed: false,
    }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
    saveSingleplayerState: (saveId: string, nextState: GameState) => {
      persistenceState.saveSingleplayerState(saveId, nextState);
      if (persistenceState.save && persistenceState.save.saveId === saveId) {
        persistenceState.save = {
          ...persistenceState.save,
          gameState: nextState,
        };
      }
      return persistenceState.save;
    },
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
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 50,
    marketValue: partial?.marketValue ?? 1000,
    salaryDemand: partial?.salaryDemand ?? 100,
    displayMarketValue: partial?.displayMarketValue,
    displaySalary: partial?.displaySalary,
    pps: partial?.pps ?? null,
    ovr: partial?.ovr ?? null,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Berserker",
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
    disciplineRatings: partial?.disciplineRatings ?? { d1: 10, d2: 10 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 0,
        above40: 0,
        above60: 0,
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
    contractLength: partial?.contractLength ?? 3,
    salary: partial?.salary ?? 1000,
    upkeep: partial?.upkeep ?? partial?.salary ?? 1000,
    purchasePrice: partial?.purchasePrice ?? 5000,
    currentValue: partial?.currentValue ?? 5500,
    roleTag: partial?.roleTag ?? "starter",
    promisedRole: partial?.promisedRole ?? null,
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input?: {
  teams?: Team[];
  players?: Player[];
  rosters?: RosterEntry[];
  transferHistory?: TransferHistoryEntry[];
  playerPotential?: GameState["playerPotential"];
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
  disciplines?: GameState["disciplines"];
  gamePhase?: GameState["gamePhase"];
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
    gamePhase: input?.gamePhase ?? "transfer_sell_phase",
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamFacilities: input?.teamFacilities,
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: input?.players ?? [],
    disciplines: input?.disciplines ?? [],
    rosters: input?.rosters ?? [],
    contracts: [],
    transferListings: [],
    transferHistory: input?.transferHistory ?? [],
    playerPotential: input?.playerPotential,
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

function createAppliedMatchdayResult(id = "result-1") {
  return {
    id,
    saveId: "save-singleplayer-dev",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    status: "preview_applied" as const,
    sourceVersion: "test",
    teamsTotal: 1,
    teamsReady: 1,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-10T12:00:00.000Z",
  };
}

describe("transfermarkt local service", () => {
  beforeEach(() => {
    persistenceState.saveSingleplayerState.mockReset();
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", { marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10 }),
          createPlayer("p2", { marketValue: 30, displayMarketValue: 30, salaryDemand: 8, displaySalary: 8 }),
          createPlayer("fa-1", { marketValue: 25, displayMarketValue: 25, salaryDemand: 6, displaySalary: 6 }),
        ],
        rosters: [
          createRosterEntry("r1", "p1", { salary: 10, contractLength: 3, currentValue: 40, purchasePrice: 40 }),
          createRosterEntry("r2", "p2", { salary: 8, contractLength: 5, currentValue: 30, purchasePrice: 30 }),
        ],
      }),
    };
  });

  it("keeps affordable free agents in the limited market feed", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: Array.from({ length: 30 }, (_, index) =>
          createPlayer(`fa-${index + 1}`, {
            name: `Free Agent ${index + 1}`,
            marketValue: index + 1,
            displayMarketValue: index + 1,
            salaryDemand: 1,
            displaySalary: 1,
            rating: 100 - index,
            className: index % 2 === 0 ? "Berserker" : "Sprinter",
          }),
        ),
      }),
    };

    const { listLocalTransfermarktFreeAgents } = await import("@/lib/market/transfermarkt-local-service");
    const result = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
    });

    expect(result.items).toHaveLength(10);
    expect(result.items.slice(0, 4).map((item) => item.marketValue)).toEqual([1, 2, 3, 4]);
  });

  it("returns team fit in compact list mode when a team is selected", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", { marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10, race: "Mensch", subclasses: ["Krieger"] }),
          createPlayer("fa-1", {
            marketValue: 25,
            displayMarketValue: 25,
            salaryDemand: 6,
            displaySalary: 6,
            race: "Mensch",
            subclasses: ["Krieger"],
          }),
        ],
        rosters: [createRosterEntry("r1", "p1", { salary: 10, contractLength: 3, currentValue: 40, purchasePrice: 40 })],
      }),
    };

    const { listLocalTransfermarktFreeAgents } = await import("@/lib/market/transfermarkt-local-service");
    const result = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 5,
      compactList: true,
    });

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.teamContextAvailable)).toBe(true);
    expect(result.items.every((item) => typeof item.fit === "number")).toBe(true);
    expect(result.items.every((item) => item.fitSource === "compact_list")).toBe(true);
  });

  it("uses save-stable potential records and scouting office level for transfermarkt scouting", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", { marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10 }),
          createPlayer("fa-1", { marketValue: 25, displayMarketValue: 25, salaryDemand: 6, displaySalary: 6 }),
        ],
        rosters: [createRosterEntry("r1", "p1", { salary: 10, contractLength: 3, currentValue: 40, purchasePrice: 40 })],
        playerPotential: [
          {
            playerId: "fa-1",
            potentialBand: "elite",
            hiddenPotentialScore: 92,
            confidence: 0,
            source: "generated",
          },
        ],
      }),
    };

    const { listLocalTransfermarktFreeAgents } = await import("@/lib/market/transfermarkt-local-service");

    const level0 = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
      mode: "full",
    }).items.find((item) => item.playerId === "fa-1");

    expect(level0?.potentialBand).toBe("elite");
    expect(level0?.potentialRange).toEqual({ min: 76, max: 99 });
    expect(level0?.scoutingConfidence).toBe(20);
    expect(level0?.scoutingWarnings).toContain("potential_range_uncertain");

    persistenceState.save.gameState.seasonState.teamFacilities = {
      "A-A": {
        facilities: {
          scouting_office: {
            level: 3,
            enabled: true,
          },
        },
      },
    };

    const level3 = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
      mode: "full",
    }).items.find((item) => item.playerId === "fa-1");

    expect(level3?.potentialBand).toBe("elite");
    expect(level3?.potentialRange).toEqual({ min: 86, max: 98 });
    expect(level3?.scoutingConfidence).toBe(70);
    expect(level3?.marketValuePotentialPremiumPct).toBeGreaterThan(0);
  });

  it("uses season schedule player counts for transfermarkt discipline tags", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        disciplines: [
          { id: "staffel", name: "Staffel", category: "speed", weight: 1, playerCount: 3 },
          { id: "fechten", name: "Fechten", category: "speed", weight: 1, playerCount: 5 },
        ] as GameState["disciplines"],
        players: [
          createPlayer("fa-schedule", {
            name: "Schedule Scout",
            marketValue: 12,
            displayMarketValue: 12,
            salaryDemand: 3,
            displaySalary: 3,
            disciplineRatings: { staffel: 82, fechten: 70 },
          }),
        ],
      }),
    };
    persistenceState.save.gameState.seasonState.disciplineSchedule = [
      {
        seasonId: "season-1",
        matchdayId: "matchday-1",
        matchdayIndex: 1,
        matchdayLabel: "Spieltag 1",
        discipline1: {
          disciplineId: "staffel",
          displayName: "Staffel",
          order: 1,
          playerCount: 6,
          category: "speed",
        },
        discipline2: {
          disciplineId: "fechten",
          displayName: "Fechten",
          order: 2,
          playerCount: 4,
          category: "speed",
        },
        sourceStatus: "season_seed",
      },
    ];

    const { listLocalTransfermarktFreeAgents } = await import("@/lib/market/transfermarkt-local-service");
    const item = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
      mode: "full",
    }).items.find((entry) => entry.playerId === "fa-schedule");

    expect(item?.topDisciplineScores.find((entry) => entry.disciplineId === "staffel")?.playerCount).toBe(6);
    expect(item?.topDisciplineScores.find((entry) => entry.disciplineId === "fechten")?.playerCount).toBe(4);
  });

  it("updates local roster, cash, salary total, market value and transfer history after a buy", async () => {
    const { executeLocalTransfermarktBuy, listLocalTransferHistory, listLocalTransfermarktFreeAgents, previewLocalTransfermarktBuy } =
      await import("@/lib/market/transfermarkt-local-service");

    const beforeRow = buildTeamSeasonOverviewRows({ gameState: persistenceState.save!.gameState }).find(
      (row) => row.teamId === "A-A",
    );
    expect(beforeRow).toBeTruthy();

    const freeAgents = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 50,
    });
    const candidate = freeAgents.items.find((item) => item.playerId === "fa-1");
    expect(candidate).toBeTruthy();

    const preview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-1",
      promisedRole: "rotation",
    });

    expect(preview.canBuy).toBe(true);
    expect(preview.rosterAfter).toBe(3);
    expect(preview.cashAfter).toBe(150);
    expect(preview.promisedRole).toBe("rotation");

    const result = executeLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-1",
      promisedRole: "rotation",
    });

    expect(result.canBuy).toBe(true);
    expect(persistenceState.saveSingleplayerState).toHaveBeenCalledTimes(1);

    const afterState = persistenceState.save!.gameState;
    const afterRow = buildTeamSeasonOverviewRows({ gameState: afterState }).find((row) => row.teamId === "A-A");

    expect(afterRow?.rosterCount).toBe((beforeRow?.rosterCount ?? 0) + 1);
    expect(afterRow?.cash).toBe((beforeRow?.cash ?? 0) - 25);
    expect(afterRow?.salaryTotal).toBe((beforeRow?.salaryTotal ?? 0) + (result.offeredSalary ?? result.salary ?? 0));
    expect(afterRow?.marketValueTotal).toBe((beforeRow?.marketValueTotal ?? 0) + 25);
    expect(afterState.rosters.find((entry) => entry.playerId === "fa-1")?.roleTag).toBe("prospect");
    expect(afterState.rosters.find((entry) => entry.playerId === "fa-1")?.promisedRole).toBe("rotation");

    const afterFreeAgents = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 50,
    });
    expect(afterFreeAgents.items.some((item) => item.playerId === "fa-1")).toBe(false);

    const history = listLocalTransferHistory({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
    });
    expect(history.items[0]?.type).toBe("buy");
    expect(history.items[0]?.playerId).toBe("fa-1");
    expect(history.items[0]?.toTeamId).toBe("A-A");
    expect(history.items[0]?.seasonLabel).toBe("Season 1");
    expect(history.items[0]?.matchdayId).toBe("matchday-1");
    expect(history.items[0]?.phase).toBe("manual_transfer_window");
    expect(history.items[0]?.source).toBe("manual_transfermarkt_buy");
    expect(history.items[0]?.remainingContractLength).toBe(preview.contractLength);
  });

  it("allows roster slots 13 and 14 but blocks slot 15", async () => {
    const rosterPlayers = Array.from({ length: 14 }, (_, index) =>
      createPlayer(`p-${index + 1}`, { marketValue: 5, displayMarketValue: 5, salaryDemand: 1, displaySalary: 1 }),
    );
    const freeAgents = [
      createPlayer("fa-13", { marketValue: 10, displayMarketValue: 10, salaryDemand: 2, displaySalary: 2 }),
      createPlayer("fa-14", { marketValue: 10, displayMarketValue: 10, salaryDemand: 2, displaySalary: 2 }),
      createPlayer("fa-15", { marketValue: 10, displayMarketValue: 10, salaryDemand: 2, displaySalary: 2 }),
    ];
    const buildRoster = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        createRosterEntry(`r-${index + 1}`, `p-${index + 1}`, {
          salary: 1,
          currentValue: 5,
          purchasePrice: 5,
        }),
      );

    const { previewLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");

    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175, rosterLimit: 14 })],
        players: [...rosterPlayers, ...freeAgents],
        rosters: buildRoster(12),
      }),
    };
    const slot13 = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-13",
    });
    expect(slot13.canBuy).toBe(true);
    expect(slot13.rosterAfter).toBe(13);

    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175, rosterLimit: 14 })],
        players: [...rosterPlayers, ...freeAgents],
        rosters: buildRoster(13),
      }),
    };
    const slot14 = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-14",
    });
    expect(slot14.canBuy).toBe(true);
    expect(slot14.rosterAfter).toBe(14);

    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175, rosterLimit: 14 })],
        players: [...rosterPlayers, ...freeAgents],
        rosters: buildRoster(14),
      }),
    };
    const slot15 = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-15",
    });
    expect(slot15.canBuy).toBe(false);
    expect(slot15.blockingReasons).toContain("roster_limit_reached");
    expect(slot15.rosterAfter).toBe(14);
  });

  it("lists historical transfer seasons from snapshots even when another season is active", async () => {
    const { listLocalTransferHistory } = await import("@/lib/market/transfermarkt-local-service");
    const gameState = persistenceState.save!.gameState;
    gameState.season = {
      ...gameState.season,
      id: "season-3",
      name: "Season 3",
      matchdayIds: ["season-3-matchday-1"],
    };
    gameState.seasonState = {
      ...gameState.seasonState,
      seasonId: "season-3",
      seasonSnapshots: [
        {
          snapshotId: "season-snapshot__season-1",
          seasonId: "season-1",
          seasonName: "Season 1",
          archivedAt: "2026-06-10T10:00:00.000Z",
          status: "completed",
          sourceStatus: "mapped",
          finalStandings: [],
          playerPerformances: [],
          transferSnapshots: [
            {
              transferId: "history-season-1-buy",
              seasonId: "season-1",
              matchdayId: "matchday-1",
              phase: "manual_transfer_window",
              playerId: "fa-1",
              playerName: "fa-1",
              fromTeamId: null,
              fromTeamName: null,
              toTeamId: "A-A",
              toTeamName: "Armageddon Aftermath",
              type: "buy",
              amount: 25,
              salary: 6,
              marketValue: 25,
              contractLength: 3,
              source: "local_transfer_history",
            },
          ],
        },
      ],
    };
    gameState.transferHistory = [
      {
        id: "history-season-3-sell",
        playerId: "p1",
        playerName: "p1",
        seasonId: "season-3",
        seasonLabel: "Season 3",
        matchdayId: null,
        happenedAt: "2026-06-12T10:00:00.000Z",
        transferType: "sell",
        fromTeamId: "A-A",
        toTeamId: null,
        fee: 42,
        salary: 10,
        marketValue: 40,
        remainingContractLength: 1,
        source: "ai_preseason_market_sell",
        phase: "transfer_sell_phase",
      },
    ];

    const allHistory = listLocalTransferHistory({
      saveId: "save-singleplayer-dev",
      allSeasons: true,
      limit: 10,
    });
    expect(allHistory.items.map((entry) => entry.seasonLabel)).toEqual(["Season 3", "Season 1"]);

    const seasonOneHistory = listLocalTransferHistory({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      limit: 10,
    });
    expect(seasonOneHistory.saveContext.scopeWarning).toBeNull();
    expect(seasonOneHistory.items).toHaveLength(1);
    expect(seasonOneHistory.items[0]?.transferId).toBe("history-season-1-buy");
  });

  it("writes season, matchday and transfer phase context into the local sell history", async () => {
    const { executeLocalTransfermarktSell, listLocalTransferHistory, previewLocalTransfermarktSell } =
      await import("@/lib/market/transfermarkt-local-service");

    const preview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });

    expect(preview.canSell).toBe(true);

    const result = executeLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });

    expect(result.canSell).toBe(true);

    const history = listLocalTransferHistory({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
    });

    expect(history.items[0]?.type).toBe("sell");
    expect(history.items[0]?.playerId).toBe("p1");
    expect(history.items[0]?.fromTeamId).toBe("A-A");
    expect(history.items[0]?.seasonLabel).toBe("Season 1");
    expect(history.items[0]?.matchdayId).toBe("matchday-1");
    expect(history.items[0]?.phase).toBe("manual_transfer_window");
    expect(history.items[0]?.source).toBe("manual_transfermarkt_sell");
    expect(history.items[0]?.remainingContractLength).toBe(3);
  });

  it("blocks local sells during an active unresolved season", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: {
        ...createGameState({
          gamePhase: "season_active",
          teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
          players: [
            createPlayer("p1", { marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10 }),
          ],
          rosters: [
            createRosterEntry("r1", "p1", { salary: 10, contractLength: 3, currentValue: 40, purchasePrice: 40 }),
          ],
        }),
        season: {
          id: "season-1",
          name: "Season 1",
          year: 2026,
          currentMatchday: 3,
          matchdayIds: ["matchday-1", "matchday-2", "matchday-3"],
        },
        matchdayState: {
          matchdayId: "matchday-3",
          status: "planning",
          pendingTeamIds: [],
          resolvedFixtureIds: [],
        },
      },
    };

    const { previewLocalTransfermarktSell, executeLocalTransfermarktSell } =
      await import("@/lib/market/transfermarkt-local-service");
    const preview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });
    const result = executeLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });

    expect(preview.canSell).toBe(false);
    expect(preview.blockingReasons).toContain("sell_only_at_season_end");
    expect(result.canSell).toBe(false);
    expect(result.transferCreated).toBeFalsy();
  });

  it("blocks all teams from rebuying players sold in the current season", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [
          createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 }),
          createTeam({ teamId: "B-B", shortCode: "B-B", name: "Blazing Beasts", cash: 175 }),
        ],
        players: [
          createPlayer("p1", { name: "Recently Sold", marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10 }),
          createPlayer("fa-1", { name: "Alternative Pick", marketValue: 25, displayMarketValue: 25, salaryDemand: 6, displaySalary: 6 }),
        ],
        transferHistory: [
          {
            id: "history-sell-p1",
            playerId: "p1",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            phase: "manual_transfer_window",
            source: "ai_preseason_market_sell",
            seasonLabel: "Season 1",
            transferType: "sell",
            fromTeamId: "A-A",
            toTeamId: null,
            fee: 40,
            salary: 10,
            marketValue: 40,
            remainingContractLength: 1,
            happenedAt: "2026-06-12T10:00:00.000Z",
          },
        ],
      }),
    };

    const { listLocalTransfermarktFreeAgents, previewLocalTransfermarktBuy } =
      await import("@/lib/market/transfermarkt-local-service");

    const sameTeamPreview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "p1",
      transferSource: "auto_roster_fill",
    });
    expect(sameTeamPreview.canBuy).toBe(false);
    expect(sameTeamPreview.blockingReasons).toContain("recently_sold_same_preseason");
    expect(sameTeamPreview.blockingReasons).toContain("player_sold_this_season_unavailable");

    const sameTeamFeed = listLocalTransfermarktFreeAgents({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      limit: 10,
    });
    expect(sameTeamFeed.items.map((item) => item.playerId)).toEqual(["fa-1"]);

    const otherTeamPreview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "B-B",
      playerId: "p1",
      transferSource: "auto_roster_fill",
    });
    expect(otherTeamPreview.canBuy).toBe(false);
    expect(otherTeamPreview.blockingReasons).toContain("player_sold_this_season_unavailable");

    const overridePreview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "p1",
      transferSource: "debug_sandbox_rebuy",
      allowRecentlySoldRebuyOverride: true,
    });
    expect(overridePreview.canBuy).toBe(false);
    expect(overridePreview.blockingReasons).toContain("player_sold_this_season_unavailable");
  });

  // Root-cause fix (2026-07-04, W-W chronically stuck below hardMin on the real S1-S10 save — see
  // outputs/real-engine-s1s5-final/progress-log.md): SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER had no
  // override anywhere (unlike the same-team-specific allowRecentlySoldRebuyOverride tested above),
  // so a team below its absolute roster minimum with an emptied-out affordable candidate pool could
  // get permanently stuck if its one remaining legal candidate happened to be sold by an unrelated
  // team in the same session — retrying can never fix this, since the (correct, by design) cooldown
  // doesn't change between retries. The new bypassSoldThisSeasonCooldown flag lets a caller (only
  // the emergency-roster-repair fallback in chunked-redraft-topup-service.ts uses it, and only for
  // teams still below hardMin) explicitly accept that trade-off for this narrow last-resort case,
  // without weakening the cooldown for any regular buy.
  it("lets an explicit override bypass the season-wide sold-cooldown for a different team, unlike allowRecentlySoldRebuyOverride", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [
          createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 }),
          createTeam({ teamId: "B-B", shortCode: "B-B", name: "Blazing Beasts", cash: 175 }),
        ],
        players: [createPlayer("p1", { name: "Recently Sold", marketValue: 40, displayMarketValue: 40, salaryDemand: 10, displaySalary: 10 })],
        transferHistory: [
          {
            id: "history-sell-p1",
            playerId: "p1",
            seasonId: "season-1",
            matchdayId: "matchday-1",
            phase: "manual_transfer_window",
            source: "ai_preseason_market_sell",
            seasonLabel: "Season 1",
            transferType: "sell",
            fromTeamId: "A-A",
            toTeamId: null,
            fee: 40,
            salary: 10,
            marketValue: 40,
            remainingContractLength: 1,
            happenedAt: "2026-06-12T10:00:00.000Z",
          },
        ],
      }),
    };

    const { previewLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");

    const withoutBypass = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "B-B",
      playerId: "p1",
      transferSource: "preseason_roster_repair_buy",
    });
    expect(withoutBypass.canBuy).toBe(false);
    expect(withoutBypass.blockingReasons).toContain("player_sold_this_season_unavailable");

    const withBypass = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "B-B",
      playerId: "p1",
      transferSource: "preseason_roster_repair_buy",
      bypassSoldThisSeasonCooldown: true,
    });
    expect(withBypass.blockingReasons).not.toContain("player_sold_this_season_unavailable");
    expect(withBypass.warnings).toContain("player_sold_this_season_cooldown_override");
    expect(withBypass.canBuy).toBe(true);
  });

  // Course correction (2026-07-04): S1 buys are NOT forbidden — the draft is just the first
  // ordinary application of the same acquisition engine to empty rosters with starting budget. A
  // team that sells down (or organically drops) below hardMin/Opt in S1 must be able to rebuy in
  // the same season, exactly like any later season. This test used to assert the opposite (S1
  // market buys hard-blocked); it now asserts the new, intended behaviour.
  it("permits season-1 transfer-market buys at preview and execute, same as draft picks", async () => {
    const { SEASON_ONE_MARKET_BUY_BLOCKER } = await import("@/lib/season/transfer-season-policy");
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 500 })],
        players: [
          createPlayer("fa-1", {
            name: "Free Agent",
            marketValue: 40,
            displayMarketValue: 40,
            salaryDemand: 10,
            displaySalary: 10,
          }),
          createPlayer("fa-2", {
            name: "Free Agent 2",
            marketValue: 40,
            displayMarketValue: 40,
            salaryDemand: 10,
            displaySalary: 10,
          }),
        ],
      }),
    };

    const { previewLocalTransfermarktBuy, executeLocalTransfermarktBuy } =
      await import("@/lib/market/transfermarkt-local-service");

    const draftPreview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-1",
      transferSource: "ai_roster_fill",
    });
    expect(draftPreview.blockingReasons).not.toContain(SEASON_ONE_MARKET_BUY_BLOCKER);

    const marketPreview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-2",
      transferSource: "ai_preseason_market_buy",
    });
    expect(marketPreview.blockingReasons).not.toContain(SEASON_ONE_MARKET_BUY_BLOCKER);

    const marketExecute = executeLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-2",
      transferSource: "ai_preseason_market_buy",
    });
    expect(marketExecute.blockingReasons).not.toContain(SEASON_ONE_MARKET_BUY_BLOCKER);
    expect(marketExecute.transferCreated).toBe(true);
  });

  it("normalizes legacy roster prices so equal entry and exit values do not show fake profit", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", {
            name: "Legacy Seed Player",
            marketValue: 40000,
            displayMarketValue: 40,
            salaryDemand: 10,
            displaySalary: 10,
          }),
        ],
        rosters: [
          createRosterEntry("r1", "p1", {
            salary: 10,
            contractLength: 3,
            currentValue: 40000,
            purchasePrice: 40000,
          }),
        ],
      }),
    };

    const { previewLocalTransfermarktSell } = await import("@/lib/market/transfermarkt-local-service");
    const preview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });

    expect(preview.salePrice).toBeCloseTo(39.76, 1);
    expect(preview.activePlayer?.purchasePrice).toBe(40);
    expect(preview.profit).toBeCloseTo(-0.24, 1);
  });

  it("uses bracket and mvs ranking for live sale factors once discipline results exist", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", {
            name: "Top Seller",
            marketValue: 40000,
            displayMarketValue: 40,
            salaryDemand: 10,
            displaySalary: 10,
          }),
          createPlayer("p2", {
            name: "Lower Seller",
            marketValue: 41000,
            displayMarketValue: 41,
            salaryDemand: 10,
            displaySalary: 10,
          }),
        ],
        rosters: [
          createRosterEntry("r1", "p1", { salary: 10, contractLength: 3, currentValue: 40000, purchasePrice: 40000 }),
          createRosterEntry("r2", "p2", { salary: 10, contractLength: 3, currentValue: 41000, purchasePrice: 41000 }),
        ],
      }),
    };

    persistenceState.save!.gameState.seasonState.matchdayResults = [createAppliedMatchdayResult()];
    persistenceState.save!.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "A-A",
        playerId: "p1",
        activePlayerId: "r1",
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 80,
        finalPlayerScore: 92,
        scoreContribution: 92,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 1,
        createdAt: "2026-06-10T12:00:00.000Z",
      },
      {
        id: "perf-2",
        matchdayResultId: "result-1",
        teamId: "A-A",
        playerId: "p2",
        activePlayerId: "r2",
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 70,
        finalPlayerScore: 71,
        scoreContribution: 71,
        rankInTeam: 2,
        rankInDiscipline: 2,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.5,
        createdAt: "2026-06-10T12:00:00.000Z",
      },
    ];

    const { previewLocalTransfermarktSell } = await import("@/lib/market/transfermarkt-local-service");
    const topPreview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r1",
    });
    const lowerPreview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      activePlayerId: "r2",
    });

    expect(topPreview.saleFactor).toBeCloseTo(1.555, 2);
    expect(topPreview.salePrice).toBeCloseTo(62.2, 1);
    expect(lowerPreview.saleFactor).toBeCloseTo(0.756, 2);
    expect(lowerPreview.salePrice).toBeCloseTo(31.0, 1);
    expect(topPreview.salePrice).toBeGreaterThan(lowerPreview.salePrice ?? 0);
  });

  it("keeps the second-best MVS player in a three-player bracket above market value", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "P-S", shortCode: "P-S", cash: 300 })],
        players: [
          createPlayer("p1", { name: "Bracket Leader", marketValue: 55700, displayMarketValue: 55.7, salaryDemand: 10, displaySalary: 10 }),
          createPlayer("p2", { name: "Akaryu Case", marketValue: 55350, displayMarketValue: 55.35, salaryDemand: 10, displaySalary: 10 }),
          createPlayer("p3", { name: "Bracket Third", marketValue: 55230, displayMarketValue: 55.23, salaryDemand: 10, displaySalary: 10 }),
        ],
        rosters: [
          createRosterEntry("r1", "p1", { teamId: "P-S", purchasePrice: 55.7, currentValue: 55.7 }),
          createRosterEntry("r2", "p2", { teamId: "P-S", purchasePrice: 55.35, currentValue: 55.35 }),
          createRosterEntry("r3", "p3", { teamId: "P-S", purchasePrice: 55.23, currentValue: 55.23 }),
        ],
      }),
    };
    persistenceState.save.gameState.seasonState.matchdayResults = [createAppliedMatchdayResult()];
    persistenceState.save.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "P-S",
        playerId: "p1",
        activePlayerId: "r1",
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 80,
        finalPlayerScore: 99,
        scoreContribution: 99,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 1,
        createdAt: "2026-06-10T12:00:00.000Z",
      },
      {
        id: "perf-2",
        matchdayResultId: "result-1",
        teamId: "P-S",
        playerId: "p2",
        activePlayerId: "r2",
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 1,
        baseValue: 78,
        finalPlayerScore: 95,
        scoreContribution: 95,
        rankInTeam: 2,
        rankInDiscipline: 2,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 1,
        createdAt: "2026-06-10T12:00:00.000Z",
      },
      {
        id: "perf-3",
        matchdayResultId: "result-1",
        teamId: "P-S",
        playerId: "p3",
        activePlayerId: "r3",
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 2,
        baseValue: 70,
        finalPlayerScore: 86,
        scoreContribution: 86,
        rankInTeam: 3,
        rankInDiscipline: 3,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 0.7,
        createdAt: "2026-06-10T12:00:00.000Z",
      },
    ];

    const { previewLocalTransfermarktSell } = await import("@/lib/market/transfermarkt-local-service");
    const preview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "P-S",
      activePlayerId: "r2",
    });

    expect(preview.saleFactor).toBeGreaterThan(1);
    expect(preview.salePrice).toBeGreaterThan(preview.marketValueReference ?? 0);
  });

  it("keeps sale factors neutral after a season reset until the new season has applied matchday scores", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("p1", {
            name: "Snapshot Star",
            marketValue: 40000,
            displayMarketValue: 40,
            salaryDemand: 10,
            displaySalary: 10,
          }),
          createPlayer("p2", {
            name: "Snapshot Depth",
            marketValue: 41000,
            displayMarketValue: 41,
            salaryDemand: 10,
            displaySalary: 10,
          }),
        ],
        rosters: [
          createRosterEntry("r1", "p1", { salary: 10, contractLength: 1, currentValue: 40000, purchasePrice: 40000 }),
          createRosterEntry("r2", "p2", { salary: 10, contractLength: 1, currentValue: 41000, purchasePrice: 41000 }),
        ],
      }),
    };
    persistenceState.save.gameState.season = {
      id: "season-3",
      name: "Season 3",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["season-3-matchday-1"],
    };
    persistenceState.save.gameState.seasonState = {
      ...persistenceState.save.gameState.seasonState,
      seasonId: "season-3",
      playerDisciplinePerformances: [],
      seasonSnapshots: [
        {
          seasonId: "season-2",
          seasonName: "Season 2",
          archivedAt: "2026-06-12T10:00:00.000Z",
          status: "completed",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: "p1",
              playerName: "Snapshot Star",
              teamId: "A-A",
              teamCode: "A-A",
              teamName: "Armageddon Aftermath",
              seasonId: "season-2",
              appearances: 10,
              totalContribution: 44,
              totalPoints: 44,
              averageContribution: 4.4,
              averageFinalScore: 90,
              top10Count: 8,
              mvpCount: 2,
              bestDisciplineId: "d1",
              bestDisciplineLabel: "Diszi 1",
              bestDisciplineScore: 110,
              warnings: [],
            },
            {
              playerId: "p2",
              playerName: "Snapshot Depth",
              teamId: "A-A",
              teamCode: "A-A",
              teamName: "Armageddon Aftermath",
              seasonId: "season-2",
              appearances: 10,
              totalContribution: 8,
              totalPoints: 8,
              averageContribution: 0.8,
              averageFinalScore: 35,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "d1",
              bestDisciplineLabel: "Diszi 1",
              bestDisciplineScore: 35,
              warnings: [],
            },
          ],
        },
      ],
    };

    const { previewLocalTransfermarktSell } = await import("@/lib/market/transfermarkt-local-service");
    const preview = previewLocalTransfermarktSell({
      saveId: "save-singleplayer-dev",
      seasonId: "season-3",
      teamId: "A-A",
      activePlayerId: "r1",
    });

    expect(preview.saleFactor).toBeCloseTo(0.994, 2);
    expect(preview.salePrice).toBeCloseTo((preview.marketValueReference ?? 0) * 0.994, 1);
    expect(preview.profit).toBeCloseTo((preview.salePrice ?? 0) - (preview.activePlayer?.purchasePrice ?? 0), 1);
  });

  it("builds deterministic contract shapes with identical total salary", () => {
    const balanced = buildContractSalarySchedule({
      annualSalary: 10,
      contractLength: 5,
      shape: "balanced",
      seasonLabelBase: "Season 1",
    });
    const frontLoaded = buildContractSalarySchedule({
      annualSalary: 10,
      contractLength: 5,
      shape: "front_loaded",
      seasonLabelBase: "Season 1",
    });
    const backLoaded = buildContractSalarySchedule({
      annualSalary: 10,
      contractLength: 5,
      shape: "back_loaded",
      seasonLabelBase: "Season 1",
    });

    expect(balanced.totalSalary).toBe(50);
    expect(frontLoaded.totalSalary).toBe(50);
    expect(backLoaded.totalSalary).toBe(50);
    expect(frontLoaded.yearlySalarySchedule[0]?.salary).toBeGreaterThan(frontLoaded.yearlySalarySchedule[4]?.salary ?? 0);
    expect(backLoaded.yearlySalarySchedule[0]?.salary).toBeLessThan(backLoaded.yearlySalarySchedule[4]?.salary ?? 0);
  });

  it("treats contract length 1 identically across all shapes", () => {
    const balanced = buildContractSalarySchedule({
      annualSalary: 12,
      contractLength: 1,
      shape: "balanced",
      seasonLabelBase: "Season 1",
    });
    const frontLoaded = buildContractSalarySchedule({
      annualSalary: 12,
      contractLength: 1,
      shape: "front_loaded",
      seasonLabelBase: "Season 1",
    });
    const backLoaded = buildContractSalarySchedule({
      annualSalary: 12,
      contractLength: 1,
      shape: "back_loaded",
      seasonLabelBase: "Season 1",
    });

    expect(frontLoaded.yearlySalarySchedule).toEqual(balanced.yearlySalarySchedule);
    expect(backLoaded.yearlySalarySchedule).toEqual(balanced.yearlySalarySchedule);
  });

  it("computes buyout as the full remaining salary schedule", () => {
    const frontLoaded = buildContractSalarySchedule({
      annualSalary: 10,
      contractLength: 5,
      shape: "front_loaded",
      seasonLabelBase: "Season 1",
    });

    expect(calculateOpenBuyoutCost(frontLoaded.yearlySalarySchedule, 0)).toBe(50);
    expect(calculateOpenBuyoutCost(frontLoaded.yearlySalarySchedule, 2)).toBe(
      Number(
        (
          (frontLoaded.yearlySalarySchedule[2]?.salary ?? 0) +
          (frontLoaded.yearlySalarySchedule[3]?.salary ?? 0) +
          (frontLoaded.yearlySalarySchedule[4]?.salary ?? 0)
        ).toFixed(2),
      ),
    );
  });

  it("lowers acceptance score for lowball offers and raises it for stronger offers", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = persistenceState.save!.gameState.players.find((entry) => entry.id === "fa-1")!;

    const lowball = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 4,
      seasonLabelBase: "Season 1",
    });
    const fair = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 6,
      seasonLabelBase: "Season 1",
    });
    const premium = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 7.5,
      seasonLabelBase: "Season 1",
    });

    expect(lowball.acceptanceScore ?? -1).toBeLessThan(fair.acceptanceScore ?? 0);
    expect(premium.acceptanceScore ?? -1).toBeGreaterThan(fair.acceptanceScore ?? 0);
    expect(lowball.acceptChance ?? -1).toBeLessThan(fair.acceptChance ?? 0);
    expect(premium.acceptChance ?? -1).toBeGreaterThan(fair.acceptChance ?? 0);
    expect(lowball.rejectChance ?? 0).toBeGreaterThan(premium.rejectChance ?? -1);
    expect(lowball.counterChance ?? 0).toBeGreaterThan(0);
  });

  it("applies a bad-experience negotiation penalty without changing salary input", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = persistenceState.save!.gameState.players.find((entry) => entry.id === "fa-1")!;

    const clean = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 6,
      seasonLabelBase: "Season 1",
    });
    const badExperience = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 6,
      priorBadExperience: true,
      seasonLabelBase: "Season 1",
    });

    expect(badExperience.offeredSalary).toBe(clean.offeredSalary);
    expect(badExperience.acceptanceScore ?? 0).toBeLessThan(clean.acceptanceScore ?? 0);
    expect(badExperience.acceptChance ?? 0).toBeLessThan(clean.acceptChance ?? 0);
    expect(badExperience.warnings).toContain("previous_rejected_offer_reduces_trust");
  });

  it("adjusts player salary demand by fit, traits, team culture and exposes score factors", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = createPlayer("scandalous-merc", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Mercenary"],
      traitsNegative: ["Scandalous"],
    });

    const strictCulture = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: {
        teamId: "A-A",
        pow: 0,
        spe: 0,
        men: 0,
        soc: 0,
        ambition: 6,
        finances: 9,
        boardConfidence: 8,
        harmony: 9,
        manners: 10,
        popularity: 6,
        cooperation: 8,
        playerMin: 7,
        playerOpt: 10,
      },
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const relaxedCulture = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: {
        teamId: "A-A",
        pow: 0,
        spe: 0,
        men: 0,
        soc: 0,
        ambition: 6,
        finances: 5,
        boardConfidence: 8,
        harmony: 4,
        manners: 4,
        popularity: 6,
        cooperation: 4,
        playerMin: 7,
        playerOpt: 10,
      },
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });

    expect(strictCulture.expectedSalary ?? 0).toBeGreaterThan(relaxedCulture.expectedSalary ?? 0);
    expect(strictCulture.demandMultiplier ?? 0).toBeGreaterThan(1);
    expect(strictCulture.expectedSalary ?? 0).toBeGreaterThan(relaxedCulture.expectedSalary ?? 0);
    expect(strictCulture.scoreBreakdown.some((entry) => entry.key === "trait_culture" && entry.points < 0)).toBe(true);
    expect(strictCulture.scoreBreakdown.some((entry) => entry.key === "salary_offer")).toBe(true);
  });

  it("keeps annual salary demands lower for longer contracts while showing the length reason", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = createPlayer("long-term-target", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Loyal"],
      traitsNegative: [],
    });

    const oneYear = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 1,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const fiveYears = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });

    expect(fiveYears.expectedSalary ?? 0).toBeLessThan(oneYear.expectedSalary ?? 0);
    expect((fiveYears.expectedSalary ?? 0) / (oneYear.expectedSalary ?? 1)).toBeLessThan(0.7);
    expect(fiveYears.totalSalary ?? 0).toBeGreaterThan(oneYear.totalSalary ?? 0);
    expect(fiveYears.scoreBreakdown.some((entry) => entry.key === "contract_length_security" && entry.points > 0)).toBe(true);
    expect(oneYear.scoreBreakdown.some((entry) => entry.key === "contract_length_security")).toBe(true);
  });

  it("uses the reduced expected salary as the automatic offer for longer contracts", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = createPlayer("auto-long-term-target", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Loyal"],
      traitsNegative: [],
    });

    const oneYear = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 1,
      contractShape: "balanced",
      offeredSalary: null,
      seasonLabelBase: "Season 1",
    });
    const fiveYears = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: null,
      seasonLabelBase: "Season 1",
    });

    expect(fiveYears.expectedSalary ?? 0).toBeLessThan(oneYear.expectedSalary ?? 0);
    expect(fiveYears.offeredSalary).toBe(fiveYears.expectedSalary);
    expect(fiveYears.offeredSalary ?? 0).toBeLessThan(oneYear.offeredSalary ?? 0);
  });

  it("still gives pricey personalities a smaller long-contract annual discount", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const loyal = createPlayer("loyal-long-term", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Loyal"],
      traitsNegative: [],
    });
    const mercenary = createPlayer("merc-long-term", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Mercenary"],
      traitsNegative: [],
    });

    const loyalPreview = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: loyal,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const mercenaryPreview = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: mercenary,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });

    expect(mercenaryPreview.expectedSalary ?? 0).toBeGreaterThan(loyalPreview.expectedSalary ?? 0);
    expect(mercenaryPreview.scoreBreakdown.some((entry) => entry.key === "contract_length_security")).toBe(true);
  });

  it("applies the Retool extra 10 percent salary discount once team fit reaches 25", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = createPlayer("fit-discount-target", {
      salaryDemand: 100,
      displaySalary: 10,
      race: "Human",
      alignment: "N",
      traitsPositive: ["Loyal"],
    });
    const rosterPlayers = Array.from({ length: 10 }, (_, index) =>
      createPlayer(`fit-context-${index}`, {
        race: "Human",
        alignment: "N",
        traitsPositive: ["Loyal"],
      }),
    );

    const noFitDiscount = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers: [],
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const fitDiscount = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers,
      contractLength: 3,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });

    expect(fitDiscount.teamFit ?? 0).toBeGreaterThanOrEqual(25);
    expect((fitDiscount.expectedSalary ?? 0) / (noFitDiscount.expectedSalary ?? 1)).toBeCloseTo(0.9, 2);
    expect(fitDiscount.scoreBreakdown.find((entry) => entry.key === "contract_length_security")?.reason).toContain("10% Fit-Rabatt");
  });

  it("keeps five-year high-fit standard deals inside the sampled Retool salary band", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const player = createPlayer("five-year-fit-target", {
      salaryDemand: 100,
      displaySalary: 10,
      race: "Human",
      alignment: "N",
      traitsPositive: ["Loyal"],
      traitsNegative: [],
    });
    const rosterPlayers = Array.from({ length: 10 }, (_, index) =>
      createPlayer(`five-year-fit-context-${index}`, {
        race: "Human",
        alignment: "N",
        traitsPositive: ["Loyal"],
        traitsNegative: [],
      }),
    );

    const fiveYears = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player,
      rosterPlayers,
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const annualRatio = (fiveYears.expectedSalary ?? 0) / (fiveYears.baseExpectedSalary ?? 1);

    expect(fiveYears.teamFit ?? 0).toBeGreaterThanOrEqual(25);
    expect(annualRatio).toBeGreaterThanOrEqual(0.5);
    expect(annualRatio).toBeLessThanOrEqual(0.7);
    expect(fiveYears.reasons.some((reason) => reason.includes("Retool-Vertragslogik"))).toBe(true);
  });

  it("exposes player contract preferences and prices mismatches into the negotiation", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const loyal = createPlayer("loyal-security", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: ["Loyal", "Disciplined"],
      traitsNegative: [],
    });

    const preferred = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: loyal,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });
    const mismatch = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: loyal,
      rosterPlayers: [],
      contractLength: 1,
      contractShape: "balanced",
      offeredSalary: 10,
      seasonLabelBase: "Season 1",
    });

    expect(buildPlayerContractPreference(loyal)?.lengthPreference).toBe("long");
    expect(preferred.contractPreference?.matchQuality).toBe("preferred");
    expect(mismatch.contractPreference?.matchQuality).toBe("mismatch");
    expect(mismatch.expectedSalary ?? 0).toBeGreaterThan(preferred.expectedSalary ?? 0);
    expect(preferred.scoreBreakdown.some((entry) => entry.key === "player_contract_preference" && entry.points > 0)).toBe(true);
    expect(mismatch.scoreBreakdown.some((entry) => entry.key === "player_contract_preference" && entry.points < 0)).toBe(true);
  });

  it("applies long-contract annual discount before short-preference premium", () => {
    const team = persistenceState.save!.gameState.teams[0]!;
    const shortPreferencePlayer = createPlayer("short-flexibility-target", {
      salaryDemand: 100,
      displaySalary: 10,
      traitsPositive: [],
      traitsNegative: ["Mercenary", "Ambitious", "Scandalous"],
    });

    expect(buildPlayerContractPreference(shortPreferencePlayer)?.lengthPreference).toBe("short");

    const oneYear = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: shortPreferencePlayer,
      rosterPlayers: [],
      contractLength: 1,
      contractShape: "balanced",
      offeredSalary: null,
      seasonLabelBase: "Season 1",
    });
    const fiveYears = buildContractNegotiationPreview({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      team,
      teamIdentity: null,
      teamStrategyProfile: null,
      player: shortPreferencePlayer,
      rosterPlayers: [],
      contractLength: 5,
      contractShape: "balanced",
      offeredSalary: null,
      seasonLabelBase: "Season 1",
    });

    expect(fiveYears.contractPreference?.salaryAdjustmentPct ?? 0).toBeGreaterThan(0);
    expect(fiveYears.expectedSalary ?? 0).toBeLessThan(oneYear.expectedSalary ?? 0);
    const contractDiscount = fiveYears.demandBreakdown.find((entry) => entry.key === "contract_length_discount");
    expect(contractDiscount?.multiplier ?? 1).toBeLessThanOrEqual(0.94);
    expect(fiveYears.demandBreakdown.some((entry) => entry.key === "player_contract_wish_salary")).toBe(true);
  });

  it("keeps the player's contract-shape preference stable across opposite team profiles", () => {
    const player = createPlayer("shape-seeded-player", {
      traitsPositive: ["Focused"],
      traitsNegative: [],
    });
    const cashTightProfile = {
      bias: {
        cashPriority: 10,
        wageSensitivity: 10,
      },
    } as TeamStrategyProfile;
    const starRushProfile = {
      bias: {
        starPriority: 10,
        riskTolerance: 10,
      },
    } as TeamStrategyProfile;

    const conservative = buildPlayerContractPreference(player, cashTightProfile);
    const aggressive = buildPlayerContractPreference(player, starRushProfile);

    expect(conservative?.shapePreference).toBe(aggressive?.shapePreference);
  });

  it("uses negotiated salary for local buy roster salary and team salary preview", async () => {
    persistenceState.save = {
      saveId: "save-singleplayer-dev",
      gameState: createGameState({
        teams: [createTeam({ teamId: "A-A", shortCode: "A-A", cash: 175 })],
        players: [
          createPlayer("fa-negotiated", {
            name: "Negotiator",
            marketValue: 1000,
            displayMarketValue: 10,
            salaryDemand: 100,
            displaySalary: 10,
          }),
        ],
        rosters: [],
      }),
    };

    const { executeLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");
    const result = executeLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: "fa-negotiated",
      offeredSalary: 12.5,
      contractLength: 2,
    });

    expect(result.canBuy).toBe(true);
    expect(result.offeredSalary).toBe(12.5);
    expect(result.salaryAfter).toBe(12.5);
    expect(persistenceState.save.gameState.rosters[0]?.salary).toBe(12.5);
    expect(persistenceState.save.gameState.transferHistory[0]?.salary).toBe(12.5);
  });

  it("shows active contracts as balanced and includes preview drafts in the team contracts table", () => {
    const gameState = persistenceState.save!.gameState;
    gameState.seasonState.contractNegotiationDrafts = [
      {
        draftId: "contract-draft:season-1:A-A:fa-1",
        saveId: "save-singleplayer-dev",
        seasonId: "season-1",
        teamId: "A-A",
        playerId: "fa-1",
        playerName: "fa-1",
        contractLength: 2,
        contractShape: "front_loaded",
        expectedSalary: 6,
        offeredSalary: 6.5,
        yearlySalarySchedule: [
          { yearIndex: 1, seasonOffset: 0, label: "Season 1", salary: 7 },
          { yearIndex: 2, seasonOffset: 1, label: "Season 2", salary: 6 },
        ],
        totalSalary: 13,
        roundingAdjustment: 0,
        buyoutCost: 13,
        bracket: 4,
        teamFit: 8,
        acceptanceScore: 61,
        acceptChance: 48,
        counterChance: 32,
        rejectChance: 20,
        reasons: ["test"],
        warnings: [],
        blockingReasons: [],
        status: "ready_for_review",
        updatedAt: new Date().toISOString(),
      },
    ];

    const table = buildTeamContractSeasonTable({
      gameState,
      teamId: "A-A",
      seasonLabelBase: "Season 1",
    });

    expect(table.rows.some((row) => row.status === "active" && row.contractShape === "balanced")).toBe(true);
    expect(table.rows.some((row) => row.status === "preview" && row.contractShape === "front_loaded")).toBe(true);
    expect(table.seasonLabels).toHaveLength(5);
    expect(table.totalsCommitted).toHaveLength(5);
    expect(table.totalsWithPreview[0]?.salary).toBeGreaterThan(table.totalsCommitted[0]?.salary ?? 0);
  });

  it("applies prior bad-experience trust from an earlier season draft", async () => {
    const { previewLocalTransfermarktBuy } = await import("@/lib/market/transfermarkt-local-service");
    const gameState = persistenceState.save!.gameState;
    gameState.season.id = "season-2";
    gameState.seasonState.seasonId = "season-2";
    gameState.seasonState.contractNegotiationDrafts = [
      {
        draftId: "contract-draft:season-1:A-A:fa-1",
        saveId: "save-singleplayer-dev",
        seasonId: "season-1",
        teamId: "A-A",
        playerId: "fa-1",
        playerName: "fa-1",
        contractLength: 2,
        contractShape: "balanced",
        expectedSalary: 6,
        offeredSalary: 6,
        yearlySalarySchedule: [],
        totalSalary: 12,
        roundingAdjustment: 0,
        buyoutCost: 12,
        bracket: 4,
        teamFit: 8,
        acceptanceScore: 40,
        acceptChance: 20,
        counterChance: 30,
        rejectChance: 50,
        reasons: [],
        warnings: ["negotiation_cancelled_after_contact"],
        blockingReasons: [],
        status: "rejected_bad_experience",
        updatedAt: new Date().toISOString(),
      },
    ];

    const preview = previewLocalTransfermarktBuy({
      saveId: "save-singleplayer-dev",
      seasonId: "season-2",
      teamId: "A-A",
      playerId: "fa-1",
    });

    expect(preview.negotiationWarnings).toContain("previous_rejected_offer_reduces_trust");
  });
});
