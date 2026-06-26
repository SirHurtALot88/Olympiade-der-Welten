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
import {
  getLeagueMinimumSalaryTotal,
  getPrizeMoneyReference,
  getRankMilestoneBonus,
  getSponsorPayoutForFinalRank,
  getSponsorPayoutForFinalRankAndTier,
  resolveSponsorEconomyAnchors,
  SPONSOR_BASE_FLOOR_C,
} from "@/lib/sponsor/sponsor-economy-calibration";
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

function createRoster(teamId: string, playerId: string, salary = 5): RosterEntry {
  return {
    id: `roster:${teamId}:${playerId}`,
    teamId,
    playerId,
    contractLength: 2,
    salary,
    upkeep: salary,
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

function runSingleTeamSettlement(gameState: GameState, teamId: string) {
  const offers = buildSponsorOffersForTeam({ gameState, teamId });
  const securityOffer = offers.find((offer) => offer.archetype === "security") ?? offers[0]!;
  const signed = chooseSponsorOffer({
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        sponsorOffersByTeamId: { [teamId]: offers },
      },
    },
    teamId,
    offerId: securityOffer.offerId,
    negotiationProfile: "balanced",
  }).gameState;

  return applySponsorSettlement({
    gameState: signed,
    saveId: "sponsor-balance-test",
    phase: "season_end",
    execute: true,
  }).gameState;
}

describe("sponsor economy balance", () => {
  it("scales sponsor economy anchors with salary factor", () => {
    const leagueMin = 38;
    const low = resolveSponsorEconomyAnchors(0.9, leagueMin);
    const high = resolveSponsorEconomyAnchors(1.21, leagueMin);

    expect(high.effectiveBaseFloor / low.effectiveBaseFloor).toBeGreaterThan(1.15);
    expect(high.effectiveBaseFloor / low.effectiveBaseFloor).toBeLessThan(1.55);
    expect(high.milestonePool).toBeGreaterThanOrEqual(low.milestonePool);
  });

  it("guarantees weakest-salary teams receive at least scaled league minimum base", () => {
    for (const salaryFactor of [0.9, 1.0, 1.21]) {
      const leagueMin = 38;
      const anchors = resolveSponsorEconomyAnchors(salaryFactor, leagueMin);
      const rank32Payout = getSponsorPayoutForFinalRankAndTier(32, salaryFactor, 5, leagueMin, "security");

      expect(anchors.effectiveBaseFloor).toBeGreaterThanOrEqual(Math.max(SPONSOR_BASE_FLOOR_C, leagueMin) * salaryFactor * 0.98);
      expect(rank32Payout).toBeGreaterThanOrEqual(anchors.effectiveBaseFloor * 0.98);
    }
  });

  it("preserves payout spread between bottom and championship security offers", () => {
    const leagueMin = 38;
    const factor = 1.09;
    const bottom = getSponsorPayoutForFinalRankAndTier(32, factor, 3, leagueMin, "security");
    const top = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin, "security");

    expect(top).toBeGreaterThan(bottom);
    expect(top / bottom).toBeGreaterThan(1.8);
    expect(top / bottom).toBeLessThan(3.5);
  });

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

    const settled = runSingleTeamSettlement(gameState, bottomTeam.teamId);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, bottomTeam.teamId);
    const leagueMin = getLeagueMinimumSalaryTotal(gameState);

    expect(payout).toBeGreaterThanOrEqual(leagueMin * 0.95);
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

  it("applies Gewinnstufen milestone bonuses cumulatively", () => {
    expect(getRankMilestoneBonus(32, 1)).toBe(0);
    expect(getRankMilestoneBonus(28, 1)).toBe(7);
    expect(getRankMilestoneBonus(24, 1)).toBe(12);
    expect(getRankMilestoneBonus(1, 1)).toBe(63);
    expect(getSponsorPayoutForFinalRank(32, 1)).toBe(SPONSOR_BASE_FLOOR_C);
    expect(getSponsorPayoutForFinalRank(28, 1)).toBe(SPONSOR_BASE_FLOOR_C + 7);
    expect(getSponsorPayoutForFinalRank(1, 1)).toBe(SPONSOR_BASE_FLOOR_C + 63);
  });

  it("scales championship payout sharply by sponsor star tier", () => {
    const factor = 1.09;
    const leagueMin = 38;
    const fiveStar = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin);
    const twoStar = getSponsorPayoutForFinalRankAndTier(1, factor, 2, leagueMin);
    const oneStar = getSponsorPayoutForFinalRankAndTier(1, factor, 1, leagueMin);

    expect(fiveStar).toBeGreaterThan(95);
    expect(twoStar).toBeLessThan(fiveStar * 0.92);
    expect(oneStar).toBeLessThan(twoStar);
    expect(fiveStar / oneStar).toBeGreaterThan(1.12);
  });

  it("never pays security base below league minimum salary", () => {
    let gameState = createSingleplayerGameState();
    const leagueMin = getLeagueMinimumSalaryTotal(gameState);
    const offers = buildSponsorOffersForTeam({ gameState, teamId: gameState.teams[0]!.teamId });
    const security = offers.find((offer) => offer.archetype === "security");
    const base = security?.components.find((component) => component.kind === "base")?.rewardCash ?? 0;

    expect(base).toBeGreaterThanOrEqual(leagueMin * 0.98);
  }, 180000);

  it("pays bottom teams at least league minimum salary without rank milestones", () => {
    let gameState = createSingleplayerGameState();
    const rrTeam = gameState.teams.find((team) => team.shortCode === "R-R") ?? gameState.teams.at(-1)!;
    const leagueMin = getLeagueMinimumSalaryTotal(gameState);
    const salaryFactor = 1.09;
    gameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: Object.fromEntries(
          gameState.teams.map((team) => [
            team.teamId,
            {
              points: team.teamId === rrTeam.teamId ? 3 : 90,
              rank: team.teamId === rrTeam.teamId ? 32 : 1,
              startplatz: team.teamId === rrTeam.teamId ? 32 : 1,
            },
          ]),
        ),
        seasonEconomyFactors: [
          {
            seasonId: gameState.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: salaryFactor,
            source: "sheet_seed",
          },
        ],
      },
    };

    const settled = runSingleTeamSettlement(gameState, rrTeam.teamId);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, rrTeam.teamId);

    expect(payout).toBeGreaterThanOrEqual(leagueMin * salaryFactor * 0.98);
    expect(payout).toBeLessThanOrEqual(leagueMin * salaryFactor * 1.08);
  }, 60000);

  it("rewards rank-28 milestone for bottom teams", () => {
    let gameState = createSingleplayerGameState();
    const rrTeam = gameState.teams.find((team) => team.shortCode === "R-R") ?? gameState.teams.at(-1)!;
    const leagueMin = getLeagueMinimumSalaryTotal(gameState);
    const salaryFactor = 1.09;
    gameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: Object.fromEntries(
          gameState.teams.map((team) => [
            team.teamId,
            {
              points: team.teamId === rrTeam.teamId ? 20 : 90,
              rank: team.teamId === rrTeam.teamId ? 28 : 1,
              startplatz: team.teamId === rrTeam.teamId ? 32 : 1,
            },
          ]),
        ),
        seasonEconomyFactors: [
          {
            seasonId: gameState.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: salaryFactor,
            source: "sheet_seed",
          },
        ],
      },
    };

    const settled = runSingleTeamSettlement(gameState, rrTeam.teamId);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, rrTeam.teamId);
    const baseOnlyTarget = getSponsorPayoutForFinalRankAndTier(32, salaryFactor, 5, leagueMin, "security");

    expect(payout).toBeGreaterThan(baseOnlyTarget);
    expect(payout).toBeGreaterThanOrEqual(leagueMin * salaryFactor * 0.98);
  }, 60000);

  it("pays top teams above base floor with milestone upside", () => {
    let gameState = createSingleplayerGameState();
    const mmTeam = gameState.teams.find((team) => team.shortCode === "M-M") ?? gameState.teams[0]!;
    const leagueMin = getLeagueMinimumSalaryTotal(gameState);
    const salaryFactor = 1.09;
    gameState = {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: Object.fromEntries(
          gameState.teams.map((team) => [
            team.teamId,
            {
              points: team.teamId === mmTeam.teamId ? 90 : 3,
              rank: team.teamId === mmTeam.teamId ? 1 : 32,
              startplatz: team.teamId === mmTeam.teamId ? 1 : 32,
            },
          ]),
        ),
        seasonEconomyFactors: [
          {
            seasonId: gameState.season.id,
            seasonLabel: "Aktuell",
            horizonIndex: 0,
            factor: salaryFactor,
            source: "sheet_seed",
          },
        ],
      },
    };

    const settled = runSingleTeamSettlement(gameState, mmTeam.teamId);
    const payout = teamSeasonSponsorPayout(settled, gameState.season.id, mmTeam.teamId);
    const baseFloor = leagueMin * salaryFactor;

    expect(payout).toBeGreaterThan(baseFloor * 1.5);
    expect(payout).toBeLessThan(115);
  }, 60000);

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
