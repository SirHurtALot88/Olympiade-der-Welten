/**
 * Generate balancing-report.md for S1–S5 validation runs.
 *
 * Usage: npx tsx scripts/generate-balancing-report.ts --save-id <id> --output-dir <dir> [--seasons 5]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  computeSeasonOrganicProgressionMetrics,
  isLeagueNetDeltaOutsideCorridor,
  isPeakNetOutsideCorridor,
  ORGANIC_LEAGUE_NET_AVG_MAX,
  ORGANIC_LEAGUE_NET_AVG_MIN,
  ORGANIC_PEAK_NET_MAX,
  ORGANIC_PEAK_NET_MIN,
} from "@/lib/season/long-run-organic-progression-audit";
import { countSeasonBuyTransfers } from "@/lib/season/transfer-season-policy";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function gate(status: "PASS" | "WARN" | "RED") {
  return status;
}

function isEmergencyBuySource(source: string | null | undefined) {
  const value = String(source ?? "");
  return /repair|topup|fallback/i.test(value);
}

function isPlannedMarketBuy(entry: TransferHistoryEntry) {
  if (entry.transferType !== "buy") return false;
  const source = String(entry.source ?? "");
  if (isEmergencyBuySource(source)) return false;
  return source === "ai_preseason_market_buy" || source.includes("season1") || source.includes("draft");
}

export function classifyPickFidelity(entry: TransferHistoryEntry) {
  if (entry.transferType !== "buy") return "other";
  if (isEmergencyBuySource(entry.source)) return "emergency";
  if (entry.source === "ai_preseason_market_buy") return "planned_market";
  return "planned_other";
}

export function seasonBuyFidelity(history: TransferHistoryEntry[], seasonId: string) {
  const buys = history.filter((entry) => entry.seasonId === seasonId && entry.transferType === "buy");
  const emergency = buys.filter((entry) => classifyPickFidelity(entry) === "emergency").length;
  const plannedMarket = buys.filter((entry) => classifyPickFidelity(entry) === "planned_market").length;
  const plannedOther = buys.filter((entry) => classifyPickFidelity(entry) === "planned_other").length;
  const planned = plannedMarket + plannedOther;
  const total = buys.length;
  const emergencyPct = total > 0 ? Math.round((emergency / total) * 1000) / 10 : 0;
  const plannedPct = total > 0 ? Math.round((planned / total) * 1000) / 10 : 0;
  return { buys: total, emergency, plannedMarket, plannedOther, planned, emergencyPct, plannedPct };
}

export function buildBalancingReportLines(input: {
  saveId: string;
  seasonIds: string[];
  gs: ReturnType<NonNullable<ReturnType<typeof createPersistenceService>["getSaveById"]>>["gameState"];
}) {
  const { saveId, seasonIds, gs } = input;
  const history = gs.transferHistory ?? [];

  const organicBySeason = seasonIds.map((seasonId) => ({
    seasonId,
    metrics: computeSeasonOrganicProgressionMetrics(gs, seasonId),
  }));

  const peakCells = organicBySeason.map(({ metrics, seasonId }) => {
    const hasData = metrics.playerCount > 0;
    if (!hasData) return "—";
    const status = isPeakNetOutsideCorridor(metrics.peakP90, metrics.playerCount) ? "RED" : "PASS";
    return `${metrics.peakP90} ${status}`;
  });

  const ligaCells = organicBySeason.map(({ metrics }) => {
    if (metrics.playerCount <= 0) return "—";
    const status = isLeagueNetDeltaOutsideCorridor(metrics.leagueNetAverage, metrics.playerCount) ? "WARN" : "PASS";
    return `${metrics.leagueNetAverage} ${status}`;
  });

  const marketBuyCells = seasonIds.map((seasonId) => {
    const counts = countSeasonBuyTransfers(history, seasonId);
    if (seasonId === "season-1") return `${counts.draftBuyCount}D+${counts.marketBuyCount}M`;
    return String(counts.marketBuyCount);
  });

  const sellCells = seasonIds.map(
    (seasonId) => history.filter((entry) => entry.seasonId === seasonId && entry.transferType === "sell").length,
  );

  const fidelityBySeason = seasonIds.map((seasonId) => seasonBuyFidelity(history, seasonId));
  const emergencyCells = fidelityBySeason.map(
    (row) => (row.buys > 0 ? `${row.emergency}/${row.buys} (${row.emergencyPct}%)` : "—"),
  );

  const headerCols = seasonIds.map((id) => id.replace("season-", "S"));
  const lines: string[] = [
    `# Balancing Report ${headerCols.join("+")}`,
    "",
    `**Save:** \`${saveId}\`  `,
    `**Stand:** ${gs.season.id} · ${gs.gamePhase ?? "?"}  `,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Abnahme-Gates",
    "",
    `| Check | ${headerCols.join(" | ")} | Ziel |`,
    `|-------|${headerCols.map(() => "---").join("|")}|------|`,
    `| Peak-P90 | ${peakCells.join(" | ")} | ${ORGANIC_PEAK_NET_MIN}–${ORGANIC_PEAK_NET_MAX} |`,
    `| Liga-Δ Ø | ${ligaCells.join(" | ")} | ${ORGANIC_LEAGUE_NET_AVG_MIN}…${ORGANIC_LEAGUE_NET_AVG_MAX} |`,
    `| Markt-Käufe | ${marketBuyCells.join(" | ")} | S1 Draft; S2+ >0 |`,
    `| Verkäufe | ${sellCells.join(" | ")} | S2+ ≥30 WARN |`,
    `| Emergency-Filler | ${emergencyCells.join(" | ")} | <15% iterate |`,
  ];

  const rehaTeams = gs.teams.filter((team) => {
    const fac = getTeamFacilityState(gs, team.teamId);
    return getFacilityLevel(fac, "recovery_center") >= 1;
  }).length;
  const negativeCash = gs.teams.filter((team) => (team.cash ?? 0) < 0).length;

  lines.push(
    `| Reha L≥1 | ${rehaTeams}/32 | — | ≥8 PASS |`,
    `| Negative Cash | ${negativeCash} Teams | — | 0 | ${negativeCash === 0 ? gate("PASS") : gate("RED")} |`,
    "",
    "## Organic Progression Detail",
    "",
  );

  for (const { seasonId, metrics } of organicBySeason) {
    const counts = countSeasonBuyTransfers(history, seasonId);
    const sells = history.filter((entry) => entry.seasonId === seasonId && entry.transferType === "sell").length;
    lines.push(
      `### ${seasonId}`,
      `- Peak-P90: **${metrics.peakP90}** (Top10-Median ${metrics.peakMedianTop10}, n=${metrics.playerCount})`,
      `- Liga-Δ: Summe **${metrics.leagueNetDelta}**, Ø **${metrics.leagueNetAverage}**`,
      `- Transfers: **${counts.totalBuyCount} Käufe · ${sells} V**`,
      "",
    );
  }

  lines.push("## Pick-Fidelity", "", "| Season | Buys | Planned Market | Planned Other | Emergency | Planned % | Emergency % |", "|--------|-----:|---------------:|--------------:|----------:|----------:|------------:|");
  for (let index = 0; index < seasonIds.length; index += 1) {
    const seasonId = seasonIds[index];
    const row = fidelityBySeason[index];
    lines.push(
      `| ${seasonId} | ${row.buys} | ${row.plannedMarket} | ${row.plannedOther} | ${row.emergency} | ${row.plannedPct}% | ${row.emergencyPct}% |`,
    );
  }

  const s2Plus = fidelityBySeason.slice(1).filter((row) => row.buys > 0);
  const s2PlusEmergencyPct =
    s2Plus.length > 0
      ? Math.round((s2Plus.reduce((sum, row) => sum + row.emergency, 0) / s2Plus.reduce((sum, row) => sum + row.buys, 0)) * 1000) / 10
      : 0;
  const s2PlusPlannedMarketPct =
    s2Plus.length > 0
      ? Math.round((s2Plus.reduce((sum, row) => sum + row.plannedMarket, 0) / s2Plus.reduce((sum, row) => sum + row.buys, 0)) * 1000) / 10
      : 0;

  lines.push(
    "",
    `- S2+ unified market buys: **${s2PlusPlannedMarketPct}%** (Ziel ≥85% audit)`,
    `- S2+ emergency filler: **${s2PlusEmergencyPct}%** (Ziel <15% iterate, <5% audit)`,
    "",
    "## Fazit",
    "",
  );

  const peakReds = organicBySeason.filter(
    ({ metrics }) => metrics.playerCount > 0 && isPeakNetOutsideCorridor(metrics.peakP90, metrics.playerCount),
  ).length;
  const ligaWarns = organicBySeason.filter(
    ({ metrics }) => metrics.playerCount > 0 && isLeagueNetDeltaOutsideCorridor(metrics.leagueNetAverage, metrics.playerCount),
  ).length;
  const s1Market = countSeasonBuyTransfers(history, "season-1").marketBuyCount;

  if (peakReds === 0 && negativeCash === 0 && s1Market === 0 && s2PlusEmergencyPct < 15) {
    lines.push(peakReds === 0 && ligaWarns === 0 ? "**PASS** — Balancing im Zielkorridor." : `**WARN** — ${ligaWarns} Liga-Δ Warnung(en), keine Peak-RED.`);
  } else {
    lines.push(`**RED/WARN** — Peak-RED: ${peakReds}, Liga-WARN: ${ligaWarns}, Emergency S2+: ${s2PlusEmergencyPct}%.`);
  }

  return lines;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const outputDir = argValue("--output-dir");
  const seasonCount = Number(argValue("--seasons") ?? "5");
  if (!saveId || !outputDir) throw new Error("Missing --save-id or --output-dir");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const seasonIds = Array.from({ length: seasonCount }, (_, index) => `season-${index + 1}`);
  const lines = buildBalancingReportLines({ saveId, seasonIds, gs: save.gameState });

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "balancing-report.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outPath}`);
}

const isDirectRun = process.argv[1]?.includes("generate-balancing-report");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
