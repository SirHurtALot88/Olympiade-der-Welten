import { describe, expect, it, vi } from "vitest";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  applyFacilityUpgrade,
  previewFacilityUpgrade,
} from "@/lib/facilities/facility-upgrade-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function baseGameState(input?: {
  cash?: number;
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", currentMatchday: 1, totalMatchdays: 10, isCompleted: false },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, teamFacilities: input?.teamFacilities },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      {
        teamId: "team-1",
        shortCode: "T-O",
        name: "Team One",
        budget: input?.cash ?? 100,
        cash: input?.cash ?? 100,
        identityId: "identity-1",
        humanControlled: true,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
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
  };
}

function save(input?: {
  cash?: number;
  status?: PersistedSaveGame["status"];
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
}): PersistedSaveGame {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: input?.status ?? "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState: baseGameState({ cash: input?.cash, teamFacilities: input?.teamFacilities }),
  };
}

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function persistenceMock(sourceSave: PersistedSaveGame) {
  const saveSingleplayerState = vi.fn((saveId: string, gameState: GameState) => ({
    ...sourceSave,
    saveId,
    gameState,
  }));

  return {
    persistence: {
      saveSingleplayerState,
    } as unknown as PersistenceService,
    saveSingleplayerState,
  };
}

describe("facility upgrade service", () => {
  it("previews level 0 to 1 with costs, upkeep, cash and confirm token", () => {
    const preview = previewFacilityUpgrade(save(), "team-1", "training_center");

    expect(preview.ok).toBe(true);
    expect(preview.currentLevel).toBe(0);
    expect(preview.nextLevel).toBe(1);
    expect(preview.upgradeCost).toBe(8);
    expect(preview.currentUpkeep).toBe(0);
    expect(preview.newUpkeep).toBe(0.8);
    expect(preview.cashBefore).toBe(100);
    expect(preview.cashAfter).toBe(92);
    expect(preview.confirmToken).toEqual(expect.any(String));
  });

  it("blocks preview when cash is insufficient", () => {
    const preview = previewFacilityUpgrade(save({ cash: 3 }), "team-1", "arena_upgrade");

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("insufficient_cash");
    expect(preview.confirmToken).toBeNull();
  });

  it("blocks apply without confirm token", () => {
    const sourceSave = save();
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = applyFacilityUpgrade(sourceSave, "team-1", "training_center", null, null, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("confirm_token_required");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("blocks stale previews when the confirm token no longer matches", () => {
    const sourceSave = save();
    const preview = previewFacilityUpgrade(sourceSave, "team-1", "training_center");
    const changedSave = save({ cash: 99 });
    const { persistence, saveSingleplayerState } = persistenceMock(changedSave);

    const result = applyFacilityUpgrade(changedSave, "team-1", "training_center", preview.confirmToken, null, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("facility_upgrade_preview_stale");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("deducts cash, increases level, increases upkeep forecast and writes a facility event", () => {
    const sourceSave = save();
    const preview = previewFacilityUpgrade(sourceSave, "team-1", "training_center");
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = applyFacilityUpgrade(
      sourceSave,
      "team-1",
      "training_center",
      preview.confirmToken,
      null,
      persistence,
    );
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(result.facilityEventId).toEqual(expect.stringMatching(/^facility-event-/));
    expect(preview.newUpkeep).toBeGreaterThan(preview.currentUpkeep);
    if (!savedState) throw new Error("Expected facility apply to persist the next game state.");
    expect(savedState.teams.find((team) => team.teamId === "team-1")?.cash).toBe(92);
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center).toMatchObject({
      level: 1,
      enabled: true,
      disabledReason: undefined,
    });
    expect(savedState.seasonState.facilityEvents?.[0]).toMatchObject({
      eventId: result.facilityEventId,
      seasonId: "season-1",
      teamId: "team-1",
      facilityId: "training_center",
      previousLevel: 0,
      nextLevel: 1,
      cost: 8,
      source: "manual_facility_upgrade",
    });
  });

  it("requires a Specialist Wing variant for the first upgrade", () => {
    const preview = previewFacilityUpgrade(save(), "team-1", "specialist_wing");

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("specialist_wing_variant_required");
  });

  it("keeps the active Specialist Wing variant and blocks switching it later", () => {
    const sourceSave = save({
      teamFacilities: {
        "team-1": facilities({
          specialist_wing: { level: 1, enabled: true, activeVariant: "power_gym" },
        }),
      },
    });

    const preview = previewFacilityUpgrade(sourceSave, "team-1", "specialist_wing", "agility_track");

    expect(preview.ok).toBe(false);
    expect(preview.facility?.variant).toBe("power_gym");
    expect(preview.blockingReasons).toContain("specialist_wing_variant_switch_not_supported");
  });

  it("keeps service source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/facilities/facility-upgrade-service.ts",
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(source).toContain("saveSingleplayerState");
  });
});
