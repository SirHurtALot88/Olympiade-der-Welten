import { describe, expect, it } from "vitest";

import type { GameState, LoanRecord, StandingRecord, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  RIVAL_CUTOFF,
  TEAM_LOAN_FLOOR,
  applyEarlyPayoff,
  applyLoanSettlement,
  buildLoanOffers,
  computeLenderOfferAmount,
  computeLoanTerms,
  computeTeamLoanRate,
  getTeamOutstandingDebt,
  originateLoan,
} from "@/lib/finance/loan-service";
import { getTeamRelationship } from "@/lib/rivalries/team-rivalries";

// Real team IDs (from the relationship sheet) so getTeamRelationship resolves meaningful values:
// - Death Peaches (D-P) -> Cash Creators (C-C): +3 (good relationship, finance-hungry lender)
// - Dire Legion (D-L) -> The Chantry (T-C): -4 (hostile, at the RIVAL_CUTOFF, must NOT lend)
const BORROWER_ID = "C-C";
const FRIENDLY_LENDER_ID = "D-P";
const RIVAL_LENDER_ID = "D-L";
const RIVAL_BORROWER_ID = "T-C";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "C-C",
    shortCode: partial?.shortCode ?? partial?.teamId ?? "C-C",
    name: partial?.name ?? "Cash Creators",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 50,
    identityId: partial?.identityId ?? partial?.teamId ?? "C-C",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createIdentity(teamId: string, partial?: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId,
    playerType: null,
    pow: 8,
    spe: 7,
    men: 5,
    soc: 3,
    ambition: 8,
    finances: partial?.finances ?? 5,
    boardConfidence: 7,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
  };
}

function createGameState(input?: {
  teams?: Team[];
  teamIdentities?: TeamIdentity[];
  loans?: LoanRecord[];
  loanApplyLogs?: GameState["seasonState"]["loanApplyLogs"];
  standings?: Record<string, StandingRecord>;
  sponsorPayoutLogs?: GameState["seasonState"]["sponsorPayoutLogs"];
  seasonId?: string;
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  const seasonId = input?.seasonId ?? "season-3";
  return {
    season: {
      id: seasonId,
      name: "Season 3",
      year: 2028,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId,
      schedule: [],
      standings: input?.standings ?? Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      loans: input?.loans ?? [],
      loanApplyLogs: input?.loanApplyLogs ?? [],
      sponsorPayoutLogs: input?.sponsorPayoutLogs ?? [],
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: input?.teamIdentities ?? teams.map((team) => createIdentity(team.teamId)),
    players: [],
    disciplines: [],
    rosters: [],
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
      teamCount: teams.length,
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

/** Baut das Zwei-Team-Szenario Borrower/Lender mit reichlich freiem Cash für den Verleiher. */
function buildBorrowLenderState(input?: {
  borrowerCash?: number;
  lenderCash?: number;
  lenderFinances?: number;
  seasonId?: string;
}): GameState {
  const seasonId = input?.seasonId ?? "season-3";
  const borrower = createTeam({ teamId: BORROWER_ID, name: "Cash Creators", cash: input?.borrowerCash ?? 30 });
  const lender = createTeam({ teamId: FRIENDLY_LENDER_ID, name: "Death Peaches", cash: input?.lenderCash ?? 100 });
  return createGameState({
    teams: [borrower, lender],
    teamIdentities: [
      createIdentity(BORROWER_ID, { finances: 5 }),
      createIdentity(FRIENDLY_LENDER_ID, { finances: input?.lenderFinances ?? 5 }),
    ],
    seasonId: input?.seasonId,
    // Sponsor payout log kept for realism/fixture parity; borrowing capacity itself is now purely
    // teamwert-based (cash + marketValueTotal), see computeBorrowingCapacity in loan-service.ts,
    // and is already covered in detail in loan-service.test.ts.
    sponsorPayoutLogs: [
      {
        id: "payout-borrower",
        saveId: "save-1",
        seasonId: "season-2",
        teamId: BORROWER_ID,
        phase: "season_end",
        componentId: "base",
        cashDelta: 100,
        action: "apply",
        createdAt: "2027-01-01T00:00:00.000Z",
      },
    ],
  });
}

describe("computeTeamLoanRate", () => {
  it("always undercuts the bank by TEAM_INTERACTION_DISCOUNT when relationship is neutral", () => {
    const rate = computeTeamLoanRate({ bankRate: 0.15, relationshipValue: 0, lenderFinances: 5 });
    expect(rate).toBeCloseTo(0.14, 4); // 0.15 - 0.01 interaction, no relationship/yield bonus
  });

  it("adds a relationship discount up to TEAM_RELATIONSHIP_DISCOUNT_MAX at relationship +5", () => {
    const rate = computeTeamLoanRate({ bankRate: 0.2, relationshipValue: 5, lenderFinances: 5 });
    // 0.20 - 0.01 (interaction) - 0.03 (relationship, capped) - 0 (yield, finances==5) = 0.16
    expect(rate).toBeCloseTo(0.16, 4);
  });

  it("finance-hungry lenders shave a bit more (yield appetite)", () => {
    const neutral = computeTeamLoanRate({ bankRate: 0.2, relationshipValue: 0, lenderFinances: 5 });
    const hungry = computeTeamLoanRate({ bankRate: 0.2, relationshipValue: 0, lenderFinances: 10 });
    expect(hungry).toBeLessThan(neutral);
  });

  it("never goes below TEAM_LOAN_FLOOR even for a low bank rate with max discounts", () => {
    const rate = computeTeamLoanRate({ bankRate: 0.07, relationshipValue: 5, lenderFinances: 10 });
    expect(rate).toBeGreaterThanOrEqual(TEAM_LOAN_FLOOR);
    expect(rate).toBeCloseTo(TEAM_LOAN_FLOOR, 4);
  });

  it("negative relationship values do not increase the discount beyond the interaction discount", () => {
    const rate = computeTeamLoanRate({ bankRate: 0.15, relationshipValue: -2, lenderFinances: 5 });
    expect(rate).toBeCloseTo(0.14, 4);
  });
});

describe("computeLenderOfferAmount", () => {
  it("offers only a fraction of lendable cash, keeping a reserve", () => {
    const gameState = buildBorrowLenderState({ lenderCash: 100 });
    const offer = computeLenderOfferAmount(gameState, FRIENDLY_LENDER_ID, { relationshipValue: 0 });
    // lendableCash = cash - buffer (buffer is small relative to 100 here); offer should be a
    // clear fraction, not the full lendable amount.
    const lendable = 100 - 3; // buffer floors at PLANNER_LIQUIDITY_BUFFER_MIN (3) with an empty roster
    expect(offer).toBeLessThan(lendable);
    expect(offer).toBeGreaterThanOrEqual(lendable * 0.5 - 0.5);
  });

  it("increases the share for finance-hungry lenders and good relationships, capped at LENDER_OFFER_SHARE_MAX", () => {
    const baseState = buildBorrowLenderState({ lenderCash: 100, lenderFinances: 5 });
    const richState = buildBorrowLenderState({ lenderCash: 100, lenderFinances: 10 });

    const baseOffer = computeLenderOfferAmount(baseState, FRIENDLY_LENDER_ID, { relationshipValue: 0 });
    const richOfferNeutralRel = computeLenderOfferAmount(richState, FRIENDLY_LENDER_ID, { relationshipValue: 0 });
    const richOfferGoodRel = computeLenderOfferAmount(richState, FRIENDLY_LENDER_ID, { relationshipValue: 5 });

    expect(richOfferNeutralRel).toBeGreaterThan(baseOffer);
    expect(richOfferGoodRel).toBeGreaterThan(richOfferNeutralRel);

    const lendable = 100 - 3;
    expect(richOfferGoodRel).toBeLessThanOrEqual(lendable * 0.66 + 0.5);
  });

  it("returns 0 when the lender has no cash above its liquidity buffer", () => {
    const gameState = buildBorrowLenderState({ lenderCash: 1 });
    const offer = computeLenderOfferAmount(gameState, FRIENDLY_LENDER_ID, { relationshipValue: 0 });
    expect(offer).toBe(0);
  });
});

describe("buildLoanOffers", () => {
  it("always includes a bank offer even with no eligible teams", () => {
    const gameState = createGameState({ teams: [createTeam({ teamId: BORROWER_ID, cash: 30 })] });
    const offers = buildLoanOffers(gameState, BORROWER_ID, 5, 4);
    expect(offers).toHaveLength(1);
    expect(offers[0].lenderType).toBe("bank");
  });

  it("excludes rivals (relationship <= RIVAL_CUTOFF)", () => {
    const rivalLenderRelation = getTeamRelationship(RIVAL_LENDER_ID, RIVAL_BORROWER_ID);
    expect(rivalLenderRelation?.value).toBeLessThanOrEqual(RIVAL_CUTOFF);

    const borrower = createTeam({ teamId: RIVAL_BORROWER_ID, name: "The Chantry", cash: 30 });
    const rival = createTeam({ teamId: RIVAL_LENDER_ID, name: "Dire Legion", cash: 200 });
    const gameState = createGameState({
      teams: [borrower, rival],
      teamIdentities: [createIdentity(RIVAL_BORROWER_ID), createIdentity(RIVAL_LENDER_ID, { finances: 8 })],
    });

    const offers = buildLoanOffers(gameState, RIVAL_BORROWER_ID, 5, 4);
    expect(offers.every((offer) => offer.lenderTeamId !== RIVAL_LENDER_ID)).toBe(true);
  });

  it("includes eligible team offers, sorted ascending by rate (best first), bank always present", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 100 });
    const offers = buildLoanOffers(gameState, BORROWER_ID, 5, 4);

    expect(offers.some((offer) => offer.lenderType === "bank")).toBe(true);
    expect(offers.some((offer) => offer.lenderTeamId === FRIENDLY_LENDER_ID)).toBe(true);

    for (let i = 1; i < offers.length; i += 1) {
      expect(offers[i].interestRatePerSeason).toBeGreaterThanOrEqual(offers[i - 1].interestRatePerSeason);
    }
    // The team offer must undercut the bank offer (interactionDiscount always applies).
    const bank = offers.find((offer) => offer.lenderType === "bank")!;
    const team = offers.find((offer) => offer.lenderTeamId === FRIENDLY_LENDER_ID)!;
    expect(team.interestRatePerSeason).toBeLessThan(bank.interestRatePerSeason);
    expect(offers[0].lenderType).toBe("team"); // best offer is the team, since teams always undercut
  });

  it("drops team offers whose offered amount is smaller than the requested principal (slider filter)", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 20 });
    const smallPrincipalOffers = buildLoanOffers(gameState, BORROWER_ID, 2, 4);
    const largePrincipalOffers = buildLoanOffers(gameState, BORROWER_ID, 100, 4);

    expect(smallPrincipalOffers.some((offer) => offer.lenderTeamId === FRIENDLY_LENDER_ID)).toBe(true);
    expect(largePrincipalOffers.some((offer) => offer.lenderTeamId === FRIENDLY_LENDER_ID)).toBe(false);
    expect(largePrincipalOffers.some((offer) => offer.lenderType === "bank")).toBe(true);
  });

  it("returns an empty list in Season 1 (hard rule)", () => {
    const gameState = buildBorrowLenderState({ seasonId: "season-1" });
    expect(buildLoanOffers(gameState, BORROWER_ID, 5, 4)).toEqual([]);
  });
});

describe("originateLoan (team lender, Phase 3)", () => {
  it("debits the lender and credits the borrower, records a team-rate LoanRecord", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 80, lenderCash: 100 });
    const result = originateLoan(
      gameState,
      { borrowerTeamId: BORROWER_ID, principal: 10, termSeasons: 4, lenderType: "team", lenderTeamId: FRIENDLY_LENDER_ID },
      { execute: true },
    );

    expect(result.ok).toBe(true);
    expect(result.loan?.lenderType).toBe("team");
    expect(result.loan?.lenderTeamId).toBe(FRIENDLY_LENDER_ID);

    const bankTerms = computeLoanTerms({ principal: 10, termSeasons: 4, finances: 5 });
    expect(result.loan!.interestRatePerSeason).toBeLessThan(bankTerms.interestRatePerSeason);

    const borrower = result.gameState.teams.find((team) => team.teamId === BORROWER_ID)!;
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    expect(borrower.cash).toBeCloseTo(90, 1); // 80 + 10
    expect(lender.cash).toBeCloseTo(90, 1); // 100 - 10

    expect(getTeamOutstandingDebt(result.gameState, BORROWER_ID)).toBeCloseTo(10, 1);
  });

  it("rejects a hostile (rival) lender", () => {
    const borrower = createTeam({ teamId: RIVAL_BORROWER_ID, name: "The Chantry", cash: 30 });
    const rival = createTeam({ teamId: RIVAL_LENDER_ID, name: "Dire Legion", cash: 200 });
    const gameState = createGameState({
      teams: [borrower, rival],
      teamIdentities: [createIdentity(RIVAL_BORROWER_ID), createIdentity(RIVAL_LENDER_ID, { finances: 8 })],
    });

    const result = originateLoan(
      gameState,
      { borrowerTeamId: RIVAL_BORROWER_ID, principal: 10, termSeasons: 4, lenderType: "team", lenderTeamId: RIVAL_LENDER_ID },
      { execute: true },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("lender_hostile_relationship");
  });

  it("rejects a lender without enough spare cash", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 5 });
    const result = originateLoan(
      gameState,
      { borrowerTeamId: BORROWER_ID, principal: 10, termSeasons: 4, lenderType: "team", lenderTeamId: FRIENDLY_LENDER_ID },
      { execute: true },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("lender_insufficient_cash");
  });

  it("keeps the bank path unchanged (default lenderType)", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 80, lenderCash: 100 });
    const result = originateLoan(gameState, { borrowerTeamId: BORROWER_ID, principal: 10, termSeasons: 4 }, { execute: true });
    expect(result.ok).toBe(true);
    expect(result.loan?.lenderType).toBe("bank");
    expect(result.loan?.lenderTeamId).toBeUndefined();
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    expect(lender.cash).toBeCloseTo(100, 1); // untouched
  });
});

describe("applyLoanSettlement (team lender credit, Phase 3)", () => {
  function buildActiveTeamLoan(): LoanRecord {
    return {
      loanId: "loan:season-3:C-C:team-1",
      borrowerTeamId: BORROWER_ID,
      lenderType: "team",
      lenderTeamId: FRIENDLY_LENDER_ID,
      principalOriginal: 10,
      principalOutstanding: 10,
      interestRatePerSeason: 0.1,
      termSeasons: 4,
      seasonsRemaining: 4,
      installmentPerSeason: computeLoanTerms({ principal: 10, termSeasons: 4, finances: 5 }).installmentPerSeason,
      originatedSeasonId: "season-2",
      status: "active",
      missedPayments: 0,
    };
  }

  it("credits the lender with the installment actually collected, borrower is debited", () => {
    const loan = buildActiveTeamLoan();
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 100 });
    const stateWithLoan: GameState = { ...gameState, seasonState: { ...gameState.seasonState, loans: [loan] } };

    const result = applyLoanSettlement(stateWithLoan, { execute: true });
    expect(result.applied).toBe(true);

    const borrower = result.gameState.teams.find((team) => team.teamId === BORROWER_ID)!;
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    const row = result.preview.rows.find((entry) => entry.loanId === loan.loanId)!;

    expect(row.status).toBe("paid_full");
    expect(borrower.cash).toBeCloseTo(30 - row.installmentCharged, 1);
    expect(lender.cash).toBeCloseTo(100 + row.installmentCharged, 1);
  });

  it("credits the lender only the partial amount actually collected on default (lender bears the shortfall)", () => {
    const loan = buildActiveTeamLoan();
    // Borrower cash too low to cover the installment -> default/capitalization path.
    const gameState = buildBorrowLenderState({ borrowerCash: 0.5, lenderCash: 100 });
    const stateWithLoan: GameState = { ...gameState, seasonState: { ...gameState.seasonState, loans: [loan] } };

    const result = applyLoanSettlement(stateWithLoan, { execute: true });
    const borrower = result.gameState.teams.find((team) => team.teamId === BORROWER_ID)!;
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    const row = result.preview.rows.find((entry) => entry.loanId === loan.loanId)!;

    expect(row.status).toBe("defaulted_capitalized");
    expect(borrower.cash).toBeCloseTo(0, 1);
    expect(lender.cash).toBeCloseTo(100 + row.installmentCharged, 1); // only the partial amount, no phantom credit
    expect(row.installmentCharged).toBeLessThan(loan.installmentPerSeason);
  });

  it("still lets bank-loan installments vanish (no lender credit) — bank behavior unchanged", () => {
    const bankLoan: LoanRecord = { ...buildActiveTeamLoan(), lenderType: "bank", lenderTeamId: undefined };
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 100 });
    const stateWithLoan: GameState = { ...gameState, seasonState: { ...gameState.seasonState, loans: [bankLoan] } };

    const result = applyLoanSettlement(stateWithLoan, { execute: true });
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    expect(lender.cash).toBeCloseTo(100, 1); // untouched — no lender to credit for a bank loan
  });
});

describe("applyEarlyPayoff (team lender credit, Phase 3)", () => {
  it("credits the lender the full payoff amount", () => {
    const loan: LoanRecord = {
      loanId: "loan:season-3:C-C:team-2",
      borrowerTeamId: BORROWER_ID,
      lenderType: "team",
      lenderTeamId: FRIENDLY_LENDER_ID,
      principalOriginal: 10,
      principalOutstanding: 8,
      interestRatePerSeason: 0.1,
      termSeasons: 4,
      seasonsRemaining: 3,
      installmentPerSeason: 3,
      originatedSeasonId: "season-2",
      status: "active",
      missedPayments: 0,
    };
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 100 });
    const stateWithLoan: GameState = { ...gameState, seasonState: { ...gameState.seasonState, loans: [loan] } };

    const result = applyEarlyPayoff(stateWithLoan, loan.loanId, { execute: true });
    expect(result.ok).toBe(true);

    const borrower = result.gameState.teams.find((team) => team.teamId === BORROWER_ID)!;
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    expect(borrower.cash).toBeCloseTo(30 - result.payoff, 1);
    expect(lender.cash).toBeCloseTo(100 + result.payoff, 1);
  });

  it("keeps bank-loan payoff unchanged (no lender credit)", () => {
    const loan: LoanRecord = {
      loanId: "loan:season-3:C-C:bank-1",
      borrowerTeamId: BORROWER_ID,
      lenderType: "bank",
      principalOriginal: 10,
      principalOutstanding: 8,
      interestRatePerSeason: 0.1,
      termSeasons: 4,
      seasonsRemaining: 3,
      installmentPerSeason: 3,
      originatedSeasonId: "season-2",
      status: "active",
      missedPayments: 0,
    };
    const gameState = buildBorrowLenderState({ borrowerCash: 30, lenderCash: 100 });
    const stateWithLoan: GameState = { ...gameState, seasonState: { ...gameState.seasonState, loans: [loan] } };

    const result = applyEarlyPayoff(stateWithLoan, loan.loanId, { execute: true });
    const lender = result.gameState.teams.find((team) => team.teamId === FRIENDLY_LENDER_ID)!;
    expect(lender.cash).toBeCloseTo(100, 1); // untouched — bank loan
  });
});

describe("AI best-offer pick (Phase 3)", () => {
  // Mirrors the minimal hook change in ai-picks-run-service.ts: once resolveAiLoanDecision
  // decides to borrow, buildLoanOffers is consulted and offers[0] (lowest rate) is used to
  // originate the loan — bank or team, whichever undercuts.
  it("picks the team offer over the bank when the team offer has the lower rate", () => {
    const gameState = buildBorrowLenderState({ borrowerCash: 80, lenderCash: 100 });
    const offers = buildLoanOffers(gameState, BORROWER_ID, 10, 4);
    const bestOffer = offers[0];
    expect(bestOffer.lenderType).toBe("team");
    expect(bestOffer.lenderTeamId).toBe(FRIENDLY_LENDER_ID);

    const result = originateLoan(
      gameState,
      {
        borrowerTeamId: BORROWER_ID,
        principal: 10,
        termSeasons: 4,
        lenderType: bestOffer.lenderType,
        lenderTeamId: bestOffer.lenderTeamId ?? undefined,
      },
      { execute: true },
    );

    expect(result.ok).toBe(true);
    expect(result.loan?.lenderType).toBe("team");
    expect(result.loan?.interestRatePerSeason).toBeCloseTo(bestOffer.interestRatePerSeason, 4);
  });

  it("falls back to the bank when no team is eligible", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: BORROWER_ID, cash: 100 })],
      sponsorPayoutLogs: [
        {
          id: "payout-borrower",
          saveId: "save-1",
          seasonId: "season-2",
          teamId: BORROWER_ID,
          phase: "season_end",
          componentId: "base",
          cashDelta: 100,
          action: "apply",
          createdAt: "2027-01-01T00:00:00.000Z",
        },
      ],
    });
    const offers = buildLoanOffers(gameState, BORROWER_ID, 10, 4);
    expect(offers[0].lenderType).toBe("bank");

    const result = originateLoan(
      gameState,
      { borrowerTeamId: BORROWER_ID, principal: 10, termSeasons: 4, lenderType: offers[0].lenderType, lenderTeamId: offers[0].lenderTeamId ?? undefined },
      { execute: true },
    );
    expect(result.ok).toBe(true);
    expect(result.loan?.lenderType).toBe("bank");
  });
});
