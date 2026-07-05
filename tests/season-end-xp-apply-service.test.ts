import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import {
  applySeasonEndXpSpend,
  previewSeasonEndXpSpend,
} from "@/lib/progression/season-end-xp-apply-service";
import { buildSeasonTransitionPreview } from "@/lib/season/season-transition-service";

const baseAttributes: PlayerGeneratorAttributes = {
  power: 30,
  health: 30,
  stamina: 30,
  intelligence: 30,
  awareness: 30,
  determination: 30,
  speed: 30,
  dexterity: 30,
  charisma: 30,
  will: 30,
  spirit: 30,
  torment: 30,
};

function createPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "player-1",
    name: partial.name ?? "Player One",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 10,
    salaryDemand: partial.salaryDemand ?? 1,
    className: partial.className ?? "Runner",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial.attributeSheetStats ?? baseAttributes,
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { tdm: 30, fechten: 30, "speed-schach": 30 },
    previousDisciplineRatings: partial.previousDisciplineRatings,
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 3, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 0,
    currentXP: partial.currentXP ?? 0,
    spentXP: partial.spentXP ?? 0,
    lifetimeXP: partial.lifetimeXP ?? 120,
    trainingMode: partial.trainingMode ?? "mittel",
  };
}

function createGameState(player: Player): GameState {
  return {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, matchdayResults: [], playerDisciplinePerformances: [], disciplineHighlights: [] },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-1", name: "Team One", shortCode: "T-O", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0, humanControlled: true }],
    teamIdentities: [],
    players: [player],
    disciplines: [
      { id: "tdm", name: "TDM", category: "power", weight: 1 },
      { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      { id: "speed-schach", name: "Schach", category: "mental", weight: 1 },
    ],
    rosters: [{ id: "active-1", teamId: "team-1", playerId: player.id, salary: 1, marketValue: 10, contractLength: 1, roleTag: "core" }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerBaselines: createPlayerBaselinesForPlayers([player], { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 1,
      matchedRosterCount: 1,
      warnings: [],
    },
  } satisfies GameState;
}

function createSave(player: Player): PersistedSaveGame {
  return {
    saveId: "save-test",
    name: "Test Save",
    status: "active",
    gameState: createGameState(player),
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
      return { saveId, name: "Test Save", status: "active", gameState };
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

describe("season-end XP spend apply service", () => {
  it("blocks apply without confirm token for organic-only spend", () => {
    const save = createSave(createPlayer({ currentXP: 100 }));
    save.gameState.seasonState.matchdayResults = [
      { id: "result-1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" },
    ];
    save.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: "player-1",
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
    ];

    const result = applySeasonEndXpSpend(save, "team-1", null, createPersistence().persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("confirm_token_missing");
  });

  it("blocks stale organic previews when attributes drift", () => {
    const save = createSave(createPlayer({ currentXP: 100 }));
    save.gameState.seasonState.matchdayResults = [
      { id: "result-1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" },
    ];
    save.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: "player-1",
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
    ];
    const preview = previewSeasonEndXpSpend(save, "team-1");
    const drifted = {
      ...save,
      gameState: {
        ...save.gameState,
        players: [createPlayer({ attributeSheetStats: { ...baseAttributes, power: 31 }, currentXP: 100 })],
      },
    } satisfies PersistedSaveGame;

    const result = applySeasonEndXpSpend(drifted, "team-1", preview.confirmToken, createPersistence().persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("xp_spend_preview_stale");
  });

  it("can materialize earned season XP without spending it", () => {
    const lowAttributes = Object.fromEntries(Object.keys(baseAttributes).map((key) => [key, 10])) as PlayerGeneratorAttributes;
    const save = createSave(
      createPlayer({
        attributeSheetStats: lowAttributes,
        rating: 10,
        potential: 100,
        traitsPositive: ["Diligent", "Motivated", "Disciplined"],
        currentXP: 35,
        spentXP: 20,
        lifetimeXP: 55,
      }),
    );
    save.gameState.seasonState.matchdayResults = [
      {
        id: "result-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
        status: "preview_applied",
      },
    ];
    save.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: "player-1",
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
    ];

    const preview = previewSeasonEndXpSpend(save, "team-1");
    const { persistence, getSavedState } = createPersistence();

    const result = applySeasonEndXpSpend(save, "team-1", preview.confirmToken, persistence);
    const savedPlayer = getSavedState()?.players[0];

    expect(preview.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(savedPlayer?.currentXP).toBe(35);
    expect(savedPlayer?.spentXP).toBe(20);
    expect(savedPlayer?.lifetimeXP).toBe(55);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.xpSpent).toBe(0);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.xpEarned).toBe(0);
    const organicUpgrades = getSavedState()?.playerProgressionEvents?.[0]?.upgrades ?? [];
    expect(organicUpgrades.length).toBeGreaterThan(0);
    expect(organicUpgrades.every((entry) => entry.source === "organic_season_progression")).toBe(true);
    expect(savedPlayer?.lastOrganicProgression?.performanceSetpoints).toBeGreaterThan(0);

    const transitionPreview = buildSeasonTransitionPreview({
      ...save,
      gameState: getSavedState() ?? save.gameState,
    });
    expect(transitionPreview.canCompleteSeason).toBe(true);
    expect(transitionPreview.steps.some((step) => step.stepId === "player_development")).toBe(true);
  });

  it("uses attribute-derived discipline baselines instead of stale stored ratings in progression snapshots", () => {
    const highAttributes = {
      ...baseAttributes,
      power: 55,
      speed: 58,
      dexterity: 60,
      spirit: 52,
      intelligence: 54,
    } satisfies PlayerGeneratorAttributes;
    const save = createSave(
      createPlayer({
        attributeSheetStats: highAttributes,
        rating: 55,
        disciplineRatings: { tdm: 18, fechten: 20, "speed-schach": 19 },
        currentXP: 10,
      }),
    );
    save.gameState.seasonState.matchdayResults = [
      { id: "result-1", seasonId: "season-1", matchdayId: "matchday-1", status: "preview_applied" },
    ];
    save.gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-1",
        matchdayResultId: "result-1",
        teamId: "team-1",
        playerId: "player-1",
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
    ];

    const preview = previewSeasonEndXpSpend(save, "team-1");
    const playerPreview = preview.players[0];
    expect(preview.ok).toBe(true);
    expect(playerPreview?.progressionSnapshotBefore.disciplineRatings.tdm).toBeGreaterThan(40);
    const tennisBefore = playerPreview?.progressionSnapshotBefore.disciplineRatings.tdm ?? 0;
    const tennisAfter = playerPreview?.progressionSnapshotAfter.disciplineRatings.tdm ?? 0;
    expect(Math.abs(tennisAfter - tennisBefore)).toBeLessThan(5);
    const mwBefore = playerPreview?.progressionSnapshotBefore.marketValue ?? 0;
    const mwAfter = playerPreview?.progressionSnapshotAfter.marketValue ?? 0;
    expect(Math.abs(mwAfter - mwBefore)).toBeLessThan(3);
  });

  it("does not materialize the same season XP twice", () => {
    const save = createSave(createPlayer({ currentXP: 100, spentXP: 20, lifetimeXP: 120 }));
    save.gameState.playerProgressionEvents = [
      {
        eventId: "already",
        seasonId: "season-1",
        teamId: "team-1",
        playerId: "player-1",
        upgrades: [],
        xpEarned: 70,
        xpSpent: 0,
        timestamp: "2026-06-11T00:00:00.000Z",
        source: "manual_season_end_xp_spend",
      },
    ];

    const preview = previewSeasonEndXpSpend(save, "team-1");

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("season_xp_no_unmaterialized_xp");
  });

  it("blocks XP writes when the player baseline is missing", () => {
    const save = createSave(createPlayer({ currentXP: 100 }));
    save.gameState.playerBaselines = [];
    const preview = previewSeasonEndXpSpend(save, "team-1");

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("player_baseline_missing:player-1");
  });
});
