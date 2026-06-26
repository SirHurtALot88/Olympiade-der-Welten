import { describe, expect, it } from "vitest";

import type { GameState, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  buildSponsorOffersForTeam,
  chooseSponsorOffer,
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getPrizeMoneyReference } from "@/lib/sponsor/sponsor-economy-calibration";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

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
  const rosters = teams.flatMap((team) =>
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

function totalNormalizedPrizeReference(gameState: GameState, salaryFactor: number) {
  return gameState.teams.reduce((sum, team) => {
    const rank = gameState.seasonState.standings[team.teamId]?.rank ?? 16;
    return sum + getPrizeMoneyReference(rank, salaryFactor);
  }, 0);
}

function totalSeasonSponsorPayout(gameState: GameState, seasonId: string) {
  return (gameState.seasonState.sponsorPayoutLogs ?? [])
    .filter((log) => log.seasonId === seasonId && log.cashDelta > 0)
    .reduce((sum, log) => sum + log.cashDelta, 0);
}

function teamSeasonSponsorPayout(gameState: GameState, seasonId: string, teamId: string) {
  return (gameState.seasonState.sponsorPayoutLogs ?? [])
    .filter((log) => log.seasonId === seasonId && log.teamId === teamId)
    .reduce((sum, log) => sum + log.cashDelta, 0);
}

function runLeagueSettlement(gameState: GameState) {
  let next = ensureSeasonSponsorOffers(gameState);
  next = chooseSponsorOfferForAiTeams(next);
  return applySponsorSettlement({
    gameState: next,
    saveId: "sponsor-balance-test",
    phase: "season_end",
    execute: true,
  }).gameState;
}

describe("sponsor economy balance", () => {
  it("scales sponsor settlement proportionally with salary factor", () => {
    const lowFactorState = runLeagueSettlement(buildLeagueGameState(0.9));
    const highFactorState = runLeagueSettlement(buildLeagueGameState(1.21));
    const lowTotal = totalSeasonSponsorPayout(lowFactorState, "season-2");
    const highTotal = totalSeasonSponsorPayout(highFactorState, "season-2");

    expect(lowTotal).toBeGreaterThan(0);
    expect(highTotal / lowTotal).toBeGreaterThan(1.15);
    expect(highTotal / lowTotal).toBeLessThan(1.55);
  }, 60000);

  it("keeps league sponsor settlement near normalized prize money reference", () => {
    for (const salaryFactor of [0.9, 1.0, 1.21]) {
      const gameState = runLeagueSettlement(buildLeagueGameState(salaryFactor));
      const sponsorTotal = totalSeasonSponsorPayout(gameState, "season-2");
      const prizeReference = totalNormalizedPrizeReference(gameState, salaryFactor);
      const ratio = sponsorTotal / prizeReference;

      expect(ratio).toBeGreaterThan(0.82);
      expect(ratio).toBeLessThan(1.18);
    }
  }, 120000);

  it("limits payout volatility across teams in a simulated season", () => {
    const gameState = runLeagueSettlement(buildLeagueGameState(1.0));
    const payouts = gameState.teams.map((team) => teamSeasonSponsorPayout(gameState, "season-2", team.teamId));
    const positive = payouts.filter((value) => value > 0);
    const min = Math.min(...positive);
    const max = Math.max(...positive);

    expect(max / min).toBeLessThan(5);
  }, 60000);

  it("supports bottom-budget teams with meaningful sponsor income in singleplayer seed", () => {
    let gameState = createSingleplayerGameState();
    const bottomTeam = [...gameState.teams].sort((left, right) => left.budget - right.budget)[0]!;
    const rank = 20;
    gameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: {
          ...gameState.seasonState.standings,
          [bottomTeam.teamId]: { points: 40, rank, startplatz: rank },
        },
        seasonEconomyFactors: [
          {
            seasonId: gameState.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: 1,
            source: "sheet_seed",
          },
        ],
      },
    };

    const settled = runLeagueSettlement(gameState);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, bottomTeam.teamId);
    const prizeReference = getPrizeMoneyReference(rank, 1);

    expect(payout).toBeGreaterThanOrEqual(prizeReference * 0.6);
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
  }, 15000);

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
  }, 15000);
});
