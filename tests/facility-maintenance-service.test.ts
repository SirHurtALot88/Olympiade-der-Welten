import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  applyFacilityMaintenance,
  previewFacilityMaintenance,
} from "@/lib/facilities/facility-maintenance-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function gameState(input?: {
  cash?: number;
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
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
    gameState: gameState({ cash: input?.cash, teamFacilities: input?.teamFacilities }),
  };
}

function persistenceMock(sourceSave: PersistedSaveGame) {
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => ({
    ...sourceSave,
    saveId,
    gameState: nextGameState,
  }));

  return {
    persistence: { saveSingleplayerState } as unknown as PersistenceService,
    saveSingleplayerState,
  };
}

describe("facility maintenance service", () => {
  it("previews maintenance cost, condition restore and cash impact", () => {
    const preview = previewFacilityMaintenance(
      save({
        teamFacilities: {
          "team-1": facilities({
            training_center: { level: 2, enabled: true, conditionPct: 50 },
          }),
        },
      }),
      "team-1",
      "training_center",
    );

    expect(preview.ok).toBe(true);
    expect(preview.conditionPct).toBe(50);
    expect(preview.nextConditionPct).toBe(100);
    expect(preview.efficiencyPct).toBe(71.43);
    expect(preview.nextEfficiencyPct).toBe(100);
    expect(preview.maintenanceCost).toBe(3.38);
    expect(preview.cashAfter).toBe(96.62);
    expect(preview.confirmToken).toEqual(expect.any(String));
  });

  it("restores condition to full, deducts cash and writes a maintenance event", () => {
    const sourceSave = save({
      teamFacilities: {
        "team-1": facilities({
          training_center: { level: 2, enabled: true, conditionPct: 50 },
        }),
      },
    });
    const preview = previewFacilityMaintenance(sourceSave, "team-1", "training_center");
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = applyFacilityMaintenance(sourceSave, "team-1", "training_center", preview.confirmToken, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(result.facilityEventId).toEqual(expect.stringMatching(/^facility-event-/));
    if (!savedState) throw new Error("Expected facility maintenance to persist the next game state.");
    expect(savedState.teams.find((team) => team.teamId === "team-1")?.cash).toBe(96.62);
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center).toMatchObject({
      level: 2,
      enabled: true,
      conditionPct: 100,
      disabledReason: undefined,
    });
    expect(savedState.seasonState.facilityEvents?.[0]).toMatchObject({
      eventId: result.facilityEventId,
      source: "manual_facility_maintenance",
      previousConditionPct: 50,
      nextConditionPct: 100,
      cost: 3.38,
    });
  });

  it("blocks maintenance for full or missing facilities", () => {
    const full = previewFacilityMaintenance(
      save({
        teamFacilities: {
          "team-1": facilities({
            training_center: { level: 1, enabled: true, conditionPct: 100 },
          }),
        },
      }),
      "team-1",
      "training_center",
    );
    const missing = previewFacilityMaintenance(save(), "team-1", "training_center");

    expect(full.ok).toBe(false);
    expect(full.blockingReasons).toContain("facility_condition_already_full");
    expect(missing.ok).toBe(false);
    expect(missing.blockingReasons).toContain("facility_not_built");
  });

  it("keeps source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        path.join(process.cwd(), "lib/facilities/facility-maintenance-service.ts"),
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(source).toContain("saveSingleplayerState");
  });
});
