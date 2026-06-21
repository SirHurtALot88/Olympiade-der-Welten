import { describe, expect, it } from "vitest";

import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import {
  applyRecoveryFacilityModifiers,
  applyTrainingXpFacilityModifiers,
  applyUpgradeCostFacilityModifiers,
  calculateFacilityIncome,
  calculateFacilityUpkeep,
  getAnalyticsForecastQuality,
  getScoutingConfidence,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function gameStateWithFacilities(teamFacilities?: GameState["seasonState"]["teamFacilities"]): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: { seasonId: "season-1", schedule: [], standings: {}, teamFacilities },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [],
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
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      unmappedPlayers: [],
      warnings: [],
      teamCount: 0,
    },
  };
}

describe("facility effects", () => {
  it("defines the V1 facility catalog centrally", () => {
    expect(FACILITY_CATALOG.map((entry) => entry.facilityId)).toEqual([
      "training_center",
      "recovery_center",
      "scouting_office",
      "analytics_room",
      "fan_shop",
      "arena_upgrade",
      "academy",
      "specialist_wing",
    ]);
    expect(FACILITY_CATALOG.every((entry) => entry.maxLevel === 5 && entry.levels.length === 5)).toBe(true);
  });

  it("level 0 creates no effects and missing save facility source does not crash", () => {
    const teamFacilities = getTeamFacilityState(gameStateWithFacilities(), "T-O");

    expect(applyTrainingXpFacilityModifiers(100, teamFacilities).after).toBe(100);
    expect(calculateFacilityUpkeep(teamFacilities)).toBe(0);
    expect(calculateFacilityIncome(teamFacilities)).toBe(0);
    expect(teamFacilities.facilities.training_center.conditionPct).toBe(100);
    expect(teamFacilities.facilities.training_center.disabledReason).toBe("not_built");
  });

  it("disabled built facilities provide no upkeep, income or effects", () => {
    const teamFacilities = facilities({
      training_center: { level: 3, enabled: false, disabledReason: "facility_upkeep_unpaid" },
      fan_shop: { level: 3, enabled: false, disabledReason: "facility_upkeep_unpaid" },
      academy: { level: 3, enabled: false, disabledReason: "facility_upkeep_unpaid" },
    });

    expect(applyTrainingXpFacilityModifiers(100, teamFacilities).after).toBe(100);
    expect(calculateFacilityUpkeep(teamFacilities)).toBe(0);
    expect(calculateFacilityIncome(teamFacilities)).toBe(0);
    expect(applyUpgradeCostFacilityModifiers("power", "D", 100, teamFacilities).costAfterFacility).toBe(100);
  });

  it("training center increases only Base Training XP", () => {
    const teamFacilities = facilities({ training_center: { level: 2, enabled: true } });
    const base = applyTrainingXpFacilityModifiers(100, teamFacilities);
    const performanceXp = 50;

    expect(base.modifierPct).toBe(10);
    expect(base.after).toBe(110);
    expect(base.after + performanceXp).toBe(160);
  });

  it("scales facility effects by condition below 70 percent and reaches zero when broken", () => {
    const wornFacilities = facilities({ training_center: { level: 2, enabled: true, conditionPct: 35 } });
    const brokenFacilities = facilities({ training_center: { level: 2, enabled: true, conditionPct: 0 } });

    expect(applyTrainingXpFacilityModifiers(100, wornFacilities).modifierPct).toBe(5);
    expect(applyTrainingXpFacilityModifiers(100, wornFacilities).after).toBe(105);
    expect(applyTrainingXpFacilityModifiers(100, brokenFacilities).after).toBe(100);
  });

  it("recovery center increases recovery", () => {
    const result = applyRecoveryFacilityModifiers(80, facilities({ recovery_center: { level: 3, enabled: true } }));

    expect(result.modifierPct).toBe(15);
    expect(result.after).toBe(92);
  });

  it("fan shop and arena upgrade generate season income", () => {
    const teamFacilities = facilities({
      fan_shop: { level: 2, enabled: true },
      arena_upgrade: { level: 1, enabled: true },
    });

    expect(calculateFacilityIncome(teamFacilities)).toBe(8);
  });

  it("sums upkeep correctly", () => {
    const teamFacilities = facilities({
      training_center: { level: 1, enabled: true },
      fan_shop: { level: 3, enabled: true },
    });

    expect(calculateFacilityUpkeep(teamFacilities)).toBe(2.2);
  });

  it("academy reduces only F/E/D upgrade costs and not S/S+", () => {
    const teamFacilities = facilities({ academy: { level: 5, enabled: true } });

    expect(applyUpgradeCostFacilityModifiers("power", "D", 100, teamFacilities).costAfterFacility).toBe(85);
    expect(applyUpgradeCostFacilityModifiers("power", "S", 100, teamFacilities).costAfterFacility).toBe(100);
    expect(applyUpgradeCostFacilityModifiers("power", "S+", 100, teamFacilities).costAfterFacility).toBe(100);
  });

  it("specialist wing affects only the active attribute group", () => {
    const teamFacilities = facilities({
      specialist_wing: { level: 5, enabled: true, activeVariant: "agility_track" },
    });

    expect(applyUpgradeCostFacilityModifiers("speed", "B", 100, teamFacilities).costAfterFacility).toBe(88);
    expect(applyUpgradeCostFacilityModifiers("power", "B", 100, teamFacilities).costAfterFacility).toBe(100);
  });

  it("specialist wing also reduces facility upkeep", () => {
    const teamFacilities = facilities({
      training_center: { level: 5, enabled: true },
      specialist_wing: { level: 5, enabled: true, activeVariant: "agility_track" },
    });

    expect(calculateFacilityUpkeep(teamFacilities)).toBe(8.54);
  });

  it("scouting and analytics expose information quality without performance bonuses", () => {
    const teamFacilities = facilities({
      scouting_office: { level: 3, enabled: true },
      analytics_room: { level: 4, enabled: true },
    });

    expect(getScoutingConfidence(teamFacilities).level).toBe(3);
    expect(getAnalyticsForecastQuality(teamFacilities).level).toBe(4);
    expect(applyTrainingXpFacilityModifiers(100, teamFacilities).after).toBe(100);
  });

  it("facilities provide no direct attribute bonuses", () => {
    const source = FACILITY_CATALOG.map((entry) => `${entry.effectType} ${entry.effectDescription}`).join(" ");

    expect(source).not.toMatch(/attribute bonus|direct attribute|\\+\\d+ attribute/i);
  });
});
