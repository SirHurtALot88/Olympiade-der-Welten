import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

const persistenceState = {
  save: null as PersistedSaveGame | null,
};

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({ save: persistenceState.save, createdFromSeed: false }),
    getActiveSave: () => persistenceState.save,
    getSaveById: (saveId: string) => (persistenceState.save?.saveId === saveId ? persistenceState.save : null),
  }),
}));

function team(teamId: string, control: "ai" | "manual" | "passive"): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `${teamId} Team`,
    budget: 100,
    cash: 75,
    identityId: teamId,
    humanControlled: control === "manual",
    rosterLimit: 14,
  };
}

function gameState(input?: { seasonId?: string }): GameState {
  const teams = [team("A-I", "ai"), team("H-U", "manual"), team("P-S", "passive")];
  return {
    gamePhase: "preseason_management",
    season: {
      id: input?.seasonId ?? "season-1",
      name: input?.seasonId === "season-2" ? "Season 2" : "Season 1",
      year: 2026,
      currentMatchday: 1,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: input?.seasonId ?? "season-1",
      schedule: [],
      disciplineSchedule: [],
      standings: {
        "A-I": { points: 12, rank: 1 },
        "H-U": { points: 8, rank: 2 },
        "P-S": { points: 3, rank: 3 },
      },
      teamControlSettings: {
        "A-I": {
          teamId: "A-I",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: true,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: true,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: true,
        },
        "H-U": {
          teamId: "H-U",
          controlMode: "manual",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
        "P-S": {
          teamId: "P-S",
          controlMode: "passive",
          aiLineupPreviewEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      playerDisciplinePerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          teamId: "A-I",
          playerId: "p-ai-good",
          activePlayerId: null,
          disciplineId: "d1",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 70,
          finalPlayerScore: 82,
          scoreContribution: 40,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
        {
          id: "perf-2",
          matchdayResultId: "result-1",
          teamId: "A-I",
          playerId: "p-ai-bad",
          activePlayerId: null,
          disciplineId: "d1",
          disciplineSide: "d1",
          slotIndex: 1,
          baseValue: 30,
          finalPlayerScore: 34,
          scoreContribution: 12,
          rankInTeam: 2,
          rankInDiscipline: 30,
          isTop10: false,
          isMvpCandidate: false,
          createdAt: "2026-06-14T00:00:00.000Z",
        },
      ],
    },
    matchdayState: { matchdayId: "matchday-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: teams.map((entry) => ({
      teamId: entry.teamId,
      pow: 50,
      spe: 50,
      men: 50,
      soc: 50,
      ambition: 50,
      finances: 50,
      boardConfidence: 50,
      harmony: 50,
      manners: 50,
      popularity: 50,
      cooperation: 50,
      playerMin: 2,
      playerOpt: 3,
    })),
    players: [
      {
        id: "p-ai-good",
        name: "Breakout",
        rating: 80,
        marketValue: 40,
        salaryDemand: 8,
        className: "Hero",
        race: "Human",
        alignment: "neutral",
        gender: "m",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 80, spe: 70, men: 65, soc: 60 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 20,
        form: 0,
        potential: 80,
      },
      {
        id: "p-ai-bad",
        name: "Slump",
        rating: 35,
        marketValue: 8,
        salaryDemand: 2,
        className: "Rogue",
        race: "Human",
        alignment: "neutral",
        gender: "m",
        subclasses: [],
        traitsPositive: [],
        traitsNegative: [],
        coreStats: { pow: 30, spe: 40, men: 30, soc: 30 },
        preferredDisciplineIds: [],
        disciplineRatings: {},
        disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
        flavorEn: "",
        flavorDe: "",
        fatigue: 75,
        form: 0,
        potential: 40,
      },
    ],
    disciplines: [],
    rosters: [
      { id: "r-1", teamId: "A-I", playerId: "p-ai-good", contractLength: 2, salary: 8, roleTag: "starter", joinedSeasonId: input?.seasonId ?? "season-1" },
      { id: "r-2", teamId: "A-I", playerId: "p-ai-bad", contractLength: 1, salary: 2, roleTag: "bench", joinedSeasonId: input?.seasonId ?? "season-1" },
    ],
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
      teamCount: 3,
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
    saveId: "save-lifecycle",
    name: "Lifecycle Test",
    status: "active",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    gameState: state,
  };
}

describe("ai season lifecycle orchestrator", () => {
  beforeEach(() => {
    persistenceState.save = save();
  });

  it("keeps preseason strategy read-only", async () => {
    const { runAiLifecyclePhase } = await import("@/lib/ai/ai-season-lifecycle-orchestrator");
    const result = await runAiLifecyclePhase("save-lifecycle", "preseason_strategy");

    expect(result.readOnly).toBe(true);
    expect(result.productiveWrites).toBe(false);
    expect(result.phaseDefinition.writeMode).toBe("read_only");
    expect(result.phaseDefinition.blockedActions).toContain("buy");
  });

  it("allows preseason market only through AI team official service scope", async () => {
    const { runAiLifecyclePhase } = await import("@/lib/ai/ai-season-lifecycle-orchestrator");
    const result = await runAiLifecyclePhase("save-lifecycle", "preseason_market");

    expect(result.productiveWrites).toBe(false);
    expect(result.phaseDefinition.writeMode).toBe("official_services_only");
    expect(result.run.affectedTeams).toEqual(["A-I"]);
    expect(result.run.affectedTeams).not.toContain("H-U");
    expect(result.run.affectedTeams).not.toContain("P-S");
    expect(result.warnings).toContain("writes_must_use_official_services_only");
  });

  it("warns that season1 topup is blocked after season 1", async () => {
    persistenceState.save = save(gameState({ seasonId: "season-2" }));
    const { runAiLifecyclePhase } = await import("@/lib/ai/ai-season-lifecycle-orchestrator");
    const result = await runAiLifecyclePhase("save-lifecycle", "preseason_market");

    expect(result.warnings).toContain("season1_autoprep_topup_blocked_after_season_1");
  });

  it("builds manager memory during season end review", async () => {
    const { runAiLifecyclePhase } = await import("@/lib/ai/ai-season-lifecycle-orchestrator");
    const result = await runAiLifecyclePhase("save-lifecycle", "season_end_review");

    expect(result.managerMemoryPreview?.["A-I"]?.breakoutPlayers).toContain("Breakout");
    expect(result.managerMemoryPreview?.["A-I"]?.underperformingPlayers).toContain("Slump");
    expect(result.phaseDefinition.producedOutputs).toContain("aiManagerMemory");
  });

  it("exports trigger and performance budget contracts", async () => {
    const { AI_LIFECYCLE_PHASE_DEFINITIONS, AI_LIFECYCLE_TRIGGER_RULES } = await import("@/lib/ai/ai-season-lifecycle-orchestrator");

    const market = AI_LIFECYCLE_PHASE_DEFINITIONS.find((phase) => phase.phase === "preseason_market");
    expect(market?.performanceBudget.targetAvgPickMs).toBe(500);
    expect(market?.performanceBudget.hardCapMs).toBe(600_000);
    expect(AI_LIFECYCLE_TRIGGER_RULES.some((rule) => rule.triggerId === "training_fatigue_70_cluster")).toBe(true);
    expect(AI_LIFECYCLE_TRIGGER_RULES.some((rule) => rule.triggerId === "building_condition_below_70")).toBe(true);
  });
});
