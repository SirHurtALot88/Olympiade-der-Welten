/**
 * S1 draft only: isolate, draft, report bracket spread + hard KPIs.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-draft-bracket-check.ts
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import {
  finalizeSeasonOneBootstrapPhase,
  finalizeSeasonOneDraftAuditReady,
  runCanonicalSeasonOneBootstrap,
} from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

import { PROJECT_ROOT, collectTeamRows, countDraftBuys, log, round, setAllTeamsAi } from "./s1-s2-transfer-shared";

function emptyBrackets(): Record<MarketBracketTierLabel, number> {
  return { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
}

function countBrackets(prices: number[], leagueBrackets: ReturnType<typeof buildLeagueMarketBrackets>) {
  const counts = emptyBrackets();
  for (const price of prices) {
    counts[classifyMarketBracket(price, leagueBrackets)] += 1;
  }
  return counts;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = path.join(PROJECT_ROOT, "outputs", `s1-draft-bracket-check-${stamp}`);
  fs.mkdirSync(outputDir, { recursive: true });
  delete process.env.OLY_APP_SQLITE_PATH;
  const isolation = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT });
  process.env.OLY_APP_SQLITE_PATH = isolation.sqlitePath;

  const persistence = createPersistenceService();
  const created = persistence.createFreshSeasonOneSave({ name: `S1 draft bracket check ${stamp}` });
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") throw new Error(reset.blockingReasons.join(" | "));

  let save = persistence.getSaveById(created.saveId) ?? created;
  save = setAllTeamsAi(save, persistence);
  const bootstrap = await runCanonicalSeasonOneBootstrap(save, persistence);
  if (bootstrap.blockers.length > 0) {
    log(`Draft blockers: ${bootstrap.blockers.join(" | ")}`);
  }
  save = finalizeSeasonOneDraftAuditReady(bootstrap.save, persistence);
  save = finalizeSeasonOneBootstrapPhase(save, persistence).save;

  const gs = save.gameState;
  const rows = collectTeamRows(gs);
  const picks = countDraftBuys(gs);
  const teamsAtMin = rows.filter((row) => row.atMin).length;
  const teamsAtOpt = rows.filter((row) => row.atOpt).length;
  const avgCash = round(rows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, rows.length));

  const buyPrices = gs.transferHistory
    .filter((entry) => entry.seasonId === "season-1" && entry.transferType === "buy")
    .map((entry) => entry.fee ?? entry.marketValue ?? 0)
    .filter((value) => value > 0);
  const leagueBrackets = buildLeagueMarketBrackets(buyPrices);
  const league = countBrackets(buyPrices, leagueBrackets);
  const teamCount = Math.max(rows.length, 1);
  const leagueAvg = Object.fromEntries(
    (Object.keys(league) as MarketBracketTierLabel[]).map((tier) => [tier, round(league[tier] / teamCount, 2)]),
  ) as Record<MarketBracketTierLabel, number>;

  const playerById = new Map(gs.players.map((player) => [player.id, player]));
  const perTeam: Array<{
    teamCode: string;
    gm: string;
    roster: number;
    brackets: Record<MarketBracketTierLabel, number>;
  }> = [];

  for (const team of gs.teams) {
    const rosterEntries = gs.rosters.filter((entry) => entry.teamId === team.teamId);
    const prices = rosterEntries.map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return 0;
      return resolvePlayerEconomyContract(player).marketValue ?? player.marketValue ?? 0;
    });
    const gm = getTeamGeneralManager(gs, team.teamId)?.profile?.archetype ?? "unknown";
    perTeam.push({
      teamCode: team.shortCode || team.teamId,
      gm,
      roster: rosterEntries.length,
      brackets: countBrackets(prices, leagueBrackets),
    });
  }

  const hardFails: string[] = [];
  const allAtMin = teamsAtMin >= 32;
  for (const blocker of bootstrap.blockers) {
    // Soft FA/race and preview-drift noise when every team already hit min.
    if (allAtMin && (blocker.includes("player_not_free_agent_in_scope") || blocker.includes("preview_execute_drift"))) {
      continue;
    }
    hardFails.push(`draft_blocker:${blocker}`);
  }
  if (teamsAtMin < 32) hardFails.push(`min_not_reached:${teamsAtMin}/32`);
  if (picks < 200) hardFails.push(`too_few_picks:${picks}`);
  // Target shape: at least ~1 Core-bracket player per team on average.
  if (leagueAvg.Core < 0.75) hardFails.push(`core_avg_low:${leagueAvg.Core}`);

  const report = {
    saveId: save.saveId,
    sqlitePath: isolation.sqlitePath,
    picks,
    teamsAtMin,
    teamsAtOpt,
    avgCash,
    league,
    leagueAvg,
    hardFails,
    hardGreen: hardFails.length === 0,
    perTeam,
  };

  const reportPath = path.join(outputDir, "draft-bracket-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const md = [
    `# S1 Draft Bracket Check`,
    `- Hard-KPI: **${report.hardGreen ? "GRÜN" : "ROT"}** (${hardFails.length} fails)`,
    `- Picks: **${picks}** · Min: **${teamsAtMin}/32** · Opt: **${teamsAtOpt}/32** · Ø Cash: **${avgCash}**`,
    ``,
    `## League Bracket-Summen (S1 Buys)`,
    `| SS | Star | Core | Depth | Backup | Reserve |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: |`,
    `| ${league.Superstar} | ${league.Star} | ${league.Core} | ${league.Depth} | ${league.Backup} | ${league.Reserve} |`,
    ``,
    `## League Bracket-Ø pro Team (Roster nach Draft)`,
    `| SS | Star | Core | Depth | Backup | Reserve |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: |`,
    `| ${leagueAvg.Superstar} | ${leagueAvg.Star} | ${leagueAvg.Core} | ${leagueAvg.Depth} | ${leagueAvg.Backup} | ${leagueAvg.Reserve} |`,
    ``,
    ...(hardFails.length > 0 ? [`## Hard Fails`, ...hardFails.map((f) => `- ${f}`), ``] : []),
    `## Teams`,
    `| Team | GM | Roster | SS/ST/CO/DE/BA/RE |`,
    `| --- | --- | ---: | --- |`,
    ...perTeam.map(
      (row) =>
        `| ${row.teamCode} | ${row.gm} | ${row.roster} | ${row.brackets.Superstar}/${row.brackets.Star}/${row.brackets.Core}/${row.brackets.Depth}/${row.brackets.Backup}/${row.brackets.Reserve} |`,
    ),
  ].join("\n");
  fs.writeFileSync(path.join(outputDir, "draft-bracket-report.md"), md);

  console.log(
    JSON.stringify(
      {
        outputDir,
        hardGreen: report.hardGreen,
        picks,
        teamsAtMin,
        teamsAtOpt,
        avgCash,
        leagueAvg,
        hardFails,
      },
      null,
      2,
    ),
  );

  if (!report.hardGreen) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
