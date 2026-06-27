import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  buildTransfermarktSaleFactorBreakdown,
  hasCurrentSeasonSaleFactorRanking,
} from "@/lib/market/transfermarkt-sale-factor";

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
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 60,
    salaryDemand: partial?.salaryDemand ?? 10,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 60,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 10,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 70, d2: 65 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 2,
        above40: 2,
        above60: 2,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  };
}

function createRosterEntry(id: string, playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 3,
    salary: partial?.salary ?? 10,
    upkeep: partial?.upkeep ?? partial?.salary ?? 10,
    purchasePrice: partial?.purchasePrice ?? 60,
    currentValue: partial?.currentValue ?? 60,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createSeasonStartGameState(input?: {
  players?: Player[];
  rosters?: RosterEntry[];
  playerDisciplinePerformances?: GameState["seasonState"]["playerDisciplinePerformances"];
  seasonSnapshots?: GameState["seasonState"]["seasonSnapshots"];
  seasonId?: string;
}): GameState {
  const teams = [createTeam()];
  const players = input?.players ?? [createPlayer("p1")];
  const rosters = input?.rosters ?? [createRosterEntry("r1", "p1", { currentValue: 60, purchasePrice: 60 })];
  return {
    gamePhase: "preseason_management",
    season: {
      id: input?.seasonId ?? "season-1",
      name: "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: input?.seasonId ?? "season-1",
      schedule: [],
      standings: { "A-A": { points: 0 } },
      playerDisciplinePerformances: input?.playerDisciplinePerformances ?? [],
      seasonSnapshots: input?.seasonSnapshots ?? [],
    },
    teams,
    players,
    rosters,
    disciplines: [],
    contracts: [],
    transferHistory: [],
    logs: [],
    teamIdentities: [],
    facilities: [],
    facilityUpgrades: [],
    facilityStaff: [],
    scoutingAssignments: [],
    scoutingReports: [],
    watchlistEntries: [],
    sponsorOffers: [],
    sponsorContracts: [],
    boardObjectives: [],
    seasonObjectives: [],
    playerSeasonPerformances: [],
    matchdayResults: [],
    lineups: [],
    aiTransferIntents: [],
    marketListings: [],
    freeAgents: [],
    draftState: null,
    allianceState: null,
    progressionState: null,
    inboxMessages: [],
    newsItems: [],
    managerPlannerState: null,
    localTeamSettings: {},
  };
}

describe("transfermarkt sale factor season start", () => {
  it("does not rank players before the current season has scored performance points", () => {
    const gameState = createSeasonStartGameState();
    const rosterEntry = gameState.rosters[0]!;
    const player = gameState.players.find((entry) => entry.id === rosterEntry.playerId)!;

    expect(hasCurrentSeasonSaleFactorRanking(gameState)).toBe(false);

    const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);

    expect(breakdown.saleFactor).toBe(1);
    expect(breakdown.salePrice).toBe(breakdown.baseMarketValue);
    expect(breakdown.factorSource).toBe("fallback_no_ranked_group");
  });

  it("ignores stale season snapshots when the new season has no scored points yet", () => {
    const gameState = createSeasonStartGameState({ seasonId: "season-2" });
    const rosterEntry = gameState.rosters[0]!;
    const player = gameState.players.find((entry) => entry.id === rosterEntry.playerId)!;

    gameState.seasonState = {
      ...gameState.seasonState,
      playerDisciplinePerformances: [],
      seasonSnapshots: [
        {
          seasonId: "season-1",
          status: "completed",
          createdAt: "2026-01-01T00:00:00.000Z",
          archivedAt: "2026-06-01T00:00:00.000Z",
          playerPerformances: [
            {
              playerId: player.id,
              totalPoints: 42,
              totalContribution: 42,
            },
          ],
        },
      ],
    };

    expect(hasCurrentSeasonSaleFactorRanking(gameState)).toBe(false);

    const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, player, rosterEntry);

    expect(breakdown.saleFactor).toBe(1);
    expect(breakdown.salePrice).toBe(breakdown.baseMarketValue);
    expect(breakdown.factorSource).toBe("fallback_no_ranked_group");
  });

  it("matches Retool bracket-8 pricing for rank 2 in a five-player group", () => {
    const players = Array.from({ length: 5 }, (_, index) =>
      createPlayer(`p${index + 1}`, {
        name: `Bracket Eight ${index + 1}`,
        marketValue: 60 - index * 0.1,
        displayMarketValue: 60 - index * 0.1,
      }),
    );
    const rosters = players.map((player, index) =>
      createRosterEntry(`r${index + 1}`, player.id, {
        currentValue: 60 - index * 0.1,
        purchasePrice: 60 - index * 0.1,
      }),
    );
    const performances = players.map((player, index) => ({
      id: `perf-${index + 1}`,
      matchdayResultId: "result-1",
      teamId: "A-A",
      playerId: player.id,
      activePlayerId: rosters[index]!.id,
      disciplineId: "d1",
      disciplineSide: "d1" as const,
      slotIndex: index,
      baseValue: 80,
      finalPlayerScore: 100 - index * 5,
      scoreContribution: 100 - index * 5,
      rankInTeam: index + 1,
      rankInDiscipline: index + 1,
      isTop10: true,
      isMvpCandidate: index === 0,
      storyWeight: 1,
      createdAt: "2026-06-10T12:00:00.000Z",
    }));

    const gameState = createSeasonStartGameState({
      players,
      rosters,
      playerDisciplinePerformances: performances,
    });
    gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        saveId: "save-test",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
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
      },
    ];

    const targetPlayer = players[1]!;
    const targetRoster = rosters[1]!;
    const breakdown = buildTransfermarktSaleFactorBreakdown(gameState, targetPlayer, targetRoster);

    expect(breakdown.bracket).toBe(8);
    expect(breakdown.bracketGroupSize).toBe(5);
    expect(breakdown.rankInBracket).toBe(2);
    expect(breakdown.baseFactor).toBe(1.095);
    expect(breakdown.rankBonus).toBe(0.1);
    expect(breakdown.saleFactor).toBe(1.195);
  });
});
