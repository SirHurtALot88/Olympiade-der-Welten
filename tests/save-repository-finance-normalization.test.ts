import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { normalizeLegacyFinanceScale } from "@/lib/persistence/save-repository";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 275,
    cash: partial?.cash ?? 115310.31,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 85000,
    salaryDemand: 8000,
    className: "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 10 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
  };
}

function createRosterEntry(id: string, playerId: string): RosterEntry {
  return {
    id,
    teamId: "A-A",
    playerId,
    contractLength: 3,
    salary: 120,
    upkeep: 120,
    purchasePrice: 850,
    currentValue: 850,
    roleTag: "starter",
    joinedSeasonId: "season-12",
  };
}

function createGameState(input?: { teams?: Team[]; players?: Player[]; rosters?: RosterEntry[] }): GameState {
  return {
    season: {
      id: "season-12",
      name: "Season 12",
      year: 2037,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-12",
      schedule: [],
      standings: {
        "A-A": {
          points: 186.3,
          cashFc: 13586.78,
          cashTotal: 13674.8,
        },
      },
      contractEvents: [
        {
          eventId: "event-1",
          seasonId: "season-12",
          teamId: "A-A",
          playerId: "p-1",
          eventType: "player_released",
          exitValue: 43085.42,
          saleFactor: 1.2,
          marketValueAtExit: 39774.43,
          purchasePrice: 12000,
          profitLoss: 31085.42,
          oldSalary: 10000,
          newSalary: null,
          oldLength: 2,
          newLength: 0,
          timestamp: new Date().toISOString(),
          source: "manual_player_release",
        },
      ],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: input?.teams ?? [createTeam()],
    teamIdentities: [],
    players: input?.players ?? [createPlayer("p-1")],
    disciplines: [],
    rosters: input?.rosters ?? [createRosterEntry("r-1", "p-1")],
    contracts: [],
    transferListings: [],
    transferHistory: [
      {
        id: "history-1",
        playerId: "p-1",
        playerName: "Umbros",
        seasonId: "season-12",
        seasonLabel: "Season 12",
        matchdayId: "matchday-1",
        phase: "contract_renewal",
        source: "manual_player_release",
        transferType: "contract_exit",
        fromTeamId: "A-A",
        toTeamId: null,
        fee: 63158.09,
        salary: 10000,
        marketValue: 42102.92,
        remainingContractLength: 0,
        happenedAt: new Date().toISOString(),
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

describe("normalizeLegacyFinanceScale", () => {
  it("normalizes mixed legacy cash and finance history for low-budget saves", () => {
    const normalized = normalizeLegacyFinanceScale(createGameState());

    expect(normalized.teams[0]?.cash).toBe(1153.1);
    expect(normalized.seasonState.standings["A-A"]?.cashFc).toBe(135.87);
    expect(normalized.seasonState.standings["A-A"]?.cashTotal).toBe(136.75);
    expect(normalized.transferHistory[0]?.fee).toBe(631.58);
    expect(normalized.transferHistory[0]?.salary).toBe(100);
    expect(normalized.transferHistory[0]?.marketValue).toBe(421.03);
    expect(normalized.seasonState.contractEvents?.[0]?.exitValue).toBe(430.85);
    expect(normalized.seasonState.contractEvents?.[0]?.marketValueAtExit).toBe(397.74);
    expect(normalized.seasonState.contractEvents?.[0]?.purchasePrice).toBe(120);
    expect(normalized.seasonState.contractEvents?.[0]?.profitLoss).toBe(310.85);
    expect(normalized.seasonState.contractEvents?.[0]?.oldSalary).toBe(100);
  });

  it("leaves high-budget saves untouched", () => {
    const gameState = createGameState({
      teams: [createTeam({ budget: 500000, cash: 120000 })],
    });

    const normalized = normalizeLegacyFinanceScale(gameState);

    expect(normalized.teams[0]?.cash).toBe(120000);
    expect(normalized.transferHistory[0]?.fee).toBe(63158.09);
    expect(normalized.seasonState.standings["A-A"]?.cashFc).toBe(13586.78);
  });
});
