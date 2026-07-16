import { describe, expect, it } from "vitest";

import {
  computeCompositeSellScore,
  resolveCompositeSellTeamProfile,
  resolveEffectiveSellThreshold,
  selectCompositeSellCandidates,
} from "@/lib/ai/ai-composite-sell-score";
import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

function team(partial: Partial<Team> = {}): Team {
  return {
    teamId: partial.teamId ?? "T-T",
    shortCode: partial.shortCode ?? "T-T",
    name: partial.name ?? "Test Team",
    budget: partial.budget ?? 100,
    cash: partial.cash ?? 100,
    identityId: partial.identityId ?? "T-T",
    humanControlled: partial.humanControlled ?? false,
    rosterLimit: partial.rosterLimit ?? 14,
    logoPath: partial.logoPath ?? null,
  };
}

function player(id: string, partial: Partial<Player> = {}): Player {
  return {
    id,
    name: partial.name ?? id,
    rating: partial.rating ?? 70,
    marketValue: partial.marketValue ?? 40,
    salaryDemand: partial.salaryDemand ?? 8,
    displayMarketValue: partial.displayMarketValue ?? partial.marketValue ?? 40,
    displaySalary: partial.displaySalary ?? partial.salaryDemand ?? 8,
    className: partial.className ?? "Hero",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "m",
    referenceClass: partial.referenceClass ?? null,
    imageSource: partial.imageSource ?? null,
    bracketLabel: partial.bracketLabel ?? null,
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { d1: 60 },
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 1, above40: 1, above60: 0, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 0,
    portraitPath: partial.portraitPath ?? null,
    portraitUrl: partial.portraitUrl ?? null,
  };
}

function rosterEntry(id: string, playerId: string, partial: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id,
    teamId: partial.teamId ?? "T-T",
    playerId,
    contractLength: partial.contractLength ?? 2,
    salary: partial.salary ?? 8,
    upkeep: partial.upkeep ?? partial.salary ?? 8,
    purchasePrice: partial.purchasePrice ?? 40,
    currentValue: partial.currentValue ?? partial.purchasePrice ?? 40,
    roleTag: partial.roleTag ?? "starter",
    joinedSeasonId: partial.joinedSeasonId ?? "season-1",
  };
}

function gameState(input: {
  team?: Team;
  identity?: TeamIdentity | null;
  players?: Player[];
  rosters?: RosterEntry[];
}): GameState {
  const testTeam = input.team ?? team();
  return {
    gamePhase: "preseason_management",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: [] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      playerDisciplinePerformances: [],
      seasonSnapshots: [],
    },
    teams: [testTeam],
    teamIdentities: input.identity ? [input.identity] : [],
    players: input.players ?? [],
    rosters: input.rosters ?? [],
    disciplines: [],
    contracts: [],
    transferHistory: [],
    logs: [],
    facilityUpgrades: [],
    facilityStaff: [],
    scoutingAssignments: [],
    scoutingReports: [],
    watchlistEntries: [],
    sponsorOffers: [],
    sponsorContracts: [],
    boardObjectives: [],
    seasonObjectives: [],
    playerSeasonPerformances: [],
    matchdayResults: [],
    lineups: [],
    aiTransferIntents: [],
    marketListings: [],
    freeAgents: [],
    draftState: null,
    allianceState: null,
    progressionState: null,
    inboxMessages: [],
    newsItems: [],
    managerPlannerState: null,
    localTeamSettings: {},
    // Cast: this fixture intentionally supplies a partial GameState; the extra/omitted
    // fields drifted with the Foundation-UI merge and are irrelevant to sell-score tests.
  } as unknown as GameState;
}

describe("ai-composite-sell-score", () => {
  it("ranks high absolute mw loss above high relative loss on cheap players", () => {
    const star = computeCompositeSellScore({
      teamId: "T-T",
      team: team({ teamId: "T-T", cash: 80 }),
      identity: null,
      player: player("star", { marketValue: 73 }),
      roster: rosterEntry("r1", "star", { purchasePrice: 83, currentValue: 73 }),
      gameState: gameState({
        players: [player("star", { marketValue: 73 })],
        rosters: [rosterEntry("r1", "star", { purchasePrice: 83, currentValue: 73 })],
      }),
      expectedSellValue: 73,
      marketValue: 73,
      salary: 10,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
    });
    const cheap = computeCompositeSellScore({
      teamId: "T-T",
      team: team({ teamId: "T-T", cash: 80 }),
      identity: null,
      player: player("cheap", { marketValue: 2 }),
      roster: rosterEntry("r2", "cheap", { purchasePrice: 4, currentValue: 2 }),
      gameState: gameState({
        players: [player("cheap", { marketValue: 2 })],
        rosters: [rosterEntry("r2", "cheap", { purchasePrice: 4, currentValue: 2 })],
      }),
      expectedSellValue: 2,
      marketValue: 2,
      salary: 1,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
    });

    expect(star.components.mwDecline).toBeGreaterThan(cheap.components.mwDecline);
  });

  it("uses flip-shop profile for C-C with lower threshold", () => {
    expect(resolveCompositeSellTeamProfile("C-C", 5)).toBe("flip_shop");
    expect(
      resolveEffectiveSellThreshold({ teamProfile: "flip_shop", cashPressureScore: 0 }),
    ).toBe(22);
  });

  it("scores profitable sells above default threshold", () => {
    const score = computeCompositeSellScore({
      teamId: "T-T",
      team: team({ teamId: "T-T", cash: 60 }),
      identity: null,
      player: player("profit", { marketValue: 40 }),
      roster: rosterEntry("r1", "profit", { purchasePrice: 30, currentValue: 40 }),
      gameState: gameState({
        players: [player("profit", { marketValue: 40 })],
        rosters: [rosterEntry("r1", "profit", { purchasePrice: 30, currentValue: 40 })],
      }),
      expectedSellValue: 52,
      marketValue: 40,
      salary: 6,
      teamCash: 60,
      teamSalaryTotal: 30,
      cashPressureScore: 0.2,
      sellForProfitAggression: 5,
    });

    expect(score.total).toBeGreaterThanOrEqual(score.threshold);
  });

  it("stops taking sells once cash pressure is resolved", () => {
    const candidates = [
      { candidate: { expectedSellValue: 20, salary: 5, purchasePrice: 10 }, score: 55 },
      { candidate: { expectedSellValue: 18, salary: 4, purchasePrice: 10 }, score: 52 },
      { candidate: { expectedSellValue: 15, salary: 3, purchasePrice: 10 }, score: 48 },
    ];
    const selected = selectCompositeSellCandidates({
      candidates,
      teamCash: 10,
      teamSalaryTotal: 40,
      cashPressureScore: 0.5,
      teamProfile: "default",
    });
    expect(selected.length).toBeLessThan(candidates.length);
    expect(selected.length).toBeGreaterThan(0);
  });

  it("applies extra loss resistance for fresh same-season net-loss sells", () => {
    const older = computeCompositeSellScore({
      teamId: "W-L",
      team: team({ teamId: "W-L", cash: 80 }),
      identity: null,
      player: player("older", { marketValue: 20 }),
      roster: rosterEntry("r1", "older", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-0" }),
      gameState: gameState({
        players: [player("older", { marketValue: 20 })],
        rosters: [rosterEntry("r1", "older", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-0" })],
      }),
      expectedSellValue: 6,
      marketValue: 20,
      salary: 6,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
    });
    const fresh = computeCompositeSellScore({
      teamId: "W-L",
      team: team({ teamId: "W-L", cash: 80 }),
      identity: null,
      player: player("fresh", { marketValue: 20 }),
      roster: rosterEntry("r2", "fresh", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-1" }),
      gameState: gameState({
        players: [player("fresh", { marketValue: 20 })],
        rosters: [rosterEntry("r2", "fresh", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-1" })],
      }),
      expectedSellValue: 6,
      marketValue: 20,
      salary: 6,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
    });
    expect(fresh.components.lossResistance).toBeLessThan(older.components.lossResistance);
    expect(fresh.total).toBeLessThanOrEqual(older.total);
  });

  it("bargain_hunter GM archetype routes the team into the flip_shop profile", () => {
    expect(resolveCompositeSellTeamProfile("Z-Z", 3, "bargain_hunter")).toBe("flip_shop");
    // without the archetype and with a low (blended) aggression it must stay default
    expect(resolveCompositeSellTeamProfile("Z-Z", 3, "culture_keeper")).toBe("default");
    expect(resolveCompositeSellTeamProfile("Z-Z", 3)).toBe("default");
  });

  it("bargain_hunter strengthens loss resistance on a fresh under-purchase sell", () => {
    const commonInput = {
      teamId: "Z-Z",
      team: team({ teamId: "Z-Z", cash: 80 }),
      identity: null,
      player: player("fresh", { marketValue: 20 }),
      roster: rosterEntry("r1", "fresh", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-1" }),
      gameState: gameState({
        players: [player("fresh", { marketValue: 20 })],
        rosters: [rosterEntry("r1", "fresh", { purchasePrice: 25, currentValue: 20, joinedSeasonId: "season-1" })],
      }),
      expectedSellValue: 6,
      marketValue: 20,
      salary: 6,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
    };
    const neutral = computeCompositeSellScore(commonInput);
    const bargainHunter = computeCompositeSellScore({ ...commonInput, gmArchetype: "bargain_hunter" });
    expect(bargainHunter.components.lossResistance).toBeLessThan(neutral.components.lossResistance);
    expect(bargainHunter.total).toBeLessThanOrEqual(neutral.total);
  });

  it("flip_shop only takes real profit flips (drops sells below purchase)", () => {
    const candidates: Array<{
      candidate: { expectedSellValue: number; salary: number; purchasePrice: number | null };
      score: number;
    }> = [
      { candidate: { expectedSellValue: 30, salary: 5, purchasePrice: 20 }, score: 60 }, // +10 profit
      { candidate: { expectedSellValue: 12, salary: 4, purchasePrice: 20 }, score: 58 }, // -8 loss → drop
      { candidate: { expectedSellValue: 25, salary: 3, purchasePrice: null }, score: 40 }, // unknown buy → keep
    ];
    const selected = selectCompositeSellCandidates({
      candidates,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
      teamProfile: "flip_shop",
    });
    const sells = selected.map((c) => c.expectedSellValue);
    expect(sells).toContain(30);
    expect(sells).toContain(25);
    expect(sells).not.toContain(12);
  });

  it("can keep profit-selling below hardMin when allowProfitSellsBelowMin is set", () => {
    const candidates = [
      { candidate: { expectedSellValue: 20, salary: 5 }, score: 55 },
      { candidate: { expectedSellValue: 18, salary: 4 }, score: 52 },
      { candidate: { expectedSellValue: 15, salary: 3 }, score: 48 },
    ];
    const selected = selectCompositeSellCandidates({
      candidates,
      teamCash: 80,
      teamSalaryTotal: 40,
      cashPressureScore: 0.1,
      teamProfile: "default",
      allowProfitSellsBelowMin: true,
    });
    expect(selected).toHaveLength(3);
  });
});
