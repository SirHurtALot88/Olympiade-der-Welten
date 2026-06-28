import { describe, expect, it } from "vitest";

import { buildTeamPlayerTrainingLoadPlans } from "@/lib/ai/ai-player-training-load-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

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
    traitsPositive: overrides.traitsPositive ?? [],
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

function buildGameState(input?: {
  players?: Player[];
  facilities?: GameState["seasonState"]["teamFacilities"];
  performances?: Array<{ playerId: string; appearances: number }>;
}): GameState {
  const players = input?.players ?? [
    buildPlayer("star", { traitsPositive: ["Ambitious", "Diligent"], fatigue: 74 }),
    buildPlayer("bench", { fatigue: 18, potential: 55, rating: 45, disciplineRatings: { tdm: 40 } }),
  ];
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
      disciplineSchedule: [{ matchdayId: "matchday-9", matchdayIndex: 9, seasonId: "season-1", discipline1: null, discipline2: null }],
      standings: {},
      playerDisciplinePerformances: (input?.performances ?? [
        { playerId: "star", appearances: 9 },
        { playerId: "bench", appearances: 1 },
      ]).flatMap((entry) =>
        Array.from({ length: entry.appearances }, (_, index) => ({
          id: `${entry.playerId}-${index}`,
          playerId: entry.playerId,
          teamId: "T-1",
          matchdayResultId: `result-${index}`,
          disciplineId: "tdm",
          scoreContribution: 4,
          finalPlayerScore: 70,
          isTop10: false,
          isMvpCandidate: false,
        })),
      ),
      teamFacilities: input?.facilities ?? {
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
        rosterLimit: 14,
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
      roleTag: index === 0 ? "starter" : "bench",
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

describe("ai player training load service", () => {
  it("avoids hard training for heavy starters even when team baseline is hard", () => {
    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState(),
      teamId: "T-1",
      teamBaselineIntensity: "hard",
    });
    const star = plans.find((plan) => plan.playerId === "star");
    const bench = plans.find((plan) => plan.playerId === "bench");

    expect(star?.selectedMode).not.toBe("hart");
    expect(star?.needsLineupRest).toBe(true);
    expect(bench?.selectedMode).toBe("hart");
  });

  it("downgrades hard demand for likely starters even when recovery center is available", () => {
    const withRecovery = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState({
        facilities: {
          "T-1": {
            facilities: {
              training_center: { level: 1, enabled: true },
              recovery_center: { level: 3, enabled: true },
              scouting_office: { level: 0, enabled: false },
              analytics_room: { level: 0, enabled: false },
              fan_shop: { level: 0, enabled: false },
              arena_upgrade: { level: 0, enabled: false },
              academy: { level: 0, enabled: false },
              specialist_wing: { level: 0, enabled: false },
            },
          },
        },
        players: [
          buildPlayer("star", {
            traitsPositive: ["Ambitious", "Motivated", "Diligent"],
            fatigue: 42,
            disciplineRatings: { tdm: 82 },
          }),
          buildPlayer("bench", { fatigue: 15, potential: 50, rating: 40, disciplineRatings: { tdm: 35 } }),
        ],
        performances: [
          { playerId: "star", appearances: 4 },
          { playerId: "bench", appearances: 0 },
        ],
      }),
      teamId: "T-1",
      teamBaselineIntensity: "hard",
    });
    const star = withRecovery.find((plan) => plan.playerId === "star");

    expect(star?.trainingDemandPreferred).toBe("hart");
    expect(star?.selectedMode).toBe("mittel");
  });

  it("allows hard training for bench players when team baseline is hard", () => {
    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState(),
      teamId: "T-1",
      teamBaselineIntensity: "hard",
    });

    expect(plans.find((plan) => plan.playerId === "bench")?.selectedMode).toBe("hart");
  });

  it("forces light training under critical fatigue regardless of demand", () => {
    const plans = buildTeamPlayerTrainingLoadPlans({
      gameState: buildGameState({
        players: [
          buildPlayer("star", {
            traitsPositive: ["Ambitious", "Motivated"],
            fatigue: 88,
          }),
          buildPlayer("bench", { fatigue: 20 }),
        ],
      }),
      teamId: "T-1",
      teamBaselineIntensity: "hard",
    });

    expect(plans.find((plan) => plan.playerId === "star")?.selectedMode).toBe("leicht");
    expect(plans.find((plan) => plan.playerId === "star")?.needsLineupRest).toBe(true);
  });
});
