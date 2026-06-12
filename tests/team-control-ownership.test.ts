import { describe, expect, it } from "vitest";

import type { Team } from "@/lib/data/olyDataTypes";
import {
  AI_OWNER_ID,
  DEFAULT_ACTIVE_OWNER_ID,
  buildTeamControlSettingsMap,
  buildTeamOwners,
  filterTeamsByControlScope,
} from "@/lib/foundation/team-control-settings";

function makeTeam(teamId: string, shortCode: string, humanControlled: boolean): Team {
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

describe("team control ownership", () => {
  const teams = [
    makeTeam("M-M", "M-M", true),
    makeTeam("D-P", "D-P", true),
    makeTeam("B-P", "B-P", false),
    makeTeam("P-X", "P-X", false),
  ];

  it("normalizes legacy control settings into owner-aware settings", () => {
    const settings = buildTeamControlSettingsMap(teams, {
      "D-P": {
        teamId: "D-P",
        controlMode: "manual",
        ownerId: "ramona_local",
        aiLineupPreviewEnabled: false,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
      },
      "P-X": {
        teamId: "P-X",
        controlMode: "passive",
        aiLineupPreviewEnabled: false,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
      },
    });

    expect(settings["M-M"]?.ownerId).toBe(DEFAULT_ACTIVE_OWNER_ID);
    expect(settings["D-P"]?.ownerId).toBe("ramona_local");
    expect(settings["B-P"]?.ownerId).toBe(AI_OWNER_ID);
    expect(settings["P-X"]?.controlMode).toBe("passive");
    expect(settings["P-X"]?.ownerId).toBe(AI_OWNER_ID);
    expect(settings["M-M"]?.displayLabel).toBe("M-M");
  });

  it("builds local owners and filters teams by control mode and owner", () => {
    const settings = buildTeamControlSettingsMap(teams, {
      "D-P": {
        teamId: "D-P",
        controlMode: "manual",
        ownerId: "ramona_local",
        aiLineupPreviewEnabled: false,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
      },
      "P-X": {
        teamId: "P-X",
        controlMode: "passive",
        aiLineupPreviewEnabled: false,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
      },
    });
    const owners = buildTeamOwners(teams, settings);

    expect(owners.find((owner) => owner.ownerId === DEFAULT_ACTIVE_OWNER_ID)?.controlledTeamIds).toEqual(["M-M"]);
    expect(owners.find((owner) => owner.ownerId === "ramona_local")?.controlledTeamIds).toEqual(["D-P"]);
    expect(owners.find((owner) => owner.ownerId === AI_OWNER_ID)?.controlledTeamIds).toEqual(["B-P", "P-X"]);

    expect(filterTeamsByControlScope(teams, settings, "my_teams", DEFAULT_ACTIVE_OWNER_ID).map((team) => team.teamId)).toEqual(["M-M"]);
    expect(filterTeamsByControlScope(teams, settings, "owner:ramona_local", DEFAULT_ACTIVE_OWNER_ID).map((team) => team.teamId)).toEqual(["D-P"]);
    expect(filterTeamsByControlScope(teams, settings, "human", DEFAULT_ACTIVE_OWNER_ID).map((team) => team.teamId)).toEqual(["M-M", "D-P"]);
    expect(filterTeamsByControlScope(teams, settings, "ai", DEFAULT_ACTIVE_OWNER_ID).map((team) => team.teamId)).toEqual(["B-P"]);
    expect(filterTeamsByControlScope(teams, settings, "passive", DEFAULT_ACTIVE_OWNER_ID).map((team) => team.teamId)).toEqual(["P-X"]);
    expect(filterTeamsByControlScope(teams, settings, "all", DEFAULT_ACTIVE_OWNER_ID)).toHaveLength(4);
  });
});
