/**
 * Team Cash / MW / Kader + Top-N teuerste Spieler für einen Save.
 * Usage: npx tsx scripts/show-team-mw-snapshot.ts --save-id <id> [--top 10]
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";
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

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const topN = Number(argValue("--top") ?? "10");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const teamById = new Map(gs.teams.map((team) => [team.teamId, team]));

  const teams = gs.teams
    .map((team) => {
      const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId);
      const mw = roster.reduce((sum, entry) => {
        const player = playerById.get(entry.playerId);
        return sum + (player?.displayMarketValue ?? player?.marketValue ?? entry.currentValue ?? 0);
      }, 0);
      return {
        code: team.shortCode ?? team.teamId,
        roster: roster.length,
        cash: round(team.cash ?? 0),
        mw: round(mw),
      };
    })
    .sort((left, right) => right.mw - left.mw);

  const leagueSumMw = round(teams.reduce((sum, team) => sum + team.mw, 0));
  const leagueAvgMw = round(leagueSumMw / Math.max(teams.length, 1));

  const topPlayers = gs.rosters
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      const team = teamById.get(entry.teamId);
      const mw = player?.displayMarketValue ?? player?.marketValue ?? entry.currentValue ?? 0;
      return {
        name: player?.name ?? entry.playerId,
        team: team?.shortCode ?? entry.teamId,
        mw: round(mw),
        rating: player?.rating ?? null,
      };
    })
    .sort((left, right) => right.mw - left.mw)
    .slice(0, topN);

  console.log(`Save: ${saveId}`);
  console.log(`Season: ${gs.season.id} · Matchday ${gs.season.currentMatchday ?? "?"}`);
  console.log(`Liga: MW Σ ${leagueSumMw} · Ø ${leagueAvgMw} · Kader Σ ${teams.reduce((s, t) => s + t.roster, 0)}`);
  console.log("");
  console.log("| Team | Kader | Cash | MW |");
  console.log("|---|---:|---:|---:|");
  for (const team of teams) {
    console.log(`| ${team.code} | ${team.roster} | ${team.cash} | ${team.mw} |`);
  }
  console.log("");
  console.log(`Top ${topN} teuerste Spieler (MW):`);
  console.log("| # | Spieler | Team | MW | Rating |");
  console.log("|---:|---|---|---:|---:|");
  topPlayers.forEach((player, index) => {
    console.log(`| ${index + 1} | ${player.name} | ${player.team} | ${player.mw} | ${player.rating ?? "—"} |`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
