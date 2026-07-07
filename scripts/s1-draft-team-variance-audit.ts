/**
 * Per-team S1 draft variance audit: team philosophy, GM archetype, buy brackets, spread metrics.
 *
 * Usage: node --import tsx scripts/s1-draft-team-variance-audit.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { runCanonicalSeasonOneBootstrap } from "@/lib/season/long-run-canonical";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function stddev(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return round(Math.sqrt(variance), 3);
}

function emptyBracketCounts(): Record<MarketBracketTierLabel, number> {
  return { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
}

type TeamAuditRow = {
  teamCode: string;
  budget: number;
  gmArchetype: string;
  gmLabel: string;
  roster: number;
  playerMin: number;
  playerOpt: number;
  cash: number;
  sumMw: number;
  buys: number;
  brackets: Record<MarketBracketTierLabel, number>;
  starBuys: number;
  ssBuys: number;
  coreBuys: number;
  depthBuys: number;
  backupBuys: number;
};

function countDistribution(values: number[]) {
  const map = new Map<number, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((left, right) => left[0] - right[0]));
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  getDatabase();

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `s1-team-variance-${timestamp}`);
  await mkdir(outputDir, { recursive: true });

  const persistence = createPersistenceService();
  let fresh = persistence.createFreshSeasonOneSave({
    name: `S1 Team Variance Audit ${timestamp}`,
  });

  const draftStarted = Date.now();
  const bootstrap = await runCanonicalSeasonOneBootstrap(fresh, persistence);
  fresh = bootstrap.save;
  const draftDurationMs = Date.now() - draftStarted;

  const save = persistence.getSaveById(fresh.saveId);
  if (!save) throw new Error("Save missing after draft");

  const draftBuys = save.gameState.transferHistory.filter(
    (entry) => entry.seasonId === "season-1" && entry.transferType === "buy",
  );
  const buyPrices = draftBuys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0);
  const leagueBrackets = buildLeagueMarketBrackets(buyPrices);

  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const teamRows: TeamAuditRow[] = [];

  for (const team of save.gameState.teams) {
    const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const gm = getTeamGeneralManager(save.gameState, team.teamId);
    const teamCode = team.shortCode ?? team.teamId;
    const teamBuys = draftBuys.filter((entry) => entry.toTeamId === team.teamId);
    const brackets = emptyBracketCounts();
    for (const buy of teamBuys) {
      const price = buy.fee ?? buy.marketValue ?? 0;
      const tier = classifyMarketBracket(price, leagueBrackets);
      brackets[tier] += 1;
    }
    const rosterEntries = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    let sumMw = 0;
    for (const entry of rosterEntries) {
      const player = playerById.get(entry.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      sumMw += economy.marketValue ?? 0;
    }

    teamRows.push({
      teamCode,
      budget: round(team.budget ?? team.cash ?? 0),
      gmArchetype: gm?.profile?.archetype ?? "none",
      gmLabel: gm?.profile?.label ?? gm?.profile?.name ?? "—",
      roster: rosterEntries.length,
      playerMin,
      playerOpt,
      cash: round(team.cash ?? 0),
      sumMw: round(sumMw),
      buys: teamBuys.length,
      brackets,
      starBuys: brackets.Star,
      ssBuys: brackets.Superstar,
      coreBuys: brackets.Core,
      depthBuys: brackets.Depth,
      backupBuys: brackets.Backup + brackets.Reserve,
    });
  }

  teamRows.sort((left, right) => left.teamCode.localeCompare(right.teamCode));

  const starCounts = teamRows.map((row) => row.starBuys);
  const ssCounts = teamRows.map((row) => row.ssBuys);
  const coreCounts = teamRows.map((row) => row.coreBuys);
  const depthCounts = teamRows.map((row) => row.depthBuys);
  const backupCounts = teamRows.map((row) => row.backupBuys);

  const gmGroups = new Map<string, TeamAuditRow[]>();
  for (const row of teamRows) {
    const bucket = gmGroups.get(row.gmArchetype) ?? [];
    bucket.push(row);
    gmGroups.set(row.gmArchetype, bucket);
  }

  const gmSummary = [...gmGroups.entries()]
    .map(([archetype, rows]) => ({
      archetype,
      teams: rows.length,
      avgStar: round(rows.reduce((sum, row) => sum + row.starBuys, 0) / rows.length, 2),
      avgCore: round(rows.reduce((sum, row) => sum + row.coreBuys, 0) / rows.length, 2),
      avgDepth: round(rows.reduce((sum, row) => sum + row.depthBuys, 0) / rows.length, 2),
      avgBackup: round(rows.reduce((sum, row) => sum + row.backupBuys, 0) / rows.length, 2),
    }))
    .sort((left, right) => right.teams - left.teams);

  const mm = teamRows.find((row) => row.teamCode === "M-M");
  const rr = teamRows.find((row) => row.teamCode === "R-R");
  const tt = teamRows.find((row) => row.teamCode === "T-T");

  let teamsAtMin = 0;
  let teamsAtOpt = 0;
  for (const row of teamRows) {
    if (row.roster >= row.playerMin) teamsAtMin += 1;
    if (row.roster >= row.playerOpt) teamsAtOpt += 1;
  }

  const spread = {
    starDistribution: countDistribution(starCounts),
    ssDistribution: countDistribution(ssCounts),
    starStddev: stddev(starCounts),
    coreStddev: stddev(coreCounts),
    depthStddev: stddev(depthCounts),
    backupStddev: stddev(backupCounts),
    teamsWith0Stars: starCounts.filter((value) => value === 0).length,
    teamsWith1PlusStars: starCounts.filter((value) => value >= 1).length,
    teamsWith2PlusStars: starCounts.filter((value) => value >= 2).length,
    teamsWithSs: ssCounts.filter((value) => value >= 1).length,
  };

  const variancePass =
    spread.teamsWith0Stars >= 8 &&
    spread.teamsWith1PlusStars >= 4 &&
    spread.teamsWith2PlusStars <= 12 &&
    spread.starStddev > 0.25 &&
    teamsAtMin === 32;

  const payload = {
    saveId: save.saveId,
    draftDurationSec: Math.round(draftDurationMs / 1000),
    teamsAtMin,
    teamsAtOpt,
    spread,
    gmSummary,
    compare: { "M-M": mm ?? null, "R-R": rr ?? null, "T-T": tt ?? null },
    teamRows,
    variancePass,
    blockers: bootstrap.blockers,
  };

  await writeFile(path.join(outputDir, "variance-audit.json"), JSON.stringify(payload, null, 2));

  const tableHeader =
    "| Team | Budget | GM | Buys | SS | Star | Core | Depth | Backup | Cash | MW | Opt |";
  const tableSep = "|------|--------|----|------|----|------|------|-------|--------|------|-----|-----|";
  const tableRows = teamRows.map(
    (row) =>
      `| ${row.teamCode} | ${row.budget} | ${row.gmArchetype} | ${row.buys} | ${row.ssBuys} | ${row.starBuys} | ${row.coreBuys} | ${row.depthBuys} | ${row.backupBuys} | ${row.cash} | ${row.sumMw} | ${row.roster}/${row.playerOpt} |`,
  );

  const md = [
    "# S1 Team Variance Audit",
    "",
    `- Draft: **${payload.draftDurationSec}s** · Min **${teamsAtMin}/32** · Opt **${teamsAtOpt}/32**`,
    `- Star-Verteilung (Teams): ${JSON.stringify(spread.starDistribution)} · StdAbw **${spread.starStddev}**`,
    `- SS-Teams: **${spread.teamsWithSs}** · 0 Stars: **${spread.teamsWith0Stars}** · 1+ Stars: **${spread.teamsWith1PlusStars}**`,
    `- Varianz-Gate: **${variancePass ? "PASS" : "FAIL"}**`,
    "",
    "## GM-Gruppen (Ø Kauf-Brackets pro Team)",
    "",
    "| GM Archetype | Teams | Ø Star | Ø Core | Ø Depth | Ø Backup |",
    "|--------------|-------|--------|--------|---------|----------|",
    ...gmSummary.map(
      (row) =>
        `| ${row.archetype} | ${row.teams} | ${row.avgStar} | ${row.avgCore} | ${row.avgDepth} | ${row.avgBackup} |`,
    ),
    "",
    "## Vergleich Premium vs Arm vs T-T",
    "",
    `| | M-M | R-R | T-T |`,
    `|--|-----|-----|-----|`,
    `| Star-Buys | ${mm?.starBuys ?? "—"} | ${rr?.starBuys ?? "—"} | ${tt?.starBuys ?? "—"} |`,
    `| SS-Buys | ${mm?.ssBuys ?? "—"} | ${rr?.ssBuys ?? "—"} | ${tt?.ssBuys ?? "—"} |`,
    `| Core | ${mm?.coreBuys ?? "—"} | ${rr?.coreBuys ?? "—"} | ${tt?.coreBuys ?? "—"} |`,
    `| Depth | ${mm?.depthBuys ?? "—"} | ${rr?.depthBuys ?? "—"} | ${tt?.depthBuys ?? "—"} |`,
    "",
    "## Alle Teams",
    "",
    tableHeader,
    tableSep,
    ...tableRows,
  ].join("\n");

  await writeFile(path.join(outputDir, "summary.md"), md);
  console.log(JSON.stringify({ outputDir, variancePass, spread, gmSummary, draftDurationSec: payload.draftDurationSec }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
