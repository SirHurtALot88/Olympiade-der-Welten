import { describe, expect, it } from "vitest";

import type { GamePhase, GameState, MatchdayResultRecord, Player, Team } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import {
  applyPlayerTrainingModes,
  applyTeamTrainingSettings,
  previewPlayerTrainingModes,
  previewTeamTrainingSettings,
  TRAINING_INTENSITY_LOCKED_BLOCKING_REASON,
} from "@/lib/training/training-settings-service";

function team(): Team {
  return {
    teamId: "T-1",
    shortCode: "T1",
    name: "Test Team",
    budget: 120,
    cash: 80,
    identityId: "I-1",
    humanControlled: true,
    rosterLimit: 14,
  };
}

function player(id: string): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 20,
    form: 50,
    potential: 50,
    trainingMode: "mittel",
  };
}

function matchdayResult(overrides: Partial<MatchdayResultRecord> = {}): MatchdayResultRecord {
  return {
    id: "result-1",
    saveId: "save-test",
    seasonId: "season-1",
    matchdayId: "season-1-md-1",
    status: "preview_applied",
    sourceVersion: "test",
    teamsTotal: 1,
    teamsReady: 1,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

function gameState(input?: {
  gamePhase?: GamePhase;
  seasonId?: string;
  matchdayResults?: MatchdayResultRecord[];
  matchdayStatus?: "planning" | "resolved";
}): GameState {
  const seasonId = input?.seasonId ?? "season-1";
  const players = [player("p-1"), player("p-2")];
  return {
    gamePhase: input?.gamePhase ?? "preseason_management",
    season: { id: seasonId, name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: [`${seasonId}-md-1`, `${seasonId}-md-2`] },
    seasonState: {
      seasonId,
      schedule: [],
      standings: {},
      matchdayResults: input?.matchdayResults ?? [],
    },
    matchdayState: {
      matchdayId: `${seasonId}-md-1`,
      status: input?.matchdayStatus ?? "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team()],
    teamIdentities: [],
    players,
    disciplines: [],
    rosters: players.map((entry, index) => ({
      id: `r-${index + 1}`,
      teamId: "T-1",
      playerId: entry.id,
      contractLength: 1,
      salary: 4,
      upkeep: 4,
      roleTag: "starter",
      joinedSeasonId: seasonId,
    })),
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

function save(state = gameState()): PersistedSaveGame {
  return {
    saveId: "save-test",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    gameState: state,
  };
}

function inMemoryPersistence(initial: PersistedSaveGame) {
  let current = initial;
  const persistence = {
    saveSingleplayerState: (_saveId: string, nextGameState: GameState) => {
      current = { ...current, gameState: nextGameState };
      return current;
    },
    getSaveById: () => current,
  } as unknown as import("@/lib/persistence/types").PersistenceService;
  return Object.defineProperty(persistence, "current", { get: () => current, enumerable: true }) as typeof persistence & {
    current: PersistedSaveGame;
  };
}

describe("training-settings-service: season-long training intensity lock", () => {
  it("allows the first team-level training intensity apply during preseason", () => {
    const source = save();
    const preview = previewTeamTrainingSettings({ save: source, teamId: "T-1", trainingFocus: "BALANCED", trainingIntensity: "light" });
    expect(preview.ok).toBe(true);
    expect(preview.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);

    const persistence = inMemoryPersistence(source);
    const result = applyTeamTrainingSettings(source, "T-1", "BALANCED", "light", preview.confirmToken, "manual_training_settings", persistence);
    expect(result.applied).toBe(true);
    expect(persistence.current.gameState.seasonState.trainingIntensityConfirmations?.["T-1"]?.seasonId).toBe("season-1");
  });

  it("allows re-applying multiple times during preseason (AI resumable planning)", () => {
    const source = save();
    const persistence = inMemoryPersistence(source);

    const firstPreview = previewTeamTrainingSettings({ save: persistence.current, teamId: "T-1", trainingFocus: "BALANCED", trainingIntensity: "light" });
    const firstResult = applyTeamTrainingSettings(persistence.current, "T-1", "BALANCED", "light", firstPreview.confirmToken, "manual_training_settings", persistence);
    expect(firstResult.applied).toBe(true);

    const secondPreview = previewTeamTrainingSettings({ save: persistence.current, teamId: "T-1", trainingFocus: "POW", trainingIntensity: "hard" });
    expect(secondPreview.ok).toBe(true);
    const secondResult = applyTeamTrainingSettings(persistence.current, "T-1", "POW", "hard", secondPreview.confirmToken, "manual_training_settings", persistence);
    expect(secondResult.applied).toBe(true);
    expect(persistence.current.gameState.players[0]?.trainingMode).toBe("hart");
  });

  it("no longer blocks team-level training intensity changes mid-season (anti-cheese Teil B)", () => {
    const source = save(
      gameState({
        gamePhase: "season_active",
        matchdayStatus: "resolved",
        matchdayResults: [matchdayResult()],
      }),
    );
    const preview = previewTeamTrainingSettings({ save: source, teamId: "T-1", trainingFocus: "BALANCED", trainingIntensity: "hard" });
    expect(preview.ok).toBe(true);
    expect(preview.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);

    const persistence = inMemoryPersistence(source);
    const result = applyTeamTrainingSettings(persistence.current, "T-1", "BALANCED", "hard", preview.confirmToken, "manual_training_settings", persistence);
    expect(result.applied).toBe(true);
    expect(result.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);
  });

  it("no longer blocks per-player training mode changes mid-season (anti-cheese Teil B)", () => {
    const source = save(
      gameState({
        gamePhase: "season_active",
        matchdayStatus: "resolved",
        matchdayResults: [matchdayResult()],
      }),
    );
    const assignments = [{ playerId: "p-1", trainingMode: "hart" as const }];
    const preview = previewPlayerTrainingModes({ save: source, teamId: "T-1", assignments });
    expect(preview.ok).toBe(true);
    expect(preview.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);

    const persistence = inMemoryPersistence(source);
    const result = applyPlayerTrainingModes(persistence.current, "T-1", assignments, preview.confirmToken, persistence);
    expect(result.applied).toBe(true);
    expect(result.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);
    expect(persistence.current.gameState.players.find((entry) => entry.id === "p-1")?.trainingMode).toBe("hart");
  });

  it("allows setting training in a brand-new season (unchanged)", () => {
    const seasonOne = save(
      gameState({
        gamePhase: "season_active",
        matchdayStatus: "resolved",
        matchdayResults: [matchdayResult()],
      }),
    );
    // Mid-season is no longer blocked (anti-cheese Teil B).
    expect(previewTeamTrainingSettings({ save: seasonOne, teamId: "T-1", trainingFocus: "BALANCED", trainingIntensity: "hard" }).ok).toBe(true);

    const seasonTwo = save(gameState({ seasonId: "season-2", gamePhase: "preseason_management" }));
    const preview = previewTeamTrainingSettings({ save: seasonTwo, teamId: "T-1", trainingFocus: "BALANCED", trainingIntensity: "hard" });
    expect(preview.ok).toBe(true);
    expect(preview.blockingReasons).not.toContain(TRAINING_INTENSITY_LOCKED_BLOCKING_REASON);
  });

  it("does not block AI teams from their single regular preseason confirmation", () => {
    const source = save(gameState({ gamePhase: "preseason_management" }));
    const preview = previewPlayerTrainingModes({
      save: source,
      teamId: "T-1",
      assignments: [
        { playerId: "p-1", trainingMode: "leicht" },
        { playerId: "p-2", trainingMode: "hart" },
      ],
    });
    expect(preview.ok).toBe(true);
    const persistence = inMemoryPersistence(source);
    const result = applyPlayerTrainingModes(source, "T-1", preview.assignments, preview.confirmToken, persistence, "ai_training_plan");
    expect(result.applied).toBe(true);
    expect(persistence.current.gameState.seasonState.trainingIntensityConfirmations?.["T-1"]?.sourcePlanId).toBe("ai_training_plan");
  });
});
