/**
 * Generate long-run-s10-recap.md from save + output dir artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  computeSeasonOrganicProgressionMetrics,
} from "@/lib/season/long-run-organic-progression-audit";
import { readObservationsMarkdown } from "@/lib/season/long-run-observation-log";
import { LONG_RUN_PERFORMANCE_REPORT } from "@/lib/season/long-run-performance-analysis";
import { countSeasonBuyTransfers, formatSeasonTransferCountsLabel } from "@/lib/season/transfer-season-policy";

const PROJECT_ROOT = path.resolve(__dirname, "..");

function argValue(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function parseSeasonNumber(seasonId: string) {
  const m = seasonId.match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  const outputDir = argValue("--output-dir") ?? path.join(PROJECT_ROOT, "outputs");
  if (!saveId) throw new Error("Missing --save-id");

  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const gs = save.gameState;
  const finalSeason = parseSeasonNumber(gs.season.id);
  const lines: string[] = [
    "# Long-Run S10 Recap",
    "",
    `- **Save:** \`${saveId}\``,
    `- **Final:** ${gs.season.id} · ${gs.gamePhase ?? "?"}`,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
    "## Progression (organic only)",
    "",
    "| Season | Spieler | Liga-Δ | Peak-P90 | Top10-Median |",
    "|---|---:|---:|---:|---:|",
  ];

  for (let n = 1; n <= finalSeason; n += 1) {
    const sid = `season-${n}`;
    const m = computeSeasonOrganicProgressionMetrics(gs, sid);
    lines.push(`| ${sid} | ${m.playerCount} | ${m.leagueNetDelta} | ${m.peakP90} | ${m.peakMedianTop10} |`);
  }

  lines.push("", "## Cash / MW (final)", "");
  const cashValues = gs.teams.map((t) => t.cash ?? 0);
  const mwValues = gs.teams.map((t) => {
    const roster = gs.rosters.filter((r) => r.teamId === t.teamId);
    return roster.reduce((sum, r) => {
      const p = gs.players.find((pl) => pl.id === r.playerId);
      return sum + (p?.marketValue ?? 0);
    }, 0);
  });
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const med = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)] ?? 0;
  };
  lines.push(`- Cash: min=${Math.min(...cashValues).toFixed(1)} med=${med(cashValues).toFixed(1)} max=${Math.max(...cashValues).toFixed(1)} Σ=${sum(cashValues).toFixed(1)}`);
  lines.push(`- MW: min=${Math.min(...mwValues).toFixed(1)} med=${med(mwValues).toFixed(1)} max=${Math.max(...mwValues).toFixed(1)} Σ=${sum(mwValues).toFixed(1)}`);

  lines.push("", "## Reha (recovery_center)", "");
  let rehaSum = 0;
  for (const team of gs.teams) {
    const fac = gs.seasonState.facilityStates?.[team.teamId]?.facilities?.recovery_center?.level ?? 0;
    rehaSum += fac;
  }
  lines.push(`- Liga-Summe Reha-Level: **${rehaSum}**`);

  lines.push("", "## Transfers (ligaweit)", "");
  for (let n = 1; n <= finalSeason; n += 1) {
    const sid = `season-${n}`;
    const txs = gs.transferHistory.filter((t) => t.seasonId === sid);
    const buyCounts = countSeasonBuyTransfers(txs, sid);
    const sellCount = txs.filter((t) => t.transferType === "sell").length;
    const exitCount = txs.filter((t) => t.transferType === "contract_exit").length;
    const profitSells = txs.filter((t) => {
      if (t.transferType !== "sell") return false;
      const p = gs.players.find((pl) => pl.id === t.playerId);
      const mv = p?.marketValue ?? t.marketValue ?? 0;
      return (t.fee ?? 0) > mv && mv > 0;
    }).length;
    const transferLabel = formatSeasonTransferCountsLabel(sid, buyCounts, {
      sellCount,
      exitCount,
      style: "recap",
    });
    lines.push(`- ${sid}: ${transferLabel} (${profitSells} Profit-Sells Fee>MW)`);
  }

  const observations = readObservationsMarkdown(outputDir);
  lines.push("", "## Beobachtungen", "");
  if (observations) {
    const body = observations.replace(/^# Long-Run Beobachtungen\n+/i, "").trim();
    lines.push(body || "_Keine Einträge._");
  } else {
    lines.push("_Keine Beobachtungen protokolliert._");
  }

  const perfReportPath = path.join(outputDir, LONG_RUN_PERFORMANCE_REPORT);
  lines.push("", "## Performance", "");
  if (fs.existsSync(perfReportPath)) {
    const perfBody = fs.readFileSync(perfReportPath, "utf8").replace(/^# Long-Run Performance-Analyse\n+/i, "").trim();
    lines.push(perfBody.split("\n").slice(0, 25).join("\n"));
    lines.push("", `_Vollständig: \`${LONG_RUN_PERFORMANCE_REPORT}\`_`);
  } else {
    lines.push("_Noch keine Performance-Analyse — `tsx scripts/analyze-long-run-performance.ts`._");
  }

  lines.push("", "## Artefakte", "");
  for (const name of ["team-kpi-table.md", "team-finance-season-table.md", "player-progression-rankings.md", "fatigue-injury-multiseason-report.md", "long-run-observations.md", LONG_RUN_PERFORMANCE_REPORT]) {
    const p = path.join(outputDir, name);
    lines.push(fs.existsSync(p) ? `- [x] ${name}` : `- [ ] ${name}`);
  }

  const outPath = path.join(outputDir, "long-run-s10-recap.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
