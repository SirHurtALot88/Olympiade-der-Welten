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
  buildOfferCashAmounts,
  getLeagueFourthFromLowestSalaryTotal,
  getLeagueMinimumSalaryTotal,
  getPrizeMoneyReference,
  getRankMilestoneBonus,
  getSponsorPayoutForFinalRank,
  getSponsorPayoutForFinalRankAndTier,
  getSponsorRank32BaseAnchorSalary,
  resolveSponsorEconomyAnchors,
  SPONSOR_BASE_FLOOR_C,
  SPONSOR_BASE_SALARY_BUFFER_C,
  SPONSOR_BUILDING_COST_OFFSET_C,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { applySponsorNegotiationToComponents } from "@/lib/sponsor/sponsor-negotiation";
import type { SponsorOfferComponent } from "@/lib/data/olyDataTypes";

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

  it("places the rank spread on performance, not security (WAVE 1 crossover)", () => {
    const leagueMin = 38;
    const factor = 1.09;
    // WAVE 1 Kreuzung: Security ist jetzt der FLACHE "sichere" Typ (hoher garantierter Sockel, gedämpfte
    // Rang-Upside) → kleine Eigenspreizung. Performance ist der STEILE Typ (schlanker Sockel, große Rang-
    // Upside) → große Spreizung. Der Rang muss weiterhin für BEIDE zahlen (top > bottom), aber die
    // Spreizung liegt jetzt bei Performance, nicht mehr bei Security. Das ist die bewusst geänderte
    // Aussage: früher forderte dieser Test security-Dominanz oben — genau die ist jetzt (gewollt) weg.
    const secBottom = getSponsorPayoutForFinalRankAndTier(32, factor, 3, leagueMin, "security");
    const secTop = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin, "security");
    const perfBottom = getSponsorPayoutForFinalRankAndTier(32, factor, 3, leagueMin, "performance");
    const perfTop = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin, "performance");

    expect(secTop).toBeGreaterThan(secBottom); // Rang zahlt weiter, auch beim sicheren Typ
    expect(perfTop).toBeGreaterThan(perfBottom);
    // Performance ist deutlich rang-sensitiver (steilere Kurve) als Security.
    expect(perfTop / perfBottom).toBeGreaterThan(secTop / secBottom);
    // ... aber nicht runaway.
    expect(perfTop / perfBottom).toBeLessThan(3.5);
    // Und die Kreuzung selbst: Performance gewinnt oben, Security unten.
    expect(perfTop).toBeGreaterThan(secTop);
    expect(secBottom).toBeGreaterThan(perfBottom);
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
    const leagueMin = getSponsorRank32BaseAnchorSalary(gameState);

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

    // #56 Gehalts-Kalibrierung: der flache Basis-Sockel wurde an die Liga-Gehälter gestrafft
    // (Building-Offset 15.6→7), und die Meilenstein-Leiter angehoben (0.6→0.8). Diese Messung nutzt den
    // Default-Archetyp (security = FLACH), dessen absoluter 5★-Champion dadurch bewusst tiefer liegt (~74);
    // die eigentliche Top-Auszahlung kommt jetzt über performance+Rang (siehe Kreuzungs-Test). Kernaussage
    // hier bleibt: scharfe Stern-Skalierung (5★ ≫ 1★), nur nicht mehr die alte überhöhte Absolut-Höhe.
    expect(fiveStar).toBeGreaterThan(72);
    expect(twoStar).toBeLessThan(fiveStar * 0.92);
    expect(oneStar).toBeLessThan(twoStar);
    expect(fiveStar / oneStar).toBeGreaterThan(1.12);
  });

  it("anchors rank-32 security base to fourth-lowest salary minus buffer", () => {
    let gameState = createSingleplayerGameState();
    const fourthLowest = getLeagueFourthFromLowestSalaryTotal(gameState);
    const anchor = getSponsorRank32BaseAnchorSalary(gameState);
    const rrTeam = gameState.teams.find((team) => team.shortCode === "R-R") ?? gameState.teams.at(-1)!;
    const offers = buildSponsorOffersForTeam({ gameState, teamId: rrTeam.teamId });
    const security = offers.find((offer) => offer.archetype === "security");
    const base = security?.components.find((component) => component.kind === "base")?.rewardCash ?? 0;

    expect(anchor).toBeGreaterThanOrEqual(fourthLowest - SPONSOR_BASE_SALARY_BUFFER_C - 0.1);
    expect(base).toBeGreaterThanOrEqual(anchor * 0.98);
    expect(getSponsorPayoutForFinalRankAndTier(32, 1, security?.starTier ?? 2, anchor, "security", security?.teamQualityRank))
      .toBeGreaterThanOrEqual(anchor * 0.98);
  }, 180000);

  it("never pays security base below rank-32 anchor for top-table teams", () => {
    let gameState = createSingleplayerGameState();
    const anchor = getSponsorRank32BaseAnchorSalary(gameState);
    const topTeam = gameState.teams.find((team) => team.shortCode === "M-M") ?? gameState.teams[0]!;
    const offers = buildSponsorOffersForTeam({ gameState, teamId: topTeam.teamId });
    const security = offers.find((offer) => offer.archetype === "security");
    const base = security?.components.find((component) => component.kind === "base")?.rewardCash ?? 0;

    expect(base).toBeGreaterThanOrEqual(anchor * 0.98);
  }, 180000);

  it("softly rebalances milestone upside from top teams to bottom teams", () => {
    const leagueMin = 35;
    const salaryFactor = 1;
    const top = buildOfferCashAmounts({
      archetype: "performance",
      salaryFactor,
      starTier: 3,
      leagueMinSalary: leagueMin,
      teamQualityRank: 3,
    });
    const bottom = buildOfferCashAmounts({
      archetype: "performance",
      salaryFactor,
      starTier: 2,
      leagueMinSalary: leagueMin,
      teamQualityRank: 30,
    });

    expect(bottom.baseCash).toBeGreaterThanOrEqual(top.baseCash * 0.95);
    expect(bottom.rankCash).toBeGreaterThan(16);

    // Real-Settlement-Pfad: performance bekommt expectedRank = teamQualityRankAtSign. Die Kletter-/
    // Überperformance-Belohnung schwacher Teams läuft jetzt über die erwartungs-relative Leiter (Feed 2,
    // max(absolut, erwartungs-relativ)), nicht mehr über den bewusst reduzierten Milestone-Rebalance.
    const rank32Bottom = getSponsorPayoutForFinalRankAndTier(32, 1, 2, leagueMin, "performance", 30, 30);
    const rank24Bottom = getSponsorPayoutForFinalRankAndTier(24, 1, 2, leagueMin, "performance", 30, 30);
    const rank32Top = getSponsorPayoutForFinalRankAndTier(32, 1, 2, leagueMin, "performance", 3, 3);
    const rank24Top = getSponsorPayoutForFinalRankAndTier(24, 1, 2, leagueMin, "performance", 3, 3);

    // Schwaches Team behält den (leicht) höheren Sockel-Schutz am Boden.
    expect(rank32Bottom).toBeGreaterThanOrEqual(rank32Top * 0.95);
    // Überperformung zahlt: das schwache Team (exp 30 → 24, +6 über Erwartung) gewinnt durch den Aufstieg
    // deutlich mehr dazu als das starke Team (exp 3 → 24, unter Erwartung → nur die absolute Leiter).
    expect(rank24Bottom - rank32Bottom).toBeGreaterThan(rank24Top - rank32Top);
    // Ein starkes Team, das seine Erwartung verfehlt (exp 3, Rang 24), bekommt weniger als der neutrale Fall.
    expect(rank24Top).toBeLessThan(getSponsorPayoutForFinalRankAndTier(24, 1, 2, leagueMin, "performance", undefined));
  });

  it("pays bottom teams at least league minimum salary without rank milestones", () => {
    let gameState = createSingleplayerGameState();
    const rrTeam = gameState.teams.find((team) => team.shortCode === "R-R") ?? gameState.teams.at(-1)!;
    const leagueMin = getSponsorRank32BaseAnchorSalary(gameState);
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

    // Bounds include (a) den flachen Gebäude-Kosten-Offset auf dem Sockel (SPONSOR_BUILDING_COST_OFFSET_C)
    // und (b) den Schwachen-Schutz: R-R ist das schwächste Team (quality rank ~32) und bekommt daher einen
    // um bis zu ~+20 % angehobenen GARANTIERTEN Sockel (baseScale, OLY_SPONSOR_WEAK_BASE_PROTECT) — genau
    // das hält die Top5/Bottom5-Schere unter Ziel. Deshalb liegt die Obergrenze ~×1.2 über dem reinen Sockel.
    const weakProtect = 1.2;
    expect(payout).toBeGreaterThanOrEqual(leagueMin * salaryFactor * 0.98 + SPONSOR_BUILDING_COST_OFFSET_C);
    expect(payout).toBeLessThanOrEqual((leagueMin * salaryFactor * 1.08 + SPONSOR_BUILDING_COST_OFFSET_C) * weakProtect + 2);
  }, 60000);

  it("rewards rank-28 milestone for bottom teams", () => {
    let gameState = createSingleplayerGameState();
    const rrTeam = gameState.teams.find((team) => team.shortCode === "R-R") ?? gameState.teams.at(-1)!;
    const leagueMin = getSponsorRank32BaseAnchorSalary(gameState);
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
    const leagueMin = getSponsorRank32BaseAnchorSalary(gameState);
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

    // Compressed milestone ladder: top teams keep a meaningful upside over the base floor (~1.3–1.5×),
    // just not the old steep multiple.
    expect(payout).toBeGreaterThan(baseFloor * 1.3);
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

  // ── WAVE 1 Erfolgs-Assertions: der Bug ist weg ──────────────────────────────────────────────

  it("crosses archetypes: performance wins the top, security wins the bottom (no archetype dominates both ends)", () => {
    const factor = 1.0;
    const leagueMin = SPONSOR_BASE_FLOOR_C; // 32 — sauberer Anker mit klarer Marge auf beiden Seiten

    // Spitze (Rang 1, 5★): performance (steile Meilenstein-Leiter) überholt security (hoher Sockel).
    const topPerformance = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin, "performance");
    const topSecurity = getSponsorPayoutForFinalRankAndTier(1, factor, 5, leagueMin, "security");
    expect(topPerformance).toBeGreaterThan(topSecurity);

    // Keller (Rang 32, 3★): security (Sockel 1.12) liegt vor performance (Sockel 0.78).
    const bottomSecurity = getSponsorPayoutForFinalRankAndTier(32, factor, 3, leagueMin, "security");
    const bottomPerformance = getSponsorPayoutForFinalRankAndTier(32, factor, 3, leagueMin, "performance");
    expect(bottomSecurity).toBeGreaterThan(bottomPerformance);
  });

  it("keeps the offer display exactly equal to the settlement for every archetype", () => {
    const factor = 1.09;
    const leagueMin = 38;
    for (const archetype of ["security", "performance", "identity"] as const) {
      for (const starTier of [2, 3, 5] as const) {
        const amounts = buildOfferCashAmounts({ archetype, salaryFactor: factor, starTier, leagueMinSalary: leagueMin });
        const settlementTop = getSponsorPayoutForFinalRankAndTier(1, factor, starTier, leagueMin, archetype);
        // totalAtMaxRank == Settlement(Rang 1)
        expect(Math.abs(amounts.totalAtMaxRank - settlementTop)).toBeLessThanOrEqual(0.2);
        // und der ANGEZEIGTE Split (Basis + Rang) entspricht demselben Settlement — der Kern-Bug (Anzeige ≠
        // Settlement, security gewann überall) ist damit strukturell ausgeschlossen.
        expect(Math.abs(amounts.baseCash + amounts.rankCash - settlementTop)).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it("gives ambitious a real downside: base shrinks, upside grows vs safe/balanced", () => {
    const components: SponsorOfferComponent[] = [
      { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 50, rewardCash: 50 },
      { componentId: "rank-target", kind: "rank", label: "Rang", targetValue: 8, rewardCash: 20, penaltyCash: 2 },
    ];
    const apply = (profile: "safe" | "balanced" | "ambitious") =>
      applySponsorNegotiationToComponents({ components, termSeasons: 1, negotiationProfile: profile });
    const baseReward = (list: SponsorOfferComponent[]) => list.find((c) => c.kind === "base")!.rewardCash;
    const rankReward = (list: SponsorOfferComponent[]) => list.find((c) => c.kind === "rank")!.rewardCash;
    const rankPenalty = (list: SponsorOfferComponent[]) => list.find((c) => c.kind === "rank")!.penaltyCash ?? 0;

    const safe = apply("safe");
    const balanced = apply("balanced");
    const ambitious = apply("ambitious");

    // Bei schlechter Platzierung (nur Basis greift): safe > balanced > ambitious.
    expect(baseReward(safe)).toBeGreaterThan(baseReward(balanced));
    expect(baseReward(balanced)).toBeGreaterThan(baseReward(ambitious));
    // Bei Titel (Rang-Upside): ambitious > balanced > safe.
    expect(rankReward(ambitious)).toBeGreaterThan(rankReward(balanced));
    expect(rankReward(balanced)).toBeGreaterThan(rankReward(safe));
    // Echtes Risiko: ambitious verdoppelt den Malus, safe halbiert ihn.
    expect(rankPenalty(ambitious)).toBeGreaterThan(rankPenalty(balanced));
    expect(rankPenalty(balanced)).toBeGreaterThan(rankPenalty(safe));
  });
});
