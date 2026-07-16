import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Player One",
    rating: partial?.rating ?? 61.5,
    marketValue: partial?.marketValue ?? 85000,
    salaryDemand: partial?.salaryDemand ?? 8000,
    displayMarketValue: partial?.displayMarketValue ?? 72.57,
    displaySalary: partial?.displaySalary ?? 16.54,
    pps: partial?.pps ?? 54.4,
    ovr: partial?.ovr ?? 66,
    currentXP: partial?.currentXP,
    spentXP: partial?.spentXP,
    lifetimeXP: partial?.lifetimeXP,
    trainingMode: partial?.trainingMode,
    cost: partial?.cost ?? 85,
    upkeepBase: partial?.upkeepBase ?? 8,
    className: partial?.className ?? "Berserker",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 60, d2: 66 },
    previousDisciplineRatings: partial?.previousDisciplineRatings,
    currentDisciplineValues: partial?.currentDisciplineValues,
    lastSeasonDisciplineValues: partial?.lastSeasonDisciplineValues,
    disciplineDelta: partial?.disciplineDelta,
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? { above20: 2, above40: 2, above60: 1, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    injuryHistory: partial?.injuryHistory,
  };
}

function createGameState(input: { player: Player; withRoster?: boolean; snapshotPoints?: number | null }): GameState {
  const teamId = "team-1";
  const rosterId = "roster-1";

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"],
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots:
        input.snapshotPoints == null
          ? []
          : [
              {
                seasonId: "season-1",
                seasonName: "Season 1",
                archivedAt: "2026-06-06T10:00:00.000Z",
                finalStandings: [],
                playerPerformances: [
                  {
                    playerId: input.player.id,
                    playerName: input.player.name,
                    teamId: input.withRoster ? teamId : null,
                    teamCode: input.withRoster ? "T-1" : null,
                    teamName: input.withRoster ? "Team One" : null,
                    appearances: 4,
                    totalContribution: input.snapshotPoints,
                    totalPoints: input.snapshotPoints,
                    averageContribution: input.snapshotPoints / 4,
                    averageFinalScore: 44.4,
                    powPoints: 12.5,
                    spePoints: 8.5,
                    menPoints: 4.2,
                    socPoints: 1.8,
                    ovr: 64.2,
                    ovrRank: 7,
                    pps: input.snapshotPoints,
                    ppsRank: 5,
                    mvs: 41.3,
                    mvsRank: 9,
                    marketValue: 31.75,
                    salary: 7.2,
                    contractLength: 2,
                    top10Count: 1,
                    mvpCount: 0,
                    bestDisciplineId: "d1",
                    bestDisciplineLabel: "Diszi 1",
                    bestDisciplineScore: 55.5,
                  },
                ],
                transferSnapshots: [
                  {
                    transferId: "transfer-history-1",
                    seasonId: "season-1",
                    playerId: input.player.id,
                    playerName: input.player.name,
                    fromTeamId: null,
                    fromTeamName: null,
                    toTeamId: input.withRoster ? teamId : null,
                    toTeamName: input.withRoster ? "Team One" : null,
                    type: "buy",
                    amount: 35,
                    salary: 7.2,
                    marketValue: 31.75,
                    amountDeltaToMarketValue: 3.25,
                    amountMarketValueFactor: 1.102,
                    contractLength: 2,
                    source: "test_transfer_history",
                    happenedAt: "2026-06-06T09:00:00.000Z",
                  },
                ],
              },
            ],
    },
    matchdayState: {
      matchdayId: "md-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: input.withRoster
      ? [
          {
            teamId,
            id: teamId,
            name: "Team One",
            shortCode: "T-1",
            cash: 100,
            budget: 100,
          } as unknown as GameState["teams"][number],
        ]
      : [],
    teamIdentities: [],
    players: [input.player],
    disciplines: [
      { id: "d1", name: "Diszi 1", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", displayOrder: 2 } as GameState["disciplines"][number],
    ],
    rosters: input.withRoster
      ? [
          {
            id: rosterId,
            playerId: input.player.id,
            teamId,
            salary: 12.75,
            contractLength: 3,
            roleTag: "starter",
            joinedSeasonId: "season-1",
            purchasePrice: 70,
            currentValue: 73,
          } as GameState["rosters"][number],
        ]
      : [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-06T10:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: input.withRoster ? 1 : 0,
      warnings: [],
    } as unknown as GameState["mappingReport"],
  };
}

function createResultGameState(player: Player): GameState {
  return {
    ...createGameState({ player, withRoster: true }),
    disciplines: [
      { id: "pow-d", name: "Power Diszi", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "spe-d", name: "Speed Diszi", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
      { id: "men-d", name: "Mental Diszi", category: "mental", displayOrder: 3 } as GameState["disciplines"][number],
    ],
    seasonState: {
      ...createGameState({ player, withRoster: true }).seasonState,
      matchdayResults: [
        {
          id: "result-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
        } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
        {
          id: "result-2",
          seasonId: "season-1",
          matchdayId: "matchday-2",
          status: "preview_applied",
        } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: "roster-1",
          disciplineId: "pow-d",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 50,
          finalPlayerScore: 51.2,
          scoreContribution: 12.5,
          rankInTeam: 1,
          rankInDiscipline: 3,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-06T10:00:00.000Z",
        },
        {
          id: "perf-2",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: "roster-1",
          disciplineId: "spe-d",
          disciplineSide: "d2",
          slotIndex: 1,
          baseValue: 48,
          finalPlayerScore: 49.9,
          scoreContribution: 8.4,
          rankInTeam: 2,
          rankInDiscipline: 6,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-06T10:05:00.000Z",
        },
        {
          id: "perf-3",
          matchdayResultId: "result-2",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: "roster-1",
          disciplineId: "men-d",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 46,
          finalPlayerScore: 47.4,
          scoreContribution: 7.1,
          rankInTeam: 1,
          rankInDiscipline: 8,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: null,
          createdAt: "2026-06-06T12:00:00.000Z",
        },
      ],
    },
  };
}

describe("player detail drawer", () => {
  it("keeps rating pps separate from season performance totals", () => {
    const player = createPlayer({ id: "player-pps", pps: 54.4, displaySalary: 9.8, salaryDemand: 9.8 });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, snapshotPoints: 88.8 }),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data).toBeTruthy();
    expect(data?.pps).toBe(88.8);
    expect(data?.ppsRating).toBe(63);
    expect(data?.seasonPerformance?.totalPoints).toBe(88.8);
  });

  it("ranks discipline season points from resolved rank points instead of old score shares", () => {
    const player = createPlayer({
      id: "player-share-high",
      name: "Share High",
      disciplineRatings: { basketball: 43 },
      currentDisciplineValues: { basketball: 43 },
    });
    const rival = createPlayer({
      id: "player-points-high",
      name: "Points High",
      disciplineRatings: { basketball: 44 },
      currentDisciplineValues: { basketball: 44 },
    });
    const gameState = createGameState({ player, withRoster: true });
    gameState.players = [player, rival];
    gameState.disciplines = [
      { id: "basketball", name: "Basketball", category: "social", displayOrder: 1, playerCount: 6 } as GameState["disciplines"][number],
    ];
    gameState.rosters = [
      ...(gameState.rosters ?? []),
      { id: "roster-2", playerId: rival.id, teamId: "team-2", salary: 10, contractLength: 2 } as GameState["rosters"][number],
    ];
    gameState.teams = [
      ...(gameState.teams ?? []),
      { teamId: "team-2", id: "team-2", name: "Team Two", shortCode: "T-2", cash: 100, budget: 100 } as unknown as GameState["teams"][number],
    ];
    gameState.seasonState.matchdayResults = [
      { id: "result-1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-result-low",
        matchdayResultId: "result-1",
        teamId: "team-1",
        disciplineId: "basketball",
        disciplineSide: "d1",
        rank: 20,
        baseScore: 100,
        totalScore: 100,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T10:00:00.000Z",
      } as NonNullable<GameState["seasonState"]["disciplineResults"]>[number],
      {
        id: "discipline-result-high",
        matchdayResultId: "result-1",
        teamId: "team-2",
        disciplineId: "basketball",
        disciplineSide: "d1",
        rank: 1,
        baseScore: 200,
        totalScore: 200,
        readinessStatus: "ready",
        warnings: [],
        createdAt: "2026-06-06T10:00:00.000Z",
      } as NonNullable<GameState["seasonState"]["disciplineResults"]>[number],
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-share-high",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: player.id,
        activePlayerId: "roster-1",
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 43,
        finalPlayerScore: 43,
        scoreContribution: 0.9,
        rankInTeam: 1,
        rankInDiscipline: 60,
        isTop10: false,
        isMvpCandidate: false,
        storyWeight: 0.9,
        createdAt: "2026-06-06T10:00:00.000Z",
      },
      {
        id: "perf-points-high",
        matchdayResultId: "result-1",
        teamId: "team-2",
        playerId: rival.id,
        activePlayerId: "roster-2",
        disciplineId: "basketball",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 44,
        finalPlayerScore: 44,
        scoreContribution: 0.1,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: true,
        storyWeight: 0.1,
        createdAt: "2026-06-06T10:00:00.000Z",
      },
    ];

    const data = buildPlayerDrawerDataFromGameState({ gameState, playerId: player.id, source: "sqlite" });
    const basketball = data?.disciplineValues.find((entry) => entry.id === "basketball");

    expect(basketball?.seasonPointsRank).toBe(2);
    expect(basketball?.seasonPoints).toBeGreaterThan(0.9);
  });

  it("keeps S1 snapshot and S2 live history stats when liveRatingsById is partial", () => {
    const player = createPlayer({ id: "player-s2-live", pps: 54.4 });
    const gameState = createResultGameState(player);
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 2,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.seasonState.matchdayResults = [
      {
        id: "result-s2-1",
        seasonId: "season-2",
        matchdayId: "matchday-1",
        status: "preview_applied",
      } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-s2-1",
        matchdayResultId: "result-s2-1",
        teamId: "team-1",
        playerId: player.id,
        activePlayerId: "roster-1",
        disciplineId: "pow-d",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: 50,
        finalPlayerScore: 51.2,
        scoreContribution: 12.5,
        rankInTeam: 1,
        rankInDiscipline: 3,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: null,
        createdAt: "2026-06-06T10:00:00.000Z",
      },
    ];
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        status: "completed",
        archivedAt: "2026-06-06T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-1",
            teamName: "Team One",
            appearances: 4,
            totalContribution: 88.8,
            totalPoints: 88.8,
            averageContribution: 22.2,
            averageFinalScore: 44.4,
            powPoints: 12.5,
            spePoints: 8.5,
            menPoints: 4.2,
            socPoints: 1.8,
            ovr: 64.2,
            ovrRank: 7,
            pps: 88.8,
            ppsRank: 5,
            mvs: 41.3,
            mvsRank: 9,
            marketValue: 31.75,
            salary: 7.2,
            contractLength: 2,
            top10Count: 1,
            mvpCount: 0,
            bestDisciplineId: "pow-d",
            bestDisciplineLabel: "Power Diszi",
            bestDisciplineScore: 55.5,
          },
        ],
        transferSnapshots: [],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const fullRatings = buildPlayerRatingContractMap(gameState);
    const partialRatings = new Map<string, (typeof fullRatings extends Map<string, infer T> ? T : never)>();
    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
      liveRatingsById: partialRatings,
    });

    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");
    const active = data?.historyRows.find((row) => row.seasonId === "season-2");

    expect(archived?.pps).toBe(88.8);
    expect(archived?.ovr).toBe(64.2);
    expect(archived?.mvs).toBe(41.3);
    expect(archived?.pow).toBe(12.5);
    expect(active?.isActiveSeason).toBe(true);
    expect(active?.pps).toBe(12.5);
    expect(active?.ovr).not.toBeNull();
    expect(active?.mvs).not.toBeNull();
    expect(active?.pow).toBe(12.5);
  });

  it("hydrates archived drawer history from playerPerformanceSnapshots when playerPerformances is empty", () => {
    const player = createPlayer({ id: "player-snapshot-alias", pps: 54.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    const snapshotRow = gameState.seasonState.seasonSnapshots?.[0]?.playerPerformances?.[0];
    if (!snapshotRow) {
      throw new Error("expected seeded season snapshot row");
    }
    gameState.seasonState.seasonSnapshots = [
      {
        ...gameState.seasonState.seasonSnapshots![0],
        playerPerformances: [],
        playerPerformanceSnapshots: [snapshotRow],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
      liveRatingsById: new Map(),
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.pps).toBe(88.8);
    expect(archived?.ovr).toBe(64.2);
    expect(archived?.pow).toBe(12.5);
  });

  it("hydrates archived drawer history with saved player metrics in later seasons", () => {
    const player = createPlayer({ id: "player-history", pps: 54.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived).toBeTruthy();
    expect(archived?.isActiveSeason).toBe(false);
    expect(archived?.pps).toBe(88.8);
    expect(archived?.ppsRank).toBe(5);
    expect(archived?.ovr).toBe(64.2);
    expect(archived?.mvs).toBe(41.3);
    expect(archived?.marketValue).toBe(31.75);
    expect(archived?.marketValueBaselineDelta).toBe(-3.25);
    expect(archived?.transferType).toBe("buy");
    expect(archived?.transferFee).toBe(35);
    expect(archived?.transferMarketValue).toBe(31.75);
    expect(archived?.transferDeltaToMarketValue).toBe(3.25);
    expect(archived?.transferMarketValueFactor).toBe(1.102);
    expect(archived?.salary).toBe(7.2);
    expect(archived?.contractLength).toBe(2);
    expect(archived?.pow).toBe(12.5);
  });

  it("uses post-progression market value for archived season rows when snapshot MW is stale", () => {
    const player = createPlayer({ id: "player-mw-fix", pps: 54.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    const snapshotRow = gameState.seasonState.seasonSnapshots?.[0]?.playerPerformances?.[0];
    if (snapshotRow) {
      snapshotRow.marketValue = 38.3;
    }
    gameState.playerProgressionEvents = [
      {
        eventId: "prog-mw-1",
        seasonId: "season-1",
        teamId: "team-1",
        playerId: player.id,
        upgrades: [],
        xpSpent: 0,
        timestamp: "2026-06-10T10:00:00.000Z",
        source: "organic_season_progression",
        progressionSnapshotAfter: {
          marketValue: 32.2,
        },
      },
    ] as unknown as NonNullable<GameState["playerProgressionEvents"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.marketValue).toBe(32.2);
  });

  it("uses buy transfer fee as MW delta baseline when snapshot purchasePrice is stale season-0 MW", () => {
    const player = createPlayer({
      id: "player-nyara",
      name: "Nyara",
      marketValue: 64.2,
      displayMarketValue: 64.2,
    });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 55 });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.rosters[0] = {
      ...gameState.rosters[0],
      purchasePrice: 64.2,
      currentValue: 64.2,
      joinedSeasonId: "season-1",
    };
    gameState.playerBaselines = [
      {
        playerId: player.id,
        name: player.name,
        race: player.race,
        className: player.className,
        subclasses: [],
        traits: [],
        traitsPositive: [],
        traitsNegative: [],
        attributes: {},
        marketValue: 76.8,
        salary: 10,
        seasonZeroEconomy: {
          source: "season_0_backfilled",
          marketValue: 76.8,
          salary: 10,
          purchasePrice: 76.8,
          salaryMarketValue: 76.8,
          baseMarketValue: null,
          salaryBase: null,
          traitPercentSum: null,
          marketValueSource: "baseline_market_value_backfill",
          salarySource: "baseline_salary_backfill",
          computedAt: "2026-06-01T00:00:00.000Z",
        },
        disciplineRatings: {},
        source: "seed",
        baselineVersion: "player-baseline-v2",
        createdAt: "2026-06-01T00:00:00.000Z",
        importedAt: "2026-06-01T00:00:00.000Z",
        sourceFile: "data/generated/oly-player-stats.json",
        checksumAlgorithm: "sha256",
        checksum: "nyara-test",
      },
    ] as unknown as NonNullable<GameState["playerBaselines"]>;

    const snapshot = gameState.seasonState.seasonSnapshots?.[0];
    const snapshotRow = snapshot?.playerPerformances?.[0];
    if (snapshotRow) {
      snapshotRow.marketValue = 64.2;
      snapshotRow.purchasePrice = 76.8;
    }
    const transferSnapshot = snapshot?.transferSnapshots?.[0];
    if (transferSnapshot) {
      transferSnapshot.amount = 64.2;
      transferSnapshot.marketValue = 64.2;
      transferSnapshot.amountDeltaToMarketValue = 0;
      transferSnapshot.amountMarketValueFactor = 1;
    }

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.marketValue).toBe(64.2);
    expect(archived?.marketValueBaselineDelta).toBe(0);
  });

  it("anchors archived season MW delta against previous season end value", () => {
    const player = createPlayer({
      id: "player-s2-delta",
      marketValue: 70,
      displayMarketValue: 70,
    });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 55 });
    gameState.season = {
      id: "season-3",
      name: "Season 3",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-3";
    gameState.rosters[0] = {
      ...gameState.rosters[0],
      purchasePrice: 60,
      currentValue: 70,
      joinedSeasonId: "season-1",
    };
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        archivedAt: "2026-06-06T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-1",
            teamName: "Team One",
            appearances: 4,
            totalContribution: 55,
            totalPoints: 55,
            averageContribution: 13.75,
            averageFinalScore: 44.4,
            marketValue: 60,
            purchasePrice: 60,
            salary: 7.2,
            contractLength: 2,
            top10Count: 0,
            mvpCount: 0,
          },
        ],
        transferSnapshots: [
          {
            transferId: "transfer-s1-buy",
            seasonId: "season-1",
            playerId: player.id,
            playerName: player.name,
            fromTeamId: null,
            fromTeamName: null,
            toTeamId: "team-1",
            toTeamName: "Team One",
            type: "buy",
            amount: 60,
            salary: 7.2,
            marketValue: 60,
            amountDeltaToMarketValue: 0,
            amountMarketValueFactor: 1,
            contractLength: 2,
            source: "test_transfer_history",
            happenedAt: "2026-06-06T09:00:00.000Z",
          },
        ],
      },
      {
        seasonId: "season-2",
        seasonName: "Season 2",
        archivedAt: "2027-06-06T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-1",
            teamName: "Team One",
            appearances: 4,
            totalContribution: 60,
            totalPoints: 60,
            averageContribution: 15,
            averageFinalScore: 45,
            marketValue: 65,
            purchasePrice: 60,
            salary: 7.2,
            contractLength: 1,
            top10Count: 0,
            mvpCount: 0,
          },
        ],
        transferSnapshots: [],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const season1 = data?.historyRows.find((row) => row.seasonId === "season-1");
    const season2 = data?.historyRows.find((row) => row.seasonId === "season-2");

    expect(season1?.marketValueBaselineDelta).toBe(0);
    expect(season2?.marketValueBaselineDelta).toBe(5);
  });

  it("fills missing snapshot seasons in history timeline for PP charts", () => {
    const player = createPlayer({ id: "player-timeline", pps: 54.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.season = {
      id: "season-5",
      name: "Season 5",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-5";
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        playerPerformances: [],
      },
      {
        seasonId: "season-4",
        seasonName: "Season 4",
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-T",
            teamName: "Terrible Teachers",
            appearances: 6,
            totalPoints: 44,
            powPoints: 12,
            spePoints: 8,
            menPoints: 14,
            socPoints: 10,
            disciplineBreakdown: [],
          },
        ],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.historyRows.map((row) => row.seasonId)).toEqual([
      "season-1",
      "season-4",
      "season-5",
    ]);
    expect(data?.historyRows.find((row) => row.seasonId === "season-1")?.pps).toBeNull();
    expect(data?.historyRows.find((row) => row.seasonId === "season-4")?.pow).toBe(12);
    expect(data?.historyRows.find((row) => row.seasonId === "season-5")?.isActiveSeason).toBe(true);
  });

  it("rebuilds archived season PP rows from snapshot discipline performances", () => {
    const player = createPlayer({ id: "player-disc-fallback", pps: 44.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.disciplines = [
      { id: "d1", name: "Diszi 1", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
    ];
    gameState.season = {
      id: "season-5",
      name: "Season 5",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-5";
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-4",
        seasonName: "Season 4",
        playerPerformances: [],
        matchdayResults: [
          {
            id: "matchday-result-season-4-md-1",
            seasonId: "season-4",
            matchdayId: "season-4-matchday-1",
            status: "preview_applied",
          },
        ],
        playerDisciplinePerformances: [
          {
            id: "player-performance-season-4-md-1",
            matchdayResultId: "matchday-result-season-4-md-1",
            teamId: "team-1",
            playerId: player.id,
            disciplineId: "d1",
            disciplineSide: "d1",
            slotIndex: 0,
            finalPlayerScore: 80,
            scoreContribution: 4.2,
            isTop10: false,
            isMvpCandidate: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "player-performance-season-4-md-1-spe",
            matchdayResultId: "matchday-result-season-4-md-1",
            teamId: "team-1",
            playerId: player.id,
            disciplineId: "d2",
            disciplineSide: "d2",
            slotIndex: 0,
            finalPlayerScore: 70,
            scoreContribution: 2.1,
            isTop10: false,
            isMvpCandidate: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.historyRows.find((row) => row.seasonId === "season-4")?.pow).toBe(4.2);
    expect(data?.historyRows.find((row) => row.seasonId === "season-4")?.spe).toBe(2.1);
  });

  it("starts the PP timeline at joinedSeasonId for late roster arrivals", () => {
    const player = createPlayer({ id: "player-late-join", pps: 54.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    const roster = gameState.rosters.find((entry) => entry.playerId === player.id);
    if (roster) {
      roster.joinedSeasonId = "season-4";
    }
    gameState.transferHistory = [];
    gameState.transferHistory.push({
      id: "transfer-late-join",
      playerId: player.id,
      seasonId: "season-4",
      seasonLabel: "Season 4",
      transferType: "buy",
      toTeamId: roster?.teamId ?? "team-1",
      fee: 25,
      salary: 8,
      marketValue: 25,
      happenedAt: "2026-01-01T00:00:00.000Z",
    } as GameState["transferHistory"][number]);
    gameState.season = {
      id: "season-5",
      name: "Season 5",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-5";
    gameState.seasonState.seasonSnapshots = [
      { seasonId: "season-1", seasonName: "Season 1", playerPerformances: [] },
      { seasonId: "season-2", seasonName: "Season 2", playerPerformances: [] },
      { seasonId: "season-3", seasonName: "Season 3", playerPerformances: [] },
      { seasonId: "season-4", seasonName: "Season 4", playerPerformances: [] },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.historyRows.map((row) => row.seasonId)).toEqual(["season-4", "season-5"]);
    expect(data?.historyRows.find((row) => row.seasonId === "season-4")?.pow).toBeNull();
    expect(data?.historyRows.find((row) => row.seasonId === "season-4")?.pps).toBeNull();
  });

  it("uses the internal player salary source for free agents", () => {
    const player = createPlayer({ id: "player-free-agent", displaySalary: 14.25, salaryDemand: 14.25 });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: false }),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data).toBeTruthy();
    expect(data?.transferStatus).toBe("Free Agent");
    expect(data?.salary).toBe(14.25);
    expect(data?.normalSalary).toBe(14.25);
    expect(data?.salarySource).toBe("calculated_stored");
  });

  it("exposes scout potential as a range and training modifier", () => {
    const player = createPlayer({ id: "player-potential", potential: 86 });
    const gameState = createGameState({ player, withRoster: true });
    gameState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 86,
        confidence: 0,
        source: "generated",
      },
    ];
    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.potential).toBe(86);
    expect(data?.scoutPotential?.potentialRange).toEqual({ min: 70, max: 99 });
    expect(data?.scoutPotential?.starRating).toBe("5.0 Sterne");
    expect(data?.scoutPotential?.trainingSpeedMultiplier).toBe(1.09);
  });

  it("shows current contract salary separately from the normal expected salary", () => {
    const player = createPlayer({
      id: "player-active",
      displayMarketValue: 72.57,
      marketValue: 85000,
      displaySalary: 16.54,
      salaryDemand: 8000,
      attributeSheetStats: {
        power: 70,
        health: 55,
        stamina: 60,
        intelligence: 48,
        awareness: 62,
        determination: 51,
        speed: 66,
        dexterity: 64,
        charisma: 58,
        will: 72,
        spirit: 57,
        torment: 45,
      },
    });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data).toBeTruthy();
    expect(data?.transferStatus).toBe("Active Player");
    expect(data?.marketValue).toBe(72.57);
    expect(data?.salary).toBe(12.75);
    expect(data?.normalSalary).not.toBeNull();
    expect(data?.normalSalary).not.toBe(data?.salary);
    expect(data?.marketValueSource).toBe("calculated_stored");
    expect(data?.salarySource).toBe("active_contract");
    expect(data?.contractLength).toBe(3);
    expect(data?.contractLengthSource).toBe("active_contract");
    expect(data?.transferContext.currentValue).toBe(72.57);
    expect(data?.transferContext.expectedSellValue).toBe(72.57);
    expect(data?.economyCompare?.legacyMarketValue).toBe(72.57);
    expect(data?.economyCompare?.calculatedMarketValue).not.toBeNull();
    expect(data?.economyCompare?.calculationBreakdown.marketValueBaseOffset).toBe(0);
    expect(data?.economyCompare?.calculationBreakdown.calcWithoutBaseOffset).not.toBeNull();
  });

  it("builds season axis points and matchday breakdown from stored performances", () => {
    const player = createPlayer({ id: "player-results", pps: 63.3 });
    const gameState = createResultGameState(player);
    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const ratingRow = buildPlayerRatingContractMap(gameState).get(player.id);

    expect(data).toBeTruthy();
    expect(data?.pps).toBe(28);
    expect(data?.ppsRating).toBe(63);
    expect(data?.seasonPerformance?.totalPoints).toBe(28);
    expect(data?.seasonPerformance?.pointsByArea.pow).toBe(12.5);
    expect(data?.seasonPerformance?.pointsByArea.spe).toBe(8.4);
    expect(data?.seasonPerformance?.pointsByArea.men).toBe(7.1);
    expect(data?.seasonPerformance?.pointsByArea.soc).toBe(0);
    expect(data?.seasonPerformance?.topDisciplineRows).toHaveLength(3);
    expect(data?.seasonPerformance?.topDisciplineRows[0]?.disciplineId).toBe("pow-d");
    expect(data?.seasonPerformance?.matchdayBreakdown).toHaveLength(2);
    expect(data?.seasonPerformance?.matchdayBreakdown[0]?.matchdayId).toBe("matchday-2");
    expect(data?.mvs).not.toBeNull();
    expect(data?.mvsSourceLabel).toContain("Retool-Season-Rankpunkten");
    expect(data?.ovr).toBe(ratingRow?.ovrNormalized ?? null);
    expect(data?.ovrRank).toBe(ratingRow?.ovrRank ?? null);
    expect(data?.ppsRank).toBe(ratingRow?.ppsSeasonRank ?? null);
    expect(data?.mvsRank).toBe(ratingRow?.mvsRank ?? null);
    expect(data?.axisCards[0]?.seasonPointsRank).toBe(ratingRow?.ppPowRank ?? null);
    expect(data?.mvs).toBe(ratingRow?.mvs ?? null);
    expect(data?.historyRows[0]?.isActiveSeason).toBe(true);
    expect(data?.historyRows[0]?.seasonName).toBe("Season 1");
  });

  it("adds previous-season axis ranks from archived snapshots", () => {
    const player = createPlayer({ id: "player-axis-rank-history", pps: 63.3 });
    const gameState = createResultGameState(player);
    gameState.seasonState = {
      ...gameState.seasonState,
      seasonSnapshots: [
        {
          seasonId: "season-0",
          seasonName: "Season 0",
          status: "completed",
          sourceStatus: "mapped",
          archivedAt: "2026-06-01T10:00:00.000Z",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: player.id,
              playerName: player.name,
              teamId: "team-1",
              teamCode: "T-1",
              teamName: "Team One",
              appearances: 5,
              totalContribution: 25,
              totalPoints: 25,
              averageContribution: 5,
              averageFinalScore: 50,
              powPoints: 5,
              spePoints: 20,
              menPoints: 0,
              socPoints: 0,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "spe-d",
              bestDisciplineLabel: "Speed Diszi",
              bestDisciplineScore: 60,
            },
            {
              playerId: "player-axis-rank-rival",
              playerName: "Rank Rival",
              teamId: "team-2",
              teamCode: "T-2",
              teamName: "Team Two",
              appearances: 5,
              totalContribution: 12,
              totalPoints: 12,
              averageContribution: 2.4,
              averageFinalScore: 42,
              powPoints: 10,
              spePoints: 2,
              menPoints: 0,
              socPoints: 0,
              top10Count: 0,
              mvpCount: 0,
              bestDisciplineId: "pow-d",
              bestDisciplineLabel: "Power Diszi",
              bestDisciplineScore: 55,
            },
          ],
        },
      ],
    };

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.axisCards.find((card) => card.id === "pow")?.previousSeasonPointsRank).toBe(2);
    expect(data?.axisCards.find((card) => card.id === "spe")?.previousSeasonPointsRank).toBe(1);
  });

  it("falls back to partial archived snapshots when the active season has no scored results", () => {
    const player = createPlayer({ id: "player-partial-snapshot", pps: 61 });
    const gameState = createGameState({ player, withRoster: true });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState = {
      ...gameState.seasonState,
      seasonId: "season-2",
      matchdayResults: [],
      playerDisciplinePerformances: [],
      seasonSnapshots: [
        {
          seasonId: "season-1",
          seasonName: "Season 1",
          status: "partial",
          sourceStatus: "partial",
          archivedAt: "2026-06-12T10:00:00.000Z",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: player.id,
              playerName: player.name,
              teamId: "team-1",
              teamCode: "T-1",
              teamName: "Team One",
              appearances: 7,
              totalContribution: 44.4,
              totalPoints: 44.4,
              averageContribution: 6.3,
              averageFinalScore: 55,
              powPoints: 30.1,
              spePoints: 14.3,
              menPoints: 0,
              socPoints: 0,
              top10Count: 2,
              mvpCount: 1,
              bestDisciplineId: "d1",
              bestDisciplineLabel: "Diszi 1",
              bestDisciplineScore: 77,
            },
          ],
        },
      ],
    };
    gameState.disciplines = [
      { id: "d1", name: "Diszi 1", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
    ];

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.seasonPerformance?.seasonId).toBe("season-1");
    expect(data?.seasonPerformance?.sourceLabel).toBe("Season Snapshot");
    expect(data?.seasonPerformance?.totalPoints).toBe(44.4);
    expect(data?.historyRows.find((row) => row.seasonId === "season-1")?.pps).toBe(44.4);
  });

  it("rebuilds archived drawer stats from snapshot discipline rows when playerPerformances is an empty stub", () => {
    const player = createPlayer({ id: "player-stub-snapshot", pps: 44.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 88.8 });
    gameState.disciplines = [
      { id: "d1", name: "Diszi 1", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
    ];
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.seasonState.matchdayResults = [];
    gameState.seasonState.playerDisciplinePerformances = [];
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        status: "completed",
        archivedAt: "2026-06-06T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-1",
            teamName: "Team One",
            appearances: 0,
            totalContribution: 0,
            totalPoints: 0,
            top10Count: 0,
            mvpCount: 0,
            bestDisciplineId: null,
            bestDisciplineScore: null,
          },
        ],
        matchdayResults: [
          {
            id: "matchday-result-season-1-md-1",
            seasonId: "season-1",
            matchdayId: "season-1-matchday-1",
            status: "preview_applied",
          } as NonNullable<GameState["seasonState"]["matchdayResults"]>[number],
        ],
        playerDisciplinePerformances: [
          {
            id: "player-performance-season-1-md-1",
            matchdayResultId: "matchday-result-season-1-md-1",
            teamId: "team-1",
            playerId: player.id,
            disciplineId: "d1",
            disciplineSide: "d1",
            slotIndex: 0,
            finalPlayerScore: 80,
            scoreContribution: 4.2,
            isTop10: false,
            isMvpCandidate: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "player-performance-season-1-md-1-spe",
            matchdayResultId: "matchday-result-season-1-md-1",
            teamId: "team-1",
            playerId: player.id,
            disciplineId: "d2",
            disciplineSide: "d2",
            slotIndex: 0,
            finalPlayerScore: 70,
            scoreContribution: 2.1,
            isTop10: false,
            isMvpCandidate: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(data?.seasonPerformance?.totalPoints).toBe(6.3);
    expect(archived?.pps).toBe(6.3);
    expect(archived?.pow).toBe(4.2);
    expect(archived?.spe).toBe(2.1);
    expect(data?.disciplineValues.some((entry) => (entry.allTimePoints ?? 0) > 0)).toBe(true);
  });

  it("falls back to the latest completed season snapshot when the active season has no scored results", () => {
    const player = createPlayer({ id: "player-snapshot-fallback", pps: 61 });
    const gameState = createGameState({ player, withRoster: true });
    gameState.season = {
      id: "season-3",
      name: "Season 3",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState = {
      ...gameState.seasonState,
      seasonId: "season-3",
      matchdayResults: [],
      playerDisciplinePerformances: [],
      seasonSnapshots: [
        {
          seasonId: "season-2",
          seasonName: "Season 2",
          status: "completed",
          sourceStatus: "mapped",
          archivedAt: "2026-06-12T10:00:00.000Z",
          finalStandings: [],
          playerPerformances: [
            {
              playerId: player.id,
              playerName: player.name,
              teamId: "team-1",
              teamCode: "T-1",
              teamName: "Team One",
              appearances: 7,
              totalContribution: 44.4,
              totalPoints: 44.4,
              averageContribution: 6.3,
              averageFinalScore: 55,
              top10Count: 2,
              mvpCount: 1,
              bestDisciplineId: "d1",
              bestDisciplineLabel: "Diszi 1",
              bestDisciplineScore: 77,
              disciplineBreakdown: [
                {
                  disciplineId: "d1",
                  disciplineName: "Diszi 1",
                  appearances: 4,
                  totalContribution: 30.1,
                  averageContribution: 7.5,
                  averageFinalScore: 60,
                },
                {
                  disciplineId: "d2",
                  disciplineName: "Diszi 2",
                  appearances: 3,
                  totalContribution: 14.3,
                  averageContribution: 4.8,
                  averageFinalScore: 49,
                },
              ],
            },
          ],
        },
      ],
    };
    gameState.disciplines = [
      { id: "d1", name: "Diszi 1", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
    ];

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.seasonPerformance?.seasonId).toBe("season-2");
    expect(data?.seasonPerformance?.sourceLabel).toBe("Season Snapshot");
    expect(data?.pps).toBe(44.4);
    expect(data?.ppsRank).toBeNull();
    expect(data?.axisCards.find((card) => card.id === "pow")?.seasonPoints).toBe(30.1);
    expect(data?.axisCards.find((card) => card.id === "spe")?.seasonPoints).toBe(14.3);
  });

  it("still merges live current-season performance into rating pps at season start", () => {
    const player = createPlayer({ id: "player-live-s3", pps: 61 });
    const gameState = createResultGameState(player);
    gameState.season = {
      id: "season-3",
      name: "Season 3",
      currentMatchday: 2,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-3";
    gameState.seasonState.matchdayResults = (gameState.seasonState.matchdayResults ?? []).map((entry) => ({
      ...entry,
      seasonId: "season-3",
    }));
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-2",
        seasonName: "Season 2",
        status: "completed",
        archivedAt: "2026-06-12T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [
          {
            playerId: player.id,
            playerName: player.name,
            teamId: "team-1",
            teamCode: "T-1",
            teamName: "Team One",
            appearances: 7,
            totalContribution: 99.9,
            totalPoints: 99.9,
            powPoints: 50,
            spePoints: 20,
            menPoints: 15,
            socPoints: 14.9,
          },
        ],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const ratingRow = buildPlayerRatingContractMap(gameState).get(player.id);

    expect(data?.seasonPerformance?.seasonId).toBe("season-3");
    expect(data?.seasonPerformance?.sourceLabel).toBe("Aktuelle Matchday-Results");
    expect(data?.pps).toBe(28);
    expect(data?.ppsRank).toBe(ratingRow?.ppsSeasonRank ?? null);
    expect(data?.axisCards.find((card) => card.id === "pow")?.seasonPoints).toBe(12.5);
  });

  it("exposes board trust and renewal policy for underperforming expiring players", () => {
    const player = createPlayer({
      id: "player-board-trust",
      rating: 90,
      pps: 63.3,
      race: "Human",
      className: "Berserker",
    });
    const gameState = createResultGameState(player);
    gameState.teamIdentities = [
      {
        teamId: "team-1",
        pow: 50,
        spe: 50,
        men: 50,
        soc: 50,
        ambition: 50,
        finances: 50,
        boardConfidence: 20,
        harmony: 50,
        manners: 50,
        popularity: 50,
        cooperation: 50,
        playerMin: 7,
        playerOpt: 10,
      },
    ];
    gameState.rosters = gameState.rosters.map((entry) => ({
      ...entry,
      contractLength: 1,
    }));

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.boardTrust?.trustScore).toBeLessThan(25);
    expect(data?.boardTrust?.smiley).toBe(">:(");
    expect(data?.boardTrust?.renewalPolicy).toBe("renewal_warning");
    expect(data?.boardTrust?.salaryCapMultiplier).toBe(0.7);
    expect(data?.boardTrust?.reasons).toContain("low_board_confidence");
    expect(data?.boardTrust?.reasons).toContain("performance_below_board_expectation");
  });

  it("shows exact attributes for manageable teams", () => {
    const player = createPlayer({
      id: "player-own-attributes",
      attributeSheetStats: {
        power: 88,
        health: 93,
        stamina: 85,
        intelligence: 60,
        awareness: 70,
        determination: 99,
        speed: 79,
        dexterity: 58,
        charisma: 13,
        will: 87,
        spirit: 7,
        torment: 90,
      },
      attributeSheetRatings: {
        powerRating: "S",
        healthRating: "S+",
        staminaRating: "S",
        intelligenceRating: "B",
        awarenessRating: "A",
        determinationRating: "S+",
        speedRating: "S",
        dexterityRating: "B",
        charismaRating: "F",
        willRating: "S",
        spiritRating: "F",
        tormentRating: "S+",
      },
    });

    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["team-1"],
    });

    expect(data?.attributeVisibility).toBe("exact");
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.value).toBe(93);
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.ratingLabel).toBe("S+");
  });

  it("keeps exact axis stats when manageableTeamIds is empty but the roster team is human-controlled", () => {
    const player = createPlayer({ id: "player-empty-manageable-scope" });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: [],
    });

    expect(data?.attributeVisibility).toBe("exact");
    expect(data?.axisCards.find((card) => card.id === "pow")?.value).not.toBeNull();
    expect(data?.axisCards.find((card) => card.id === "pow")?.valueRank).not.toBeNull();
  });

  it("shows rough attribute bands without exact values for non-manageable teams", () => {
    const player = createPlayer({
      id: "player-scouted-attributes",
      attributeSheetStats: {
        power: 88,
        health: 93,
        stamina: 85,
        intelligence: 60,
        awareness: 70,
        determination: 99,
        speed: 79,
        dexterity: 58,
        charisma: 13,
        will: 87,
        spirit: 7,
        torment: 90,
      },
      attributeSheetRatings: {
        powerRating: "S",
        healthRating: "S+",
        staminaRating: "S",
        intelligenceRating: "B",
        awarenessRating: "A",
        determinationRating: "S+",
        speedRating: "S",
        dexterityRating: "B",
        charismaRating: "F",
        willRating: "S",
        spiritRating: "F",
        tormentRating: "S+",
      },
    });

    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["other-team"],
    });

    expect(data?.attributeVisibility).toBe("scouted");
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.value).toBeNull();
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.revealed).toBe(false);
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.ratingLabel).toBeNull();
    expect(data?.attributeStats.find((entry) => entry.key === "power")?.rangeLabel).toBeNull();
    expect(data?.axisCards.every((entry) => entry.value == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.valueRank == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.seasonPoints == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.seasonPointsRank == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.previousSeasonPointsRank == null)).toBe(true);
  });

  it("uses scouted discipline rows for non-manageable roster players", () => {
    const player = createPlayer({
      id: "player-other-team-scouted-disciplines",
      disciplineRatings: { d1: 96, d2: 42 },
      currentDisciplineValues: { d1: 98, d2: 45 },
      previousDisciplineRatings: { d1: 94, d2: 40 },
      lastSeasonDisciplineValues: { d1: 94, d2: 40 },
      disciplineDelta: { d1: 4, d2: 5 },
      attributeSheetStats: {
        power: 88,
        health: 93,
        stamina: 85,
        intelligence: 60,
        awareness: 70,
        determination: 99,
        speed: 79,
        dexterity: 58,
        charisma: 13,
        will: 87,
        spirit: 7,
        torment: 90,
      },
      attributeSheetRatings: {
        powerRating: "S",
        healthRating: "S+",
        staminaRating: "S",
        intelligenceRating: "B",
        awarenessRating: "A",
        determinationRating: "S+",
        speedRating: "S",
        dexterityRating: "B",
        charismaRating: "F",
        willRating: "S",
        spiritRating: "F",
        tormentRating: "S+",
      },
    });

    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["other-team"],
    });

    expect(data?.transferStatus).toBe("Active Player");
    expect(data?.attributeVisibility).toBe("scouted");
    expect(data?.disciplineValues).toHaveLength(2);
    expect(data?.disciplineValues.every((entry) => entry.currentDisciplineValues == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.lastSeasonDisciplineValues == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.disciplineDelta == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.seasonPoints == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.allTimePoints == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.scoutedTier != null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.value == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.seasonPoints == null)).toBe(true);
  });

  it("uses scouted discipline rows for free agents instead of exact drawer values", () => {
    const player = createPlayer({
      id: "player-free-agent-scouted-disciplines",
      disciplineRatings: { d1: 96, d2: 42 },
      attributeSheetStats: {
        power: 88,
        health: 93,
        stamina: 85,
        intelligence: 60,
        awareness: 70,
        determination: 99,
        speed: 79,
        dexterity: 58,
        charisma: 13,
        will: 87,
        spirit: 7,
        torment: 90,
      },
      attributeSheetRatings: {
        powerRating: "S",
        healthRating: "S+",
        staminaRating: "S",
        intelligenceRating: "B",
        awarenessRating: "A",
        determinationRating: "S+",
        speedRating: "S",
        dexterityRating: "B",
        charismaRating: "F",
        willRating: "S",
        spiritRating: "F",
        tormentRating: "S+",
      },
    });

    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: false }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["team-1"],
    });

    expect(data?.transferStatus).toBe("Free Agent");
    expect(data?.attributeVisibility).toBe("scouted");
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.value).toBeNull();
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.revealed).toBe(false);
    expect(data?.attributeStats.find((entry) => entry.key === "health")?.ratingLabel).toBeNull();
    expect(data?.disciplineValues).toHaveLength(2);
    expect(data?.disciplineValues.every((entry) => entry.currentDisciplineValues == null)).toBe(true);
    expect(data?.disciplineValues.every((entry) => entry.scoutedTier != null)).toBe(true);
    expect(data?.axisCards.find((card) => card.id === "pow")?.value).not.toBeNull();
    expect(data?.axisCards.find((card) => card.id === "pow")?.valueRank).not.toBeNull();
    expect(data?.axisCards.every((entry) => entry.seasonPoints == null)).toBe(true);
    expect(data?.axisCards.every((entry) => entry.seasonPointsRank == null)).toBe(true);
  });

  it("falls back to imported catalog flavor when compact load stripped player lore", () => {
    const player = createPlayer({
      id: "player-1537-kiti",
      name: "Kiti",
      flavorDe: "",
    });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: false }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["team-1"],
    });

    expect(data?.flavorDe).toContain("Nebelroute");
  });

  it("exposes German flavor lore in drawer data when present on the player", () => {
    const player = createPlayer({
      id: "player-flavor-de",
      flavorDe: "Casino-Wal aus den Tiefen von Lunira.",
    });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: false }),
      playerId: player.id,
      source: "sqlite",
      manageableTeamIds: ["team-1"],
    });

    expect(data?.flavorDe).toBe("Casino-Wal aus den Tiefen von Lunira.");
  });

  it("exposes season-end XP forecast and discipline upgrade deltas", () => {
    const player = createPlayer({
      id: "player-progression",
      traitsPositive: ["Diligent"],
      trainingMode: "hart",
      currentXP: 25,
      spentXP: 10,
      lifetimeXP: 120,
      disciplineRatings: { "pow-d": 62, "spe-d": 66, "men-d": 50 },
      previousDisciplineRatings: { "pow-d": 60, "spe-d": 66, "men-d": 50 },
    });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createResultGameState(player),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.progressionForecast?.trainingMode).toBe("hart");
    expect(data?.progressionForecast?.currentXP).toBe(25);
    expect(data?.progressionForecast?.spentXP).toBe(10);
    expect(data?.progressionForecast?.lifetimeXP).toBe(120);
    expect(data?.progressionForecast?.audit.seasonEndOnly).toBe(true);
    expect(data?.progressionForecast?.audit.productiveWrites).toBe(false);
    expect(data?.disciplineValues.find((entry) => entry.id === "pow-d")?.upgradeDelta).toBe(2);
    expect(data?.disciplineValues.find((entry) => entry.id === "spe-d")?.upgradeDelta).toBe(0);
    expect(data?.seasonOrganicForecast?.playerId).toBe("player-progression");
    expect(typeof data?.seasonOrganicForecast?.netSetpoints).toBe("number");
    expect(data?.seasonOrganicForecast?.trainingSetpoints).toBeGreaterThanOrEqual(0);
  });

  it("exposes potential delta and route state for own roster players", () => {
    const player = createPlayer({
      id: "own-roster-potential",
      attributeSheetStats: {
        power: 58,
        health: 52,
        stamina: 50,
        speed: 28,
        dexterity: 24,
        awareness: 22,
        intelligence: 26,
        will: 24,
        charisma: 30,
        spirit: 28,
        determination: 32,
        torment: 40,
      },
    });
    const gameState = createGameState({ player, withRoster: true });
    gameState.playerPotential = [
      {
        playerId: player.id,
        potentialBand: "high",
        hiddenPotentialScore: 80,
        confidence: 0,
        source: "generated",
        hiddenPotentialOverallStars: 4,
        hiddenPotentialCeilingByAxis: { pow: 4, spe: 2, men: 2, soc: 3.5 },
        hiddenAttributeCeiling: {
          power: 70,
          health: 68,
          stamina: 66,
          speed: 55,
          dexterity: 52,
          awareness: 50,
          intelligence: 48,
          will: 46,
          charisma: 58,
          spirit: 56,
          determination: 60,
          torment: 62,
        },
        lastSeasonSnapshot: {
          seasonId: "season-0",
          hiddenPotentialScore: 78,
          overallStars: 4.5,
          byAxis: { pow: 4.5, spe: 2.5, men: 2, soc: 3.5 },
        },
      },
    ];

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.potentialOverallStars).toBe(3);
    expect(data?.potentialOverallStars).toBeGreaterThanOrEqual(data?.currentOverallStars ?? 0);
    expect(data?.potentialOverallDelta).toBe(-1.5);
    expect(data?.potentialAxisStatus.some((entry) => entry.axis === "pow" && entry.routeState === "open")).toBe(true);
    expect(data?.trainingRouteImpact?.note).toContain("POW");
    expect(data?.attributeCeilingPreview.length).toBeGreaterThan(0);
  });

  it("exposes transfer history and full progression events with source labels", () => {
    const player = createPlayer({ id: "player-transfer-history" });
    const gameState = createGameState({ player, withRoster: true });
    // Live season must be at least Season 2 so the Season-2 sell transfer below is
    // not a future-season row (career/history builders drop future seasons).
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.transferHistory = [
      {
        id: "history-buy-1",
        playerId: player.id,
        playerName: player.name,
        fromTeamId: null,
        toTeamId: "team-1",
        transferType: "buy",
        seasonId: "season-1",
        seasonLabel: "Season 1",
        fee: 42,
        salary: 8,
        marketValue: 36,
        remainingContractLength: 3,
        happenedAt: "2026-06-01T10:00:00.000Z",
        source: "test",
      } as GameState["transferHistory"][number],
      {
        id: "history-sell-1",
        playerId: player.id,
        playerName: player.name,
        fromTeamId: "team-1",
        toTeamId: "team-2",
        transferType: "sell",
        seasonId: "season-2",
        seasonLabel: "Season 2",
        fee: 55,
        salary: 9,
        marketValue: 48,
        remainingContractLength: 0,
        happenedAt: "2026-07-01T10:00:00.000Z",
        source: "test",
      } as GameState["transferHistory"][number],
    ];
    gameState.playerProgressionEvents = [
      {
        eventId: "prog-organic-1",
        seasonId: "season-1",
        teamId: "team-1",
        playerId: player.id,
        upgrades: [{ attribute: "power", fromValue: 50, toValue: 52, cost: 0 }],
        xpSpent: 0,
        timestamp: "2026-06-10T10:00:00.000Z",
        source: "organic_season_progression",
      },
      {
        eventId: "prog-xp-1",
        seasonId: "season-1",
        teamId: "team-1",
        playerId: player.id,
        upgrades: [{ attribute: "speed", fromValue: 48, toValue: 50, cost: 12 }],
        xpSpent: 12,
        timestamp: "2026-06-11T10:00:00.000Z",
        source: "manual_season_end_xp_spend",
      },
    ];

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.transferHistory).toHaveLength(2);
    expect(data?.transferHistory[0]?.transferType).toBe("sell");
    expect(data?.transferHistory[0]?.toTeamName).toBe("team-2");
    expect(data?.transferHistory[1]?.fromTeamName).toBeNull();
    expect(data?.transferHistory[1]?.fee).toBe(42);

    expect(data?.progressionEvents).toHaveLength(2);
    expect(data?.progressionEvents.some((entry) => entry.source === "organic_season_progression")).toBe(true);
    expect(data?.progressionEvents.some((entry) => entry.source === "manual_season_end_xp_spend")).toBe(true);
    expect(data?.trainingHistoryRows.every((entry) => entry.source === "organic")).toBe(true);
    expect(data?.trainingHistoryRows).toHaveLength(1);
  });

  it("shows dashes instead of zero stats for transfer-only seasons without snapshots", () => {
    const player = createPlayer({ id: "player-transfer-only", pps: 61 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: null });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.seasonState.seasonSnapshots = [];
    gameState.transferHistory = [
      {
        id: "history-buy-1",
        playerId: player.id,
        playerName: player.name,
        fromTeamId: null,
        toTeamId: "team-1",
        transferType: "buy",
        seasonId: "season-1",
        seasonLabel: "Season 1",
        fee: 85.6,
        salary: 8,
        marketValue: 85.6,
        remainingContractLength: 3,
        happenedAt: "2026-06-01T10:00:00.000Z",
        source: "test",
      } as GameState["transferHistory"][number],
    ];

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.appearances).toBeNull();
    expect(archived?.pps).toBeNull();
    expect(archived?.pow).toBeNull();
    expect(archived?.marketValue).toBe(85.6);
    expect(archived?.warnings).toContain("transfer_fallback_without_snapshot_performance");
  });

  it("rebuilds archived stats from discipline rows when snapshot matchdayResults are missing", () => {
    const player = createPlayer({ id: "player-no-matchday-results", pps: 44.4 });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: null });
    gameState.disciplines = [
      { id: "d1", name: "Diszi 1", category: "power", displayOrder: 1 } as GameState["disciplines"][number],
      { id: "d2", name: "Diszi 2", category: "speed", displayOrder: 2 } as GameState["disciplines"][number],
    ];
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";
    gameState.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        status: "partial",
        archivedAt: "2026-06-06T10:00:00.000Z",
        finalStandings: [],
        playerPerformances: [],
        playerDisciplinePerformances: [
          {
            id: "player-performance-season-1-md-1",
            matchdayResultId: "matchday-result-season-1-md-1",
            teamId: "team-1",
            playerId: player.id,
            disciplineId: "d1",
            disciplineSide: "d1",
            slotIndex: 0,
            finalPlayerScore: 80,
            scoreContribution: 4.2,
            isTop10: false,
            isMvpCandidate: false,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ] as unknown as NonNullable<GameState["seasonState"]["seasonSnapshots"]>;

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.appearances).toBe(1);
    expect(archived?.pps).toBe(4.2);
    expect(archived?.pow).toBe(4.2);
  });

  it("maps archived season injuries into history row Verl./Ausfall columns", () => {
    const player = createPlayer({
      id: "player-injured-s1",
      injuryHistory: [
        {
          eventId: "evt-s1",
          seasonId: "season-1",
          seasonName: "Season 1",
          matchdayId: "season-1-matchday-1",
          matchdayLabel: "Spieltag 1",
          teamId: "team-1",
          fatigueBefore: 88,
          riskPercent: 22,
          unavailableUntil: "season-1-matchday-2",
          matchdaysMissed: 2,
          injuryRecoveryPct: 50,
          timestamp: "2026-06-01T10:00:00.000Z",
        },
      ],
    });
    const gameState = createGameState({ player, withRoster: true, snapshotPoints: 55 });
    gameState.season = {
      id: "season-2",
      name: "Season 2",
      currentMatchday: 1,
      totalMatchdays: 10,
      isCompleted: false,
    } as unknown as GameState["season"];
    gameState.seasonState.seasonId = "season-2";

    const data = buildPlayerDrawerDataFromGameState({
      gameState,
      playerId: player.id,
      source: "sqlite",
    });
    const archived = data?.historyRows.find((row) => row.seasonId === "season-1");

    expect(archived?.injuriesCount).toBe(1);
    expect(archived?.matchdaysMissed).toBe(2);
    expect(data?.injuryHistoryRows).toHaveLength(1);
  });
});
