import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { collectTeamFatigueInjuryMetrics, buildPlayerAvailabilityByPlayerId } from "@/lib/season/long-run-fatigue-collect";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(v: number, d = 1) {
  return Number(v.toFixed(d));
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Provide --save-id");
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const snaps = [...(gs.seasonState.seasonSnapshots ?? [])].sort((a, b) =>
    a.seasonId.localeCompare(b.seasonId, undefined, { numeric: true }),
  );
  const seasons = snaps.map((s) => s.seasonId);
  if (seasons.length === 0) seasons.push(gs.season.id);

  console.log(`# Finance · Sponsor · Salary · Reha · ${saveId}\n`);

  for (const seasonId of seasons) {
    const factorWindow = getSeasonEconomyFactorWindow({
      saveId,
      seasonId,
      seasonState: gs.seasonState,
    });
    const salaryFactor = factorWindow[0]?.factor ?? null;
    console.log(`## ${seasonId} · Salary-Factor (aktuell): **${salaryFactor}**`);
    console.log(
      `Fenster: ${factorWindow.map((row) => `${row.seasonLabel}=${row.factor}`).join(" · ")}\n`,
    );

    const snap = snaps.find((s) => s.seasonId === seasonId);
    const rows = snap?.teamSnapshots ?? snap?.finalStandings ?? [];
    if (rows.length === 0) {
      console.log("(kein Snapshot)\n");
      continue;
    }

    let sumSponsor = 0;
    let sumSalary = 0;
    console.log("| Team | Sponsor Saison | Gehalt Σ | MW Ende | Kader |");
    console.log("|---|---:|---:|---:|---:|");
    for (const row of [...rows].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))) {
      const sponsor = row.sponsorSeason ?? row.sponsorTotal ?? 0;
      const salary = row.salaryEnd ?? row.salaryTotalEnd ?? 0;
      const mw = row.marketValueEnd ?? row.marketValueTotalEnd ?? 0;
      sumSponsor += sponsor;
      sumSalary += salary;
      console.log(
        `| ${row.teamCode} | ${round(sponsor)} | ${round(salary)} | ${round(mw)} | ${row.rosterEnd ?? row.rosterCountEnd ?? "?"} |`,
      );
    }
    console.log(`| **Σ Liga** | **${round(sumSponsor)}** | **${round(sumSalary)}** | — | — |\n`);
  }

  // S5 live facilities + injuries correlation
  console.log("## S5 Reha-Level + Verletzungen (Live)\n");
  console.log("| Team | Kader | Reha | Sco | Tra | Verletz. ges. | Ø Fatigue |");
  console.log("|---|---:|---:|---:|---:|---:|---:|");
  const playerById = new Map(gs.players.map((p) => [p.id, p]));
  const availability = buildPlayerAvailabilityByPlayerId(gs);
  const injuryTotal = new Map<string, number>();
  for (const ev of gs.seasonState.injuryEvents ?? []) {
    if (ev.result !== "injured" || !ev.teamId) continue;
    injuryTotal.set(ev.teamId, (injuryTotal.get(ev.teamId) ?? 0) + 1);
  }

  const teamRows = gs.teams.map((team) => {
    const roster = gs.rosters.filter((r) => r.teamId === team.teamId);
    const fac = getTeamFacilityState(gs, team.teamId);
    const metrics = collectTeamFatigueInjuryMetrics({
      gameState: gs,
      team,
      roster,
      playerById,
      seasonId: gs.season.id,
      availabilityByPlayerId: availability,
    });
    return {
      code: team.shortCode,
      roster: roster.length,
      rec: getFacilityLevel(fac, "recovery_center"),
      sco: getFacilityLevel(fac, "scouting_office"),
      tra: getFacilityLevel(fac, "training_center"),
      inj: injuryTotal.get(team.teamId) ?? 0,
      fatigue: metrics.fatigueAvg,
    };
  });
  teamRows.sort((a, b) => b.inj - a.inj);
  for (const r of teamRows) {
    console.log(`| ${r.code} | ${r.roster} | ${r.rec} | ${r.sco} | ${r.tra} | ${r.inj} | ${r.fatigue} |`);
  }

  // S-S MW audit
  console.log("\n## S-S Marktwert-Audit\n");
  const ss = gs.teams.find((t) => t.shortCode === "S-S")!;
  const ssRoster = gs.rosters.filter((r) => r.teamId === ss.teamId);
  let sumCurrent = 0;
  let sumPurchase = 0;
  let sumDisplay = 0;
  for (const r of ssRoster) {
    const p = playerById.get(r.playerId);
    sumCurrent += r.currentValue ?? 0;
    sumPurchase += r.purchasePrice ?? 0;
    sumDisplay += p?.displayMarketValue ?? p?.marketValue ?? 0;
  }
  const s1Snap = snaps.find((s) => s.seasonId === "season-1")?.teamSnapshots?.find((r) => r.teamCode === "S-S");
  console.log(`Draft purchasePrice Σ: ${round(sumPurchase)}`);
  console.log(`Live currentValue Σ: ${round(sumCurrent)}`);
  console.log(`Live displayMarketValue Σ: ${round(sumDisplay)}`);
  console.log(`S1 Snapshot marketValueEnd: ${s1Snap?.marketValueEnd ?? "?"}`);

  // Profit sells S2-S5 for cash-poor teams
  console.log("\n## Verkäufe mit Gewinn (S2–S5, Cash ≤20 am S5-Ende)\n");
  const poorTeams = new Set(gs.teams.filter((t) => (t.cash ?? 0) <= 20).map((t) => t.teamId));
  for (const teamId of poorTeams) {
    const team = gs.teams.find((t) => t.teamId === teamId)!;
    const sells = gs.transferHistory.filter(
      (t) => t.fromTeamId === teamId && t.transferType === "sell" && (t.seasonId ?? "").match(/season-[2-5]/),
    );
    if (sells.length === 0) continue;
    const profitSells = sells.filter((t) => {
      const p = playerById.get(t.playerId);
      const mv = p?.displayMarketValue ?? p?.marketValue ?? 0;
      return (t.fee ?? 0) > mv * 0.95;
    });
    console.log(
      `${team.shortCode}: ${sells.length} Verkäufe, ${profitSells.length} mit Fee≈MV, FeeΣ=${round(sells.reduce((s, t) => s + (t.fee ?? 0), 0))}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
