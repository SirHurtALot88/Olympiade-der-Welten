import { describe, expect, it } from "vitest";

import {
  buildDoctrineAuditBundle,
  buildLineupStrategyAudit,
  buildSeasonStrategyState,
  buildTacticalAdaptationAudit,
  buildTeamDoctrineMap,
  evaluateIdentityGuard,
} from "@/lib/ai/ai-manager-doctrine-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

function team(teamId: string, overrides: Partial<Team> = {}): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `${teamId} Team`,
    budget: 120,
    cash: 120,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 14,
    rosterMinTarget: 8,
    rosterOptTarget: 11,
    ...overrides,
  };
}

function identity(teamId: string, overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId,
    pow: 6,
    spe: 6,
    men: 6,
    soc: 6,
    ambition: 6,
    finances: 6,
    boardConfidence: 6,
    harmony: 6,
    manners: 6,
    popularity: 6,
    cooperation: 6,
    playerMin: 8,
    playerOpt: 11,
    ...overrides,
  };
}

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 25,
    salaryDemand: 5,
    className: "Hero",
    race: "Human",
    alignment: "Neutral",
    gender: "unknown",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 60 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 70,
    ...overrides,
  };
}

function gameState(overrides: Partial<GameState> = {}): GameState {
  const teams = [
    team("M-M", { name: "Mayhem Mavericks", cash: 180 }),
    team("B-P", { name: "Black Panthers", cash: 140 }),
    team("C-C", { name: "Cash Creators", cash: 160 }),
    team("W-W", { name: "Wicked Wizards", cash: 120 }),
    team("Z-H", { name: "Zero Heroes", cash: 100 }),
    team("H-H", { name: "Harmony House", cash: 100 }),
  ];
  const players = [
    player("cheap-prospect", { rating: 35, marketValue: 4, potential: 80, className: "Prospect", race: "Goblin" }),
    player("mage-core", { rating: 72, marketValue: 55, className: "Mage", race: "Construct", coreStats: { pow: 45, spe: 42, men: 82, soc: 55 } }),
    player("off-theme-star", { rating: 85, marketValue: 80, className: "Berserker", race: "Orc", coreStats: { pow: 88, spe: 50, men: 20, soc: 35 } }),
    player("toxic-talent", { rating: 75, marketValue: 35, className: "Rogue", race: "Human", traitsNegative: ["Diva", "toxic"] }),
  ];

  return {
    gamePhase: "preseason_management",
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: Object.fromEntries(teams.map((entry, index) => [entry.teamId, { points: 32 - index, rank: index + 1 }])),
    },
    matchdayState: { matchdayId: "md-1", status: "open" },
    teams,
    teamIdentities: [
      identity("M-M", { ambition: 10 }),
      identity("B-P", { ambition: 8 }),
      identity("C-C", { finances: 10 }),
      identity("W-W", { men: 10, ambition: 8 }),
      identity("Z-H", { ambition: 9 }),
      identity("H-H", { harmony: 10 }),
    ],
    players,
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-14T00:00:00.000Z",
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
    ...overrides,
  };
}

describe("ai-manager-doctrine-service", () => {
  it("creates a doctrine for every team", () => {
    const doctrines = buildTeamDoctrineMap(gameState());
    expect(Object.keys(doctrines)).toHaveLength(6);
    expect(doctrines["M-M"].preferredWinPath).toContain("Stars");
  });

  it("blocks M-M cheap-prospect-only behavior unless cash recovery explains it", () => {
    const state = gameState();
    const candidate = state.players.find((entry) => entry.id === "cheap-prospect");
    const result = evaluateIdentityGuard({
      gameState: state,
      teamId: "M-M",
      decisionType: "player_buy",
      candidate,
      context: { cheapProspectOnly: true },
    });

    expect(result.doctrineFit).toBe("red");
    expect(result.hardFails).toContain("topteam_cheap_players_despite_cash");

    const recovery = evaluateIdentityGuard({
      gameState: { ...state, teams: state.teams.map((entry) => (entry.teamId === "M-M" ? { ...entry, cash: -5 } : entry)) },
      teamId: "M-M",
      decisionType: "strategy_shift",
      candidate,
      context: { cashCrisis: true, seasonStrategy: "cash_recovery" },
    });
    expect(recovery.adaptationAllowed).toBe(true);
  });

  it("allows B-P small elite identity but blocks broad cheap roster", () => {
    const state = gameState();
    const result = evaluateIdentityGuard({
      gameState: state,
      teamId: "B-P",
      decisionType: "roster_target",
      context: { broadCheapRoster: true },
    });

    expect(result.doctrineFit).toBe("red");
    expect(result.hardFails).toContain("small_elite_broad_cheap_roster");
  });

  it("blocks C-C eco round when roster becomes unplayable", () => {
    const state = gameState();
    const result = evaluateIdentityGuard({
      gameState: state,
      teamId: "C-C",
      decisionType: "eco_round",
      projectedRosterCount: 5,
      context: { seasonStrategy: "eco_round", unplayableRoster: true },
    });

    expect(result.doctrineFit).toBe("red");
    expect(result.hardFails).toContain("eco_round_unplayable_roster");
  });

  it("rates W-W mage fit better than a strong off-theme candidate", () => {
    const state = gameState();
    const mage = state.players.find((entry) => entry.id === "mage-core");
    const offTheme = state.players.find((entry) => entry.id === "off-theme-star");

    const mageFit = evaluateIdentityGuard({ gameState: state, teamId: "W-W", decisionType: "player_buy", candidate: mage });
    const offThemeFit = evaluateIdentityGuard({ gameState: state, teamId: "W-W", decisionType: "player_buy", candidate: offTheme });

    expect(mageFit.identityScore).toBeGreaterThan(offThemeFit.identityScore);
    expect(offThemeFit.doctrineFit).toBe("red");
  });

  it("blocks toxic high-potential players for high-harmony teams", () => {
    const state = gameState();
    const toxic = state.players.find((entry) => entry.id === "toxic-talent");
    const result = evaluateIdentityGuard({ gameState: state, teamId: "H-H", decisionType: "player_buy", candidate: toxic });

    expect(result.doctrineFit).toBe("red");
    expect(result.hardFails).toContain("harmony_team_toxic_player_blocked");
  });

  it("allows Z-H more overpay/risk when it supports core attack", () => {
    const state = gameState();
    const star = state.players.find((entry) => entry.id === "off-theme-star");
    const result = evaluateIdentityGuard({
      gameState: state,
      teamId: "Z-H",
      decisionType: "overpay",
      candidate: star,
      context: { overpayForCore: true },
    });

    expect(result.adaptationAllowed).toBe(true);
    expect(result.doctrineFit).not.toBe("red");
  });

  it("switches to recovery/light tactical behavior in injury crisis and rejects hard training after crisis", () => {
    const base = gameState({
      rosters: [
        { id: "r1", teamId: "M-M", playerId: "cheap-prospect", contractLength: 2, salary: 3, upkeep: 3, roleTag: "starter", joinedSeasonId: "season-1" },
        { id: "r2", teamId: "M-M", playerId: "mage-core", contractLength: 2, salary: 8, upkeep: 8, roleTag: "starter", joinedSeasonId: "season-1" },
      ],
      seasonState: {
        ...gameState().seasonState,
        playerAvailabilityState: [
          { playerId: "cheap-prospect", teamId: "M-M", status: "injured", reason: "test", updatedAt: "2026-06-14T00:00:00.000Z" } as any,
          { playerId: "mage-core", teamId: "M-M", status: "injured", reason: "test", updatedAt: "2026-06-14T00:00:00.000Z" } as any,
        ],
      },
    });

    const tactical = buildTacticalAdaptationAudit(base).find((entry) => entry.teamId === "M-M");
    expect(tactical?.tacticalMode).toBe("injury_crisis");
    expect(tactical?.allowedActions).toContain("training_intensity_light");

    const hardTraining = evaluateIdentityGuard({
      gameState: base,
      teamId: "M-M",
      decisionType: "training_change",
      context: { hardTrainingAfterInjuryCrisis: true },
    });
    expect(hardTraining.doctrineFit).toBe("red");
  });

  it("creates season recommendation, lineup strategy and decision journal with rejected alternatives", () => {
    const state = gameState({
      rosters: Array.from({ length: 8 }, (_, index) => ({
        id: `m-m-r-${index}`,
        teamId: "M-M",
        playerId: index % 2 === 0 ? "mage-core" : "off-theme-star",
        contractLength: 2,
        salary: 8,
        upkeep: 8,
        roleTag: index < 5 ? "starter" : "bench",
        joinedSeasonId: "season-1",
      })),
    });
    const strategies = buildSeasonStrategyState(state);
    const lineup = buildLineupStrategyAudit(state);
    const bundle = buildDoctrineAuditBundle(state);

    expect(strategies["M-M"].seasonStrategy).toBe("win_now_push");
    expect(lineup.find((entry) => entry.teamId === "M-M")?.lineupStrategy).toBe("protect_stars");
    expect(bundle.managerReview.find((entry) => entry.teamId === "M-M")?.nextSeasonRecommendation).toBe("win_now_push");
    expect(bundle.decisionJournal[0]?.reason).toBeTruthy();
    expect(bundle.decisionJournal[0]?.rejectedAlternatives.length).toBeGreaterThan(0);
  });

  it("marks stop-under-opt without reason as red", () => {
    const state = gameState();
    const result = evaluateIdentityGuard({
      gameState: state,
      teamId: "M-M",
      decisionType: "stop_under_opt",
      projectedRosterCount: 9,
      context: { stopUnderOptWithoutReason: true },
    });

    expect(result.doctrineFit).toBe("red");
    expect(result.hardFails).toContain("stop_under_opt_without_reason");
  });
});
