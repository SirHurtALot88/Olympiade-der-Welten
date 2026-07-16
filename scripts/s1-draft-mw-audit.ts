import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[s1-draft-mw-audit] ${message}`);
}

function rosterMarketValues(gameState: GameState, teamId: string): number[] {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return 0;
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      return economy.marketValue ?? player.displayMarketValue ?? player.marketValue ?? 0;
    })
    .filter((value) => value > 0)
    .sort((left, right) => right - left);
}

type BracketTier = ReturnType<typeof classifyMarketBracket>;

function bracketHistogram(values: number[], brackets: LeagueMarketBrackets) {
  const hist: Record<BracketTier, number> = {
    Superstar: 0,
    Star: 0,
    Core: 0,
    Depth: 0,
    Backup: 0,
    Reserve: 0,
  };
  for (const value of values) {
    hist[classifyMarketBracket(value, brackets)] += 1;
  }
  return hist;
}

/**
 * "Cliff" = mehrere teure Spieler (Core+, MW>=Core-Floor) und gleichzeitig KEINE
 * Mittelschicht (Depth/Backup), nur noch Reserve-Müll darunter.
 */
function analyzeCliff(values: number[], brackets: LeagueMarketBrackets) {
  const expensive = values.filter((value) => value + 0.01 >= brackets.core.floorMw).length; // >=30
  const midTier = values.filter(
    (value) => value + 0.01 >= brackets.backup.floorMw && value + 0.01 < brackets.core.floorMw,
  ).length; // 12..30
  const cheap = values.filter((value) => value + 0.01 < brackets.backup.floorMw).length; // <12
  const cliff = expensive >= 3 && midTier === 0 && cheap >= 2;
  return { expensive, midTier, cheap, cliff };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const persistence = createPersistenceService();
  const label = process.env.OLY_S1_MW_LABEL ?? "baseline";
  const s1Steps = Number(process.env.OLY_S1_STEPS ?? "16");
  const outputDir =
    process.env.OLY_S1_MW_OUTPUT_DIR ??
    path.join(PROJECT_ROOT, "outputs", `s1-draft-mw-${label}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
  await mkdir(outputDir, { recursive: true });
  log(`Label=${label} steps/team=${s1Steps} → ${outputDir}`);

  const fresh = persistence.createFreshSeasonOneSave({ name: `S1 MW Audit ${label} ${new Date().toISOString()}` });
  log(`Fresh S1 save: ${fresh.saveId}`);

  const preview = await runAiPicksExecutePreview(
    {
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId: fresh.gameState.season.id,
      dryRun: false,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: s1Steps,
      runMode: "season1_optimum_execute",
      draftSeed: `s1-mw-audit:${label}:${fresh.saveId}`,
    },
    persistence,
  );
  log(
    `S1 draft: planned=${preview.globalExecution.plannedPickCount} applied=${preview.globalExecution.appliedPickCount} gate=${preview.qualityGate.passed ? "pass" : "fail"}`,
  );

  const save = persistence.getSaveById(fresh.saveId);
  if (!save) throw new Error("Save missing after S1 draft");
  const gameState = save.gameState;

  const allMw = gameState.teams.flatMap((team) => rosterMarketValues(gameState, team.teamId));
  const brackets = buildLeagueMarketBrackets(gameState.players.map((player) => player.marketValue ?? null));

  const detailCodes = (process.env.OLY_S1_MW_DETAIL ?? "A-A,H-R,T-T,M-M,C-C").split(",").map((code) => code.trim().toUpperCase());

  const teamRows = gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const values = rosterMarketValues(gameState, team.teamId);
    const cliff = analyzeCliff(values, brackets);
    const hist = bracketHistogram(values, brackets);
    return {
      teamCode: team.shortCode ?? team.teamId,
      teamId: team.teamId,
      budget: round(team.budget ?? 0),
      cashAfter: round(team.cash ?? 0),
      rosterAfter: values.length,
      playerMin,
      playerOpt,
      reachedMin: values.length >= playerMin,
      reachedOpt: values.length >= playerOpt,
      maxMw: values.length > 0 ? round(values[0]!) : 0,
      minMw: values.length > 0 ? round(values[values.length - 1]!) : 0,
      medianMw: median(values),
      expensiveGe30: cliff.expensive,
      midTier12to30: cliff.midTier,
      cheapLt12: cliff.cheap,
      cliff: cliff.cliff,
      hist: `S*${hist.Superstar}|S${hist.Star}|C${hist.Core}|D${hist.Depth}|B${hist.Backup}|R${hist.Reserve}`,
      mwSorted: values.map((value) => round(value)).join(" "),
    };
  });

  const cliffTeams = teamRows.filter((row) => row.cliff);
  const minReached = teamRows.filter((row) => row.reachedMin).length;
  const optReached = teamRows.filter((row) => row.reachedOpt).length;

  const summaryLines = [
    `# S1 Draft MW-Verteilung Audit (${label})`,
    "",
    `- Save: \`${fresh.saveId}\` · steps/team=${s1Steps}`,
    `- Draft applied: ${preview.globalExecution.appliedPickCount}`,
    `- Teams >= Min: ${minReached}/${teamRows.length} · >= Opt: ${optReached}/${teamRows.length}`,
    `- Bracket-Floors: Core>=${brackets.core.floorMw} Depth>=${brackets.depth.floorMw} Backup>=${brackets.backup.floorMw} Reserve<${brackets.backup.floorMw}`,
    `- **CLIFF-Teams (>=3 teuer, 0 Mittelschicht, >=2 billig): ${cliffTeams.length}/${teamRows.length}**`,
    cliffTeams.length > 0 ? `  - ${cliffTeams.map((row) => row.teamCode).join(", ")}` : "  - (keine)",
    `- Liga MW gesamt: median=${median(allMw)} max=${round(Math.max(...allMw))}`,
    "",
    "## Detail-Teams",
    "",
    ...detailCodes.flatMap((code) => {
      const row = teamRows.find((entry) => String(entry.teamCode).toUpperCase() === code);
      if (!row) return [`- ${code}: n/a`];
      return [
        `- **${code}** (budget ${row.budget}, cash ${row.cashAfter}) roster ${row.rosterAfter}/${row.playerOpt} · cliff=${row.cliff ? "JA" : "nein"}`,
        `  - brackets ${row.hist} · teuer>=30:${row.expensiveGe30} mid12-30:${row.midTier12to30} billig<12:${row.cheapLt12}`,
        `  - MW: ${row.mwSorted}`,
      ];
    }),
    "",
    "## Alle Teams (MW absteigend)",
    "",
    ...teamRows
      .slice()
      .sort((left, right) => Number(right.cliff) - Number(left.cliff) || right.expensiveGe30 - left.expensiveGe30)
      .map(
        (row) =>
          `- ${row.cliff ? "CLIFF " : "      "}${row.teamCode}: ${row.hist} | teuer ${row.expensiveGe30} / mid ${row.midTier12to30} / billig ${row.cheapLt12} | MW ${row.mwSorted}`,
      ),
  ];

  await writeFile(path.join(outputDir, "s1-mw-summary.md"), summaryLines.join("\n"));
  await writeFile(
    path.join(outputDir, "s1-mw-kpi.json"),
    JSON.stringify(
      {
        label,
        saveId: fresh.saveId,
        s1Steps,
        draftApplied: preview.globalExecution.appliedPickCount,
        minReached,
        optReached,
        cliffTeamCount: cliffTeams.length,
        cliffTeams: cliffTeams.map((row) => row.teamCode),
        brackets: {
          core: brackets.core.floorMw,
          depth: brackets.depth.floorMw,
          backup: brackets.backup.floorMw,
        },
        teamRows,
      },
      null,
      2,
    ),
  );

  log(`Done. Cliff teams: ${cliffTeams.length}/${teamRows.length} → ${outputDir}`);
  console.log(`CLIFF ${cliffTeams.length}/${teamRows.length} :: ${cliffTeams.map((row) => row.teamCode).join(",") || "none"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
