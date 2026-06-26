import { describe, expect, it } from "vitest";

import type { GameState, Player, PersistedSaveGame } from "@/lib/data/olyDataTypes";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import { getMatchdayArenaReadiness } from "@/lib/foundation/matchday-arena-readiness";
import { applySeasonEndXpSpend, previewSeasonEndXpSpend } from "@/lib/progression/season-end-xp-apply-service";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Player One",
    rating: 61.5,
    marketValue: 85000,
    salaryDemand: 8000,
    displayMarketValue: 72.57,
    displaySalary: 16.54,
    pps: 54.4,
    ovr: 66,
    currentXP: partial?.currentXP ?? 35,
    spentXP: partial?.spentXP ?? 20,
    lifetimeXP: partial?.lifetimeXP ?? 55,
    trainingMode: partial?.trainingMode ?? "normal",
    cost: 85,
    upkeepBase: 8,
    className: partial?.className ?? "Berserker",
    race: "Human",
    alignment: "N",
    gender: "m",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: partial?.traitsPositive ?? ["Diligent"],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial?.attributeSheetStats ?? {
      power: 58,
      health: 55,
      stamina: 54,
      speed: 52,
      dexterity: 50,
      awareness: 48,
      intelligence: 47,
      will: 49,
      charisma: 46,
      spirit: 45,
      determination: 53,
      torment: 44,
    },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 60, d2: 66 },
    disciplineTierCounts: { above20: 2, above40: 2, above60: 1, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: partial?.potential ?? 72,
    portraitPath: null,
    portraitUrl: null,
  };
}

function createSave(player: Player): PersistedSaveGame {
  const gameState = {
    gamePhase: "season_end",
    season: { id: "season-1", name: "Season 1", currentMatchday: 1, matchdayIds: ["season-1-md-1"] },
    matchdayState: { matchdayId: "season-1-md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team One", shortCode: "T1", cash: 1000, humanControlled: true }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "d1", name: "Discipline 1", category: "power", slotCount: 2 },
      { id: "d2", name: "Discipline 2", category: "speed", slotCount: 2 },
    ],
    rosters: [{ id: "r-1", teamId: "team-1", playerId: player.id, contractLength: 2, salary: 8000, upkeep: 800, roleTag: "starter", joinedSeasonId: "season-1" }],
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
      teamCount: 0,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "season-1-md-1",
          discipline1: { disciplineId: "d1", playerCount: 2 },
          discipline2: { disciplineId: "d2", playerCount: 2 },
        },
      ],
      playerDisciplinePerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: player.id,
          activePlayerId: null,
          disciplineId: "d1",
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
      ],
    },
    playerBaselines: [
      {
        playerId: player.id,
        seasonId: "season-1",
        attributes: player.attributeSheetStats ?? {},
        capturedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  } as unknown as GameState;

  return {
    saveId: "save-1",
    gameState,
    updatedAt: "2026-06-11T00:00:00.000Z",
  };
}

describe("gameplay stability pass", () => {
  it("treats skipped form card selections as arena-ready when the pool exists", () => {
    const gameState = {
      season: { id: "season-1", matchdayIds: ["season-1-md-1"], currentMatchday: 1 },
      matchdayState: { matchdayId: "season-1-md-1", status: "open", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [{ teamId: "H-R", name: "H-R", shortCode: "HR", cash: 1000, humanControlled: true }],
      rosters: [
        { teamId: "H-R", playerId: "p-1", activePlayerId: "r-1" },
        { teamId: "H-R", playerId: "p-2", activePlayerId: "r-2" },
        { teamId: "H-R", playerId: "p-3", activePlayerId: "r-3" },
      ],
      players: [
        { playerId: "p-1", name: "Player 1", teamId: "H-R" },
        { playerId: "p-2", name: "Player 2", teamId: "H-R" },
        { playerId: "p-3", name: "Player 3", teamId: "H-R" },
      ],
      gamePhase: "season_active",
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        standings: {},
        disciplineSchedule: [
          {
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            discipline1: { disciplineId: "d1", playerCount: 2 },
            discipline2: { disciplineId: "d2", playerCount: 2 },
          },
        ],
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-1",
            teamId: "H-R",
            playerId: "p-1",
            playerName: "Player 1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        lineupDrafts: [
          {
            lineupId: "lineup-1",
            saveId: "save-1",
            seasonId: "season-1",
            matchdayId: "season-1-md-1",
            teamId: "H-R",
            status: "submitted",
            entries: [
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 0, playerId: "p-1", activePlayerId: "r-1" },
              { disciplineId: "d1", disciplineSide: "d1", slotIndex: 1, playerId: "p-2", activePlayerId: "r-2" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 0, playerId: "p-3", activePlayerId: "r-3" },
              { disciplineId: "d2", disciplineSide: "d2", slotIndex: 1, playerId: "p-1", activePlayerId: "r-1" },
            ],
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    } as GameState;

    expect(getFormCardFlowStatus(gameState, "H-R")).toMatchObject({
      hasPool: true,
      hasSelections: false,
      skipped: true,
      isReady: true,
      blocker: null,
    });
    expect(getMatchdayArenaReadiness(gameState, "H-R").isReady).toBe(true);
  });

  it("applies organic season progression end-to-end when collecting season XP", () => {
    const save = createSave(createPlayer());
    const preview = previewSeasonEndXpSpend(save, "team-1", []);
    const persistence = {
      saveGame: async (nextSave: PersistedSaveGame) => nextSave,
    };

    const result = applySeasonEndXpSpend(save, "team-1", [], preview.confirmToken, persistence);

    expect(preview.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(preview.players[0]?.organicProgression?.netSetpoints).toBeTypeOf("number");
    expect(preview.players[0]?.plannedUpgrades.some((upgrade) => upgrade.source === "organic_season_progression")).toBe(true);
  });
});
