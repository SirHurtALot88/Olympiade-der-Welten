import { describe, expect, it, vi } from "vitest";

import { reevaluateAiTrainingModesForMatchday } from "@/lib/ai/ai-training-mode-reevaluation-service";
import type {
  GameState,
  Player,
  Team,
  TeamControlSettings,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function buildPlayer(id: string, teamHint: string, overrides: Partial<Player> = {}): Player {
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
    trainingMode: "mittel",
    ...overrides,
    // teamHint keeps the id namespaced per team without leaking into Player.
  } as Player;
}

function controlSettings(teamId: string, controlMode: "ai" | "manual"): TeamControlSettings {
  return {
    teamId,
    controlMode,
    ownerId: controlMode === "ai" ? "ai" : "user_local",
    ownerSlot: controlMode === "ai" ? "ai" : "user",
    displayLabel: teamId,
    aiLineupPreviewEnabled: controlMode === "ai",
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: controlMode === "ai",
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: controlMode === "ai",
    aiSellAutoApplyEnabled: false,
    notes: null,
    strategyLock: null,
  };
}

function buildTeam(teamId: string, humanControlled: boolean): Team {
  return {
    teamId,
    shortCode: teamId,
    name: teamId,
    budget: 50,
    cash: 50,
    identityId: `${teamId}-I`,
    humanControlled,
    rosterLimit: 30,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
  } as Team;
}

function buildIdentity(teamId: string): TeamIdentity {
  return {
    teamId,
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
  } as TeamIdentity;
}

function facilitiesFor(teamIds: string[]) {
  return Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      {
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
    ]),
  );
}

/** AI team (T-AI) with `aiCount` fatigued players; manual team (T-HUM) with `humCount`. */
function buildSave(input: { aiCount: number; humCount: number; fatigue: number }): PersistedSaveGame {
  const aiPlayers = Array.from({ length: input.aiCount }, (_, index) =>
    buildPlayer(`ai-${index}`, "T-AI", { rating: 84, fatigue: input.fatigue, disciplineRatings: { tdm: 84 } }),
  );
  const humPlayers = Array.from({ length: input.humCount }, (_, index) =>
    buildPlayer(`hum-${index}`, "T-HUM", { rating: 84, fatigue: input.fatigue, disciplineRatings: { tdm: 84 } }),
  );
  const players = [...aiPlayers, ...humPlayers];
  const teamOf = (playerId: string) => (playerId.startsWith("ai-") ? "T-AI" : "T-HUM");

  const gameState = {
    gamePhase: "season_active",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 5,
      matchdayIds: Array.from({ length: 10 }, (_, index) => `matchday-${index + 1}`),
      totalMatchdays: 10,
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [
        { matchdayId: "matchday-5", matchdayIndex: 5, seasonId: "season-1", discipline1: null, discipline2: null },
      ],
      standings: {},
      teamControlSettings: {
        "T-AI": controlSettings("T-AI", "ai"),
        "T-HUM": controlSettings("T-HUM", "manual"),
      },
      aiManagerTrainingSettings: {
        "T-AI": { teamId: "T-AI", seasonId: "season-1", trainingIntensity: "normal" },
        "T-HUM": { teamId: "T-HUM", seasonId: "season-1", trainingIntensity: "normal" },
      },
      playerDisciplinePerformances: players.flatMap((player) =>
        Array.from({ length: 4 }, (_, index) => ({
          id: `${player.id}-${index}`,
          playerId: player.id,
          teamId: teamOf(player.id),
          matchdayResultId: `result-${index}`,
          disciplineId: "tdm",
          scoreContribution: 4,
          finalPlayerScore: 70,
          isTop10: false,
          isMvpCandidate: false,
        })),
      ),
      teamFacilities: facilitiesFor(["T-AI", "T-HUM"]),
    },
    matchdayState: {
      matchdayId: "matchday-5",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [buildTeam("T-AI", false), buildTeam("T-HUM", true)],
    teamIdentities: [buildIdentity("T-AI"), buildIdentity("T-HUM")],
    players,
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1 }],
    rosters: players.map((player, index) => ({
      id: `r-${index}`,
      teamId: teamOf(player.id),
      playerId: player.id,
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
      teamCount: 2,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;

  return {
    saveId: "save-1",
    status: "active",
    updatedAt: new Date().toISOString(),
    gameState,
  } as unknown as PersistedSaveGame;
}

function persistenceMock(initial: PersistedSaveGame) {
  let current = initial;
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => {
    current = { ...current, saveId, gameState: nextGameState };
    return current;
  });
  return {
    persistence: {
      saveSingleplayerState,
      getSaveById: vi.fn(() => current),
      getActiveSave: vi.fn(() => current),
      bootstrapSingleplayerSave: vi.fn(() => ({ save: current, createdFromSeed: false })),
    } as unknown as PersistenceService,
    get current() {
      return current;
    },
    saveSingleplayerState,
  };
}

describe("reevaluateAiTrainingModesForMatchday", () => {
  it("switches fatigued AI players to leicht and NEVER touches a human-controlled team", () => {
    const mock = persistenceMock(buildSave({ aiCount: 12, humCount: 4, fatigue: 82 }));

    const result = reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });

    const players = mock.current.gameState.players;
    const aiLeicht = players.filter((player) => player.id.startsWith("ai-") && player.trainingMode === "leicht");
    const humModes = players.filter((player) => player.id.startsWith("hum-"));

    // The re-evaluation fired: a fatigued (>= floor) AI cohort was moved to LIGHT training.
    expect(result.teamsUpdated).toBe(1);
    expect(result.playersReassigned).toBeGreaterThan(0);
    expect(aiLeicht.length).toBeGreaterThan(0);

    // The human-controlled team was skipped entirely and its modes are untouched.
    expect(result.skippedManual).toBe(1);
    expect(humModes.every((player) => player.trainingMode === "mittel")).toBe(true);
  });

  it("lightens far more AI players when the cohort is fatigued than when fresh (fatigue-driven)", () => {
    const countLeicht = (fatigue: number) => {
      const mock = persistenceMock(buildSave({ aiCount: 12, humCount: 4, fatigue }));
      reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });
      const players = mock.current.gameState.players;
      return {
        aiLeicht: players.filter((player) => player.id.startsWith("ai-") && player.trainingMode === "leicht").length,
        humUntouched: players
          .filter((player) => player.id.startsWith("hum-"))
          .every((player) => player.trainingMode === "mittel"),
      };
    };

    const fresh = countLeicht(20);
    const tired = countLeicht(82);

    // The re-evaluation reacts to fatigue: a tired cohort ends up on leicht far more than a fresh one.
    expect(tired.aiLeicht).toBeGreaterThan(fresh.aiLeicht);
    // The human-controlled team is never touched, regardless of fatigue.
    expect(fresh.humUntouched).toBe(true);
    expect(tired.humUntouched).toBe(true);
  });

  it("is deterministic: same state re-evaluated twice yields identical modes", () => {
    const run = () => {
      const mock = persistenceMock(buildSave({ aiCount: 12, humCount: 4, fatigue: 82 }));
      reevaluateAiTrainingModesForMatchday({ saveId: "save-1", persistence: mock.persistence });
      return mock.current.gameState.players
        .filter((player) => player.id.startsWith("ai-"))
        .map((player) => `${player.id}:${player.trainingMode}`);
    };
    expect(run()).toEqual(run());
  });
});
