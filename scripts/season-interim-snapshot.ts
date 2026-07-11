import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const saveId = argValue("--save-id") ?? persistence.getActiveSave()?.saveId ?? null;
  if (!saveId) throw new Error("Provide --save-id <id> or activate a save first.");

  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const seasonId = save.gameState.season.id;
  const phase = save.gameState.gamePhase ?? "?";
  const matchday = save.gameState.season.currentMatchday ?? "?";
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const transfers = save.gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
  const buyCount = transfers.filter((entry) => entry.transferType === "buy").length;
  const sellCount = transfers.filter((entry) => entry.transferType === "sell").length;
  const sourceCounts = new Map<string, number>();
  for (const entry of transfers) {
    const source = entry.source ?? "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const identityByTeamId = new Map(save.gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
  const rows = save.gameState.teams.map((team) => {
    const identity = identityByTeamId.get(team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const roster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const salary = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
    }, 0);
    const marketValue = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).marketValue ?? 0);
    }, 0);
    const teamTransfers = transfers.filter((entry) => entry.fromTeamId === team.teamId || entry.toTeamId === team.teamId);
    const buys = teamTransfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId).length;
    const sells = teamTransfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId).length;
    const rank = save.gameState.seasonState.standings?.[team.teamId]?.rank ?? null;
    return {
      shortCode: team.shortCode,
      rank,
      cash: round(team.cash ?? 0),
      marketValue: round(marketValue),
      salary: round(salary),
      roster: roster.length,
      playerMin,
      playerOpt,
      rosterLabel: `${roster.length}/${playerMin}/${playerOpt}`,
      buys,
      sells,
    };
  });

  rows.sort((left, right) => (left.rank ?? 99) - (right.rank ?? 99) || left.shortCode.localeCompare(right.shortCode));

  const totalCash = round(rows.reduce((sum, row) => sum + row.cash, 0));
  const totalMw = round(rows.reduce((sum, row) => sum + row.marketValue, 0));
  const neg = rows.filter((row) => row.cash < 0);
  const teamsAtMin = rows.filter((row) => row.roster >= row.playerMin).length;
  const teamsAtOpt = rows.filter((row) => row.roster >= row.playerOpt).length;

  console.log(`\n=== SEASON INTERIM SNAPSHOT ===`);
  console.log(`save: ${saveId}`);
  console.log(`season: ${seasonId} · phase: ${phase} · MD: ${matchday}`);
  console.log(
    `liga: Cash Σ ${totalCash} · MW Σ ${totalMw} · Kader ≥Min ${teamsAtMin}/${rows.length} · ≥Opt ${teamsAtOpt}/${rows.length} · Transfers ${buyCount}K/${sellCount}V`,
  );
  if (neg.length > 0) console.log(`WARN negative: ${neg.map((row) => `${row.shortCode}:${row.cash}`).join(", ")}`);
  if (sourceCounts.size > 0) {
    console.log(
      `quellen: ${[...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([source, count]) => `${source}:${count}`)
        .join(" | ")}`,
    );
  }
  console.log("Team · Rang · Kader(min/opt) · Cash · MW · Gehalt · K/V");
  for (const row of rows) {
    console.log(
      `${row.shortCode.padEnd(4)} · ${String(row.rank ?? "-").padStart(2)} · ${row.rosterLabel.padStart(11)} · ${String(row.cash).padStart(6)} · ${String(row.marketValue).padStart(6)} · ${String(row.salary).padStart(5)} · ${String(row.buys).padStart(2)}/${String(row.sells).padStart(2)}`,
    );
  }
}

main();
