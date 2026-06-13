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
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? { above20: 2, above40: 2, above60: 1, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
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
    } as GameState["season"],
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
                    top10Count: 1,
                    mvpCount: 0,
                    bestDisciplineId: "d1",
                    bestDisciplineLabel: "Diszi 1",
                    bestDisciplineScore: 55.5,
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
          } as GameState["teams"][number],
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
    } as GameState["mappingReport"],
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
        } as GameState["seasonState"]["matchdayResults"][number],
        {
          id: "result-2",
          seasonId: "season-1",
          matchdayId: "matchday-2",
          status: "preview_applied",
        } as GameState["seasonState"]["matchdayResults"][number],
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

  it("uses the real player salary source for free agents", () => {
    const player = createPlayer({ id: "player-free-agent", displaySalary: 14.25, salaryDemand: 14.25 });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: false }),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data).toBeTruthy();
    expect(data?.transferStatus).toBe("Free Agent");
    expect(data?.salary).toBe(14.25);
    expect(data?.salarySource).toBe("imported_display");
  });

  it("exposes scout potential as a range and training modifier", () => {
    const player = createPlayer({ id: "player-potential", potential: 86 });
    const data = buildPlayerDrawerDataFromGameState({
      gameState: createGameState({ player, withRoster: true }),
      playerId: player.id,
      source: "sqlite",
    });

    expect(data?.potential).toBe(86);
    expect(data?.scoutPotential?.potentialRange).toEqual({ min: 70, max: 99 });
    expect(data?.scoutPotential?.starRating).toBe("4.0 Sterne");
    expect(data?.scoutPotential?.trainingSpeedMultiplier).toBe(1.09);
  });

  it("keeps active-player economy on the imported visible values while contract context stays attached", () => {
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
    expect(data?.salary).toBe(16.54);
    expect(data?.marketValueSource).toBe("imported_display");
    expect(data?.salarySource).toBe("imported_display");
    expect(data?.contractLength).toBe(3);
    expect(data?.contractLengthSource).toBe("active_contract");
    expect(data?.transferContext.currentValue).toBe(72.57);
    expect(data?.transferContext.expectedSellValue).toBe(72.57);
    expect(data?.economyCompare?.legacyMarketValue).toBe(72.57);
    expect(data?.economyCompare?.calculatedMarketValue).not.toBeNull();
    expect(data?.economyCompare?.calculationBreakdown.marketValueBaseOffset).toBe(3.5);
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
    expect(data?.mvsSourceLabel).toContain("Rank→Diszi-MW");
    expect(data?.ovr).toBe(ratingRow?.ovrNormalized ?? null);
    expect(data?.ovrRank).toBe(ratingRow?.ovrRank ?? null);
    expect(data?.ppsRank).toBe(ratingRow?.ppsSeasonRank ?? null);
    expect(data?.mvsRank).toBe(ratingRow?.mvsRank ?? null);
    expect(data?.axisCards[0]?.seasonPointsRank).toBe(ratingRow?.ppPowRank ?? null);
    expect(data?.mvs).toBe(ratingRow?.mvs ?? null);
    expect(data?.historyRows[0]?.isActiveSeason).toBe(true);
    expect(data?.historyRows[0]?.seasonName).toBe("Season 1");
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
    } as GameState["season"];
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
    expect(data?.axisCards.find((card) => card.id === "pow")?.seasonPoints).toBe(30.1);
    expect(data?.axisCards.find((card) => card.id === "spe")?.seasonPoints).toBe(14.3);
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
    expect(data?.boardTrust?.renewalPolicy).toBe("do_not_renew");
    expect(data?.boardTrust?.salaryCapMultiplier).toBe(0);
    expect(data?.boardTrust?.reasons).toContain("low_board_confidence");
    expect(data?.boardTrust?.reasons).toContain("performance_below_board_expectation");
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
  });
});
