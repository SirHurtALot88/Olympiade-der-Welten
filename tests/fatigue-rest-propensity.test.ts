import { describe, expect, it } from "vitest";

import {
  FATIGUE_REST_FLOOR,
  fatigueRestProbability,
  shouldRestForFatigue,
  stableRestRoll,
} from "@/lib/fatigue/fatigue-rest-propensity";
import {
  buildTeamPlayerTrainingLoadPlans,
  playerNeedsLineupRestFromTrainingLoad,
} from "@/lib/ai/ai-player-training-load-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

describe("fatigueRestProbability", () => {
  it("never fires below the fatigue floor", () => {
    expect(fatigueRestProbability({ fatigue: 0 })).toBe(0);
    expect(fatigueRestProbability({ fatigue: 30 })).toBe(0);
    expect(fatigueRestProbability({ fatigue: FATIGUE_REST_FLOOR })).toBe(0);
    expect(fatigueRestProbability({ fatigue: FATIGUE_REST_FLOOR, valueLean: 0.6, caution: 1, depthLean: 0.4 })).toBe(0);
  });

  it("rises monotonically with fatigue", () => {
    const series = [50, 60, 70, 80, 90, 100].map((fatigue) => fatigueRestProbability({ fatigue }));
    for (let index = 1; index < series.length; index += 1) {
      expect(series[index]).toBeGreaterThanOrEqual(series[index - 1]);
    }
    expect(series[0]).toBeGreaterThan(0);
    expect(series[series.length - 1]).toBeGreaterThan(0.5);
  });

  it("leans stars / high-value players into resting earlier than filler", () => {
    const star = fatigueRestProbability({ fatigue: 70, valueLean: 0.5 });
    const filler = fatigueRestProbability({ fatigue: 70, valueLean: 0 });
    expect(star).toBeGreaterThan(filler);
  });

  it("rests earlier for a cautious GM and later for a gambler", () => {
    const cautious = fatigueRestProbability({ fatigue: 65, caution: 1 });
    const neutral = fatigueRestProbability({ fatigue: 65, caution: 0 });
    const gambler = fatigueRestProbability({ fatigue: 65, caution: -1 });
    expect(cautious).toBeGreaterThan(neutral);
    expect(neutral).toBeGreaterThan(gambler);
  });

  it("rests more readily when rotation depth is available", () => {
    const deep = fatigueRestProbability({ fatigue: 65, depthLean: 0.4 });
    const thin = fatigueRestProbability({ fatigue: 65, depthLean: 0 });
    expect(deep).toBeGreaterThan(thin);
  });

  it("produces deterministic rolls in [0, 1)", () => {
    const a = stableRestRoll("seed-a");
    expect(a).toBe(stableRestRoll("seed-a"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(stableRestRoll("seed-a")).not.toBe(stableRestRoll("seed-b"));
  });

  it("rests a clear majority of a fatigued star cohort but no fresh players", () => {
    let tiredRested = 0;
    let freshRested = 0;
    const cohort = 200;
    for (let index = 0; index < cohort; index += 1) {
      if (shouldRestForFatigue({ fatigue: 82, valueLean: 0.5, seed: `tired-${index}` }).rest) {
        tiredRested += 1;
      }
      if (shouldRestForFatigue({ fatigue: 25, valueLean: 0.5, seed: `fresh-${index}` }).rest) {
        freshRested += 1;
      }
    }
    expect(freshRested).toBe(0);
    expect(tiredRested).toBeGreaterThan(cohort * 0.6);
  });
});

// --- Integration: fatigue-scaled LIGHT training via the AI training-load service ---

function buildPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 70,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 70, spe: 70, men: 70, soc: 70 },
    preferredDisciplineIds: [],
    disciplineRatings: { tdm: 80, "mini-dm": 75 },
    disciplineTierCounts: { above20: 1, above40: 1, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 25,
    form: 50,
    potential: 80,
    ...overrides,
  };
}

function buildGameState(players: Player[]): GameState {
  return {
    gamePhase: "preseason_management",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 9,
      matchdayIds: Array.from({ length: 10 }, (_, index) => `matchday-${index + 1}`),
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [
        { matchdayId: "matchday-9", matchdayIndex: 9, seasonId: "season-1", discipline1: null, discipline2: null },
      ],
      standings: {},
      playerDisciplinePerformances: players.flatMap((player) =>
        Array.from({ length: 6 }, (_, index) => ({
          id: `${player.id}-${index}`,
          playerId: player.id,
          teamId: "T-1",
          matchdayResultId: `result-${index}`,
          disciplineId: "tdm",
          scoreContribution: 4,
          finalPlayerScore: 70,
          isTop10: false,
          isMvpCandidate: false,
        })),
      ),
      teamFacilities: {
        "T-1": {
          facilities: {
            training_center: { level: 1, enabled: true },
            recovery_center: { level: 0, enabled: false },
            scouting_office: { level: 0, enabled: false },
            analytics_room: { level: 0, enabled: false },
            fan_shop: { level: 0, enabled: false },
            arena_upgrade: { level: 0, enabled: false },
            academy: { level: 0, enabled: false },
            specialist_wing: { level: 0, enabled: false },
          },
        },
      },
    },
    matchdayState: {
      matchdayId: "matchday-9",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [
      {
        teamId: "T-1",
        shortCode: "T1",
        name: "Test Team",
        budget: 50,
        cash: 50,
        identityId: "I-1",
        humanControlled: false,
        rosterLimit: 30,
        rosterMinTarget: 4,
        rosterOptTarget: 6,
      } satisfies Team,
    ],
    teamIdentities: [
      {
        teamId: "T-1",
        playerType: "balanced",
        pow: 70,
        spe: 60,
        men: 60,
        soc: 50,
        ambition: 75,
        finances: 60,
        boardConfidence: 60,
        harmony: 60,
        manners: 60,
        popularity: 60,
        cooperation: 60,
        playerMin: 4,
        playerOpt: 6,
      } satisfies TeamIdentity,
    ],
    players,
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1 }],
    rosters: players.map((entry, index) => ({
      id: `r-${index}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: "starter",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
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
  } as unknown as GameState;
}

describe("ai training load — fatigue-scaled light training", () => {
  it("puts far more fatigued players on LIGHT training than fresh players", () => {
    const tired = Array.from({ length: 14 }, (_, index) =>
      buildPlayer(`tired-${index}`, { rating: 85, fatigue: 80, disciplineRatings: { tdm: 84 } }),
    );
    const fresh = Array.from({ length: 14 }, (_, index) =>
      buildPlayer(`fresh-${index}`, { rating: 60, fatigue: 25, disciplineRatings: { tdm: 62 } }),
    );

    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState([...tired, ...fresh]),
      teamId: "T-1",
      teamBaselineIntensity: "normal",
    });

    const tiredLeicht = plans.filter((plan) => plan.playerId.startsWith("tired-") && plan.selectedMode === "leicht").length;
    const freshLeicht = plans.filter((plan) => plan.playerId.startsWith("fresh-") && plan.selectedMode === "leicht").length;

    // Fresh players (below the fatigue floor) are never spared by the countermeasure.
    expect(freshLeicht).toBe(0);
    // A clear majority of the fatigued cohort is moved to light training.
    expect(tiredLeicht).toBeGreaterThanOrEqual(7);
    expect(tiredLeicht).toBeGreaterThan(freshLeicht);
  });

  it("attaches a fatigue-schoner reason when it lightens a plan", () => {
    const tired = Array.from({ length: 14 }, (_, index) =>
      buildPlayer(`tired-${index}`, { rating: 85, fatigue: 82, disciplineRatings: { tdm: 84 } }),
    );
    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState(tired),
      teamId: "T-1",
      teamBaselineIntensity: "normal",
    });
    const spared = plans.filter(
      (plan) => plan.selectedMode === "leicht" && plan.reasons.some((reason) => reason.includes("Fatigue-Schoner")),
    );
    expect(spared.length).toBeGreaterThan(0);
    expect(spared.every((plan) => plan.needsLineupRest)).toBe(true);
  });
});

// --- Integration: fatigue-scaled discipline REST via the lineup-consumed rest flag ---
// The legacy lineup engine spares/rests a player in disciplines by reading
// playerNeedsLineupRestFromTrainingLoad (a -28 selection penalty). This proves the
// countermeasure drives that flag: a fatigued star cohort is flagged for rest far more
// often than fresh players, who are never flagged.
describe("ai lineup rest — fatigue-scaled discipline schonen", () => {
  it("flags far more fatigued stars for lineup rest than fresh players", () => {
    const tired = Array.from({ length: 14 }, (_, index) =>
      buildPlayer(`tired-${index}`, { rating: 85, fatigue: 80, disciplineRatings: { tdm: 84 } }),
    );
    const fresh = Array.from({ length: 14 }, (_, index) =>
      buildPlayer(`fresh-${index}`, { rating: 60, fatigue: 25, disciplineRatings: { tdm: 62 } }),
    );
    const gameState = buildGameState([...tired, ...fresh]);

    const tiredRested = tired.filter((player) =>
      playerNeedsLineupRestFromTrainingLoad({ gameState, teamId: "T-1", playerId: player.id }),
    ).length;
    const freshRested = fresh.filter((player) =>
      playerNeedsLineupRestFromTrainingLoad({ gameState, teamId: "T-1", playerId: player.id }),
    ).length;

    // Fresh players (below the fatigue floor) are never rested by the countermeasure.
    expect(freshRested).toBe(0);
    // A clear majority of the fatigued star cohort is rested in disciplines.
    expect(tiredRested).toBeGreaterThanOrEqual(7);
    expect(tiredRested).toBeGreaterThan(freshRested);
  });

  it("is deterministic per (player, matchday) so preview and lineup agree", () => {
    const roster = Array.from({ length: 8 }, (_, index) =>
      buildPlayer(`p-${index}`, { rating: 82, fatigue: 78, disciplineRatings: { tdm: 80 } }),
    );
    const gameState = buildGameState(roster);
    const first = roster.map((player) =>
      playerNeedsLineupRestFromTrainingLoad({ gameState, teamId: "T-1", playerId: player.id }),
    );
    const second = roster.map((player) =>
      playerNeedsLineupRestFromTrainingLoad({ gameState, teamId: "T-1", playerId: player.id }),
    );
    expect(second).toEqual(first);
  });
});
