import { describe, expect, it } from "vitest";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import {
  AI_OWNER_ID,
  DEFAULT_ACTIVE_OWNER_ID,
  applyGameModeOwnership,
  withNormalizedTeamControlSettings,
} from "@/lib/foundation/team-control-settings";

function makeTeam(teamId: string, shortCode: string, humanControlled = false): Team {
  return {
    teamId,
    shortCode,
    name: `${shortCode} Team`,
    budget: 100,
    cash: 100,
    identityId: teamId,
    humanControlled,
    rosterLimit: 12,
  };
}

function makeMinimalGameState(teams: Team[]): GameState {
  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      matchdayIds: [],
      currentMatchday: 1,
    },
    teams,
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    matchdayState: {
      matchdayId: "matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-01-01T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: teams.length,
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
      newGameFlow: {
        active: true,
        selectedTeamId: "M-M",
        steps: [],
      },
    },
    gamePhase: "preseason_management",
    scenarioMeta: {
      saveMode: "solo_1",
      newGamePresetId: "solo_1",
      humanControlledTeamCount: 1,
    },
  };
}

describe("applyGameModeOwnership", () => {
  const teams = [
    makeTeam("H-R", "H-R"),
    makeTeam("M-M", "M-M"),
    makeTeam("D-P", "D-P"),
    makeTeam("P-S", "P-S"),
    makeTeam("M-S", "M-S"),
    makeTeam("P-C", "P-C"),
    makeTeam("C-S", "C-S"),
    makeTeam("G-G", "G-G"),
    makeTeam("V-W", "V-W"),
    makeTeam("B-P", "B-P"),
  ];

  it("sets solo_1 to exactly one manual Chris team and AI rest", () => {
    const next = applyGameModeOwnership(makeMinimalGameState(teams), {
      saveMode: "solo_1",
      chrisTeamIds: ["H-R"],
      frankyTeamIds: [],
    });

    expect(next.scenarioMeta?.saveMode).toBe("solo_1");
    expect(next.scenarioMeta?.humanControlledTeamCount).toBe(1);
    expect(next.seasonState.newGameFlow?.selectedTeamId).toBe("H-R");
    expect(next.seasonState.teamControlSettings?.["H-R"]?.controlMode).toBe("manual");
    expect(next.seasonState.teamControlSettings?.["H-R"]?.ownerId).toBe(DEFAULT_ACTIVE_OWNER_ID);
    expect(next.teams.filter((team) => team.humanControlled)).toHaveLength(1);
    expect(next.teams.find((team) => team.teamId === "H-R")?.humanControlled).toBe(true);
    expect(next.teams.find((team) => team.teamId === "M-M")?.humanControlled).toBe(false);
    expect(next.seasonState.teamControlSettings?.["M-M"]?.controlMode).toBe("ai");
    expect(next.seasonState.teamControlSettings?.["M-M"]?.ownerId).toBe(AI_OWNER_ID);
  });

  it("sets online_4v4 to 4 Chris + 4 Franky manual teams and AI rest", () => {
    const chrisTeamIds = ["P-S", "D-P", "M-M", "V-W"];
    const frankyTeamIds = ["M-S", "P-C", "C-S", "G-G"];
    const next = applyGameModeOwnership(makeMinimalGameState(teams), {
      saveMode: "online_4v4",
      chrisTeamIds,
      frankyTeamIds,
    });

    expect(next.scenarioMeta?.saveMode).toBe("online_4v4");
    expect(next.scenarioMeta?.humanControlledTeamCount).toBe(8);
    expect(next.teams.filter((team) => team.humanControlled)).toHaveLength(8);

    for (const teamId of chrisTeamIds) {
      expect(next.seasonState.teamControlSettings?.[teamId]?.controlMode).toBe("manual");
      expect(next.seasonState.teamControlSettings?.[teamId]?.ownerId).toBe(DEFAULT_ACTIVE_OWNER_ID);
    }

    for (const teamId of frankyTeamIds) {
      expect(next.seasonState.teamControlSettings?.[teamId]?.controlMode).toBe("manual");
      expect(next.seasonState.teamControlSettings?.[teamId]?.ownerId).toBe("franky_remote_placeholder");
    }

    expect(next.seasonState.teamControlSettings?.["B-P"]?.controlMode).toBe("ai");
    expect(next.seasonState.teamControlSettings?.["H-R"]?.controlMode).toBe("ai");
  });

  it("preserves saved AI teams after normalize reload", () => {
    const applied = applyGameModeOwnership(makeMinimalGameState(teams), {
      saveMode: "solo_1",
      chrisTeamIds: ["H-R"],
      frankyTeamIds: [],
    });
    const reloaded = withNormalizedTeamControlSettings(applied);

    expect(reloaded.teams.find((team) => team.teamId === "H-R")?.humanControlled).toBe(true);
    expect(reloaded.teams.find((team) => team.teamId === "M-M")?.humanControlled).toBe(false);
    expect(reloaded.seasonState.teamControlSettings?.["M-M"]?.controlMode).toBe("ai");
  });
});
