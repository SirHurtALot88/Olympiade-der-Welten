import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import {
  applySeasonEndXpSpend,
  previewSeasonEndXpSpend,
  type SeasonEndXpSpendPlannedUpgradeInput,
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

function upgrade(attribute = "power" as const): SeasonEndXpSpendPlannedUpgradeInput {
  return { playerId: "player-1", attribute, source: "manual_xp_spend_preview" };
}

describe("season-end XP spend apply service", () => {
  it("previews a valid XP upgrade without writing", () => {
    const preview = previewSeasonEndXpSpend(createSave(createPlayer({ currentXP: 100 })), "team-1", [upgrade()]);

    expect(preview.ok).toBe(true);
    expect(preview.confirmToken).toBeTruthy();
    expect(preview.players[0]?.plannedUpgrades[0]).toMatchObject({ fromValue: 30, toValue: 31, cost: 70 });
    expect(preview.players[0]?.remainingXP).toBeGreaterThanOrEqual(0);
  });

  it("blocks when XP is insufficient", () => {
    const player = createPlayer({ attributeSheetStats: { ...baseAttributes, power: 80 }, currentXP: 0 });
    const preview = previewSeasonEndXpSpend(createSave(player), "team-1", [upgrade()]);

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("xp_insufficient:player-1");
  });

  it("blocks attributes at 99", () => {
    const player = createPlayer({ attributeSheetStats: { ...baseAttributes, power: 99 }, currentXP: 999 });
    const preview = previewSeasonEndXpSpend(createSave(player), "team-1", [upgrade()]);

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("attribute_at_99:player-1:power");
  });

  it("recalculates costs for multiple upgrades of the same attribute", () => {
    const player = createPlayer({ attributeSheetStats: { ...baseAttributes, power: 29 }, currentXP: 500 });
    const preview = previewSeasonEndXpSpend(createSave(player), "team-1", [upgrade(), upgrade()]);

    expect(preview.players[0]?.plannedUpgrades.map((entry) => entry.cost)).toEqual([55, 70]);
    expect(preview.players[0]?.plannedXP).toBe(125);
  });

  it("removing an upgrade returns planned XP in the next preview", () => {
    const player = createPlayer({ attributeSheetStats: { ...baseAttributes, power: 29 }, currentXP: 500 });
    const two = previewSeasonEndXpSpend(createSave(player), "team-1", [upgrade(), upgrade()]);
    const one = previewSeasonEndXpSpend(createSave(player), "team-1", [upgrade()]);

    expect(two.players[0]?.remainingXP).toBe((one.players[0]?.remainingXP ?? 0) - 70);
  });

  it("blocks apply without confirm token", () => {
    const result = applySeasonEndXpSpend(createSave(createPlayer({ currentXP: 100 })), "team-1", [upgrade()], null, createPersistence().persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("confirm_token_missing");
  });

  it("blocks stale previews when attributes drift", () => {
    const save = createSave(createPlayer({ currentXP: 100 }));
    const preview = previewSeasonEndXpSpend(save, "team-1", [upgrade()]);
    const drifted = {
      ...save,
      gameState: {
        ...save.gameState,
        players: [createPlayer({ attributeSheetStats: { ...baseAttributes, power: 31 }, currentXP: 100 })],
      },
    } satisfies PersistedSaveGame;

    const result = applySeasonEndXpSpend(drifted, "team-1", [upgrade()], preview.confirmToken, createPersistence().persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("xp_spend_preview_stale");
  });

  it("applies local attributes, XP, discipline deltas and progression event", () => {
    const save = createSave(createPlayer({ attributeSheetStats: { ...baseAttributes, power: 98 }, currentXP: 500 }));
    const baselineChecksumBefore = save.gameState.playerBaselines?.[0]?.checksum;
    const preview = previewSeasonEndXpSpend(save, "team-1", [upgrade()]);
    const { persistence, getSavedState } = createPersistence();

    const result = applySeasonEndXpSpend(save, "team-1", [upgrade()], preview.confirmToken, persistence);
    const savedPlayer = getSavedState()?.players[0];

    expect(result.applied).toBe(true);
    expect(savedPlayer?.attributeSheetStats?.power).toBe(99);
    expect(savedPlayer?.spentXP).toBe(360);
    expect(savedPlayer?.currentXP).toBe((preview.players[0]?.remainingXP ?? 0));
    expect(savedPlayer?.lifetimeXP).toBe(120 + (preview.players[0]?.earnedSeasonXP ?? 0));
    expect(getSavedState()?.playerProgressionEvents?.[0]?.source).toBe("manual_season_end_xp_spend");
    expect(getSavedState()?.playerProgressionEvents?.[0]?.xpEarned).toBe(preview.players[0]?.earnedSeasonXP);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.currentXPAfter).toBe(savedPlayer?.currentXP);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.lifetimeXPAfter).toBe(savedPlayer?.lifetimeXP);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.progressionSnapshotBefore?.marketValue).toBe(10);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.progressionSnapshotAfter?.marketValuePreview).not.toBeUndefined();
    expect(Object.values(savedPlayer?.disciplineDelta ?? {}).some((value) => value > 0)).toBe(true);
    expect(savedPlayer?.economyAfterUpgradePreview?.source).toBe("season_end_xp_spend_preview");
    expect(savedPlayer?.economyAfterUpgradePreview?.currentContractSalary).toBe(1);
    expect(savedPlayer?.economyAfterUpgradePreview?.renewalSalaryPreview).not.toBeUndefined();
    expect(savedPlayer?.marketValue).toBe(savedPlayer?.economyAfterUpgradePreview?.marketValuePreview);
    expect(savedPlayer?.displayMarketValue).toBe(savedPlayer?.economyAfterUpgradePreview?.marketValuePreview);
    expect(savedPlayer?.salaryDemand).toBe(savedPlayer?.economyAfterUpgradePreview?.salaryExpectation);
    expect(savedPlayer?.displaySalary).toBe(savedPlayer?.economyAfterUpgradePreview?.salaryExpectation);
    expect(getSavedState()?.rosters[0]?.salary).toBe(1);
    expect(getSavedState()?.rosters[0]?.currentValue).toBe(savedPlayer?.economyAfterUpgradePreview?.marketValuePreview);
    expect(getSavedState()?.playerBaselines?.[0]?.attributes.power).toBe(98);
    expect(getSavedState()?.playerBaselines?.[0]?.baselineVersion).toBe("player-baseline-v2");
    expect(getSavedState()?.playerBaselines?.[0]?.checksum).toBe(baselineChecksumBefore);
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

    const preview = previewSeasonEndXpSpend(save, "team-1", []);
    const { persistence, getSavedState } = createPersistence();

    const result = applySeasonEndXpSpend(save, "team-1", [], preview.confirmToken, persistence);
    const savedPlayer = getSavedState()?.players[0];

    expect(preview.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(savedPlayer?.currentXP).toBe(35 + (preview.players[0]?.earnedSeasonXP ?? 0));
    expect(savedPlayer?.spentXP).toBe(20);
    expect(savedPlayer?.lifetimeXP).toBe(55 + (preview.players[0]?.earnedSeasonXP ?? 0));
    expect(getSavedState()?.playerProgressionEvents?.[0]?.xpSpent).toBe(0);
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

    const preview = previewSeasonEndXpSpend(save, "team-1", []);

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("season_xp_no_unmaterialized_xp");
  });

  it("blocks XP writes when the player baseline is missing", () => {
    const save = createSave(createPlayer({ currentXP: 100 }));
    save.gameState.playerBaselines = [];
    const preview = previewSeasonEndXpSpend(save, "team-1", [upgrade()]);

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("player_baseline_missing:player-1");
  });
});
