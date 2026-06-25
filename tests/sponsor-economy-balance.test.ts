import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { buildSponsorOffersForTeam, chooseSponsorOffer } from "@/lib/sponsor/sponsor-offer-service";
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";

function createTeam(index: number): Team {
  const code = `T-${String(index + 1).padStart(2, "0")}`;
  return {
    teamId: code,
    shortCode: code,
    name: `Team ${index + 1}`,
    budget: 120,
    cash: 80,
    identityId: code,
    humanControlled: index === 0,
    rosterLimit: 12,
  };
}

function createRoster(teamId: string, playerId: string): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary: 55,
    upkeep: 55,
    purchasePrice: 20,
    currentValue: 20,
    roleTag: "starter",
    joinedSeasonId: "season-2",
  };
}

function buildLeagueGameState(salaryFactor: number): GameState {
  const teams = Array.from({ length: 32 }, (_, index) => createTeam(index));
  const rosters = teams.flatMap((team, teamIndex) =>
    Array.from({ length: 8 }, (_, playerIndex) =>
      createRoster(team.teamId, `${team.teamId}-p${playerIndex + 1}`),
    ),
  );

  return {
    gamePhase: "season_active",
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(teams.map((team, index) => [team.teamId, { points: 100 - index, rank: index + 1 }])),
      seasonEconomyFactors: [
        {
          seasonId: "season-2",
          seasonLabel: "Aktuell",
          horizonIndex: 0,
          factor: salaryFactor,
          source: "sheet_seed",
        },
      ],
    },
    matchdayState: { matchdayId: "season-2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: teams.map((team, index) => ({
      teamId: team.teamId,
      playerType: null,
      pow: 5,
      spe: 5,
      men: 5,
      soc: 5,
      ambition: index < 8 ? 8 : 5,
      finances: 5,
      boardConfidence: 6,
      harmony: 5,
      manners: 5,
      popularity: 5,
      cooperation: 5,
      playerMin: 7,
      playerOpt: 10,
    })),
    players: rosters.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      rating: 60,
      marketValue: 20,
      salaryDemand: 5,
      displayMarketValue: 20,
      displaySalary: 5,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "f",
      referenceClass: null,
      imageSource: null,
      bracketLabel: null,
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
      preferredDisciplineIds: [],
      disciplineRatings: { d1: 50 },
      disciplineTierCounts: { above20: 1, above40: 1, above60: 0, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 0,
      potential: 0,
      portraitPath: null,
      portraitUrl: null,
    })),
    disciplines: [],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 32,
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

function sumBestSponsorUpside(gameState: GameState, teamIds?: string[]): number {
  const targets = teamIds ?? gameState.teams.map((team) => team.teamId);
  return targets.reduce((sum, teamId) => {
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const best = offers.reduce((max, offer) => Math.max(max, offer.totalUpsideEstimate), 0);
    return sum + best;
  }, 0);
}

function totalLeaguePrizeMoney(gameState: GameState, salaryFactor: number): number {
  const teamSalaries = gameState.teams.map((team) =>
    gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => sum + (entry.upkeep ?? entry.salary ?? 0), 0),
  );
  const prizeRows = buildPrizeMoneyTable(teamSalaries, salaryFactor);
  return prizeRows.reduce((sum, row) => sum + row.totalPrizeMoney, 0);
}

describe("sponsor economy balance", () => {
  it("scales sponsor upside proportionally with salary factor", () => {
    const teamId = "T-01";
    const lowFactorState = buildLeagueGameState(0.9);
    const highFactorState = buildLeagueGameState(1.21);

    const lowUpside = sumBestSponsorUpside(lowFactorState, [teamId]);
    const highUpside = sumBestSponsorUpside(highFactorState, [teamId]);

    expect(lowUpside).toBeGreaterThan(0);
    expect(highUpside / lowUpside).toBeCloseTo(1.21 / 0.9, 1);
  }, 15000);

  it("keeps league sponsor upside in a reasonable band vs prize money", () => {
    for (const salaryFactor of [0.9, 1.0, 1.21]) {
      const gameState = buildLeagueGameState(salaryFactor);
      const sponsorUpside = sumBestSponsorUpside(gameState);
      const prizeMoney = totalLeaguePrizeMoney(gameState, salaryFactor);
      const ratio = sponsorUpside / prizeMoney;

      expect(ratio).toBeGreaterThan(0.35);
      expect(ratio).toBeLessThan(0.85);
    }
  }, 60000);

  it("always signs single-season contracts even when a longer term is requested", () => {
    const gameState = buildLeagueGameState(1.0);
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const withOffers: GameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { [teamId]: offers },
      },
    };

    const result = chooseSponsorOffer({
      gameState: withOffers,
      teamId,
      offerId: offers[0]!.offerId,
      termSeasons: 3,
      negotiationProfile: "balanced",
    });

    expect(result.contract?.termSeasons).toBe(1);
    expect(result.contract?.seasonsRemaining).toBe(1);
  });

  it("expires sponsor contracts after one season", () => {
    const gameState = buildLeagueGameState(1.0);
    const teamId = gameState.teams[0]!.teamId;
    const offers = buildSponsorOffersForTeam({ gameState, teamId });
    const signed = chooseSponsorOffer({
      gameState: {
        ...gameState,
        seasonState: {
          ...gameState.seasonState,
          sponsorOffersByTeamId: { [teamId]: offers },
        },
      },
      teamId,
      offerId: offers[0]!.offerId,
      negotiationProfile: "balanced",
    }).gameState;

    const advanced = advanceSponsorContractsForNewSeason(
      {
        ...signed,
        season: { ...signed.season, id: "season-3" },
      },
      "season-3",
    );

    expect(getTeamSponsorContract(advanced, teamId)).toBeNull();
  });
});
