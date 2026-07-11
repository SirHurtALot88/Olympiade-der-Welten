import { writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const saveId = process.argv[2] ?? "";
const outputDir = process.argv[3] ?? "";
if (!saveId || !outputDir) {
  console.error("Usage: tmp-draft-report.ts <saveId> <outputDir>");
  process.exit(1);
}

loadEnvConfig(path.resolve(__dirname, ".."));

async function main() {
const save = createPersistenceService().getSaveById(saveId);
if (!save) throw new Error(`Save missing: ${saveId}`);

const gs = save.gameState;
const seasonId = gs.season.id;
const buys = gs.transferHistory.filter((e) => e.transferType === "buy" && e.seasonId === seasonId);
const sells = gs.transferHistory.filter((e) => e.transferType === "sell" && e.seasonId === seasonId);
const totalSpent = buys.reduce((sum, e) => sum + (e.fee ?? e.marketValue ?? 0), 0);
const totalSellProceeds = sells.reduce((sum, e) => sum + (e.fee ?? e.marketValue ?? 0), 0);

const teamRows = gs.teams.map((team) => {
  const identity = gs.teamIdentities.find((entry) => entry.teamId === team.teamId);
  const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
  const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId).length;
  const teamBuys = buys.filter((entry) => entry.toTeamId === team.teamId);
  const teamSpent = teamBuys.reduce((sum, entry) => sum + (entry.fee ?? entry.marketValue ?? 0), 0);
  return {
    code: team.shortCode ?? team.teamId,
    roster,
    playerMin,
    playerOpt,
    gapToOpt: Math.max(playerOpt - roster, 0),
    cash: Math.round(team.cash ?? 0),
    buys: teamBuys.length,
    spent: Math.round(teamSpent),
    atMin: roster >= playerMin,
    atOpt: roster >= playerOpt,
  };
});

teamRows.sort((left, right) => right.gapToOpt - left.gapToOpt || left.code.localeCompare(right.code));

const sources = new Map<string, number>();
for (const entry of buys) {
  const key = entry.source ?? "unknown";
  sources.set(key, (sources.get(key) ?? 0) + 1);
}

const report = {
  saveId,
  seasonId,
  league: {
    rosterTotal: teamRows.reduce((sum, row) => sum + row.roster, 0),
    cashTotal: teamRows.reduce((sum, row) => sum + row.cash, 0),
    buys: buys.length,
    sells: sells.length,
    totalSpent: Math.round(totalSpent),
    totalSellProceeds: Math.round(totalSellProceeds),
    teamsAtMin: teamRows.filter((row) => row.atMin).length,
    teamsAtOpt: teamRows.filter((row) => row.atOpt).length,
    buySources: Object.fromEntries(sources),
  },
  teams: teamRows,
};

const md = [
  "# Draft Transfer Report",
  "",
  `- Save: \`${saveId}\``,
  `- Buys: **${report.league.buys}** · Sells: **${report.league.sells}** · Spent: **${report.league.totalSpent}M**`,
  `- Teams ≥ Min: **${report.league.teamsAtMin}/32** · Teams ≥ Opt: **${report.league.teamsAtOpt}/32**`,
  `- Liga Cash Σ: **${report.league.cashTotal}M** · Kader Σ: **${report.league.rosterTotal}**`,
  "",
  "## Teams unter Opt (sortiert nach Gap)",
  "",
  "| Team | Kader | Opt | Gap | Buys | Spent | Cash |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...teamRows
    .filter((row) => row.gapToOpt > 0)
    .map((row) => `| ${row.code} | ${row.roster} | ${row.playerOpt} | ${row.gapToOpt} | ${row.buys} | ${row.spent} | ${row.cash} |`),
  "",
  "## Buy Sources",
  "",
  ...Object.entries(report.league.buySources).map(([source, count]) => `- \`${source}\`: ${count}`),
].join("\n");

await writeFile(path.join(outputDir, "draft-transfer-report.json"), JSON.stringify(report, null, 2));
await writeFile(path.join(outputDir, "draft-transfer-report.md"), md);
console.log(JSON.stringify(report.league, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
