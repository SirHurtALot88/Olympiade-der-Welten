/**
 * S1 draft-only experiment: +50 cash to all teams before draft, repeated N times.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-draft-plus50-multi.ts
 *   node --import tsx scripts/run-s1-draft-plus50-multi.ts --runs 5 --with-baseline
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import type { TeamControlSettings } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { runCanonicalSeasonOneDraftPhase } from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SPECIAL_TEAMS = ["S-C", "W-L", "T-T"] as const;

type RunConfig = {
  label: string;
  cashBonus: number;
  outputDir: string;
};

type TeamSnapshot = {
  teamCode: string;
  roster: number;
  playerMin: number;
  playerOpt: number;
  reachedMin: boolean;
  reachedOpt: boolean;
  cashAfter: number;
  budgetAfter: number;
  sumMw: number;
  status: string;
};

type RunResult = {
  label: string;
  cashBonus: number;
  saveId: string;
  sqlitePath: string;
  outputDir: string;
  durationMs: number;
  aiRosterFillBuys: number;
  plannedPicks: number;
  appliedPicks: number;
  teamsAtMin: number;
  teamsAtOpt: number;
  teamCount: number;
  teamsBelowMin: string[];
  teamsBelowOpt: string[];
  sumCashRemaining: number;
  avgCashRemaining: number;
  sumMw: number;
  insufficientCashBlockers: number;
  plannedSpendExceedsStartingCashBlockers: number;
  allBlockers: string[];
  specialTeams: Record<string, TeamSnapshot>;
  teamRows: TeamSnapshot[];
};

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function log(message: string) {
  console.error(`[s1-draft-plus50] ${message}`);
}

function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
  const settings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: `AI · ${team.shortCode}`,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
        notes: "s1_draft_plus50_experiment",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  const gameState = withScenarioMeta(
    {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
      seasonState: {
        ...save.gameState.seasonState,
        teamControlSettings: settings,
      },
    },
    {
      scenarioType: "sandbox_multiseason_test",
      label: "S1 Draft +50 Cash Experiment",
      description: "Isolated S1 draft-only run with optional pre-draft cash bonus.",
      sourceSaveId: save.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: false,
      containsFinalStandings: false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

function assertCleanStart(save: PersistedSaveGame, stage: string) {
  const state = save.gameState;
  const issues = [
    state.rosters.length > 0 ? `rosters:${state.rosters.length}` : null,
    state.transferHistory.length > 0 ? `transferHistory:${state.transferHistory.length}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  if (issues.length > 0) {
    throw new Error(`Clean start failed at ${stage}: ${issues.join(" | ")}`);
  }
}

/**
 * Bump pre-draft cash for all teams. The picks planner quality gate uses
 * `team.budget` as startingCash (see buildCashStrategy in ai-needs-picks-compare),
 * so both cash and budget must move together or planned_spend_exceeds_starting_cash fires.
 */
function addCashToAllTeams(save: PersistedSaveGame, persistence: PersistenceService, bonus: number) {
  if (bonus <= 0) return save;
  return persistence.saveSingleplayerState(save.saveId, {
    ...save.gameState,
    teams: save.gameState.teams.map((team) => {
      const cash = round((team.cash ?? 0) + bonus);
      const budget =
        Number.isFinite(team.budget) && team.budget > 0 ? round(team.budget + bonus) : cash;
      return { ...team, cash, budget };
    }),
  });
}

function teamStatus(row: Pick<TeamSnapshot, "reachedMin" | "reachedOpt">) {
  if (row.reachedOpt) return "opt";
  if (row.reachedMin) return "min";
  return "unter min";
}

function countBlockerMatches(blockers: string[], picksRunTeams: Array<{ blockingReasons: string[] }>, needle: string) {
  let count = 0;
  for (const entry of blockers) {
    if (entry.includes(needle)) count += 1;
  }
  for (const team of picksRunTeams) {
    for (const reason of team.blockingReasons) {
      if (reason.includes(needle)) count += 1;
    }
  }
  return count;
}

function collectRunMetrics(input: {
  save: PersistedSaveGame;
  picksRun: Awaited<ReturnType<typeof runCanonicalSeasonOneDraftPhase>>["picksRun"];
  blockers: string[];
  cashBonus: number;
  label: string;
  outputDir: string;
  sqlitePath: string;
  durationMs: number;
}): RunResult {
  const { save, picksRun, blockers, cashBonus, label, outputDir, sqlitePath, durationMs } = input;
  const gameState = save.gameState;
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));

  const aiRosterFillBuys = gameState.transferHistory.filter(
    (entry) => entry.seasonId === gameState.season.id && entry.transferType === "buy" && entry.source === "ai_roster_fill",
  ).length;

  const teamRows: TeamSnapshot[] = gameState.teams.map((team) => {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
    const { playerMin, playerOpt } = deriveRosterTargets(team, identity);
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    let sumMw = 0;
    for (const entry of gameState.rosters.filter((row) => row.teamId === team.teamId)) {
      const player = playerById.get(entry.playerId);
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      sumMw += economy.marketValue ?? 0;
    }
    const reachedMin = roster >= playerMin;
    const reachedOpt = roster >= playerOpt;
    return {
      teamCode: team.shortCode ?? team.teamId,
      roster,
      playerMin,
      playerOpt,
      reachedMin,
      reachedOpt,
      cashAfter: round(team.cash ?? 0),
      budgetAfter: round(team.budget ?? 0),
      sumMw: round(sumMw),
      status: teamStatus({ reachedMin, reachedOpt }),
    };
  });

  const teamsBelowMin = teamRows.filter((row) => !row.reachedMin).map((row) => `${row.teamCode}:${row.roster}/${row.playerMin}`);
  const teamsBelowOpt = teamRows.filter((row) => row.reachedMin && !row.reachedOpt).map((row) => `${row.teamCode}:${row.roster}/${row.playerOpt}`);

  let sumMw = 0;
  for (const entry of gameState.rosters) {
    const player = playerById.get(entry.playerId);
    const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
    sumMw += economy.marketValue ?? 0;
  }

  const sumCashRemaining = round(teamRows.reduce((sum, row) => sum + row.cashAfter, 0));
  const avgCashRemaining = round(sumCashRemaining / Math.max(1, teamRows.length));

  const specialTeams = Object.fromEntries(
    SPECIAL_TEAMS.map((code) => {
      const row = teamRows.find((entry) => entry.teamCode === code);
      return [code, row ?? null];
    }).filter((entry): entry is [string, TeamSnapshot] => entry[1] != null),
  );

  return {
    label,
    cashBonus,
    saveId: save.saveId,
    sqlitePath,
    outputDir,
    durationMs,
    aiRosterFillBuys,
    plannedPicks: picksRun.globalExecution.plannedPickCount,
    appliedPicks: picksRun.globalExecution.appliedPickCount,
    teamsAtMin: teamRows.filter((row) => row.reachedMin).length,
    teamsAtOpt: teamRows.filter((row) => row.reachedOpt).length,
    teamCount: teamRows.length,
    teamsBelowMin,
    teamsBelowOpt,
    sumCashRemaining,
    avgCashRemaining,
    sumMw: round(sumMw),
    insufficientCashBlockers: countBlockerMatches(blockers, picksRun.teams, "insufficient_cash"),
    plannedSpendExceedsStartingCashBlockers: countBlockerMatches(
      blockers,
      picksRun.teams,
      "planned_spend_exceeds_starting_cash",
    ),
    allBlockers: blockers,
    specialTeams,
    teamRows,
  };
}

async function runSingleDraft(config: RunConfig): Promise<RunResult> {
  fs.mkdirSync(config.outputDir, { recursive: true });
  delete process.env.OLY_APP_SQLITE_PATH;
  const isolation = ensureIsolatedLongRunDatabase({ outputDir: config.outputDir, projectRoot: PROJECT_ROOT });
  log(`${config.label}: isolated DB → ${isolation.sqlitePath}`);

  const persistence = createPersistenceService();
  const started = Date.now();

  const created = persistence.createFreshSeasonOneSave({
    name: `${config.label} ${new Date().toISOString()}`,
  });
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") {
    throw new Error(`${config.label}: season-start-reset blocked: ${reset.blockingReasons.join(" | ") || reset.warnings.join(" | ")}`);
  }

  let save = persistence.getSaveById(created.saveId) ?? created;
  assertCleanStart(save, "after season-start-reset");
  save = setAllTeamsAi(save, persistence);

  if (config.cashBonus > 0) {
    const cashBefore = save.gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0);
    const budgetBefore = save.gameState.teams.reduce((sum, team) => sum + (team.budget ?? 0), 0);
    save = addCashToAllTeams(save, persistence, config.cashBonus);
    const cashAfter = save.gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0);
    const budgetAfter = save.gameState.teams.reduce((sum, team) => sum + (team.budget ?? 0), 0);
    const budgetMismatch = save.gameState.teams.filter(
      (team) => Math.abs((team.cash ?? 0) - (team.budget ?? 0)) > 0.01,
    ).length;
    log(
      `${config.label}: +${config.cashBonus}/team cash+budget (cash ${round(cashBefore)}→${round(cashAfter)}, budget ${round(budgetBefore)}→${round(budgetAfter)}, mismatch=${budgetMismatch})`,
    );
  }

  const draftPhase = await runCanonicalSeasonOneDraftPhase(save, persistence);
  save = persistence.getSaveById(save.saveId) ?? save;
  const durationMs = Date.now() - started;

  const result = collectRunMetrics({
    save,
    picksRun: draftPhase.picksRun,
    blockers: draftPhase.blockers,
    cashBonus: config.cashBonus,
    label: config.label,
    outputDir: config.outputDir,
    sqlitePath: isolation.sqlitePath,
    durationMs,
  });

  fs.writeFileSync(path.join(config.outputDir, "run-result.json"), JSON.stringify(result, null, 2));
  log(
    `${config.label}: picks=${result.aiRosterFillBuys} min=${result.teamsAtMin}/${result.teamCount} opt=${result.teamsAtOpt}/${result.teamCount} avgCash=${result.avgCashRemaining} (${Math.round(durationMs / 1000)}s)`,
  );
  return result;
}

function pct(n: number, total: number) {
  return total > 0 ? round((n / total) * 100, 1) : 0;
}

function formatTeamRow(row: TeamSnapshot, highlight = false) {
  const prefix = highlight ? "**" : "";
  const suffix = highlight ? "**" : "";
  return `| ${prefix}${row.teamCode}${suffix} | ${row.roster} | ${row.sumMw} | ${row.cashAfter} | ${row.playerMin} | ${row.playerOpt} | ${row.status} |`;
}

function buildLeagueTable(rows: TeamSnapshot[], title: string) {
  const lines = [
    `### ${title}`,
    "",
    "| Team | Spieler | MW | Cash | Min | Opt | Status |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of rows) {
    lines.push(formatTeamRow(row, SPECIAL_TEAMS.includes(row.teamCode as (typeof SPECIAL_TEAMS)[number])));
  }
  return lines;
}

function buildGermanReport(results: RunResult[], baseline: RunResult | null) {
  const plus50 = results.filter((row) => row.cashBonus > 0);
  const lines: string[] = [
    "# S1 Draft +50 Cash Experiment (Fix: cash + budget)",
    "",
    "Fix: +50 wird auf `team.cash` **und** `team.budget` angewendet (startingCash für Quality Gate).",
    "",
    "## Zusammenfassung (+50 Runs)",
    "",
    "| Run | Picks | Min-Rate | Opt-Rate | Ø Cash | Σ MW | spend>starting | insufficient |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of plus50) {
    lines.push(
      `| ${row.label} | ${row.aiRosterFillBuys} | ${row.teamsAtMin}/${row.teamCount} (${pct(row.teamsAtMin, row.teamCount)}%) | ${row.teamsAtOpt}/${row.teamCount} (${pct(row.teamsAtOpt, row.teamCount)}%) | ${row.avgCashRemaining} | ${row.sumMw} | ${row.plannedSpendExceedsStartingCashBlockers} | ${row.insufficientCashBlockers} |`,
    );
  }

  if (plus50.length > 1) {
    const avgPicks = round(plus50.reduce((sum, row) => sum + row.aiRosterFillBuys, 0) / plus50.length, 1);
    const avgMinRate = round(plus50.reduce((sum, row) => sum + pct(row.teamsAtMin, row.teamCount), 0) / plus50.length, 1);
    const avgOptRate = round(plus50.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / plus50.length, 1);
    const avgCash = round(plus50.reduce((sum, row) => sum + row.avgCashRemaining, 0) / plus50.length, 1);
    const avgMw = round(plus50.reduce((sum, row) => sum + row.sumMw, 0) / plus50.length, 0);

    lines.push(
      "",
      `**Mittelwerte (+50, ${plus50.length} Runs):** Picks Ø ${avgPicks} · Min-Rate Ø ${avgMinRate}% · Opt-Rate Ø ${avgOptRate}% · Ø Cash ${avgCash} · Σ MW Ø ${avgMw}`,
    );
  }

  for (const row of plus50) {
    lines.push("", ...buildLeagueTable(row.teamRows, `${row.label} — Liga-Tabelle (32 Teams)`));
  }

  lines.push("", "## Edge-Case-Teams S-C · W-L · T-T", "");
  for (const row of plus50) {
    lines.push(`**${row.label}**`);
    for (const code of SPECIAL_TEAMS) {
      const team = row.specialTeams[code];
      if (!team) {
        lines.push(`- ${code}: nicht gefunden`);
        continue;
      }
      lines.push(
        `- **${code}:** ${team.roster} Spieler · MW ${team.sumMw} · Cash ${team.cashAfter} · Min ${team.playerMin} / Opt ${team.playerOpt} · **${team.status}**`,
      );
    }
    lines.push("");
  }

  if (baseline) {
    lines.push(
      "## Baseline (ohne +50)",
      "",
      "| Metrik | Wert |",
      "| --- | ---: |",
      `| Picks | ${baseline.aiRosterFillBuys} |`,
      `| Min-Rate | ${baseline.teamsAtMin}/${baseline.teamCount} (${pct(baseline.teamsAtMin, baseline.teamCount)}%) |`,
      `| Opt-Rate | ${baseline.teamsAtOpt}/${baseline.teamCount} (${pct(baseline.teamsAtOpt, baseline.teamCount)}%) |`,
      `| Ø Cash | ${baseline.avgCashRemaining} |`,
      `| Σ MW | ${baseline.sumMw} |`,
      `| spend>starting | ${baseline.plannedSpendExceedsStartingCashBlockers} |`,
      "",
      ...buildLeagueTable(baseline.teamRows, "Baseline — Liga-Tabelle"),
      "",
      "### Delta (+50 Mittel vs Baseline)",
      "",
    );
    if (plus50.length > 0) {
      const avgPicks = round(plus50.reduce((sum, r) => sum + r.aiRosterFillBuys, 0) / plus50.length, 1);
      const avgOpt = round(plus50.reduce((sum, r) => sum + r.teamsAtOpt, 0) / plus50.length, 1);
      const avgMin = round(plus50.reduce((sum, r) => sum + r.teamsAtMin, 0) / plus50.length, 1);
      lines.push(
        `- Picks: ${avgPicks} vs ${baseline.aiRosterFillBuys} (${avgPicks - baseline.aiRosterFillBuys >= 0 ? "+" : ""}${round(avgPicks - baseline.aiRosterFillBuys, 1)})`,
        `- Opt-Teams Ø: ${avgOpt} vs ${baseline.teamsAtOpt} (${avgOpt - baseline.teamsAtOpt >= 0 ? "+" : ""}${round(avgOpt - baseline.teamsAtOpt, 1)})`,
        `- Min-Teams Ø: ${avgMin} vs ${baseline.teamsAtMin} (${avgMin - baseline.teamsAtMin >= 0 ? "+" : ""}${round(avgMin - baseline.teamsAtMin, 1)})`,
      );
      for (const code of SPECIAL_TEAMS) {
        const baseTeam = baseline.teamRows.find((t) => t.teamCode === code);
        const plusTeam = plus50.at(-1)?.teamRows.find((t) => t.teamCode === code);
        if (baseTeam && plusTeam) {
          lines.push(
            `- **${code}** (letzter +50-Run): Opt ${plusTeam.roster}/${plusTeam.playerOpt} vs Baseline ${baseTeam.roster}/${baseTeam.playerOpt} · Cash ${plusTeam.cashAfter} vs ${baseTeam.cashAfter}`,
          );
        }
      }
    }
  }

  const last = plus50.at(-1);
  if (last) {
    lines.push("", "## Save-Pfade (letzter +50-Run)", "", `- Output: \`${last.outputDir}\``, `- SQLite: \`${last.sqlitePath}\``, `- Save-ID: \`${last.saveId}\``);
  }

  const plus50Works = plus50.every((row) => row.aiRosterFillBuys > 0);
  const plus50Successful = plus50.filter((row) => row.aiRosterFillBuys > 0);
  const noSpendBlockers = plus50.every((row) => row.plannedSpendExceedsStartingCashBlockers === 0);
  const avgOptRate =
    plus50.length > 0
      ? round(plus50.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / plus50.length, 1)
      : 0;
  const successOptRate =
    plus50Successful.length > 0
      ? round(
          plus50Successful.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / plus50Successful.length,
          1,
        )
      : null;
  const baselineOptRate = baseline ? pct(baseline.teamsAtOpt, baseline.teamCount) : null;

  lines.push("", "## Fazit", "");
  if (noSpendBlockers) {
    lines.push(
      "✓ **Fix bestätigt:** `planned_spend_exceeds_starting_cash` = 0 in allen Runs (cash+budget synchron).",
    );
  }
  if (!plus50Works) {
    const failed = plus50.filter((row) => row.aiRosterFillBuys === 0);
    lines.push(
      "",
      `${failed.length}/${plus50.length} +50-Runs scheitern am Quality Gate (z.B. \`season1_spend_floor_missed\` / \`season1_topup_below_min\`) — **nicht** mehr am startingCash-Budget-Mismatch.`,
    );
  }
  if (successOptRate != null && baselineOptRate != null) {
    const delta = round(successOptRate - baselineOptRate, 1);
    lines.push(
      "",
      `**Erfolgreiche +50-Runs (${plus50Successful.length}/${plus50.length}):** Opt-Rate Ø ${successOptRate}% vs Baseline ${baselineOptRate}% (${delta >= 0 ? "+" : ""}${delta} pp).`,
      delta >= 5
        ? "**Ja** — +50 Start-Cash (cash+budget) verbessert die Opt-Rate in erfolgreichen Runs deutlich; Teams behalten mehr Cash und erreichen häufiger Opt-Kader."
        : delta > 0
          ? "**Leicht ja** — Opt-Rate steigt moderat in erfolgreichen Runs."
          : "**Nein** — Opt-Rate verbessert sich nicht material.",
    );
  } else if (plus50Works && baselineOptRate != null) {
    lines.push(
      "",
      successOptRate != null && successOptRate > baselineOptRate
        ? `**Ja** — Opt-Rate Ø ${avgOptRate}% vs Baseline ${baselineOptRate}%.`
        : `Opt-Rate Ø ${avgOptRate}% — kein klarer Vorteil vs Baseline.`,
    );
  }

  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const runCount = Math.max(1, Number(argValue("--runs") ?? "5") || 5);
  const withBaseline = hasFlag("--with-baseline");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rootOutput = path.join(PROJECT_ROOT, "outputs", `s1-draft-plus50-fixed-batch-${timestamp}`);
  fs.mkdirSync(rootOutput, { recursive: true });

  log(`Batch output → ${rootOutput}`);
  log(`Runs: ${runCount}${withBaseline ? " + baseline" : ""}`);

  const plus50Results: RunResult[] = [];
  for (let index = 1; index <= runCount; index += 1) {
    plus50Results.push(
      await runSingleDraft({
        label: `Run ${index}`,
        cashBonus: 50,
        outputDir: path.join(rootOutput, `s1-draft-plus50-run${index}-${timestamp}`),
      }),
    );
  }

  let baseline: RunResult | null = null;
  if (withBaseline) {
    baseline = await runSingleDraft({
      label: "Baseline",
      cashBonus: 0,
      outputDir: path.join(rootOutput, `s1-draft-baseline-${timestamp}`),
    });
  }

  const report = buildGermanReport(plus50Results, baseline);
  fs.writeFileSync(path.join(rootOutput, "report.md"), report);
  fs.writeFileSync(
    path.join(rootOutput, "results.json"),
    JSON.stringify({ plus50Results, baseline, generatedAt: new Date().toISOString() }, null, 2),
  );

  console.log(report);
  log(`Done → ${rootOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
