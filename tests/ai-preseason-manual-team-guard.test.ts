import { describe, expect, it } from "vitest";

import {
  allowsAiPreseasonManualTeamOverride,
  getProtectedHumanTeamIds,
  protectManualPlayerTeams,
} from "@/lib/ai/ai-preseason-manual-team-guard";
import type { GameState, ScenarioType, Team, TeamControlSettings } from "@/lib/data/olyDataTypes";

function createTeam(partial: Partial<Team> & Pick<Team, "teamId">): Team {
  return {
    shortCode: partial.teamId,
    name: partial.name ?? partial.teamId,
    budget: 100,
    cash: 100,
    identityId: partial.teamId,
    rosterLimit: 12,
    humanControlled: partial.humanControlled ?? false,
    ...partial,
  };
}

function createGameState(input?: {
  teams?: Team[];
  teamControlSettings?: Record<string, TeamControlSettings>;
  selectedTeamId?: string | null;
  scenarioType?: ScenarioType;
}): GameState {
  const teams = input?.teams ?? [
    createTeam({ teamId: "H-R", humanControlled: true }),
    createTeam({ teamId: "A-I", humanControlled: false }),
  ];

  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      newGameFlow: input?.selectedTeamId ? { selectedTeamId: input.selectedTeamId, active: true } : undefined,
      teamControlSettings: input?.teamControlSettings,
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams,
    teamIdentities: [],
    players: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-26T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
      unmappedPlayers: [],
    },
    disciplines: [],
    scenarioMeta: input?.scenarioType
      ? {
          scenarioType: input.scenarioType,
          label: input.scenarioType,
          createdAt: "2026-06-26T00:00:00.000Z",
        }
      : undefined,
  } as GameState;
}

describe("ai preseason manual team guard", () => {
  it("protects selected, human-controlled, and manual teams in normal saves", () => {
    const gameState = createGameState({
      selectedTeamId: "H-R",
      teamControlSettings: {
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "M-M",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
        "A-I": {
          teamId: "A-I",
          controlMode: "ai",
          ownerId: "ai",
          ownerSlot: "ai",
          displayLabel: "A-I",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      },
      teams: [
        createTeam({ teamId: "H-R", humanControlled: true }),
        createTeam({ teamId: "M-M", humanControlled: false }),
        createTeam({ teamId: "A-I", humanControlled: false }),
      ],
    });

    const protectedIds = getProtectedHumanTeamIds(gameState);
    expect([...protectedIds].sort()).toEqual(["H-R", "M-M"]);

    const protectedState = protectManualPlayerTeams(gameState);
    expect(protectedState.seasonState.teamControlSettings?.["H-R"]?.controlMode).toBe("manual");
    expect(protectedState.seasonState.teamControlSettings?.["M-M"]?.controlMode).toBe("manual");
    expect(protectedState.seasonState.teamControlSettings?.["A-I"]?.controlMode).toBe("ai");
  });

  it("allows manual override only for test and sandbox contexts", () => {
    const normalSave = createGameState({ scenarioType: "new_game" });
    expect(allowsAiPreseasonManualTeamOverride({ saveId: "my-campaign-save", gameState: normalSave })).toBe(false);
    expect(
      allowsAiPreseasonManualTeamOverride({
        saveId: "block-1-smoke-save",
        gameState: normalSave,
      }),
    ).toBe(true);
    expect(
      allowsAiPreseasonManualTeamOverride({
        saveId: "my-campaign-save",
        gameState: createGameState({ scenarioType: "season1_simulation" }),
      }),
    ).toBe(true);
    expect(
      allowsAiPreseasonManualTeamOverride({
        saveId: "my-campaign-save",
        gameState: normalSave,
        explicitOverride: true,
      }),
    ).toBe(true);
  });

  it("returns the original reference when no manual protection is needed", () => {
    const gameState = createGameState({
      teams: [createTeam({ teamId: "A-I", humanControlled: false })],
      teamControlSettings: {
        "A-I": {
          teamId: "A-I",
          controlMode: "ai",
          ownerId: "ai",
          ownerSlot: "ai",
          displayLabel: "A-I",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      },
    });

    expect(protectManualPlayerTeams(gameState)).toBe(gameState);
  });

  it("disables AI preview flags on protected manual teams in normal saves", () => {
    const gameState = createGameState({
      selectedTeamId: "H-R",
      teamControlSettings: {
        "H-R": {
          teamId: "H-R",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "H-R",
          aiLineupPreviewEnabled: true,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
          notes: null,
          strategyLock: null,
        },
      },
      teams: [createTeam({ teamId: "H-R", humanControlled: true })],
    });

    const protectedState = protectManualPlayerTeams(gameState);
    const hrSettings = protectedState.seasonState.teamControlSettings?.["H-R"];

    expect(hrSettings?.controlMode).toBe("manual");
    expect(hrSettings?.aiLineupPreviewEnabled).toBe(false);
    expect(hrSettings?.aiTransferPreviewEnabled).toBe(false);
    expect(hrSettings?.aiSellPreviewEnabled).toBe(false);
  });
});
