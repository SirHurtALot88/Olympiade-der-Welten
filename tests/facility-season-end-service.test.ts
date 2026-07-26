import path from "node:path";
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

    // BALANCE (2026-07): Fan-Shop L2 = 7.8, Arena-Basis L1 = 2.4, effektiv Basis × Beliebtheit.
    // Dieses Ein-Team-Setup ohne Kader/Tabelle liefert den neutralen Faktor 1.0 → Arena L1 =
    // 2.4 × 1.0 = 2.4. Upkeep-Werte (training_center/fan_shop/arena_upgrade L1/L2/L1 je 0.8/0.8/0.8)
    // sind vom Balancing unberührt geblieben.
    expect(preview.facilityUpkeepTotal).toBe(2.4);
    expect(preview.fanShopIncome).toBe(7.8);
    expect(preview.arenaIncome).toBe(2.4);
    expect(preview.arenaPopularityFactor).toBe(1);
    expect(preview.facilityIncomeTotal).toBe(10.2);
    expect(preview.netFacilityResult).toBe(7.8);
    expect(preview.cashBeforeFacilities).toBe(100);
    expect(preview.cashAfterFacilities).toBe(107.8);
  });

  it("BEHAVIOR FIX: upkeep is mandatory — it is still charged (and cash goes negative) instead of disabling the facility", () => {
    // Unterhalt ist Pflicht (facility-season-end-service.ts): der frühere Zustand
    // `will_disable_unpaid` existiert nicht mehr. Der Unterhalt wird IMMER abgebucht (status
    // "paid"), auch wenn cashAfterFacilities dadurch negativ wird — ein negatives Saison-Ende wird
    // erst danach vom Zahlungsunfähigkeits-Backstop (applyInsolvencyBackstop) in einen Notkredit
    // umgewandelt. Gebäude werden NICHT mehr durch Nichtzahlung deaktiviert, disabledFacilities
    // bleibt daher immer leer.
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

    // Upkeep total: training_center L1 (0.8) + recovery_center L1 (0.7) = 1.5, no income facilities
    // built -> cashAfterFacilities = 0 + 0 - 1.5 = -1.5 (allowed to go negative).
    expect(preview.disabledFacilities).toEqual([]);
    expect(preview.facilityUpkeepTotal).toBe(1.5);
    expect(preview.cashAfterFacilities).toBe(-1.5);
    expect(preview.rows.find((row) => row.facilityId === "training_center")?.status).toBe("paid");
    expect(preview.rows.find((row) => row.facilityId === "recovery_center")?.status).toBe("paid");

    const result = applyFacilitySeasonEndFinance(sourceSave, "team-1", preview.confirmToken, persistence);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(result.disabledFacilities).toEqual([]);
    if (!savedState) throw new Error("Expected facility season-end apply to persist state.");
    expect(savedState.teams.find((team) => team.teamId === "team-1")?.cash).toBe(-1.5);
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.training_center).toMatchObject({
      level: 1,
      enabled: true,
      disabledReason: undefined,
    });
    expect(savedState.seasonState.teamFacilities?.["team-1"].facilities.recovery_center).toMatchObject({
      level: 1,
      enabled: true,
      disabledReason: undefined,
    });
    expect(savedState.seasonState.facilityEvents?.every((event) => event.source !== "facility_upkeep_unpaid")).toBe(true);
    expect(savedState.seasonState.facilityEvents?.filter((event) => event.source === "facility_upkeep_paid")).toHaveLength(2);
    // The facility still fully applies its effect afterwards (it was never disabled).
    expect(applyTrainingXpFacilityModifiers(100, savedState.seasonState.teamFacilities?.["team-1"]).after).toBe(114);
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
    // BALANCE (2026-07): fan_shop L1 income 3.9, upkeep training_center(0.8)+fan_shop(0.4)=1.2
    // -> cash 10 + 3.9 - 1.2 = 12.7.
    expect(savedState.teams.find((team) => team.teamId === "team-1")?.cash).toBe(12.7);
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

    // fan_shop L2 = 7.8, condition 35% -> efficiency 50% (35/70*100) -> 7.8 * 0.5 = 3.9.
    expect(preview.fanShopIncome).toBe(3.9);
    expect(preview.facilityIncomeTotal).toBe(3.9);
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

  it("is idempotent — a second apply in the same season does not double-credit income (audit R2/A6)", () => {
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

    const first = applyFacilitySeasonEndFinance(sourceSave, "team-1", preview.confirmToken, persistence);
    expect(first.applied).toBe(true);
    const savedState = saveSingleplayerState.mock.calls[0]?.[1];
    if (!savedState) throw new Error("Expected first facility apply to persist state.");

    // Zweiter Apply auf dem bereits abgerechneten Stand — muss ohne weitere Buchung abbrechen.
    const alreadyAppliedSave: PersistedSaveGame = { ...sourceSave, gameState: savedState };
    const secondPreview = previewFacilitySeasonEndFinance(alreadyAppliedSave, "team-1");
    const second = applyFacilitySeasonEndFinance(
      alreadyAppliedSave,
      "team-1",
      secondPreview.confirmToken,
      persistence,
    );

    expect(second.applied).toBe(false);
    expect(second.blockingReasons).toContain("facility_season_end_already_applied");
    // Kein zweiter Persist-Aufruf → kein doppeltes Einkommen / kein doppelter Upkeep-Abzug.
    expect(saveSingleplayerState).toHaveBeenCalledTimes(1);
  });

  it("keeps source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        path.join(process.cwd(), "lib/facilities/facility-season-end-service.ts"),
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(calculateFacilityIncome(facilities({ fan_shop: { level: 1, enabled: true } }))).toBe(3.9);
  });
});
