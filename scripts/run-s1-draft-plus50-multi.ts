/**
 * S1 draft-only experiment: +50 cash to all teams before draft, repeated N times.
 *
 * Usage:
 *   node --import tsx scripts/run-s1-draft-plus50-multi.ts
 *   node --import tsx scripts/run-s1-draft-plus50-multi.ts --runs 5 --with-baseline
 *   node --import tsx scripts/run-s1-draft-plus50-multi.ts --runs 5 --cash-bonus 0
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

function writeFailureForensics(input: {
  outputDir: string;
  picksRun: Awaited<ReturnType<typeof runCanonicalSeasonOneDraftPhase>>["picksRun"];
  blockers: string[];
  teamsBelowMin: string[];
}) {
  if (input.teamsBelowMin.length === 0) {
    return;
  }
  const forensics = input.teamsBelowMin.map((entry) => {
    const [teamCode] = entry.split(":");
    const team = input.picksRun.teams.find((row) => row.teamCode === teamCode);
    if (!team) {
      return { teamCode, entry, error: "team_not_found_in_picks_run" };
    }
    return {
      teamCode,
      entry,
      rosterBefore: team.rosterBefore,
      rosterAfter: team.rosterAfter,
      targetRosterMin: team.targetRosterMin,
      targetRosterSize: team.targetRosterSize,
      teamBlockingReasons: team.blockingReasons,
      teamWarnings: team.warnings,
      executeWarnings: team.warnings.filter(
        (warning) =>
          warning.includes("partial") ||
          warning.includes("fallback") ||
          warning.includes("drift") ||
          warning.includes("excluded") ||
          warning.includes("emergency"),
      ),
      globalBlockers: input.picksRun.blockingReasons.filter((reason) => reason.includes(teamCode)),
      topupBlockers: input.blockers.filter((reason) => reason.includes(teamCode)),
      plannedPicks: team.plannedPicks.filter((pick) => pick.status !== "blocked").length,
      appliedPicks: team.plannedPicks.filter((pick) => pick.status === "applied").length,
      blockedPicks: team.plannedPicks.filter((pick) => pick.status === "blocked").length,
      picks: team.plannedPicks.map((pick) => ({
        status: pick.status,
        playerName: pick.playerName,
        marketValue: pick.marketValue,
        minimumReachableAfterPick: pick.minimumReachableAfterPick,
        warnings: pick.warnings,
      })),
      previewSummary: team.previewSummary,
    };
  });
  fs.writeFileSync(path.join(input.outputDir, "failure-forensics.json"), JSON.stringify(forensics, null, 2));
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

  writeFailureForensics({
    outputDir: config.outputDir,
    picksRun: draftPhase.picksRun,
    blockers: draftPhase.blockers,
    teamsBelowMin: result.teamsBelowMin,
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
  const batchRuns = results;
  const cashBonus = batchRuns[0]?.cashBonus ?? 0;
  const batchTitle = cashBonus > 0 ? `+${cashBonus} Cash` : "Standard-Cash";
  const lines: string[] = [
    `# S1 Draft ${batchTitle} Experiment`,
    "",
    cashBonus > 0
      ? "Fix: Bonus wird auf `team.cash` **und** `team.budget` angewendet (startingCash für Quality Gate)."
      : "Kein Start-Cash-Bonus — Teams draften mit normalem Season-1-Startbudget.",
    "",
    `## Zusammenfassung (${batchTitle} Runs)`,
    "",
    "| Run | Picks | Min-Rate | Opt-Rate | Ø Cash | Σ MW | spend>starting | insufficient |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const row of batchRuns) {
    lines.push(
      `| ${row.label} | ${row.aiRosterFillBuys} | ${row.teamsAtMin}/${row.teamCount} (${pct(row.teamsAtMin, row.teamCount)}%) | ${row.teamsAtOpt}/${row.teamCount} (${pct(row.teamsAtOpt, row.teamCount)}%) | ${row.avgCashRemaining} | ${row.sumMw} | ${row.plannedSpendExceedsStartingCashBlockers} | ${row.insufficientCashBlockers} |`,
    );
  }

  if (batchRuns.length > 1) {
    const avgPicks = round(batchRuns.reduce((sum, row) => sum + row.aiRosterFillBuys, 0) / batchRuns.length, 1);
    const avgMinRate = round(batchRuns.reduce((sum, row) => sum + pct(row.teamsAtMin, row.teamCount), 0) / batchRuns.length, 1);
    const avgOptRate = round(batchRuns.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / batchRuns.length, 1);
    const avgCash = round(batchRuns.reduce((sum, row) => sum + row.avgCashRemaining, 0) / batchRuns.length, 1);
    const avgMw = round(batchRuns.reduce((sum, row) => sum + row.sumMw, 0) / batchRuns.length, 0);

    lines.push(
      "",
      `**Mittelwerte (${batchTitle}, ${batchRuns.length} Runs):** Picks Ø ${avgPicks} · Min-Rate Ø ${avgMinRate}% · Opt-Rate Ø ${avgOptRate}% · Ø Cash ${avgCash} · Σ MW Ø ${avgMw}`,
    );
  }

  for (const row of batchRuns) {
    lines.push("", ...buildLeagueTable(row.teamRows, `${row.label} — Liga-Tabelle (32 Teams)`));
  }

  lines.push("", "## Edge-Case-Teams S-C · W-L · T-T", "");
  for (const row of batchRuns) {
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
    if (batchRuns.length > 0) {
      const avgPicks = round(batchRuns.reduce((sum, r) => sum + r.aiRosterFillBuys, 0) / batchRuns.length, 1);
      const avgOpt = round(batchRuns.reduce((sum, r) => sum + r.teamsAtOpt, 0) / batchRuns.length, 1);
      const avgMin = round(batchRuns.reduce((sum, r) => sum + r.teamsAtMin, 0) / batchRuns.length, 1);
      lines.push(
        `- Picks: ${avgPicks} vs ${baseline.aiRosterFillBuys} (${avgPicks - baseline.aiRosterFillBuys >= 0 ? "+" : ""}${round(avgPicks - baseline.aiRosterFillBuys, 1)})`,
        `- Opt-Teams Ø: ${avgOpt} vs ${baseline.teamsAtOpt} (${avgOpt - baseline.teamsAtOpt >= 0 ? "+" : ""}${round(avgOpt - baseline.teamsAtOpt, 1)})`,
        `- Min-Teams Ø: ${avgMin} vs ${baseline.teamsAtMin} (${avgMin - baseline.teamsAtMin >= 0 ? "+" : ""}${round(avgMin - baseline.teamsAtMin, 1)})`,
      );
      for (const code of SPECIAL_TEAMS) {
        const baseTeam = baseline.teamRows.find((t) => t.teamCode === code);
        const batchTeam = batchRuns.at(-1)?.teamRows.find((t) => t.teamCode === code);
        if (baseTeam && batchTeam) {
          lines.push(
            `- **${code}** (letzter Run): Opt ${batchTeam.roster}/${batchTeam.playerOpt} vs Baseline ${baseTeam.roster}/${baseTeam.playerOpt} · Cash ${batchTeam.cashAfter} vs ${baseTeam.cashAfter}`,
          );
        }
      }
    }
  }

  const last = batchRuns.at(-1);
  if (last) {
    lines.push("", "## Save-Pfade (letzter Run)", "", `- Output: \`${last.outputDir}\``, `- SQLite: \`${last.sqlitePath}\``, `- Save-ID: \`${last.saveId}\``);
  }

  const batchWorks = batchRuns.every((row) => row.aiRosterFillBuys > 0);
  const batchSuccessful = batchRuns.filter((row) => row.aiRosterFillBuys > 0);
  const noSpendBlockers = batchRuns.every((row) => row.plannedSpendExceedsStartingCashBlockers === 0);
  const avgOptRate =
    batchRuns.length > 0
      ? round(batchRuns.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / batchRuns.length, 1)
      : 0;
  const successOptRate =
    batchSuccessful.length > 0
      ? round(
          batchSuccessful.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / batchSuccessful.length,
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
  if (!batchWorks) {
    const failed = batchRuns.filter((row) => row.aiRosterFillBuys === 0);
    lines.push(
      "",
      `${failed.length}/${batchRuns.length} Runs scheitern am Quality Gate (z.B. \`season1_spend_floor_missed\` / \`season1_topup_below_min\`) — **nicht** mehr am startingCash-Budget-Mismatch.`,
    );
  }
  if (successOptRate != null && baselineOptRate != null) {
    const delta = round(successOptRate - baselineOptRate, 1);
    lines.push(
      "",
      `**Erfolgreiche Runs (${batchSuccessful.length}/${batchRuns.length}):** Opt-Rate Ø ${successOptRate}% vs Baseline ${baselineOptRate}% (${delta >= 0 ? "+" : ""}${delta} pp).`,
      delta >= 5
        ? `**Ja** — ${batchTitle} verbessert die Opt-Rate in erfolgreichen Runs deutlich.`
        : delta > 0
          ? "**Leicht ja** — Opt-Rate steigt moderat in erfolgreichen Runs."
          : "**Nein** — Opt-Rate verbessert sich nicht material.",
    );
  } else if (batchWorks && baselineOptRate != null) {
    lines.push(
      "",
      successOptRate != null && successOptRate > baselineOptRate
        ? `**Ja** — Opt-Rate Ø ${avgOptRate}% vs Baseline ${baselineOptRate}%.`
        : `Opt-Rate Ø ${avgOptRate}% — kein klarer Vorteil vs Baseline.`,
    );
  }

  return lines.join("\n");
}

function buildErrorSummary(results: RunResult[]) {
  const belowMinCounts = new Map<string, number>();
  const belowOptCounts = new Map<string, number>();
  const hardFailRuns: string[] = [];
  const zeroPickRuns: string[] = [];
  const blockerCounts = new Map<string, number>();

  for (const row of results) {
    if (row.teamsBelowMin.length > 0) {
      hardFailRuns.push(`${row.label}: ${row.teamsBelowMin.join(", ")}`);
    }
    if (row.aiRosterFillBuys === 0) {
      zeroPickRuns.push(row.label);
    }
    for (const entry of row.teamsBelowMin) {
      const teamCode = entry.split(":")[0];
      belowMinCounts.set(teamCode, (belowMinCounts.get(teamCode) ?? 0) + 1);
    }
    for (const entry of row.teamsBelowOpt) {
      const teamCode = entry.split(":")[0];
      belowOptCounts.set(teamCode, (belowOptCounts.get(teamCode) ?? 0) + 1);
    }
    for (const blocker of row.allBlockers) {
      const key = blocker.split(":")[0];
      blockerCounts.set(key, (blockerCounts.get(key) ?? 0) + 1);
    }
  }

  const chronicBelowOpt = [...belowOptCounts.entries()]
    .filter(([, count]) => count >= Math.max(2, Math.ceil(results.length * 0.6)))
    .sort((left, right) => right[1] - left[1])
    .map(([teamCode, count]) => ({ teamCode, count, runs: results.length }));

  const avgMinRate = round(
    results.reduce((sum, row) => sum + pct(row.teamsAtMin, row.teamCount), 0) / Math.max(1, results.length),
    1,
  );
  const avgOptRate = round(
    results.reduce((sum, row) => sum + pct(row.teamsAtOpt, row.teamCount), 0) / Math.max(1, results.length),
    1,
  );
  const avgCash = round(
    results.reduce((sum, row) => sum + row.avgCashRemaining, 0) / Math.max(1, results.length),
    1,
  );

  return {
    generatedAt: new Date().toISOString(),
    runCount: results.length,
    avgMinRate,
    avgOptRate,
    avgCash,
    hardFailRuns,
    zeroPickRuns,
    chronicBelowOpt,
    belowMinCounts: Object.fromEntries([...belowMinCounts.entries()].sort((a, b) => b[1] - a[1])),
    belowOptCounts: Object.fromEntries([...belowOptCounts.entries()].sort((a, b) => b[1] - a[1])),
    topBlockers: Object.fromEntries(
      [...blockerCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12),
    ),
  };
}

function buildErrorSummaryMarkdown(summary: ReturnType<typeof buildErrorSummary>) {
  const lines = [
    "## Fehleranalyse (aggregiert)",
    "",
    `| Metrik | Wert |`,
    `| --- | ---: |`,
    `| Runs | ${summary.runCount} |`,
    `| Min-Rate Ø | ${summary.avgMinRate}% |`,
    `| Opt-Rate Ø | ${summary.avgOptRate}% |`,
    `| Ø Cash | ${summary.avgCash} |`,
    `| Hard-Fail Runs | ${summary.hardFailRuns.length} |`,
    `| 0-Pick Runs | ${summary.zeroPickRuns.length} |`,
    "",
  ];
  if (summary.hardFailRuns.length > 0) {
    lines.push("### Hard-Fails", "", ...summary.hardFailRuns.map((entry) => `- ${entry}`), "");
  }
  if (summary.chronicBelowOpt.length > 0) {
    lines.push("### Chronic below-opt (≥60% Runs)", "");
    for (const entry of summary.chronicBelowOpt) {
      lines.push(`- **${entry.teamCode}:** ${entry.count}/${entry.runs} Runs`);
    }
    lines.push("");
  }
  if (Object.keys(summary.topBlockers).length > 0) {
    lines.push("### Top Blocker-Prefixe", "");
    for (const [key, count] of Object.entries(summary.topBlockers)) {
      lines.push(`- \`${key}\`: ${count}×`);
    }
  }
  return lines.join("\n");
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const runCount = Math.max(1, Number(argValue("--runs") ?? "5") || 5);
  const withBaseline = hasFlag("--with-baseline");
  const cashBonus = Math.max(0, Number(argValue("--cash-bonus") ?? "50") || 0);
  const batchLabel = cashBonus > 0 ? `plus${cashBonus}` : "standard";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rootOutput = path.join(PROJECT_ROOT, "outputs", `s1-draft-${batchLabel}-batch-${timestamp}`);
  fs.mkdirSync(rootOutput, { recursive: true });

  log(`Batch output → ${rootOutput}`);
  log(`Runs: ${runCount} (cashBonus=${cashBonus})${withBaseline ? " + baseline" : ""}`);

  const plus50Results: RunResult[] = [];
  for (let index = 1; index <= runCount; index += 1) {
    plus50Results.push(
      await runSingleDraft({
        label: `Run ${index}`,
        cashBonus,
        outputDir: path.join(rootOutput, `s1-draft-${batchLabel}-run${index}-${timestamp}`),
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
  const errorSummary = buildErrorSummary(plus50Results);
  const fullReport = `${report}\n\n${buildErrorSummaryMarkdown(errorSummary)}`;
  fs.writeFileSync(path.join(rootOutput, "report.md"), fullReport);
  fs.writeFileSync(path.join(rootOutput, "error-summary.json"), JSON.stringify(errorSummary, null, 2));
  fs.writeFileSync(
    path.join(rootOutput, "results.json"),
    JSON.stringify({ plus50Results, baseline, errorSummary, generatedAt: new Date().toISOString() }, null, 2),
  );

  console.log(fullReport);
  log(`Done → ${rootOutput}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
