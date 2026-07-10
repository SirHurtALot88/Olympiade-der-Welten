import { writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { getPlayerClassColor } from "@/lib/lineups/legacy-lineup-modifiers";
import type { FormCardColor, GameState, Player } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const COLOR_LABEL: Record<FormCardColor, string> = {
  red: "POW",
  green: "SPE",
  blue: "MEN",
  yellow: "SOC",
};

function getPlayer(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId) ?? null;
}

function getPlayerAxis(player: Player): "pow" | "spe" | "men" | "soc" {
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  return [...entries].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pow";
}

async function main() {
  loadEnvConfig(path.resolve(__dirname, ".."));
  const saveId = process.argv[2] ?? "fresh-season-1-1783314253878";
  const outputDir =
    process.argv[3] ?? path.join(__dirname, "..", "outputs", "s1-draft-audit-2026-07-06T05-04-13");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save missing: ${saveId}`);
  const gs = save.gameState;
  const seasonId = gs.season.id;

  const buys = gs.transferHistory
    .filter((entry) => entry.transferType === "buy" && entry.seasonId === seasonId)
    .sort((left, right) => left.happenedAt.localeCompare(right.happenedAt));

  const leagueBrackets = buildLeagueMarketBrackets(
    buys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0),
  );

  const leagueFormByClassColor: Record<FormCardColor, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
  const leagueFormByTopAxis: Record<"pow" | "spe" | "men" | "soc", number> = { pow: 0, spe: 0, men: 0, soc: 0 };
  const leagueBracket = new Map<string, number>();

  const teamRows = gs.teams.map((team) => {
    const identity = gs.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt, playerMax } = deriveRosterTargets(team, identity);
    const gm = getTeamGeneralManager(gs, team.teamId);
    const teamBuys = buys.filter((entry) => entry.toTeamId === team.teamId);

    const formByClassColor: Record<FormCardColor, number> = { red: 0, green: 0, blue: 0, yellow: 0 };
    const formByTopAxis: Record<"pow" | "spe" | "men" | "soc", number> = { pow: 0, spe: 0, men: 0, soc: 0 };
    const bracketCounts = new Map<string, number>();
    const pickDetails: Array<{
      name: string;
      className: string;
      formColor: string;
      topAxis: string;
      price: number;
      bracket: string;
    }> = [];

    for (const entry of teamBuys) {
      const player = getPlayer(gs, entry.playerId);
      if (!player) continue;
      const classColor = getPlayerClassColor(player);
      const topAxis = getPlayerAxis(player);
      const price = entry.fee ?? entry.marketValue ?? 0;
      const bracket = classifyMarketBracket(price, leagueBrackets);

      if (classColor) {
        formByClassColor[classColor] += 1;
        leagueFormByClassColor[classColor] += 1;
      }
      formByTopAxis[topAxis] += 1;
      leagueFormByTopAxis[topAxis] += 1;
      bracketCounts.set(bracket, (bracketCounts.get(bracket) ?? 0) + 1);
      leagueBracket.set(bracket, (leagueBracket.get(bracket) ?? 0) + 1);

      pickDetails.push({
        name: player.name,
        className: player.className,
        formColor: classColor ? COLOR_LABEL[classColor] : "?",
        topAxis: topAxis.toUpperCase(),
        price: Math.round(price * 10) / 10,
        bracket,
      });
    }

    const maxFormColor = Math.max(...Object.values(formByClassColor));
    const spent = Math.round(teamBuys.reduce((sum, entry) => sum + (entry.fee ?? entry.marketValue ?? 0), 0));

    return {
      code: team.shortCode ?? team.teamId,
      roster: teamBuys.length,
      playerMin,
      playerOpt,
      playerMax,
      cash: Math.round(team.cash ?? 0),
      spent,
      gmName: gm?.profile.name ?? null,
      gmArchetype: gm?.profile.archetype ?? null,
      starPriority: gm?.profile.bias?.starPriority ?? null,
      eliteSmall: gm?.profile.bias?.eliteSmallRosterPreference ?? null,
      depthPref: gm?.profile.bias?.rosterDepthPreference ?? null,
      formByClassColor,
      formByTopAxis,
      maxFormColor,
      bracketCounts: Object.fromEntries(bracketCounts),
      stars: bracketCounts.get("Star") ?? 0,
      superstars: bracketCounts.get("Superstar") ?? 0,
      pickDetails,
    };
  });

  teamRows.sort((left, right) => left.code.localeCompare(right.code));

  const focusCodes = ["W-W", "T-T", "B-P", "M-M", "P-S"];
  const focusTeams = teamRows.filter((row) => focusCodes.includes(row.code));

  const md = [
    "# Formkarten- & Bracket-Audit (S1 Draft)",
    "",
    `- Save: \`${saveId}\` · ${buys.length} Draft-Buys`,
    "",
    "## Liga: Formkarten nach Klassen-Farbe (= Formkarte im Spiel)",
    "",
    "| Farbe | Achse | Picks | Anteil |",
    "|---|---|---:|---:|",
    ...(["red", "green", "blue", "yellow"] as FormCardColor[]).map((color) => {
      const count = leagueFormByClassColor[color];
      const pct = Math.round((count / buys.length) * 1000) / 10;
      return `| ${color} | ${COLOR_LABEL[color]} | ${count} | ${pct}% |`;
    }),
    "",
    "## Liga: Top-Core-Stat-Achse der gepickten Spieler",
    "",
    "| Achse | Picks | Anteil |",
    "|---|---:|---:|",
    ...(["pow", "spe", "men", "soc"] as const).map((axis) => {
      const count = leagueFormByTopAxis[axis];
      const pct = Math.round((count / buys.length) * 1000) / 10;
      return `| ${axis.toUpperCase()} | ${count} | ${pct}% |`;
    }),
    "",
    "## Liga: Bracket-Verteilung",
    "",
    ...[...leagueBracket.entries()].map(([tier, count]) => `- ${tier}: ${count}`),
    "",
    "## Teams mit ≥6 gleicher Formkarten-Farbe (Klassen-Mapping)",
    "",
    "| Team | Max | POW | SPE | MEN | SOC | GM |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...teamRows
      .filter((row) => row.maxFormColor >= 6)
      .sort((left, right) => right.maxFormColor - left.maxFormColor)
      .map(
        (row) =>
          `| ${row.code} | ${row.maxFormColor} | ${row.formByClassColor.red} | ${row.formByClassColor.green} | ${row.formByClassColor.blue} | ${row.formByClassColor.yellow} | ${row.gmName ?? "—"} |`,
      ),
    "",
    "## Formkarten pro Team (alle 32)",
    "",
    "| Team | K | POW | SPE | MEN | SOC | ★ | ★★ | Cash | Spent | GM |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...teamRows.map(
      (row) =>
        `| ${row.code} | ${row.roster} | ${row.formByClassColor.red} | ${row.formByClassColor.green} | ${row.formByClassColor.blue} | ${row.formByClassColor.yellow} | ${row.stars} | ${row.superstars} | ${row.cash} | ${row.spent} | ${row.gmName ?? "—"} |`,
    ),
    "",
    "## Fokus-Teams Detail",
    "",
  ];

  for (const row of focusTeams) {
    md.push(
      `### ${row.code} — GM: ${row.gmName} (${row.gmArchetype}, star=${row.starPriority}, elite=${row.eliteSmall}, depth=${row.depthPref})`,
      `- Opt ${row.playerOpt} / Max ${row.playerMax} · ${row.roster} picks · ${row.spent}M spent · ${row.cash}M cash`,
      "",
      "| # | Spieler | Klasse | Form | Axis | Preis | Bracket |",
      "|---:|---|---|---|---|---:|---|",
      ...row.pickDetails.map(
        (pick, index) =>
          `| ${index + 1} | ${pick.name} | ${pick.className} | ${pick.formColor} | ${pick.topAxis} | ${pick.price} | ${pick.bracket} |`,
      ),
      "",
    );
  }

  md.push(
    "## Steps-Cap Hinweis",
    "",
    "- `s1-draft-fresh-audit.ts` default: **10 steps/team**",
    "- `runAiPicksExecutePreview` default season1: **14**, hard cap: **16**",
    "- `buildTeamEntry` maxSteps: **min(steps, playerMax−roster, 16)**",
    "",
  );

  await writeFile(path.join(outputDir, "formcolor-bracket-audit.md"), md.join("\n"));
  await writeFile(
    path.join(outputDir, "formcolor-bracket-audit.json"),
    JSON.stringify({ leagueFormByClassColor, leagueFormByTopAxis, leagueBracket: Object.fromEntries(leagueBracket), teamRows }, null, 2),
  );
  console.log(md.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
