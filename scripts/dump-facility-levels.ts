import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityEfficiency, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id") ?? "fresh-season-1-1782677167840";
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const events = gs.seasonState.facilityEvents ?? [];

  const bySource: Record<string, number> = {};
  for (const event of events) {
    bySource[event.source ?? "?"] = (bySource[event.source ?? "?"] ?? 0) + 1;
  }

  const upgrades = events.filter(
    (event) =>
      event.source === "facility_upgraded" ||
      event.source === "facility_built" ||
      (event.nextLevel ?? 0) > (event.previousLevel ?? 0),
  );
  const maintenance = events.filter(
    (event) => event.source === "facility_maintenance" || event.source?.includes("maintenance"),
  );
  const upkeep = events.filter(
    (event) => event.source === "facility_upkeep_paid" || event.source === "facility_upkeep_unpaid",
  );

  console.log("=== SAVE ===", saveId, gs.season.id, gs.gamePhase);
  console.log("=== FACILITY EVENTS BY SOURCE ===");
  for (const [key, value] of Object.entries(bySource).sort((left, right) => right[1] - left[1])) {
    console.log(`${key}: ${value}`);
  }
  console.log("Total events:", events.length);
  console.log("Upgrades (level up):", upgrades.length);
  console.log("Maintenance:", maintenance.length);
  console.log("Upkeep paid/unpaid:", upkeep.length);

  const facilityIds = FACILITY_CATALOG.map((facility) => facility.facilityId);
  const shortIds = facilityIds.map((id) => id.replace(/_center|_office|_room|_upgrade|_shop|_wing/g, "").slice(0, 4));

  console.log("\n=== END BUILDING LEVELS (all teams) ===");
  console.log(["Team", "Cash", ...shortIds, "cond%", "eff%"].join("\t"));

  const teams = [...gs.teams].sort((left, right) => left.shortCode.localeCompare(right.shortCode));
  let allZeroTeams = 0;
  const levelTotals = Object.fromEntries(facilityIds.map((id) => [id, 0])) as Record<string, number>;

  for (const team of teams) {
    const facilities = getTeamFacilityState(gs, team.teamId);
    const levels = facilityIds.map((facilityId) => {
      const level = facilities.facilities[facilityId]?.level ?? 0;
      levelTotals[facilityId] += level;
      return level;
    });
    const conditions: number[] = [];
    const efficiencies: number[] = [];
    for (const facilityId of facilityIds) {
      const efficiency = getFacilityEfficiency(facilities, facilityId);
      if ((facilities.facilities[facilityId]?.level ?? 0) > 0) {
        conditions.push(efficiency.conditionPct);
        efficiencies.push(efficiency.efficiencyPct);
      }
    }
    const sumLevel = levels.reduce((sum, level) => sum + level, 0);
    if (sumLevel === 0) allZeroTeams += 1;
    const condAvg = conditions.length ? Math.round(conditions.reduce((sum, value) => sum + value, 0) / conditions.length) : "-";
    const effAvg = efficiencies.length ? Math.round(efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length) : "-";
    console.log([team.shortCode, Math.round(team.cash ?? 0), ...levels, condAvg, effAvg].join("\t"));
  }

  console.log("\n=== LEAGUE TOTALS (sum levels across teams) ===");
  for (const facilityId of facilityIds) {
    console.log(`${facilityId}: ${levelTotals[facilityId]} (avg ${(levelTotals[facilityId] / teams.length).toFixed(2)}/team)`);
  }
  console.log(`\nTeams with ALL buildings level 0: ${allZeroTeams} / ${teams.length}`);
  const rehaL1Plus = teams.filter((team) => {
    const facilities = getTeamFacilityState(gs, team.teamId);
    return (facilities.facilities.recovery_center?.level ?? 0) >= 1;
  }).length;
  console.log(`Reha L1+ teams: ${rehaL1Plus} / ${teams.length}`);

  const countBySeason = (rows: typeof events) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const seasonId = row.seasonId ?? "?";
      map.set(seasonId, (map.get(seasonId) ?? 0) + 1);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  };

  console.log("\n=== UPGRADES BY SEASON ===");
  for (const [seasonId, count] of countBySeason(upgrades)) console.log(seasonId, count);
  console.log("\n=== MAINTENANCE BY SEASON ===");
  for (const [seasonId, count] of countBySeason(maintenance)) console.log(seasonId, count);
  console.log("\n=== UPKEEP PAID BY SEASON ===");
  for (const [seasonId, count] of countBySeason(upkeep.filter((event) => event.source === "facility_upkeep_paid"))) {
    console.log(seasonId, count);
  }

  console.log("\n=== DETAIL: built/upgraded events (sample) ===");
  for (const event of upgrades.slice(0, 20)) {
    const team = gs.teams.find((entry) => entry.teamId === event.teamId);
    console.log(
      `${event.seasonId} ${team?.shortCode ?? event.teamId} ${event.facilityId} ${event.previousLevel}->${event.nextLevel} ${event.source}`,
    );
  }
  if (upgrades.length > 20) console.log(`... +${upgrades.length - 20} more`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
