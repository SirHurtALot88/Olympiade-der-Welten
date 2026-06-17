import { describe, expect, it } from "vitest";

import type { GameState, Player, PlayerGeneratorAttributes, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselinesForPlayers } from "@/lib/players/player-baseline-service";
import { applyAiSeasonEndXpSpend, previewAiSeasonEndXpSpend } from "@/lib/progression/ai-xp-spend-planner";
import { applySeasonEndXpSpend } from "@/lib/progression/season-end-xp-apply-service";

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

function createTeam(partial: Partial<Team> & Pick<Team, "teamId" | "shortCode" | "name">): Team {
  return {
    budget: 100,
    cash: 100,
    salaryTotal: 0,
    rosterValue: 0,
    humanControlled: false,
    rosterLimit: 12,
    ...partial,
  };
}

function createIdentity(partial: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
    playerType: null,
    pow: 25,
    spe: 25,
    men: 25,
    soc: 25,
    ambition: 5,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
    ...partial,
  };
}

function createPlayer(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    rating: 60,
    marketValue: 10,
    salaryDemand: 1,
    className: "Fighter",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: [],
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
    potential: 50,
    currentXP: 300,
    spentXP: 0,
    lifetimeXP: 300,
    trainingMode: "mittel",
    ...partial,
  };
}

function createSave(input: {
  team: Team;
  identity?: TeamIdentity;
  players?: Player[];
  priorProgressionEvents?: boolean;
}): PersistedSaveGame {
  const players = input.players ?? [
    createPlayer({ id: "star", name: "Star", rating: 90, className: "Duelist", attributeSheetStats: { ...baseAttributes, dexterity: 40, speed: 40 } }),
    createPlayer({ id: "depth", name: "Depth", rating: 40, className: "Apprentice", attributeSheetStats: { ...baseAttributes, health: 20 } }),
  ];
  const gameState: GameState = {
    gamePhase: "player_development",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 10, matchdayIds: [] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      formCards: [],
    },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [input.team],
    teamIdentities: [input.identity ?? createIdentity({ teamId: input.team.teamId })],
    players,
    disciplines: [
      { id: "tdm", name: "TDM", category: "power", weight: 1 },
      { id: "fechten", name: "Fechten", category: "speed", weight: 1 },
      { id: "speed-schach", name: "Schach", category: "mental", weight: 1 },
    ],
    rosters: players.map((player, index) => ({
      id: `r-${player.id}`,
      teamId: input.team.teamId,
      playerId: player.id,
      salary: player.salaryDemand,
      upkeep: player.salaryDemand,
      marketValue: player.marketValue,
      contractLength: 1,
      roleTag: index === 0 ? "starter" : "bench",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerBaselines: createPlayerBaselinesForPlayers(players, { source: "seed", createdAt: "2026-06-12T00:00:00.000Z" }),
    playerProgressionEvents: input.priorProgressionEvents
      ? players.map((player) => ({
          eventId: `existing-${player.id}`,
          seasonId: "season-1",
          teamId: input.team.teamId,
          playerId: player.id,
          upgrades: [],
          xpSpent: 0,
          timestamp: "2026-06-12T00:00:00.000Z",
          source: "manual_season_end_xp_spend",
        }))
      : [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-12T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: players.length,
      warnings: [],
    },
  };
  return { saveId: "save-test", name: "Test Save", status: "active", gameState };
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

describe("AI season-end XP spend planner", () => {
  it("plans no upgrades without XP", () => {
    const team = createTeam({ teamId: "C-S", shortCode: "C-S", name: "Cold Steel" });
    const players = [createPlayer({ id: "p1", name: "Empty XP", currentXP: 0 })];
    const plan = previewAiSeasonEndXpSpend(createSave({ team, players, priorProgressionEvents: true }), team.teamId);

    expect(plan.normalizedPlannedUpgrades).toHaveLength(0);
    expect(plan.warnings.some((warning) => warning.includes("no_xp_available"))).toBe(true);
  });

  it("does not exceed available XP and respects attribute 99", () => {
    const team = createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks" });
    const players = [
      createPlayer({
        id: "p1",
        name: "Almost Max",
        currentXP: 100,
        attributeSheetStats: Object.fromEntries(Object.keys(baseAttributes).map((key) => [key, 99])) as PlayerGeneratorAttributes,
      }),
    ];
    const plan = previewAiSeasonEndXpSpend(createSave({ team, players }), team.teamId);

    expect(plan.normalizedPlannedUpgrades).toHaveLength(0);
    expect(plan.playerPlans.every((player) => player.xpSpent <= player.availableXP)).toBe(true);
  });

  it("prioritizes core/star players more than depth players", () => {
    const team = createTeam({ teamId: "M-M", shortCode: "M-M", name: "Mayhem Mavericks" });
    const plan = previewAiSeasonEndXpSpend(createSave({ team }), team.teamId);
    const star = plan.playerPlans.find((player) => player.playerId === "star");
    const depth = plan.playerPlans.find((player) => player.playerId === "depth");

    expect((star?.plannedUpgrades.length ?? 0)).toBeGreaterThanOrEqual(depth?.plannedUpgrades.length ?? 0);
    expect(star?.reasons).toContain("role_star_main_attributes");
  });

  it("uses team identity and team focus for Cold Steel precision/agility", () => {
    const team = createTeam({ teamId: "C-S", shortCode: "C-S", name: "Cold Steel" });
    const plan = previewAiSeasonEndXpSpend(createSave({ team }), team.teamId);
    const attributes = plan.normalizedPlannedUpgrades.map((upgrade) => upgrade.attribute);

    expect(attributes.some((attribute) => ["dexterity", "speed", "awareness", "will"].includes(attribute))).toBe(true);
  });

  it("uses Wicked Wizards mental/magic focus", () => {
    const team = createTeam({ teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards" });
    const players = [createPlayer({ id: "wiz", name: "Wizard", className: "Wizard", currentXP: 400 })];
    const plan = previewAiSeasonEndXpSpend(createSave({ team, players }), team.teamId);
    const attributes = plan.normalizedPlannedUpgrades.map((upgrade) => upgrade.attribute);

    expect(attributes.some((attribute) => ["intelligence", "awareness", "will", "spirit"].includes(attribute))).toBe(true);
  });

  it("makes Cash Creators prefer efficient upgrades", () => {
    const team = createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" });
    const players = [
      createPlayer({ id: "value", name: "Value", currentXP: 400, attributeSheetStats: { ...baseAttributes, stamina: 20, awareness: 20 } }),
    ];
    const plan = previewAiSeasonEndXpSpend(createSave({ team, players }), team.teamId);

    expect(plan.normalizedPlannedUpgrades.length).toBeGreaterThan(0);
    expect(plan.normalizedPlannedUpgrades.every((upgrade) => upgrade.cost <= 130)).toBe(true);
    expect(plan.playerPlans[0]?.reasons).toContain("cash_creators_value_upgrade");
  });

  it("applies via the same human XP service with explicit AI allowance", () => {
    const team = createTeam({ teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards" });
    const save = createSave({ team, players: [createPlayer({ id: "wiz", name: "Wizard", className: "Wizard", currentXP: 400 })] });
    const plan = previewAiSeasonEndXpSpend(save, team.teamId);
    const blockedHumanApply = applySeasonEndXpSpend(save, team.teamId, plan.plannedUpgrades, plan.confirmToken, createPersistence().persistence);
    const { persistence, getSavedState } = createPersistence();
    const applied = applyAiSeasonEndXpSpend(save, team.teamId, plan.confirmToken, persistence);

    expect(blockedHumanApply.applied).toBe(false);
    expect(blockedHumanApply.blockingReasons).toContain("ai_xp_spend_apply_not_enabled_v1");
    expect(applied.applied).toBe(true);
    expect(getSavedState()?.playerProgressionEvents?.[0]?.source).toBe("manual_season_end_xp_spend");
  });
});
