import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { collectTeamFatigueInjuryMetrics, buildPlayerAvailabilityByPlayerId } from "@/lib/season/long-run-fatigue-collect";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Provide --save-id <id>");
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const availabilityByPlayerId = buildPlayerAvailabilityByPlayerId(gs);
  const standings = gs.seasonState.standings ?? {};
  const seasonId = gs.season.id;

  const injuryTotalByTeam = new Map<string, number>();
  for (const event of gs.seasonState.injuryEvents ?? []) {
    if (event.result !== "injured" || !event.teamId) continue;
    injuryTotalByTeam.set(event.teamId, (injuryTotalByTeam.get(event.teamId) ?? 0) + 1);
  }

  const rows = gs.teams.map((team) => {
    const roster = gs.rosters.filter((entry) => entry.teamId === team.teamId);
    const mw = roster.reduce((sum, entry) => {
      const player = playerById.get(entry.playerId);
      return sum + (player?.displayMarketValue ?? player?.marketValue ?? 0);
    }, 0);
    const metrics = collectTeamFatigueInjuryMetrics({
      gameState: gs,
      team,
      roster,
      playerById,
      seasonId,
      availabilityByPlayerId,
    });
    const injuryHistoryPlayers = roster.filter((entry) => {
      const player = playerById.get(entry.playerId);
      return (player?.injuryHistory?.length ?? 0) > 0;
    }).length;

    return {
      rank: standings[team.teamId]?.rank ?? 99,
      code: team.shortCode,
      roster: roster.length,
      cash: Math.round(team.cash ?? 0),
      mw: Math.round(mw),
      injS5: metrics.injuryEventsSeason,
      injTotal: injuryTotalByTeam.get(team.teamId) ?? 0,
      injNow: metrics.injuredNow,
      recovering: metrics.recoveringNow,
      injHist: injuryHistoryPlayers,
      fatigueAvg: metrics.fatigueAvg,
    };
  });

  rows.sort((left, right) => left.rank - right.rank);

  const lines = [
    `# Team-KPI-Tabelle · ${saveId}`,
    "",
    `Season: **${seasonId}** · Phase: **${gs.gamePhase ?? "?"}**`,
    "",
    "| Rang | Team | Kader | Cash | MW | Verletz. Saison | Verletz. ges. | Verletzt | Erholung | m. Historie | Ø Fatigue |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.code} | ${row.roster} | ${row.cash} | ${row.mw} | ${row.injS5} | ${row.injTotal} | ${row.injNow} | ${row.recovering} | ${row.injHist} | ${row.fatigueAvg} |`,
    );
  }

  const totals = {
    cash: rows.reduce((sum, row) => sum + row.cash, 0),
    mw: rows.reduce((sum, row) => sum + row.mw, 0),
    roster: rows.reduce((sum, row) => sum + row.roster, 0),
    injS5: rows.reduce((sum, row) => sum + row.injS5, 0),
    injTotal: rows.reduce((sum, row) => sum + row.injTotal, 0),
  };
  lines.push(
    "",
    `**Liga Σ:** Cash ${totals.cash} · MW ${totals.mw} · Kader ${totals.roster} (Ø ${(totals.roster / rows.length).toFixed(1)}) · Verletz. Saison ${totals.injS5} · Verletz. ges. ${totals.injTotal}`,
    "",
  );

  const markdown = `${lines.join("\n")}\n`;
  console.log(markdown);

  const outputPath = argValue("--output");
  if (outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, markdown, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
