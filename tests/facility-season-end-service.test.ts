import { describe, expect, it, vi } from "vitest";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import {
  applyFacilitySeasonEndFinance,
  previewFacilitySeasonEndFinance,
} from "@/lib/facilities/facility-season-end-service";
import { applyTrainingXpFacilityModifiers, calculateFacilityIncome } from "@/lib/facilities/facility-effects";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function gameState(input?: {
  cash?: number;
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
}): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 10, matchdayIds: ["matchday-10"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, teamFacilities: input?.teamFacilities },
    matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
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
  teamFacilities?: GameState["seasonState"]["teamFacilities"];
}): PersistedSaveGame {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState: gameState(input),
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

describe("facility season-end finance service", () => {
  it("calculates upkeep, income and net facility result", () => {
    const preview = previewFacilitySeasonEndFinance(
      save({
        teamFacilities: {
          "team-1": facilities({
            training_center: { level: 1, enabled: true },
            fan_shop: { level: 2, enabled: true },
            arena_upgrade: { level: 1, enabled: true },
          }),
        },
      }),
      "team-1",
    );

    // BALANCE: Fan-Shop L2 = 5, Arena-Basis L1 = 1.75, effektiv Basis ×
    // Beliebtheit. Dieses Ein-Team-Setup ohne Kader/Tabelle liefert den
    // neutralen Faktor 1.0 → Arena L1 = 1.75 × 1.0 = 1.75 (vorher 3.5).
    expect(preview.facilityUpkeepTotal).toBe(2.4);
    expect(preview.fanShopIncome).toBe(5);
    expect(preview.arenaIncome).toBe(1.75);
    expect(preview.arenaPopularityFactor).toBe(1);
    expect(preview.facilityIncomeTotal).toBe(6.75);
    expect(preview.netFacilityResult).toBe(4.35);
    expect(preview.cashBeforeFacilities).toBe(100);
    expect(preview.cashAfterFacilities).toBe(104.35);
  });

  it("disables facilities when upkeep cannot be paid and removes their effects after apply", () => {
    const sourceSave = save({
      cash: 0,
      teamFacilities: {
        "team-1": facilities({
          training_center: { level: 1, enabled: true },
          recovery_center: { level: 1, enabled: true },
        }),
      },
    });
    const preview = previewFacilitySeasonEndFinance(sourceSave, "team-1");
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    expect(preview.disabledFacilities.map((row) => row.facilityId)).toEqual(["training_center", "recovery_center"]);
    const result = applyFacilitySeasonEndFinance(sourceSave, "team-1", preview.confirmToken, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected facility season-end apply to persist state.");
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center).toMatchObject({
      level: 1,
      enabled: false,
      disabledReason: "facility_upkeep_unpaid",
    });
    expect(savedState.seasonState.facilityEvents?.some((event) => event.source === "facility_upkeep_unpaid")).toBe(true);
    expect(applyTrainingXpFacilityModifiers(100, savedState.seasonState.teamFacilities?.["team-1"]).after).toBe(100);
  });

  it("sets lastPaidSeasonId and deducts paid upkeep while collecting income", () => {
    const sourceSave = save({
      cash: 10,
      teamFacilities: {
        "team-1": facilities({
          training_center: { level: 1, enabled: true },
          fan_shop: { level: 1, enabled: true },
        }),
      },
    });
    const preview = previewFacilitySeasonEndFinance(sourceSave, "team-1");
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    applyFacilitySeasonEndFinance(sourceSave, "team-1", preview.confirmToken, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    if (!savedState) throw new Error("Expected paid facility season-end apply to persist state.");
    expect(savedState.teams.find((team) => team.teamId === "team-1")?.cash).toBe(11.3);
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center.lastPaidSeasonId).toBe("season-1");
    expect(savedState.seasonState.facilityEvents?.some((event) => event.source === "facility_upkeep_paid")).toBe(true);
    expect(savedState.seasonState.facilityEvents?.some((event) => event.source === "facility_income_collected")).toBe(true);
  });

  it("degrades facility condition at season end and keeps paid facilities active until broken", () => {
    const sourceSave = save({
      cash: 10,
      teamFacilities: {
        "team-1": facilities({
          training_center: { level: 1, enabled: true, conditionPct: 76 },
        }),
      },
    });
    const preview = previewFacilitySeasonEndFinance(sourceSave, "team-1");
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    applyFacilitySeasonEndFinance(sourceSave, "team-1", preview.confirmToken, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    if (!savedState) throw new Error("Expected paid facility season-end apply to persist state.");
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center).toMatchObject({
      enabled: true,
      conditionPct: 68,
    });
    expect(savedState.seasonState.facilityEvents?.some((event) => event.source === "facility_upkeep_paid")).toBe(true);
    expect(savedState.seasonState.facilityEvents?.[0]).toMatchObject({
      previousConditionPct: 76,
      nextConditionPct: 68,
    });
  });

  it("scales facility income by condition efficiency", () => {
    const preview = previewFacilitySeasonEndFinance(
      save({
        teamFacilities: {
          "team-1": facilities({
            fan_shop: { level: 2, enabled: true, conditionPct: 35 },
          }),
        },
      }),
      "team-1",
    );

    expect(preview.fanShopIncome).toBe(2.5);
    expect(preview.facilityIncomeTotal).toBe(2.5);
  });

  it("does not invent income for missing sponsor-like sources", () => {
    const sourceSave = save({
      teamFacilities: {
        "team-1": facilities({ training_center: { level: 1, enabled: true } }),
      },
    });
    const preview = previewFacilitySeasonEndFinance(sourceSave, "team-1");

    expect(preview.facilityIncomeTotal).toBe(0);
    expect(preview.warnings).toContain("fan_shop_income_missing");
    expect(preview.warnings).toContain("arena_income_missing");
  });

  it("keeps source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/facilities/facility-season-end-service.ts",
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(calculateFacilityIncome(facilities({ fan_shop: { level: 1, enabled: true } }))).toBe(2.5);
  });
});
