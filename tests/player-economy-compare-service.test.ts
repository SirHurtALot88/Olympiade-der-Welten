import { describe, expect, it } from "vitest";

import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { buildPlayerEconomyCompareReport } from "@/lib/foundation/player-economy-compare-service";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Player One",
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 85000,
    salaryDemand: partial?.salaryDemand ?? 8000,
    displayMarketValue: partial?.displayMarketValue ?? 48,
    displaySalary: partial?.displaySalary ?? 11,
    pps: partial?.pps ?? 60,
    ovr: partial?.ovr ?? 70,
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
    coreStats: partial?.coreStats ?? { pow: 60, spe: 50, men: 40, soc: 30 },
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? {},
    disciplineTierCounts: partial?.disciplineTierCounts ?? { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    cost: partial?.cost ?? 0,
    upkeepBase: partial?.upkeepBase ?? 0,
  };
}

function createGameState(players: Player[]): GameState {
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
      standings: {},
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      { teamId: "A-A", shortCode: "A-A", name: "Armageddon Aftermath", budget: 100, cash: 100, identityId: "A-A", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players,
    disciplines: [
      { id: "d1", name: "Diszi 1", category: "power", weight: 1 },
      { id: "d2", name: "Diszi 2", category: "speed", weight: 1 },
      { id: "d3", name: "Diszi 3", category: "mental", weight: 1 },
    ],
    rosters: [
      { id: "r-1", teamId: "A-A", playerId: players[0]!.id, contractLength: 2, salary: 11, upkeep: 11, purchasePrice: 48, currentValue: 48, roleTag: "starter", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-07T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: 1,
      teamCount: 1,
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

describe("player economy compare service", () => {
  it("keeps legacy values separate while calculating compare values", () => {
    const players = [
      createPlayer({
        id: "p-1",
        name: "Valira",
        displayMarketValue: 52,
        displaySalary: 12,
        traitsPositive: ["Disciplined"],
        traitsNegative: ["Lazy"],
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
        disciplineRatings: { d1: 1, d2: 1, d3: 1 },
      }),
      createPlayer({
        id: "p-2",
        name: "Belinda",
        displayMarketValue: 18,
        displaySalary: 4,
        attributeSheetStats: {
          power: 40,
          health: 44,
          stamina: 42,
          intelligence: 71,
          awareness: 68,
          determination: 48,
          speed: 35,
          dexterity: 46,
          charisma: 61,
          will: 66,
          spirit: 73,
          torment: 29,
        },
        disciplineRatings: { d1: 25, d2: 31, d3: 74 },
      }),
    ];

    const report = buildPlayerEconomyCompareReport({
      gameState: createGameState(players),
      economyMode: "compare",
    });

    expect(report.economyMode).toBe("compare");
    expect(report.activeTransferEconomyMode).toBe("legacy");
    expect(report.formulaStatus.marketValueEngine).toBe("ready");
    expect(report.players).toHaveLength(2);
    expect(report.players[0]?.legacyMarketValue).toBe(52);
    expect(report.players[0]?.legacySalary).toBe(12);
    expect(report.players[0]?.calculatedMarketValue).not.toBeNull();
    expect(report.players[0]?.calculatedSalary).not.toBeNull();
    expect(report.players[0]?.calculationBreakdown.marketValueBaseOffset).toBe(0);
    expect(report.players[0]?.calculationBreakdown.calcWithoutBaseOffset).not.toBeNull();
    expect(report.summary.comparedPlayers).toBe(2);
    expect(report.summary.missingSourceCount).toBe(0);
    expect(report.summary.topSalaryOutliers.length).toBeGreaterThan(0);
  });

  it("marks salary compare as missing when attribute sources are incomplete", () => {
    const players = [
      createPlayer({
        id: "p-missing",
        name: "Nightowl",
        displayMarketValue: 55,
        displaySalary: 9,
        attributeSheetStats: {
          power: 70,
        },
        disciplineRatings: { d1: 67, d2: 47, d3: 39 },
      }),
    ];

    const report = buildPlayerEconomyCompareReport({
      gameState: createGameState(players),
      economyMode: "compare",
    });

    expect(report.players[0]?.calculatedMarketValue).not.toBeNull();
    expect(report.players[0]?.calculatedSalary).toBeNull();
    expect(report.players[0]?.missingSources).toContain("attribute_sheet_stats_missing");
    expect(report.summary.missingSalarySources).toBe(1);
    expect(report.summary.playersWithMissingSources[0]?.playerId).toBe("p-missing");
  });

  it("never returns a negative salary preview even for strongly negative trait mixes", () => {
    const players = [
      createPlayer({
        id: "p-floor",
        name: "Floor Case",
        displayMarketValue: 20,
        displaySalary: 6,
        traitsNegative: ["Lazy", "Relaxed", "Cheater", "FaintHearted", "Paranoid", "Caring", "Diva"],
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
        disciplineRatings: { d1: 1, d2: 1, d3: 1 },
      }),
      createPlayer({
        id: "p-strong-1",
        name: "Anchor One",
        disciplineRatings: { d1: 98, d2: 91, d3: 82 },
        attributeSheetStats: {
          power: 72,
          health: 61,
          stamina: 66,
          intelligence: 55,
          awareness: 68,
          determination: 59,
          speed: 70,
          dexterity: 69,
          charisma: 52,
          will: 71,
          spirit: 60,
          torment: 48,
        },
      }),
      createPlayer({
        id: "p-strong-2",
        name: "Anchor Two",
        disciplineRatings: { d1: 95, d2: 84, d3: 77 },
        attributeSheetStats: {
          power: 68,
          health: 58,
          stamina: 61,
          intelligence: 57,
          awareness: 63,
          determination: 55,
          speed: 67,
          dexterity: 65,
          charisma: 54,
          will: 69,
          spirit: 58,
          torment: 44,
        },
      }),
      createPlayer({
        id: "p-strong-3",
        name: "Anchor Three",
        disciplineRatings: { d1: 92, d2: 79, d3: 73 },
        attributeSheetStats: {
          power: 66,
          health: 56,
          stamina: 59,
          intelligence: 54,
          awareness: 61,
          determination: 53,
          speed: 64,
          dexterity: 62,
          charisma: 56,
          will: 67,
          spirit: 55,
          torment: 42,
        },
      }),
    ];

    const report = buildPlayerEconomyCompareReport({
      gameState: createGameState(players),
      economyMode: "compare",
    });

    const floorRow = report.players.find((row) => row.playerId === "p-floor");

    expect(floorRow?.calculatedSalary).toBeGreaterThanOrEqual(0);
    expect(floorRow?.salaryFloorApplied).toBe(true);
    expect(floorRow?.outlierFlags).toContain("salary_floor_applied");
    expect(report.summary.salaryFloorAppliedCount).toBe(1);
    expect(report.summary.salaryFloorAppliedPlayers[0]?.playerId).toBe("p-floor");
  });
});
