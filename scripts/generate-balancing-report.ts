/**
 * Generate balancing-report.md for S1+S2 validation runs.
 *
 * Usage: npx tsx scripts/generate-balancing-report.ts --save-id <id> --output-dir <dir>
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
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
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function gate(status: "PASS" | "WARN" | "RED") {
  return status;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const outputDir = argValue("--output-dir");
  if (!saveId || !outputDir) throw new Error("Missing --save-id or --output-dir");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const history = gs.transferHistory ?? [];
  const lines: string[] = [
    "# Balancing Report S1+S2",
    "",
    `**Save:** \`${saveId}\`  `,
    `**Stand:** ${gs.season.id} · ${gs.gamePhase ?? "?"}  `,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Abnahme-Gates",
    "",
    "| Check | S1 | S2 | Ziel |",
    "|-------|----|----|------|",
  ];

  for (const seasonId of ["season-1", "season-2"] as const) {
    if (seasonId === "season-2" && !history.some((e) => e.seasonId === "season-2")) {
      continue;
    }
  }

  const s1Counts = countSeasonBuyTransfers(history, "season-1");
  const s2Counts = countSeasonBuyTransfers(history, "season-2");
  const s1Draft = s1Counts.draftBuyCount;
  const s1Market = s1Counts.marketBuyCount;
  const s2Market = s2Counts.marketBuyCount;
  const s1Sells = history.filter((e) => e.seasonId === "season-1" && e.transferType === "sell").length;
  const s2Sells = history.filter((e) => e.seasonId === "season-2" && e.transferType === "sell").length;

  const s1Organic = computeSeasonOrganicProgressionMetrics(gs, "season-1");
  const s2Organic = computeSeasonOrganicProgressionMetrics(gs, "season-2");

  const s1PeakStatus = isPeakNetOutsideCorridor(s1Organic.peakP90, s1Organic.playerCount) ? "RED" : "PASS";
  const s2PeakStatus = isPeakNetOutsideCorridor(s2Organic.peakP90, s2Organic.playerCount) ? "RED" : "PASS";
  const s1LigaStatus = isLeagueNetDeltaOutsideCorridor(s1Organic.leagueNetAverage, s1Organic.playerCount) ? "WARN" : "PASS";
  const s2LigaStatus = isLeagueNetDeltaOutsideCorridor(s2Organic.leagueNetAverage, s2Organic.playerCount) ? "WARN" : "PASS";

  const rehaTeams = gs.teams.filter((team) => {
    const fac = getTeamFacilityState(gs, team.teamId);
    return getFacilityLevel(fac, "recovery_center") >= 1;
  }).length;

  const negativeCash = gs.teams.filter((team) => (team.cash ?? 0) < 0).length;

  lines.push(
    `| S1 Marktkäufe | ${s1Market} | — | 0 | ${s1Market === 0 ? gate("PASS") : gate("RED")} |`,
    `| S1 Draft-Käufe | ${s1Draft} | — | >0 | ${s1Draft > 0 ? gate("PASS") : gate("RED")} |`,
    `| Peak-P90 | ${s1Organic.peakP90} | ${s2Organic.peakP90} | ${ORGANIC_PEAK_NET_MIN}–${ORGANIC_PEAK_NET_MAX} | S1:${s1PeakStatus} S2:${s2PeakStatus} |`,
    `| Liga-Δ Ø | ${s1Organic.leagueNetAverage} | ${s2Organic.leagueNetAverage} | ${ORGANIC_LEAGUE_NET_AVG_MIN}…${ORGANIC_LEAGUE_NET_AVG_MAX} | S1:${s1LigaStatus} S2:${s2LigaStatus} |`,
    `| Verkäufe (Liga) | ${s1Sells} | ${s2Sells} | S2 ≥50 (Ziel ~25–30% Turnover) | ${s2Sells >= 50 ? gate("PASS") : s2Sells >= 30 ? gate("WARN") : gate("RED")} |`,
    `| Marktkäufe S2 | — | ${s2Market} | >0 erwartet | ${s2Market > 0 ? gate("PASS") : gate("WARN")} |`,
    `| Reha L≥1 (S2-Ende) | — | ${rehaTeams}/32 | ≥8 PASS, ≥4 WARN | ${rehaTeams >= 8 ? gate("PASS") : rehaTeams >= 4 ? gate("WARN") : gate("RED")} |`,
    `| Negative Cash | ${negativeCash} Teams | — | 0 | ${negativeCash === 0 ? gate("PASS") : gate("RED")} |`,
    "",
    "## Organic Progression Detail",
    "",
    "### Season 1",
    `- Peak-P90: **${s1Organic.peakP90}** (Top10-Median ${s1Organic.peakMedianTop10})`,
    `- Liga-Δ: Summe **${s1Organic.leagueNetDelta}**, Ø **${s1Organic.leagueNetAverage}** (n=${s1Organic.playerCount})`,
    `- Transfers: **${s1Draft} Draft · ${s1Market} Markt · ${s1Sells} V**`,
    "",
    "### Season 2",
    `- Peak-P90: **${s2Organic.peakP90}** (Top10-Median ${s2Organic.peakMedianTop10})`,
    `- Liga-Δ: Summe **${s2Organic.leagueNetDelta}**, Ø **${s2Organic.leagueNetAverage}** (n=${s2Organic.playerCount})`,
    `- Transfers: **${s2Market} Markt · ${s2Sells} V**`,
    "",
    "## Vergleich",
    "",
    "- Sell-Fix-Benchmark (`fresh-season-1-1782915932466`): S2 113V, Peak 5.4, Liga-Δ 0.807",
    "- S10-Recap (`fresh-season-1-1782878530467`): chronisch zu wenig Verkäufe (~2.4 % Markt)",
    "",
    "## Fazit",
    "",
  );

  const reds = [s1Market > 0, s1PeakStatus === "RED", s2PeakStatus === "RED", negativeCash > 0, s2Sells < 30].filter(Boolean).length;
  const warns = [s1LigaStatus === "WARN", s2LigaStatus === "WARN", s2Sells < 50, rehaTeams < 8].filter(Boolean).length;

  if (reds === 0 && warns === 0) {
    lines.push("**PASS** — S1+S2 Balancing im Zielkorridor.");
  } else if (reds === 0) {
    lines.push(`**WARN** — ${warns} Dimension(en) brauchen Feintuning, keine harten Blocker.`);
  } else {
    lines.push(`**RED** — ${reds} harte Blocker, ${warns} Warnungen.`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "balancing-report.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
