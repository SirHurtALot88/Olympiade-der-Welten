import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildExpectedSellValueByPlayerId } from "@/lib/market/transfermarkt-expected-sell-value";

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
    ...(partial?.yearlySalarySchedule ? { yearlySalarySchedule: partial.yearlySalarySchedule } : {}),
    ...(partial?.contractShape ? { contractShape: partial.contractShape } : {}),
  };
}

function createGameState(input: { players: Player[]; rosters: RosterEntry[] }): GameState {
  return {
    gamePhase: "preseason_management",
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
      playerDisciplinePerformances: [],
      seasonSnapshots: [],
      matchdayResults: [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [createTeam()],
    teamIdentities: [],
    players: input.players,
    disciplines: [],
    rosters: input.rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
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

describe("buildExpectedSellValueByPlayerId", () => {
  it("computes gross sale price minus open buyout for every rostered player", () => {
    // Season start (keine gewerteten Performances) → Sale-Factor 1, Brutto = MW.
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("p2", { marketValue: 100, displayMarketValue: 100 })],
      rosters: [
        createRosterEntry("r1", "p1", { currentValue: 60, contractLength: 3, salary: 10 }),
        createRosterEntry("r2", "p2", { currentValue: 100, contractLength: 1, salary: 5 }),
      ],
    });

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);

    const p1 = byPlayerId.get("p1");
    expect(p1).toBeTruthy();
    expect(p1!.grossSalePrice).toBe(60);
    // Offener Buyout: 3 Restjahre à 10 (balanced-Schedule aus salary+contractLength).
    expect(p1!.buyoutCost).toBe(30);
    expect(p1!.expectedSellValue).toBe(30);

    const p2 = byPlayerId.get("p2");
    expect(p2).toBeTruthy();
    expect(p2!.grossSalePrice).toBe(100);
    expect(p2!.buyoutCost).toBe(5);
    expect(p2!.expectedSellValue).toBe(95);
  });

  it("nets can go negative for long contracts and low sale prices", () => {
    const gameState = createGameState({
      players: [createPlayer("p1", { marketValue: 10, displayMarketValue: 10 })],
      rosters: [createRosterEntry("r1", "p1", { currentValue: 10, contractLength: 4, salary: 8 })],
    });

    const entry = buildExpectedSellValueByPlayerId(gameState).get("p1");
    expect(entry).toBeTruthy();
    expect(entry!.grossSalePrice).toBe(10);
    expect(entry!.buyoutCost).toBe(32);
    expect(entry!.expectedSellValue).toBe(-22);
  });

  it("omits free agents — players without a roster entry cannot be sold", () => {
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("free-agent")],
      rosters: [createRosterEntry("r1", "p1")],
    });

    const byPlayerId = buildExpectedSellValueByPlayerId(gameState);
    expect(byPlayerId.has("p1")).toBe(true);
    expect(byPlayerId.has("free-agent")).toBe(false);
  });

  it("stays consistent: expectedSellValue always equals gross minus buyout", () => {
    const gameState = createGameState({
      players: [createPlayer("p1"), createPlayer("p2"), createPlayer("p3")],
      rosters: [
        createRosterEntry("r1", "p1", { contractLength: 1, salary: 3 }),
        createRosterEntry("r2", "p2", { contractLength: 2, salary: 7 }),
        createRosterEntry("r3", "p3", { contractLength: 5, salary: 12 }),
      ],
    });

    for (const entry of buildExpectedSellValueByPlayerId(gameState).values()) {
      expect(entry.expectedSellValue).toBeCloseTo(entry.grossSalePrice - entry.buyoutCost, 2);
    }
  });
});
