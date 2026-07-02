import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import { runSeasonEndProgressionBatch } from "@/lib/progression/season-end-progression-batch";

const baseAttributes: PlayerGeneratorAttributes = {
  power: 10,
  health: 10,
  stamina: 10,
  intelligence: 10,
  awareness: 10,
  determination: 10,
  speed: 10,
  dexterity: 10,
  charisma: 10,
  will: 10,
  spirit: 10,
  torment: 10,
};

function createPlayer(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    rating: 10,
    marketValue: 10,
    salaryDemand: 1,
    className: "Runner",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: ["Diligent", "Motivated", "Disciplined"],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: baseAttributes,
    preferredDisciplineIds: [],
    disciplineRatings: { tdm: 30, fechten: 30, "speed-schach": 30 },
    disciplineTierCounts: { above20: 3, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 100,
    currentXP: 35,
    spentXP: 20,
    lifetimeXP: 55,
    trainingMode: "mittel",
  };
}

function createSave(): PersistedSaveGame {
  const humanPlayer = createPlayer("player-human");
  const aiPlayer = createPlayer("player-ai");
  const players = [humanPlayer, aiPlayer];
  const gameState: GameState = {
    gamePhase: "season_completed",
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [
        {
          id: "result-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          status: "preview_applied",
        },
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-human",
          matchdayResultId: "result-1",
          teamId: "team-human",
          playerId: humanPlayer.id,
          activePlayerId: null,
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 80,
          finalPlayerScore: 95,
          scoreContribution: 25,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: null,
          createdAt: "2026-06-11T00:00:00.000Z",
        },
        {
          id: "perf-ai",
          matchdayResultId: "result-1",
          teamId: "team-ai",
          playerId: aiPlayer.id,
          activePlayerId: null,
          disciplineId: "tdm",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 80,
          finalPlayerScore: 90,
          scoreContribution: 22,
          rankInTeam: 1,
          rankInDiscipline: 2,
          isTop10: true,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-11T00:00:00.000Z",
        },
      ],
      disciplineHighlights: [],
      teamControlSettings: {
        "team-ai": { controlMode: "ai" },
        "team-human": { controlMode: "manual" },
      },
    },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-human", name: "Human Team", shortCode: "H-U", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0, humanControlled: true },
      { teamId: "team-ai", name: "AI Team", shortCode: "A-I", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0, humanControlled: false },
    ],
    teamIdentities: [],
    players,
    disciplines: [{ id: "tdm", name: "TDM", category: "power", weight: 1 }],
    rosters: [
      { id: "r-human", teamId: "team-human", playerId: humanPlayer.id, salary: 1, marketValue: 10, contractLength: 1, roleTag: "core" },
      { id: "r-ai", teamId: "team-ai", playerId: aiPlayer.id, salary: 1, marketValue: 10, contractLength: 1, roleTag: "depth" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerBaselines: createPlayerBaselinesForPlayers(players, { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 2,
      matchedRosterCount: 2,
      warnings: [],
    },
  };

  return {
    saveId: "save-batch-test",
    name: "Batch Test Save",
    status: "active",
    gameState,
  };
}

function createPersistence() {
  let savedState: GameState | null = null;
  const persistence: PersistenceService = {
    bootstrapSingleplayerSave: () => {
      throw new Error("not used");
    },
    getActiveSave: () => null,
    getSaveById: () => null,
    saveSingleplayerState: (saveId, gameState) => {
      savedState = gameState;
      return { saveId, name: "Batch Test Save", status: "active", gameState };
    },
    createSave: () => {
      throw new Error("not used");
    },
    createFreshSeasonOneSave: () => {
      throw new Error("not used");
    },
    cloneSave: () => {
      throw new Error("not used");
    },
    activateSave: () => null,
    listSaves: () => [],
  };
  return { persistence, getSavedState: () => savedState };
}

describe("runSeasonEndProgressionBatch", () => {
  it("produces only organic_season_progression upgrades for human and AI teams", () => {
    const save = createSave();
    const { persistence, getSavedState } = createPersistence();

    const result = runSeasonEndProgressionBatch({ save, persistence, persistFinalState: true });

    expect(result.teamsProcessed).toBe(2);
    expect(result.teamsApplied).toBe(2);
    expect(result.aiPlannedTeams).toBe(0);
    expect(result.humanOrganicTeams).toBe(1);
    expect(result.aiOrganicFallbackTeams).toBe(1);
    expect(result.playerEventsCreated).toBeGreaterThan(0);

    const events = getSavedState()?.playerProgressionEvents ?? [];
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.source === "organic_season_progression")).toBe(true);

    const upgrades = events.flatMap((event) => event.upgrades);
    expect(upgrades.length).toBeGreaterThan(0);
    expect(upgrades.every((upgrade) => upgrade.source === "organic_season_progression")).toBe(true);
    expect(upgrades.some((upgrade) => upgrade.source === "manual_xp_spend_preview")).toBe(false);
  });
});
