/**
 * Season Corridor Trend — S1..S10 Zielkorridor-Check für MW+Cash vs. Startbudget × Salary-Faktor.
 *
 * Liest NUR die persistierten Season-Snapshots (kein Re-Run, keine Writes) und prüft pro Team
 * und Season, ob (cashEnd + marketValueEnd) innerhalb eines Korridors um
 * (Team-Startbudget × Salary-Faktor der jeweiligen Season) liegt. Baut daraus einen S1->S10
 * Trend (wie viele Teams pro Season im Korridor liegen), damit man auf einen Blick sieht, ob
 * sich das Balancing über die Seasons hinweg verbessert oder verschlechtert.
 *
 * Formel (Default, siehe CORRIDOR_MIN_RATIO / CORRIDOR_MAX_RATIO unten):
 *   target      = team.budget * salaryFactor(seasonId)
 *   ratio       = (cashEnd + marketValueEnd) / target
 *   PASS        = ratio in [CORRIDOR_MIN_RATIO, CORRIDOR_MAX_RATIO]  (default 0.8x - 1.3x)
 *
 * Wenn für eine Season kein Salary-Faktor auffindbar ist, wird nur die Ratio (ohne Faktor,
 * d.h. relativ zu budget*1.0) informativ ausgegeben und explizit als "kein Faktor" markiert —
 * es wird NICHT stillschweigend PASS/RED behauptet.
 *
 * Usage:
 *   npx tsx scripts/season-corridor-trend.ts --save-id <id> [--from season-1] [--to season-10]
 *     [--output-dir outputs/...] [--verbose]
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import type { GameState, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");

/** Zielkorridor-Band relativ zu (Startbudget x Salary-Faktor). Leicht anpassbar, keine Logik-Änderung nötig. */
const CORRIDOR_MIN_RATIO = 0.8;
const CORRIDOR_MAX_RATIO = 1.3;

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toMio(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 1_000_000 ? value / 1_000_000 : value;
}

function fmt(value: number | null, digits = 1) {
  return value == null
    ? "—"
    : round(value, digits).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function seasonNumber(seasonId: string): number | null {
  const match = seasonId.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

type TeamCorridorRow = {
  teamCode: string;
  cashEnd: number | null;
  mwEnd: number | null;
  metric: number | null;
  startBudget: number | null;
  salaryFactor: number | null;
  target: number | null;
  ratio: number | null;
  status: "PASS" | "RED" | "NO_FACTOR" | "NO_DATA";
};

type SeasonCorridorSummary = {
  seasonId: string;
  seasonNum: number | null;
  rows: TeamCorridorRow[];
  teamsInCorridor: number;
  teamsRed: number;
  teamsNoFactor: number;
  teamsNoData: number;
  passPct: number | null;
};

export function buildSeasonCorridorSummaries(input: {
  gs: GameState;
  fromSeasonNum: number;
  toSeasonNum: number;
}): SeasonCorridorSummary[] {
  const { gs } = input;
  const startBudgetByTeamId = new Map(gs.teams.map((team) => [team.teamId, team.budget ?? null] as const));
  const teamCodeByTeamId = new Map(gs.teams.map((team) => [team.teamId, team.shortCode] as const));
  const factorBySeasonId = new Map(
    (gs.seasonState.seasonEconomyFactors ?? []).map((entry) => [entry.seasonId, entry.factor] as const),
  );
  const snapshotsBySeasonId = new Map(
    (gs.seasonState.seasonSnapshots ?? []).map((snap) => [snap.seasonId, snap] as const),
  );

  const summaries: SeasonCorridorSummary[] = [];
  for (let seasonNum = input.fromSeasonNum; seasonNum <= input.toSeasonNum; seasonNum += 1) {
    const seasonId = `season-${seasonNum}`;
    const snap = snapshotsBySeasonId.get(seasonId);
    const records: SeasonSnapshotTeamRecord[] =
      snap?.teamSnapshots && snap.teamSnapshots.length > 0
        ? snap.teamSnapshots
        : snap?.finalStandings ?? [];
    const recordByTeamId = new Map(records.map((rec) => [rec.teamId, rec] as const));
    const isCurrentLiveSeason = gs.season.id === seasonId && records.length === 0;

    const rows: TeamCorridorRow[] = gs.teams.map((team) => {
      const startBudget = startBudgetByTeamId.get(team.teamId) ?? null;
      const salaryFactor = factorBySeasonId.get(seasonId) ?? null;
      let cashEnd: number | null;
      let mwEnd: number | null;

      const rec = recordByTeamId.get(team.teamId);
      if (rec) {
        cashEnd = rec.cashEnd;
        mwEnd = rec.marketValueEnd ?? rec.marketValueTotalEnd ?? null;
      } else if (isCurrentLiveSeason) {
        const rosterEntries = gs.rosters.filter((entry) => entry.teamId === team.teamId);
        const playerById = new Map(gs.players.map((player) => [player.id, player]));
        mwEnd = rosterEntries.reduce((sum, entry) => {
          const player = playerById.get(entry.playerId);
          return sum + (player?.displayMarketValue ?? player?.marketValue ?? 0);
        }, 0);
        cashEnd = team.cash ?? null;
      } else {
        cashEnd = null;
        mwEnd = null;
      }

      const metric = cashEnd != null && mwEnd != null ? cashEnd + mwEnd : null;
      const target = startBudget != null && salaryFactor != null ? startBudget * salaryFactor : null;
      const ratio = metric != null && target != null && target > 0 ? metric / target : null;

      let status: TeamCorridorRow["status"];
      if (metric == null || startBudget == null) status = "NO_DATA";
      else if (salaryFactor == null) status = "NO_FACTOR";
      else if (ratio != null && ratio >= CORRIDOR_MIN_RATIO && ratio <= CORRIDOR_MAX_RATIO) status = "PASS";
      else status = "RED";

      return {
        teamCode: teamCodeByTeamId.get(team.teamId) ?? team.teamId,
        cashEnd,
        mwEnd,
        metric,
        startBudget,
        salaryFactor,
        target,
        ratio,
        status,
      };
    });

    const teamsInCorridor = rows.filter((row) => row.status === "PASS").length;
    const teamsRed = rows.filter((row) => row.status === "RED").length;
    const teamsNoFactor = rows.filter((row) => row.status === "NO_FACTOR").length;
    const teamsNoData = rows.filter((row) => row.status === "NO_DATA").length;
    const evaluable = teamsInCorridor + teamsRed;

    summaries.push({
      seasonId,
      seasonNum,
      rows,
      teamsInCorridor,
      teamsRed,
      teamsNoFactor,
      teamsNoData,
      passPct: evaluable > 0 ? round((teamsInCorridor / evaluable) * 100, 1) : null,
    });
  }
  return summaries;
}

export function buildSeasonCorridorMarkdown(input: { saveId: string; summaries: SeasonCorridorSummary[]; verbose: boolean }) {
  const { saveId, summaries, verbose } = input;
  const lines: string[] = [
    "# Season Corridor Trend (MW + Cash vs. Startbudget × Salary-Faktor)",
    "",
    `**Save:** \`${saveId}\``,
    `**Erstellt:** ${new Date().toISOString()}`,
    `**Korridor:** [${CORRIDOR_MIN_RATIO}x – ${CORRIDOR_MAX_RATIO}x] von (Startbudget × Salary-Faktor der Season)`,
    "",
    "## Trend S1 → S10",
    "",
    "| Season | Im Korridor | RED | Kein Faktor | Keine Daten | Pass-Quote |",
    "|---|---:|---:|---:|---:|---:|",
  ];

  for (const summary of summaries) {
    lines.push(
      `| ${summary.seasonId} | ${summary.teamsInCorridor}/${summary.rows.length} | ${summary.teamsRed} | ${summary.teamsNoFactor} | ${summary.teamsNoData} | ${summary.passPct != null ? `${summary.passPct}%` : "—"} |`,
    );
  }
  lines.push("");

  const evaluableSummaries = summaries.filter((summary) => summary.passPct != null);
  if (evaluableSummaries.length >= 2) {
    const first = evaluableSummaries[0];
    const last = evaluableSummaries[evaluableSummaries.length - 1];
    const delta = round((last.passPct ?? 0) - (first.passPct ?? 0), 1);
    const verdict = delta > 0 ? "✅ Verbesserung" : delta < 0 ? "❌ Verschlechterung" : "➖ unverändert";
    lines.push(
      `**Verlauf ${first.seasonId} → ${last.seasonId}:** ${first.passPct}% → ${last.passPct}% (Δ ${delta > 0 ? "+" : ""}${delta} Punkte) → ${verdict}`,
      "",
    );
  }

  if (verbose) {
    for (const summary of summaries) {
      lines.push(`## ${summary.seasonId} — Detail`, "");
      lines.push(
        "| Team | Cash | MW | Cash+MW | Startbudget | Salary-Faktor | Ziel (Budget×Faktor) | Ratio | Status |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---|",
      );
      for (const row of [...summary.rows].sort((a, b) => a.teamCode.localeCompare(b.teamCode, "de"))) {
        const badge =
          row.status === "PASS" ? "✅ PASS" : row.status === "RED" ? "🔴 RED" : row.status === "NO_FACTOR" ? "🟡 kein Faktor" : "⚪ keine Daten";
        lines.push(
          `| ${row.teamCode} | ${fmt(toMio(row.cashEnd))} | ${fmt(toMio(row.mwEnd))} | ${fmt(toMio(row.metric))} | ${fmt(toMio(row.startBudget))} | ${row.salaryFactor != null ? fmt(row.salaryFactor, 2) : "—"} | ${fmt(toMio(row.target))} | ${row.ratio != null ? `${fmt(row.ratio, 2)}x` : "—"} | ${badge} |`,
        );
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const saveId = argValue("--save-id");
  if (!saveId) throw new Error("Missing --save-id");
  const fromSeasonNum = seasonNumber(argValue("--from") ?? "season-1") ?? 1;
  const toSeasonNum = seasonNumber(argValue("--to") ?? "season-10") ?? 10;
  const outputDir = argValue("--output-dir");
  const verbose = process.argv.includes("--verbose");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);

  const summaries = buildSeasonCorridorSummaries({ gs: save.gameState, fromSeasonNum, toSeasonNum });
  const markdown = buildSeasonCorridorMarkdown({ saveId, summaries, verbose });

  console.log(markdown);

  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `season-corridor-trend-${saveId}.md`);
    fs.writeFileSync(outPath, `${markdown}\n`);
    console.log(`\nWrote ${outPath}`);
  }
}

const isDirectRun = process.argv[1]?.includes("season-corridor-trend");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
