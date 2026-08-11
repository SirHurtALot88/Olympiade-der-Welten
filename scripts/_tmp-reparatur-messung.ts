import Database from "better-sqlite3";

import { FACILITY_CATALOG_BY_ID, getFacilityLevelDefinition, type FacilityId } from "../lib/facilities/facility-catalog";
import {
  calculateFacilityMaintenanceCost,
  getFacilityEfficiencyPct,
  getFacilityConditionStatus,
  resolveFacilitySeasonDecay,
} from "../lib/facilities/facility-condition";

const SQ = process.env.OLY_APP_SQLITE_PATH!;
const SAVE = "new-game-1785823388048-1hf25q";
const db = new Database(SQ, { readonly: true });

const seasonState = JSON.parse(
  (db.prepare("select payload_json from season_states where save_id = ?").get(SAVE) as any).payload_json,
);
const teams = (db.prepare("select payload_json from teams where save_id = ?").all(SAVE) as any[]).map((r) =>
  JSON.parse(r.payload_json),
);
const identities = (db.prepare("select payload_json from team_identities where save_id = ?").all(SAVE) as any[]).map(
  (r) => JSON.parse(r.payload_json),
);
const season = JSON.parse((db.prepare("select payload_json from seasons where save_id = ?").get(SAVE) as any).payload_json);

console.log("season:", season.id ?? season);

const teamById = new Map(teams.map((t: any) => [t.teamId, t]));
const identityById = new Map(identities.map((t: any) => [t.teamId, t]));

// --- Gebäudebestand
const tf = seasonState.teamFacilities ?? {};
console.log("\n=== Gebäudebestand ===");
const rows: any[] = [];
for (const [teamId, coll] of Object.entries<any>(tf)) {
  for (const [fid, rec] of Object.entries<any>(coll.facilities ?? {})) {
    if ((rec?.level ?? 0) <= 0) continue;
    const cond = rec.conditionPct ?? 100;
    const def = getFacilityLevelDefinition(fid as FacilityId, rec.level);
    const repairCost = calculateFacilityMaintenanceCost({ facilityId: fid as FacilityId, level: rec.level, conditionPct: cond });
    rows.push({
      team: (teamById.get(teamId) as any)?.shortCode ?? teamId,
      cash: (teamById.get(teamId) as any)?.cash,
      fid,
      level: rec.level,
      cond,
      eff: getFacilityEfficiencyPct(cond),
      status: getFacilityConditionStatus(cond),
      upkeep: def?.seasonUpkeep,
      income: def?.seasonIncome ?? 0,
      repairCost,
      enabled: rec.enabled,
      lastPaid: rec.lastPaidSeasonId,
    });
  }
}
console.table(rows);

// --- Cash-Verteilung
const cashes = teams.map((t: any) => t.cash).sort((a: number, b: number) => a - b);
console.log("\nCash: min", cashes[0], "median", cashes[Math.floor(cashes.length / 2)], "max", cashes.at(-1), "n=", cashes.length, "auf 0:", cashes.filter((c: number) => c === 0).length);

// --- Kredite
const loans = seasonState.loans ?? [];
const active = loans.filter((l: any) => l.status === "active");
console.log("\nKredite: gesamt", loans.length, "aktiv", active.length, "Restschuld", active.reduce((s: number, l: any) => s + l.principalOutstanding, 0).toFixed(1));
const byStatus: Record<string, number> = {};
for (const l of loans) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
console.log("Status:", byStatus);
const rates = active.map((l: any) => l.interestRatePerSeason);
console.log("Zinssätze aktiv: min", Math.min(...rates), "max", Math.max(...rates));

// --- Identities der Gebäude-Besitzer
console.log("\n=== Identity (ambition/finances) der Gebäude-Besitzer ===");
for (const teamId of Object.keys(tf)) {
  const hasBuilding = Object.values<any>(tf[teamId]?.facilities ?? {}).some((r) => (r?.level ?? 0) > 0);
  if (!hasBuilding) continue;
  const id = identityById.get(teamId) as any;
  const t = teamById.get(teamId) as any;
  console.log(t?.shortCode, "cash", t?.cash, "ambition", id?.ambition, "finances", id?.finances);
}

// --- Verschleiß-Streuung Beispielrechnung für nächste Saison
console.log("\n=== Beispiel: Verschleiß nächste Saison (bezahlt) je Gebäude ===");
for (const r of rows.slice(0, 12)) {
  const teamId = [...teamById.values()].find((t: any) => t.shortCode === r.team)?.teamId;
  const seed = `${season.id}:${teamId}:${r.fid}`;
  console.log(r.team, r.fid, "decay:", resolveFacilitySeasonDecay(true, seed));
}

// --- Repair cost per condition point (Stufe-1-Gebäude)
console.log("\n=== Reparaturkosten je Stufe-1-Gebäude (voll kaputt -> 100) ===");
for (const entry of Object.values(FACILITY_CATALOG_BY_ID)) {
  const def = getFacilityLevelDefinition(entry.facilityId, 1);
  const base = Math.max(def?.upgradeCost ?? 0, def?.seasonUpkeep ?? 0);
  console.log(
    entry.facilityId,
    "L1 base", base,
    "| Kosten je fehlendem Punkt:", ((base * 0.45) / 100).toFixed(3),
    "| Reparatur bei 66:", calculateFacilityMaintenanceCost({ facilityId: entry.facilityId, level: 1, conditionPct: 66 }),
    "| bei 49:", calculateFacilityMaintenanceCost({ facilityId: entry.facilityId, level: 1, conditionPct: 49 }),
    "| bei 0:", calculateFacilityMaintenanceCost({ facilityId: entry.facilityId, level: 1, conditionPct: 0 }),
  );
}
