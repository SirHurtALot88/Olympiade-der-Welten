/**
 * Post-run bracket report for S1→S2 smoke: SS/ST/CO/DE/BA/RE per team + league aggregates.
 *
 * Usage:
 *   node --import tsx scripts/s1-s2-bracket-report.ts <run-result.json path>
 *   node --import tsx scripts/s1-s2-bracket-report.ts outputs/s1-s2-transfer-smoke-.../run1-.../run-result.json
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { derivePlayerThemeTags } from "@/lib/ai/team-theme-composition-service";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function emptyBrackets(): Record<MarketBracketTierLabel, number> {
  return { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
}

function bracketShort(tier: MarketBracketTierLabel) {
  const map: Record<MarketBracketTierLabel, string> = {
    Superstar: "SS",
    Star: "ST",
    Core: "CO",
    Depth: "DE",
    Backup: "BA",
    Reserve: "RE",
  };
  return map[tier];
}

function countBrackets(prices: number[], leagueBrackets: ReturnType<typeof buildLeagueMarketBrackets>) {
  const counts = emptyBrackets();
  for (const price of prices) {
    counts[classifyMarketBracket(price, leagueBrackets)] += 1;
  }
  return counts;
}

function sumBrackets(rows: Record<MarketBracketTierLabel, number>[]) {
  const total = emptyBrackets();
  for (const row of rows) {
    for (const tier of Object.keys(total) as MarketBracketTierLabel[]) {
      total[tier] += row[tier];
    }
  }
  return total;
}

function avgBracket(rows: Record<MarketBracketTierLabel, number>[]) {
  const total = sumBrackets(rows);
  const n = Math.max(rows.length, 1);
  return Object.fromEntries(
    (Object.keys(total) as MarketBracketTierLabel[]).map((tier) => [tier, round(total[tier] / n, 2)]),
  ) as Record<MarketBracketTierLabel, number>;
}

type PreseasonBatchPlanVsExecute = {
  seasonId: string;
  teamCount: number;
  globalPreview?: { laneDistribution?: Array<{ label: string; count: number }> };
  teams?: Array<{
    teamCode: string;
    plannedPicks?: Array<{
      pickLane?: string | null;
      marketValue?: number | null;
    }>;
  }>;
};

function loadPreseasonBatchPlanVsExecute(outputDir: string): PreseasonBatchPlanVsExecute | null {
  const diagPath = path.join(outputDir, "preseason-batch-plan-vs-execute-season-2.json");
  if (!fs.existsSync(diagPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(diagPath, "utf8")) as PreseasonBatchPlanVsExecute;
  } catch {
    return null;
  }
}

function countExecutedPickLanes(diag: PreseasonBatchPlanVsExecute | null) {
  const laneCounts: Record<string, number> = {};
  let starPickCount = 0;
  let superstarPickCount = 0;
  let minStarPickPrice = Number.POSITIVE_INFINITY;
  let maxStarPickPrice = 0;

  const teams = diag?.teams ?? [];
  for (const team of teams) {
    for (const pick of team.plannedPicks ?? []) {
      const lane = (pick.pickLane ?? "").trim();
      if (!lane) continue;
      laneCounts[lane] = (laneCounts[lane] ?? 0) + 1;
      if (lane === "star_pick") {
        starPickCount += 1;
        const v = pick.marketValue ?? null;
        if (v != null && Number.isFinite(v)) {
          minStarPickPrice = Math.min(minStarPickPrice, v);
          maxStarPickPrice = Math.max(maxStarPickPrice, v);
        }
      }
      if (lane === "superstar_pick") {
        superstarPickCount += 1;
      }
    }
  }

  return {
    laneCounts,
    starPickCount,
    superstarPickCount,
    minStarPickPrice: Number.isFinite(minStarPickPrice) ? round(minStarPickPrice, 2) : null,
    maxStarPickPrice: maxStarPickPrice > 0 ? round(maxStarPickPrice, 2) : null,
    plannedLaneDistribution: diag?.globalPreview?.laneDistribution ?? null,
    diagPresent: Boolean(diag),
  };
}

async function main() {
  const runResultPath = process.argv[2];
  if (!runResultPath) {
    console.error("Usage: node --import tsx scripts/s1-s2-bracket-report.ts <run-result.json>");
    process.exit(1);
  }

  const resolved = path.isAbsolute(runResultPath) ? runResultPath : path.join(PROJECT_ROOT, runResultPath);
  const result = JSON.parse(fs.readFileSync(resolved, "utf8")) as {
    saveId: string;
    sqlitePath?: string;
    label: string;
    hardFails: string[];
    afterPreseason: {
      totalBuys: number;
      teamsAtMin: number;
      teamsAtOpt: number;
      avgCash: number;
      engineSummary: Record<string, number>;
      blockingReasons: string[];
      emergencyRepairTeams: number;
    };
    economy: {
      leagueBuyFeesS2: number;
      leagueSellFeesS1: number;
      leagueExcessOverBuffer: number;
    };
  };

  if (result.sqlitePath && fs.existsSync(result.sqlitePath)) {
    process.env.OLY_APP_SQLITE_PATH = result.sqlitePath;
  }

  loadEnvConfig(PROJECT_ROOT);
  getDatabase();

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(result.saveId);
  if (!save) throw new Error(`Save not found: ${result.saveId}`);

  const gs = save.gameState;
  const playerById = new Map(gs.players.map((p) => [p.id, p]));

  const s1BuyPrices = gs.transferHistory
    .filter((e) => e.seasonId === "season-1" && e.transferType === "buy")
    .map((e) => e.fee ?? e.marketValue ?? 0)
    .filter((v) => v > 0);

  const s2BuyHistory = gs.transferHistory.filter((e) => e.seasonId === "season-2" && e.transferType === "buy");
  const s2BuyPrices = s2BuyHistory.map((e) => e.fee ?? e.marketValue ?? 0).filter((v) => v > 0);

  const s2BuyBySource = s2BuyHistory.reduce(
    (acc, e) => {
      const src = e.source ?? "unknown";
      acc[src] = (acc[src] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const leagueBracketsS1 = buildLeagueMarketBrackets(s1BuyPrices);
  const rosterPrices = gs.rosters
    .map((r) => {
      const p = playerById.get(r.playerId);
      if (!p) return 0;
      const economy = resolvePlayerEconomyContract({ player: p, rosterEntry: r });
      return economy.marketValue ?? p.marketValue ?? 0;
    })
    .filter((v) => v > 0);
  const leagueBracketsRoster = buildLeagueMarketBrackets(rosterPrices);

  type TeamRow = {
    teamCode: string;
    gmArchetype: string;
    roster: number;
    s1Buys: Record<MarketBracketTierLabel, number>;
    s2EndRoster: Record<MarketBracketTierLabel, number>;
    s2BuyCount: number;
    s2RepairBuys: number;
  };

  const teamRows: TeamRow[] = [];

  for (const team of gs.teams) {
    const teamCode = team.shortCode ?? team.teamId;
    const gm = getTeamGeneralManager(gs, team.teamId);

    const s1TeamBuys = gs.transferHistory
      .filter((e) => e.seasonId === "season-1" && e.transferType === "buy" && e.toTeamId === team.teamId)
      .map((e) => e.fee ?? e.marketValue ?? 0)
      .filter((v) => v > 0);

    const rosterEntries = gs.rosters.filter((r) => r.teamId === team.teamId);
    const rosterMws = rosterEntries
      .map((r) => {
        const p = playerById.get(r.playerId);
        if (!p) return 0;
        const economy = resolvePlayerEconomyContract({ player: p, rosterEntry: r });
        return economy.marketValue ?? p.marketValue ?? 0;
      })
      .filter((v) => v > 0);

    const s2TeamBuys = gs.transferHistory.filter(
      (e) => e.seasonId === "season-2" && e.transferType === "buy" && e.toTeamId === team.teamId,
    );
    const s2RepairBuys = s2TeamBuys.filter((e) => e.source === "preseason_roster_repair_buy").length;

    teamRows.push({
      teamCode,
      gmArchetype: gm?.profile?.archetype ?? "none",
      roster: rosterEntries.length,
      s1Buys: countBrackets(s1TeamBuys, leagueBracketsS1),
      s2EndRoster: countBrackets(rosterMws, leagueBracketsRoster),
      s2BuyCount: s2TeamBuys.length,
      s2RepairBuys,
    });
  }

  teamRows.sort((a, b) => a.teamCode.localeCompare(b.teamCode));

  const leagueS1 = sumBrackets(teamRows.map((r) => r.s1Buys));
  const leagueS2Roster = sumBrackets(teamRows.map((r) => r.s2EndRoster));
  const leagueAvgS1 = avgBracket(teamRows.map((r) => r.s1Buys));
  const leagueAvgS2 = avgBracket(teamRows.map((r) => r.s2EndRoster));

  const gmGroups = new Map<string, TeamRow[]>();
  for (const row of teamRows) {
    const bucket = gmGroups.get(row.gmArchetype) ?? [];
    bucket.push(row);
    gmGroups.set(row.gmArchetype, bucket);
  }

  const gmSummary = [...gmGroups.entries()]
    .map(([archetype, rows]) => ({
      archetype,
      teams: rows.length,
      avgCoreS1: round(rows.reduce((s, r) => s + r.s1Buys.Core, 0) / rows.length, 2),
      avgCoreS2: round(rows.reduce((s, r) => s + r.s2EndRoster.Core, 0) / rows.length, 2),
      avgDepthS2: round(rows.reduce((s, r) => s + r.s2EndRoster.Depth, 0) / rows.length, 2),
      avgBackupS2: round(
        rows.reduce((s, r) => s + r.s2EndRoster.Backup + r.s2EndRoster.Reserve, 0) / rows.length,
        2,
      ),
    }))
    .sort((a, b) => b.teams - a.teams);

  const totalS2Repair = teamRows.reduce((s, r) => s + r.s2RepairBuys, 0);
  const totalS2Buys = teamRows.reduce((s, r) => s + r.s2BuyCount, 0);
  const repairPct = totalS2Buys > 0 ? round((totalS2Repair / totalS2Buys) * 100, 1) : 0;

  const tt = teamRows.find((r) => r.teamCode === "T-T");
  let ttThemeDetail = "";
  if (tt) {
    const ttRoster = gs.rosters.filter((r) => r.teamId === "T-T");
    const lines: string[] = [];
    for (const entry of ttRoster) {
      const p = playerById.get(entry.playerId);
      if (!p) continue;
      const tags = derivePlayerThemeTags(p).playerThemeTags;
      const themed = tags.some((t) => ["Teacher", "Mentor", "Leader"].includes(t));
      const mw = p.marketValue ?? 0;
      const tier = classifyMarketBracket(mw, leagueBracketsRoster);
      lines.push(`  ${p.name} | ${p.className} | MW=${round(mw)} | ${bracketShort(tier)} | themed=${themed}`);
    }
    ttThemeDetail = lines.join("\n");
  }

  const classSpamBlockers = result.afterPreseason.blockingReasons.filter((b) => b.includes("class_spam"));
  const hardGreen = result.hardFails.length === 0;

  const outputDir = path.dirname(resolved);
  const diag = loadPreseasonBatchPlanVsExecute(outputDir);
  const laneAudit = countExecutedPickLanes(diag);
  const md = [
    "# S1→S2 Bracket Report",
    "",
    `- Run: **${result.label}**`,
    `- Hard-KPI: **${hardGreen ? "GRÜN" : "ROT"}** (${result.hardFails.length} fails)`,
    `- Min: **${result.afterPreseason.teamsAtMin}/32** · Opt: **${result.afterPreseason.teamsAtOpt}/32**`,
    `- Ø Cash S2: **${result.afterPreseason.avgCash}** · Buy-Fees S2: **${result.economy.leagueBuyFeesS2}** · Excess>Buffer: **${result.economy.leagueExcessOverBuffer}**`,
    `- S2 Engine: ${JSON.stringify(result.afterPreseason.engineSummary)}`,
    `- S2 Buy-Quellen: ${JSON.stringify(s2BuyBySource)} · Repair-Anteil: **${repairPct}%** (${totalS2Repair}/${totalS2Buys})`,
    classSpamBlockers.length > 0 ? `- class_spam Blocker: **${classSpamBlockers.length}**` : "",
    "",
    "## S2 Execute Lane Summary (Pick-Lanes)",
    "",
    laneAudit.diagPresent
      ? `- Quelle: \`preseason-batch-plan-vs-execute-season-2.json\``
      : "- Quelle: (keine Diagnose-Datei gefunden; Lane-Summary nicht verfügbar)",
    laneAudit.diagPresent
      ? `- star_pick: **${laneAudit.starPickCount}** (MW min/max: ${laneAudit.minStarPickPrice ?? "n/a"} / ${laneAudit.maxStarPickPrice ?? "n/a"})`
      : "",
    laneAudit.diagPresent ? `- superstar_pick: **${laneAudit.superstarPickCount}**` : "",
    laneAudit.plannedLaneDistribution
      ? `- planned lanes (preview): ${JSON.stringify(laneAudit.plannedLaneDistribution)}`
      : "",
    "",
    "## League Bracket-Summen",
    "",
    "| Phase | SS | Star | Core | Depth | Backup | Reserve |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| S1 Draft Buys | ${leagueS1.Superstar} | ${leagueS1.Star} | ${leagueS1.Core} | ${leagueS1.Depth} | ${leagueS1.Backup} | ${leagueS1.Reserve} |`,
    `| S2 Endkader | ${leagueS2Roster.Superstar} | ${leagueS2Roster.Star} | ${leagueS2Roster.Core} | ${leagueS2Roster.Depth} | ${leagueS2Roster.Backup} | ${leagueS2Roster.Reserve} |`,
    "",
    "## League Bracket-Ø pro Team",
    "",
    "| Phase | SS | Star | Core | Depth | Backup | Reserve |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| S1 Draft Buys | ${leagueAvgS1.Superstar} | ${leagueAvgS1.Star} | ${leagueAvgS1.Core} | ${leagueAvgS1.Depth} | ${leagueAvgS1.Backup} | ${leagueAvgS1.Reserve} |`,
    `| S2 Endkader | ${leagueAvgS2.Superstar} | ${leagueAvgS2.Star} | ${leagueAvgS2.Core} | ${leagueAvgS2.Depth} | ${leagueAvgS2.Backup} | ${leagueAvgS2.Reserve} |`,
    "",
    "## GM-Archetype (S2 Endkader Ø)",
    "",
    "| GM | Teams | Ø Core S1 | Ø Core S2 | Ø Depth S2 | Ø Backup+RE S2 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...gmSummary.map(
      (g) => `| ${g.archetype} | ${g.teams} | ${g.avgCoreS1} | ${g.avgCoreS2} | ${g.avgDepthS2} | ${g.avgBackupS2} |`,
    ),
    "",
    "## Alle Teams (S1 Buys + S2 Endkader)",
    "",
    "| Team | GM | Roster | S1 SS/ST/CO/DE/BA/RE | S2 SS/ST/CO/DE/BA/RE | S2 Buys | Repair |",
    "| --- | --- | ---: | --- | --- | ---: | ---: |",
    ...teamRows.map((r) => {
      const fmt = (b: Record<MarketBracketTierLabel, number>) =>
        `${b.Superstar}/${b.Star}/${b.Core}/${b.Depth}/${b.Backup}/${b.Reserve}`;
      return `| ${r.teamCode} | ${r.gmArchetype} | ${r.roster} | ${fmt(r.s1Buys)} | ${fmt(r.s2EndRoster)} | ${r.s2BuyCount} | ${r.s2RepairBuys} |`;
    }),
    "",
    "## T-T Theme-Detail (S2 Endkader)",
    "",
    ttThemeDetail || "T-T nicht gefunden",
  ]
    .filter(Boolean)
    .join("\n");

  const jsonPath = path.join(outputDir, "bracket-report.json");
  const mdPath = path.join(outputDir, "bracket-report.md");
  const payload = {
    hardGreen,
    hardFails: result.hardFails,
    leagueS1,
    leagueS2Roster,
    leagueAvgS1,
    leagueAvgS2,
    s2ExecuteLaneAudit: laneAudit,
    gmSummary,
    repairPct,
    s2BuyBySource,
    classSpamBlockers,
    engineSummary: result.afterPreseason.engineSummary,
    teamRows,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(mdPath, md);

  console.log(JSON.stringify({ mdPath, jsonPath, hardGreen, leagueAvgS1, leagueAvgS2, repairPct, classSpamBlockers: classSpamBlockers.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
