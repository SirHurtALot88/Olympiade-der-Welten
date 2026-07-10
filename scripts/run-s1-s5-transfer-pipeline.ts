/**
 * Transfer-only multi-season pipeline: draft + season_end sells + preseason buys (no matchdays).
 *
 * Benchmark KPIs:
 * - season_end: roster Min/Opt **before** market sells (pre-sell)
 * - draft / preseason: roster Min/Opt **after** buys (post-buy)
 *
 * Usage: node --import tsx scripts/run-s1-s5-transfer-pipeline.ts [--seasons 10]
 */
import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import {
  buildLeagueMarketBrackets,
  classifyMarketBracket,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { closeDatabaseForMaintenance } from "@/lib/persistence/sqlite";
import { runCanonicalSeasonOneBootstrap } from "@/lib/season/long-run-canonical";
import { ensureIsolatedLongRunDatabase } from "@/lib/season/long-run-db-isolation";
import {
  getLongRunPlannerMaxLeagueRounds,
  getLongRunPlannerMaxTeamCycles,
} from "@/lib/season/long-run-profile";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import {
  collectSeasonTransferPipelineGuv,
  formatTransferPipelineGuvMarkdown,
} from "@/lib/season/transfer-pipeline-guv";
import {
  collectSeasonWealthSnapshot,
  formatWealthSnapshotLogLine,
  formatWealthTrackMarkdown,
  type SeasonWealthSnapshot,
} from "@/lib/season/transfer-pipeline-wealth-tracker";
import { isTransferActionAllowed } from "@/lib/season/transfer-season-policy";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

import {
  PROJECT_ROOT,
  applyQuickSimSeasonEndStack,
  bootstrapFastSeasonOneCompleted,
  collectTeamRows,
  countDraftBuys,
  log,
  round,
  runEmergencyRepairIfNeeded,
  setAllTeamsAi,
  summarizeEngines,
} from "./s1-s2-transfer-shared";

let FINAL_SEASON = 10;
let TAG = "s1-s10-transfer";

function parseSeasonsArg() {
  const idx = process.argv.indexOf("--seasons");
  if (idx >= 0) {
    const parsed = Number(process.argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed >= 1) return Math.floor(parsed);
  }
  return 10;
}

function configurePipelineScope() {
  FINAL_SEASON = parseSeasonsArg();
  TAG = `s1-s${FINAL_SEASON}-transfer`;
}

const S1_QUOTA_REF = {
  Superstar: 3,
  Star: 8,
  Core: 5,
  Depth: 188,
  Backup: 186,
};

const TIMING_MS = {
  draft: { target: 30_000, alarm: 60_000 },
  preseason: { target: 35_000, alarm: 60_000 },
  seasonEnd: { alarm: 120_000 },
};

type BracketCounts = Record<MarketBracketTierLabel, number>;

type PhaseRecord = {
  seasonNumber: number;
  seasonId: string;
  phase: "draft" | "season_end" | "preseason";
  durationMs: number;
  buys: number;
  sells: number;
  teamsAtMin: number;
  teamsAtOpt: number;
  avgCash: number;
  brackets: BracketCounts;
  engineSummary: Record<string, number>;
  blockingReasons: string[];
  warnings: string[];
  emergencyRepairTeams: number;
  cashBefore?: number;
  cashAfter?: number;
  /** Informational only — season_end post-sell counts must not drive acceptance gates. */
  teamsAtMinAfterSells?: number;
  teamsAtOptAfterSells?: number;
  timingGate: "pass" | "warn" | "fail";
  quotaGate: "pass" | "warn" | "fail" | "n/a";
  minOptGate: "pass" | "fail";
};

type PipelineResult = {
  timestamp: string;
  outputDir: string;
  saveId: string;
  sqlitePath: string;
  totalDurationMs: number;
  phases: PhaseRecord[];
  wealthSnapshots: SeasonWealthSnapshot[];
  hardFails: string[];
  allGatesGreen: boolean;
};

function emptyBrackets(): BracketCounts {
  return { Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0 };
}

function writePhaseCheckpoint(outputDir: string, record: PhaseRecord) {
  fs.writeFileSync(
    path.join(outputDir, `phase-${record.seasonId}-${record.phase}.json`),
    JSON.stringify(record, null, 2),
  );
  const manifestPath = path.join(outputDir, "phases-manifest.json");
  const manifest: PhaseRecord[] = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PhaseRecord[])
    : [];
  const without = manifest.filter(
    (entry) => !(entry.seasonId === record.seasonId && entry.phase === record.phase),
  );
  without.push(record);
  without.sort((left, right) => {
    const seasonDelta = left.seasonNumber - right.seasonNumber;
    if (seasonDelta !== 0) return seasonDelta;
    const order = { draft: 0, season_end: 1, preseason: 2 } as const;
    return order[left.phase] - order[right.phase];
  });
  fs.writeFileSync(manifestPath, JSON.stringify(without, null, 2));
}

function reconstructPhasesFromLog(logPath: string, draftRecord: PhaseRecord): PhaseRecord[] {
  if (!fs.existsSync(logPath)) return [draftRecord];
  const logText = fs.readFileSync(logPath, "utf8");
  const phases: PhaseRecord[] = [draftRecord];

  const endMatch = logText.matchAll(
    /\[s1-s\d+-transfer\] (season-\d+) season_end: benchmark\(pre-sell\) min=(\d+)\/32 opt=(\d+)\/32 sells=(\d+)(?: post-sell min=(\d+)\/32)? \((\d+)s\)/g,
  );
  for (const match of endMatch) {
    const seasonId = match[1];
    phases.push({
      seasonNumber: parseSeasonNumber(seasonId),
      seasonId,
      phase: "season_end",
      durationMs: Number(match[6]) * 1000,
      buys: 0,
      sells: Number(match[4]),
      teamsAtMin: Number(match[2]),
      teamsAtOpt: Number(match[3]),
      teamsAtMinAfterSells: match[5] ? Number(match[5]) : undefined,
      avgCash: 0,
      brackets: emptyBrackets(),
      engineSummary: {},
      blockingReasons: [],
      warnings: [],
      emergencyRepairTeams: 0,
      timingGate: Number(match[6]) > 120 ? "fail" : "pass",
      quotaGate: "n/a",
      minOptGate: "pass",
    });
  }

  const preMatch = logText.matchAll(
    /\[s1-s\d+-transfer\] (season-\d+) preseason: buys=(\d+) benchmark\(post-buy\) min=(\d+)\/32 opt=(\d+)\/32 Star=(\d+) Backup=(\d+) \((\d+)s\)/g,
  );
  for (const match of preMatch) {
    const seasonId = match[1];
    const teamsAtMin = Number(match[3]);
    const durationMs = Number(match[7]) * 1000;
    phases.push({
      seasonNumber: parseSeasonNumber(seasonId),
      seasonId,
      phase: "preseason",
      durationMs,
      buys: Number(match[2]),
      sells: 0,
      teamsAtMin,
      teamsAtOpt: Number(match[4]),
      avgCash: 0,
      brackets: {
        ...emptyBrackets(),
        Star: Number(match[5]),
        Backup: Number(match[6]),
      },
      engineSummary: {},
      blockingReasons: [],
      warnings: ["preseason_s1_draft_batch"],
      emergencyRepairTeams: 0,
      timingGate: durationMs > 60_000 ? "fail" : durationMs > 35_000 ? "warn" : "pass",
      quotaGate: teamsAtMin >= 32 ? "pass" : "warn",
      minOptGate: teamsAtMin >= 32 ? "pass" : "fail",
    });
  }

  phases.sort((left, right) => {
    const seasonDelta = left.seasonNumber - right.seasonNumber;
    if (seasonDelta !== 0) return seasonDelta;
    const order = { draft: 0, season_end: 1, preseason: 2 } as const;
    return order[left.phase] - order[right.phase];
  });
  return phases;
}

function loadExistingPhases(outputDir: string): PhaseRecord[] {
  const manifestPath = path.join(outputDir, "phases-manifest.json");
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PhaseRecord[];
  }
  const draftPath = path.join(outputDir, "s1-draft-checkpoint.json");
  if (fs.existsSync(draftPath)) {
    return [JSON.parse(fs.readFileSync(draftPath, "utf8")) as PhaseRecord];
  }
  return [];
}

function parseResumeArgs() {
  const resumeDbIdx = process.argv.indexOf("--resume-db");
  const saveIdIdx = process.argv.indexOf("--save-id");
  const outputDirIdx = process.argv.indexOf("--output-dir");
  if (resumeDbIdx === -1) return null;
  return {
    sqlitePath: process.argv[resumeDbIdx + 1] ?? "",
    saveId: saveIdIdx >= 0 ? process.argv[saveIdIdx + 1] ?? "" : "",
    outputDir: outputDirIdx >= 0 ? process.argv[outputDirIdx + 1] ?? "" : "",
  };
}

function seasonIdForNumber(seasonNumber: number) {
  return `season-${seasonNumber}`;
}

function parseSeasonNumber(seasonId: string) {
  const match = seasonId.match(/^season-(\d+)$/);
  return match ? Number(match[1]) : 1;
}

async function continueTransferLoop(input: {
  save: PersistedSaveGame;
  persistence: PersistenceService;
  outputDir: string;
  phases: PhaseRecord[];
  wealthSnapshots: SeasonWealthSnapshot[];
}) {
  let save = input.save;

  while (parseSeasonNumber(save.gameState.season.id) <= FINAL_SEASON) {
    const seasonNumber = parseSeasonNumber(save.gameState.season.id);

    if (save.gameState.gamePhase === "season_completed") {
      if (seasonNumber >= FINAL_SEASON) break;
      save = await transitionToNextSeason(save, input.persistence, seasonNumber);
      const preseason = await runPreseasonPhase({
        save,
        persistence: input.persistence,
        seasonNumber: seasonNumber + 1,
        outputDir: input.outputDir,
        wealthSnapshots: input.wealthSnapshots,
      });
      save = preseason.save;
      pushPhase(input.outputDir, input.phases, preseason.record);
      continue;
    }

    const seasonEnd = await runSeasonEndPhase({
      save,
      persistence: input.persistence,
      seasonNumber,
    });
    save = seasonEnd.save;
    pushPhase(input.outputDir, input.phases, seasonEnd.record);
  }

  return save;
}

function leagueCashSum(gameState: GameState) {
  return round(gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0));
}

function countBuyBrackets(gameState: GameState, seasonId: string, sources?: string[]): BracketCounts {
  const buys = gameState.transferHistory.filter((entry) => {
    if (entry.seasonId !== seasonId || entry.transferType !== "buy") return false;
    if (!sources || sources.length === 0) return true;
    return sources.includes(entry.source ?? "");
  });
  const prices = buys.map((entry) => entry.fee ?? entry.marketValue ?? 0).filter((value) => value > 0);
  const brackets = buildLeagueMarketBrackets(prices);
  const counts = emptyBrackets();
  for (const price of prices) {
    const tier = classifyMarketBracket(price, brackets);
    counts[tier] += 1;
  }
  return counts;
}

function summarizeTeamMinOpt(gameState: GameState) {
  const rows = collectTeamRows(gameState);
  return {
    teamsAtMin: rows.filter((row) => row.atMin).length,
    teamsAtOpt: rows.filter((row) => row.atOpt).length,
    avgCash: round(rows.reduce((sum, row) => sum + row.cash, 0) / Math.max(1, rows.length)),
  };
}

function evaluateTimingGate(phase: PhaseRecord["phase"], durationMs: number): PhaseRecord["timingGate"] {
  if (phase === "draft") {
    if (durationMs > TIMING_MS.draft.alarm) return "fail";
    if (durationMs > TIMING_MS.draft.target) return "warn";
    return "pass";
  }
  if (phase === "preseason") {
    if (durationMs > TIMING_MS.preseason.alarm) return "fail";
    if (durationMs > TIMING_MS.preseason.target) return "warn";
    return "pass";
  }
  if (durationMs > TIMING_MS.seasonEnd.alarm) return "fail";
  return "pass";
}

function evaluateQuotaGate(phase: PhaseRecord["phase"], seasonNumber: number, brackets: BracketCounts): PhaseRecord["quotaGate"] {
  if (phase === "season_end") return "n/a";
  if (phase === "draft" && seasonNumber === 1) {
    const starOk = Math.abs(brackets.Star - S1_QUOTA_REF.Star) <= Math.ceil(S1_QUOTA_REF.Star * 0.35);
    const backupOk = brackets.Backup <= S1_QUOTA_REF.Backup + 25;
    return starOk && backupOk ? "pass" : "warn";
  }
  if (phase === "preseason" && seasonNumber >= 2) {
    const starOk = brackets.Star >= 4 && brackets.Star <= 12;
    const backupOk = brackets.Backup <= 220;
    return starOk && backupOk ? "pass" : "warn";
  }
  return "n/a";
}

function evaluateMinOptGate(phase: PhaseRecord["phase"], teamsAtMin: number): PhaseRecord["minOptGate"] {
  if (phase === "season_end") return "pass";
  return teamsAtMin >= 32 ? "pass" : "fail";
}

function checkEngineWarnings(engineSummary: Record<string, number>, warnings: string[]): string[] {
  const issues: string[] = [];
  const legacy = (engineSummary.legacy ?? 0) + (engineSummary.repair ?? 0);
  if (legacy >= 8) issues.push(`engine_legacy_repair_dominant:${legacy}`);
  if (warnings.some((entry) => /convergence_loop/i.test(entry))) {
    issues.push("convergence_loop_detected");
  }
  if (!warnings.some((entry) => /preseason_s1_draft_batch/i.test(entry)) && warnings.length > 0) {
    // preseason may encode batch in session metadata instead of warnings — only flag convergence
  }
  return issues;
}

async function runS1Draft(input: {
  persistence: PersistenceService;
  outputDir: string;
  wealthSnapshots: SeasonWealthSnapshot[];
}): Promise<{ save: PersistedSaveGame; record: PhaseRecord }> {
  let save = input.persistence.createFreshSeasonOneSave({
    name: `S1-S${FINAL_SEASON} Transfer Pipeline ${new Date().toISOString()}`,
  });
  save = setAllTeamsAi(save, input.persistence);

  const cashBefore = leagueCashSum(save.gameState);
  const started = Date.now();
  log("S1 canonical draft bootstrap…", TAG);
  const bootstrap = await runCanonicalSeasonOneBootstrap(save, input.persistence);
  const durationMs = Date.now() - started;
  save = input.persistence.getSaveById(save.saveId)!;

  const { teamsAtMin, teamsAtOpt, avgCash } = summarizeTeamMinOpt(save.gameState);
  const brackets = countBuyBrackets(save.gameState, "season-1");
  const record: PhaseRecord = {
    seasonNumber: 1,
    seasonId: "season-1",
    phase: "draft",
    durationMs,
    buys: countDraftBuys(save.gameState),
    sells: 0,
    teamsAtMin,
    teamsAtOpt,
    avgCash,
    brackets,
    engineSummary: {},
    blockingReasons: bootstrap.blockers.slice(0, 10),
    warnings: [],
    emergencyRepairTeams: 0,
    cashBefore,
    cashAfter: leagueCashSum(save.gameState),
    timingGate: "pass",
    quotaGate: "n/a",
    minOptGate: "pass",
  };
  record.timingGate = evaluateTimingGate("draft", durationMs);
  record.quotaGate = evaluateQuotaGate("draft", 1, brackets);
  record.minOptGate = evaluateMinOptGate("draft", teamsAtMin);

  fs.writeFileSync(path.join(input.outputDir, "s1-draft-checkpoint.json"), JSON.stringify(record, null, 2));
  writePhaseCheckpoint(input.outputDir, record);
  log(
    `S1 draft: benchmark(post-buy) picks=${record.buys} min=${teamsAtMin}/32 opt=${teamsAtOpt}/32 SS=${brackets.Superstar} Star=${brackets.Star} (${Math.round(durationMs / 1000)}s)`,
    TAG,
  );
  pushWealthSnapshot(input.wealthSnapshots, save.gameState, save.saveId, "season-1", "draft", TAG);
  return { save, record };
}

async function runSeasonEndPhase(input: {
  save: PersistedSaveGame;
  persistence: PersistenceService;
  seasonNumber: number;
}): Promise<{ save: PersistedSaveGame; record: PhaseRecord }> {
  const seasonId = seasonIdForNumber(input.seasonNumber);
  if (input.save.gameState.season.id !== seasonId) {
    throw new Error(`Expected ${seasonId}, got ${input.save.gameState.season.id}`);
  }

  const cashBefore = leagueCashSum(input.save.gameState);
  const started = Date.now();
  log(`${seasonId} season-end stack (sponsor apply, no prize payout)…`, TAG);
  const seasonEndStack = await applyQuickSimSeasonEndStack(input.save, input.persistence);
  let save = seasonEndStack.save;
  log(
    `${seasonId} sponsor gross=${seasonEndStack.sponsorGrossCashDelta} net=${seasonEndStack.sponsorNetCashDelta} applied=${seasonEndStack.sponsorApplied}`,
    TAG,
  );
  log(
    `${seasonId} contracts renewed=${seasonEndStack.contractsRenewed} released=${seasonEndStack.contractsReleased} exitCash=${seasonEndStack.contractExitCashDelta} · facilities actions=${seasonEndStack.facilityActionsApplied} income=${seasonEndStack.facilityIncomeTotal} upkeep=${seasonEndStack.facilityUpkeepTotal}`,
    TAG,
  );

  const preSellBenchmark = summarizeTeamMinOpt(save.gameState);

  log(`${seasonId} season_end sell…`, TAG);
  const session = await runTransferWindowSession({
    saveId: save.saveId,
    seasonId,
    persistence: input.persistence,
    phase: "season_end",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: isTransferActionAllowed(seasonId, "season_end_market_buy"),
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });
  const durationMs = Date.now() - started;
  save = input.persistence.getSaveById(save.saveId)!;

  const postSellRoster = summarizeTeamMinOpt(save.gameState);
  const record: PhaseRecord = {
    seasonNumber: input.seasonNumber,
    seasonId,
    phase: "season_end",
    durationMs,
    buys: session.appliedBuys,
    sells: session.appliedSells,
    teamsAtMin: preSellBenchmark.teamsAtMin,
    teamsAtOpt: preSellBenchmark.teamsAtOpt,
    teamsAtMinAfterSells: postSellRoster.teamsAtMin,
    teamsAtOptAfterSells: postSellRoster.teamsAtOpt,
    avgCash: postSellRoster.avgCash,
    brackets: emptyBrackets(),
    engineSummary: summarizeEngines(session.perTeam),
    blockingReasons: session.blockingReasons.slice(0, 10),
    warnings: session.warnings.slice(0, 20),
    emergencyRepairTeams: 0,
    cashBefore,
    cashAfter: leagueCashSum(save.gameState),
    timingGate: evaluateTimingGate("season_end", durationMs),
    quotaGate: "n/a",
    minOptGate: evaluateMinOptGate("season_end", preSellBenchmark.teamsAtMin),
  };

  log(
    `${seasonId} season_end: benchmark(pre-sell) min=${preSellBenchmark.teamsAtMin}/32 opt=${preSellBenchmark.teamsAtOpt}/32 sells=${record.sells} post-sell min=${postSellRoster.teamsAtMin}/32 (${Math.round(durationMs / 1000)}s)`,
    TAG,
  );
  return { save, record };
}

function pushWealthSnapshot(
  snapshots: SeasonWealthSnapshot[],
  gameState: GameState,
  saveId: string,
  seasonId: string,
  phase: "draft" | "preseason",
  tag: string,
) {
  const prior = snapshots.at(-1) ?? null;
  const salaryFactorsThroughSeason = snapshots
    .map((entry) => entry.salaryFactor)
    .filter((value): value is number => value != null);
  const snapshot = collectSeasonWealthSnapshot({
    gameState,
    saveId,
    seasonId,
    phase,
    priorSnapshot: prior,
    salaryFactorsThroughSeason:
      salaryFactorsThroughSeason.length > 0 ? salaryFactorsThroughSeason : undefined,
  });
  snapshots.push(snapshot);
  log(formatWealthSnapshotLogLine(snapshot), tag);
  return snapshot;
}

function pushPhase(outputDir: string, phases: PhaseRecord[], record: PhaseRecord) {
  phases.push(record);
  writePhaseCheckpoint(outputDir, record);
}

async function runPreseasonPhase(input: {
  save: PersistedSaveGame;
  persistence: PersistenceService;
  seasonNumber: number;
  outputDir: string;
  wealthSnapshots: SeasonWealthSnapshot[];
}): Promise<{ save: PersistedSaveGame; record: PhaseRecord }> {
  const seasonId = seasonIdForNumber(input.seasonNumber);
  if (input.save.gameState.season.id !== seasonId) {
    throw new Error(`Expected ${seasonId} for preseason, got ${input.save.gameState.season.id}`);
  }

  const cashBefore = leagueCashSum(input.save.gameState);
  const started = Date.now();

  log(`${seasonId} preseason cash recovery…`, TAG);
  await runPreseasonProactiveCashRecovery({
    saveId: input.save.saveId,
    seasonId,
    persistence: input.persistence,
  });

  log(`${seasonId} preseason buy (s1_draft_batch)…`, TAG);
  const session = await runTransferWindowSession({
    saveId: input.save.saveId,
    seasonId,
    persistence: input.persistence,
    phase: "preseason",
    dryRun: false,
    confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
    transferPhase: "manual_transfer_window",
    teamScope: "all",
    maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
    maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
    allowBuys: true,
    skipIfExistingMarketTransfers: false,
    progressLog: true,
  });

  const emergencyRepairTeams = await runEmergencyRepairIfNeeded({
    saveId: input.save.saveId,
    seasonId,
    persistence: input.persistence,
    outputDir: input.outputDir,
  });

  const durationMs = Date.now() - started;
  let save = input.persistence.getSaveById(input.save.saveId)!;
  const { teamsAtMin, teamsAtOpt, avgCash } = summarizeTeamMinOpt(save.gameState);
  const brackets = countBuyBrackets(save.gameState, seasonId, [
    "ai_preseason_market_buy",
    "manual_transfer_window",
    "preseason_roster_repair_buy",
  ]);

  const record: PhaseRecord = {
    seasonNumber: input.seasonNumber,
    seasonId,
    phase: "preseason",
    durationMs,
    buys: session.appliedBuys,
    sells: session.appliedSells,
    teamsAtMin,
    teamsAtOpt,
    avgCash,
    brackets,
    engineSummary: summarizeEngines(session.perTeam),
    blockingReasons: session.blockingReasons.slice(0, 10),
    warnings: session.warnings.slice(0, 20),
    emergencyRepairTeams,
    cashBefore,
    cashAfter: leagueCashSum(save.gameState),
    timingGate: evaluateTimingGate("preseason", durationMs),
    quotaGate: evaluateQuotaGate("preseason", input.seasonNumber, brackets),
    minOptGate: evaluateMinOptGate("preseason", teamsAtMin),
  };

  log(
    `${seasonId} preseason: buys=${record.buys} benchmark(post-buy) min=${teamsAtMin}/32 opt=${teamsAtOpt}/32 Star=${brackets.Star} Backup=${brackets.Backup} (${Math.round(durationMs / 1000)}s)`,
    TAG,
  );
  pushWealthSnapshot(input.wealthSnapshots, save.gameState, save.saveId, seasonId, "preseason", TAG);
  return { save, record };
}

async function transitionToNextSeason(save: PersistedSaveGame, persistence: PersistenceService, fromSeason: number) {
  const nextSeason = fromSeason + 1;
  const nextId = seasonIdForNumber(nextSeason);
  log(`Transition ${seasonIdForNumber(fromSeason)} → ${nextId}…`, TAG);
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
  if (!next.applied) {
    throw new Error(`Transition to ${nextId} blocked: ${next.blockingReasons.join(" | ")}`);
  }
  const updated = persistence.getSaveById(save.saveId)!;
  if (updated.gameState.season.id !== nextId) {
    throw new Error(`Expected ${nextId} after transition, got ${updated.gameState.season.id}`);
  }
  return updated;
}

function collectHardFails(phases: PhaseRecord[]): string[] {
  const fails: string[] = [];
  for (const phase of phases) {
    if (phase.timingGate === "fail") {
      fails.push(`${phase.seasonId}_${phase.phase}_timing>${phase.durationMs}ms`);
    }
    if (phase.minOptGate === "fail") {
      fails.push(`${phase.seasonId}_${phase.phase}_min=${phase.teamsAtMin}/32`);
    }
    // Quota warn is informational when min/opt gates are green (plan 4.3).
    if (phase.quotaGate === "warn" && phase.minOptGate === "fail") {
      fails.push(`${phase.seasonId}_${phase.phase}_quota_warn`);
    }
    fails.push(...checkEngineWarnings(phase.engineSummary, phase.warnings));
    if (phase.blockingReasons.length > 0) {
      fails.push(`${phase.seasonId}_${phase.phase}_blockers:${phase.blockingReasons.slice(0, 2).join("|")}`);
    }
  }
  return [...new Set(fails)];
}

function buildPipelineReport(result: PipelineResult): string {
  const maxSeason = result.phases.reduce((max, phase) => Math.max(max, phase.seasonNumber), FINAL_SEASON);
  const lines = [
    `# S1–S${maxSeason} Transfer Pipeline (Finance / no matchdays)`,
    "",
    `Generated: ${result.timestamp}`,
    `Save: \`${result.saveId}\``,
    `DB: \`${result.sqlitePath}\``,
    `Total duration: ${Math.round(result.totalDurationMs / 1000)}s`,
    `Gates: **${result.allGatesGreen ? "GRÜN" : "ROT"}**`,
    "",
    "Benchmark-Regel: **season_end = Min/Opt vor Verkäufen** · **draft/preseason = Min/Opt nach Käufen** (post-sell nur informativ).",
    "",
    "## Phase Summary",
    "",
    "| Season | Phase | Duration | Buys | Sells | Benchmark Min | Benchmark Opt | Post-Sell Min | SS | Star | Core | Depth | Backup | Timing | Quota | Min/Opt |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ];

  for (const phase of result.phases) {
    const b = phase.brackets;
    const postSellMin =
      phase.phase === "season_end" && phase.teamsAtMinAfterSells != null ? `${phase.teamsAtMinAfterSells}/32` : "—";
    lines.push(
      `| ${phase.seasonId} | ${phase.phase} | ${Math.round(phase.durationMs / 1000)}s | ${phase.buys} | ${phase.sells} | ${phase.teamsAtMin}/32 | ${phase.teamsAtOpt}/32 | ${postSellMin} | ${b.Superstar} | ${b.Star} | ${b.Core} | ${b.Depth} | ${b.Backup} | ${phase.timingGate} | ${phase.quotaGate} | ${phase.minOptGate} |`,
    );
  }

  lines.push(
    "",
    "## Timing Gates",
    "",
    `- S1 Draft: target ≤${TIMING_MS.draft.target / 1000}s, alarm >${TIMING_MS.draft.alarm / 1000}s`,
    `- S2–S${maxSeason} Preseason: target ≤${TIMING_MS.preseason.target / 1000}s, alarm >${TIMING_MS.preseason.alarm / 1000}s`,
    `- season_end: alarm >${TIMING_MS.seasonEnd.alarm / 1000}s`,
    "",
    "## Quota Reference (S1 Draft)",
    "",
    `SS ~${S1_QUOTA_REF.Superstar}, Star ~${S1_QUOTA_REF.Star}, Core ~${S1_QUOTA_REF.Core}, Depth ~${S1_QUOTA_REF.Depth}, Backup ~${S1_QUOTA_REF.Backup}`,
    "",
    `## S2–S${maxSeason} Preseason Quota`,
    "",
    "Star 4–12 (±50% of ~8), Backup ≤220, Min 32/32 **nach Käufen** (post-buy benchmark).",
    "",
  );

  if (result.hardFails.length > 0) {
    lines.push("## Hard Fails / Warnings", "", ...result.hardFails.map((entry) => `- ${entry}`), "");
  }

  for (const phase of result.phases.filter((entry) => entry.phase === "preseason" || entry.phase === "draft")) {
    if (Object.keys(phase.engineSummary).length === 0) continue;
    lines.push(
      `### Engine ${phase.seasonId} ${phase.phase}`,
      "",
      Object.entries(phase.engineSummary)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n"),
      "",
    );
  }

  return lines.join("\n");
}

function buildPipelineGuvReport(gameState: GameState, maxSeason: number): { markdown: string; rows: ReturnType<typeof collectSeasonTransferPipelineGuv>[] } {
  const rows = Array.from({ length: maxSeason }, (_, index) =>
    collectSeasonTransferPipelineGuv(gameState, `season-${index + 1}`),
  );
  return {
    rows,
    markdown: formatTransferPipelineGuvMarkdown(rows),
  };
}

function buildPipelineReportWithGuv(result: PipelineResult, gameState: GameState): string {
  const maxSeason = result.phases.reduce((max, phase) => Math.max(max, phase.seasonNumber), FINAL_SEASON);
  const base = buildPipelineReport(result);
  const guv = buildPipelineGuvReport(gameState, maxSeason);
  const wealth =
    result.wealthSnapshots.length > 0
      ? `\n\n${formatWealthTrackMarkdown(result.wealthSnapshots)}\n`
      : "";
  return `${base}\n\n${guv.markdown}${wealth}`;
}

type SellSeasonRow = {
  seasonId: string;
  sellCount: number;
  sellFeesTotal: number;
  teamsWithSell: number;
  avgFee: number;
  leagueCashBeforeSeasonEnd: number;
  leagueCashAfterSeasonEnd: number;
  leagueCashBeforePreseason: number;
  leagueCashAfterPreseason: number;
};

function buildSellAnalysis(
  gameState: GameState,
  phases: PhaseRecord[],
): { markdown: string; csv: string; rows: SellSeasonRow[] } {
  const teamCodeById = new Map(gameState.teams.map((team) => [team.teamId, team.shortCode ?? team.teamId]));

  const seasonEndCash = new Map<string, { before?: number; after?: number }>();
  const preseasonCash = new Map<string, { before?: number; after?: number }>();
  for (const phase of phases) {
    if (phase.phase === "season_end") {
      seasonEndCash.set(phase.seasonId, { before: phase.cashBefore, after: phase.cashAfter });
    }
    if (phase.phase === "preseason") {
      preseasonCash.set(phase.seasonId, { before: phase.cashBefore, after: phase.cashAfter });
    }
  }

  const seasonIds = [...new Set(gameState.transferHistory.map((entry) => entry.seasonId))].sort();
  const rows: SellSeasonRow[] = [];

  for (const seasonId of seasonIds) {
    const sells = gameState.transferHistory.filter(
      (entry) =>
        entry.seasonId === seasonId &&
        entry.transferType === "sell" &&
        (entry.source === "ai_preseason_market_sell" || entry.source === "manual_transfer_window"),
    );
    const sellFeesTotal = round(sells.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
    const teamsWithSell = new Set(sells.map((entry) => entry.fromTeamId).filter(Boolean)).size;
    const endCash = seasonEndCash.get(seasonId);
    const preCash = preseasonCash.get(seasonId);
    rows.push({
      seasonId,
      sellCount: sells.length,
      sellFeesTotal,
      teamsWithSell,
      avgFee: sells.length > 0 ? round(sellFeesTotal / sells.length) : 0,
      leagueCashBeforeSeasonEnd: endCash?.before ?? 0,
      leagueCashAfterSeasonEnd: endCash?.after ?? 0,
      leagueCashBeforePreseason: preCash?.before ?? 0,
      leagueCashAfterPreseason: preCash?.after ?? 0,
    });
  }

  const detailRows = gameState.transferHistory
    .filter((entry) => entry.transferType === "sell")
    .map((entry) => ({
      seasonId: entry.seasonId,
      teamCode: teamCodeById.get(entry.fromTeamId ?? "") ?? entry.fromTeamId,
      playerName: entry.playerName ?? entry.playerId,
      fee: entry.fee ?? 0,
      marketValue: entry.marketValue ?? 0,
      source: entry.source ?? "",
      phase: entry.phase ?? "",
    }));

  const mdLines = [
    `# Sell Analysis (S1–S${FINAL_SEASON} Transfer Pipeline)`,
    "",
    "## Per Season",
    "",
    "| Season | Sells | Teams w/ Sell | Σ Fees | Ø Fee | Cash Σ vor SE | Cash Σ nach SE | Cash Σ vor Pre | Cash Σ nach Pre |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    mdLines.push(
      `| ${row.seasonId} | ${row.sellCount} | ${row.teamsWithSell} | ${row.sellFeesTotal} | ${row.avgFee} | ${row.leagueCashBeforeSeasonEnd} | ${row.leagueCashAfterSeasonEnd} | ${row.leagueCashBeforePreseason} | ${row.leagueCashAfterPreseason} |`,
    );
  }
  mdLines.push(
    "",
    "## Sell Detail (all seasons)",
    "",
    `Total sell entries: ${detailRows.length}`,
    "",
    "| Season | Team | Player | Fee | MW | Source | Phase |",
    "| --- | --- | --- | ---: | ---: | --- | --- |",
  );
  for (const row of detailRows.slice(0, 200)) {
    mdLines.push(
      `| ${row.seasonId} | ${row.teamCode} | ${row.playerName} | ${row.fee} | ${row.marketValue} | ${row.source} | ${row.phase} |`,
    );
  }
  if (detailRows.length > 200) {
    mdLines.push("", `_… ${detailRows.length - 200} weitere Zeilen in sell-analysis.csv_`);
  }

  const csvLines = [
    "seasonId,teamCode,playerName,fee,marketValue,source,phase",
    ...detailRows.map((row) =>
      [row.seasonId, row.teamCode, `"${String(row.playerName).replace(/"/g, '""')}"`, row.fee, row.marketValue, row.source, row.phase].join(","),
    ),
  ];

  return { markdown: mdLines.join("\n"), csv: csvLines.join("\n"), rows };
}

async function finalizePipeline(input: {
  outputDir: string;
  save: PersistedSaveGame;
  sqlitePath: string;
  phases: PhaseRecord[];
  wealthSnapshots: SeasonWealthSnapshot[];
  pipelineStarted: number;
  timestamp: string;
}) {
  const hardFails = collectHardFails(input.phases);
  const allGatesGreen =
    hardFails.filter((entry) => !entry.includes("_quota_warn") && !entry.includes("engine_legacy")).length === 0 &&
    input.phases.every((phase) => phase.timingGate !== "fail" && phase.minOptGate !== "fail");

  const result: PipelineResult = {
    timestamp: input.timestamp,
    outputDir: input.outputDir,
    saveId: input.save.saveId,
    sqlitePath: input.sqlitePath,
    totalDurationMs: Date.now() - input.pipelineStarted,
    phases: input.phases,
    wealthSnapshots: input.wealthSnapshots,
    hardFails,
    allGatesGreen,
  };

  fs.writeFileSync(path.join(input.outputDir, "pipeline-result.json"), JSON.stringify(result, null, 2));
  fs.writeFileSync(
    path.join(input.outputDir, "pipeline-wealth-track.json"),
    JSON.stringify(input.wealthSnapshots, null, 2),
  );
  fs.writeFileSync(
    path.join(input.outputDir, "pipeline-wealth-track.md"),
    formatWealthTrackMarkdown(input.wealthSnapshots),
  );
  const maxSeason = input.phases.reduce((max, phase) => Math.max(max, phase.seasonNumber), FINAL_SEASON);
  const guv = buildPipelineGuvReport(input.save.gameState, maxSeason);
  fs.writeFileSync(path.join(input.outputDir, "pipeline-guv.json"), JSON.stringify(guv.rows, null, 2));
  fs.writeFileSync(path.join(input.outputDir, "pipeline-report.md"), buildPipelineReportWithGuv(result, input.save.gameState));

  const wealthGreens = input.wealthSnapshots.filter((row) => row.corridor.overallStatus === "green").length;
  log(
    `Wealth track: ${wealthGreens}/${input.wealthSnapshots.length} snapshots GREEN → pipeline-wealth-track.md`,
    TAG,
  );

  const sellAnalysis = buildSellAnalysis(input.save.gameState, input.phases);
  fs.writeFileSync(path.join(input.outputDir, "sell-analysis.md"), sellAnalysis.markdown);
  fs.writeFileSync(path.join(input.outputDir, "sell-analysis.csv"), sellAnalysis.csv);
  log(`Sell analysis written (${sellAnalysis.rows.length} season rows)`, TAG);

  closeDatabaseForMaintenance();
  log(`Done → ${input.outputDir} (${Math.round(result.totalDurationMs / 1000)}s, gates=${allGatesGreen ? "green" : "red"})`, TAG);
  console.log(JSON.stringify({ outputDir: input.outputDir, allGatesGreen, hardFails: hardFails.slice(0, 10) }, null, 2));
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  configurePipelineScope();
  process.env.OLY_TRANSFER_PIPELINE_FAST = "1";
  process.env.OLY_ENABLE_EMERGENCY_REPAIR = "0";
  const resume = parseResumeArgs();
  const pipelineStarted = Date.now();

  let outputDir: string;
  let sqlitePath: string;
  let timestamp: string;
  let persistence: PersistenceService;
  let save: PersistedSaveGame;
  const phases: PhaseRecord[] = [];
  const wealthSnapshots: SeasonWealthSnapshot[] = [];

  if (resume?.sqlitePath && resume.outputDir) {
    outputDir = resume.outputDir;
    sqlitePath = resume.sqlitePath;
    timestamp = path.basename(outputDir).replace(/^s1-s\d+-transfer-/, "");
    process.env.OLY_APP_SQLITE_PATH = sqlitePath;
    persistence = createPersistenceService();
    if (!resume.saveId) {
      throw new Error("--resume-db requires --save-id");
    }
    const loaded = persistence.getSaveById(resume.saveId);
    if (!loaded) throw new Error(`Save not found: ${resume.saveId}`);
    save = loaded;
    const draftPath = path.join(outputDir, "s1-draft-checkpoint.json");
    const draftRecord = fs.existsSync(draftPath)
      ? (JSON.parse(fs.readFileSync(draftPath, "utf8")) as PhaseRecord)
      : null;
    const logIdx = process.argv.indexOf("--bootstrap-log");
    const logPath = logIdx >= 0 ? process.argv[logIdx + 1] ?? "" : "/tmp/s1-s5-pipeline.log";
    if (draftRecord && !fs.existsSync(path.join(outputDir, "phases-manifest.json"))) {
      phases.push(...reconstructPhasesFromLog(logPath, draftRecord));
      for (const record of phases) writePhaseCheckpoint(outputDir, record);
    } else {
      phases.push(...loadExistingPhases(outputDir));
    }
    log(`Resume from ${save.gameState.season.id} (${save.gameState.gamePhase}), ${phases.length} prior phases`, TAG);
  } else {
    timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    outputDir = path.join(PROJECT_ROOT, "outputs", `s1-s${FINAL_SEASON}-transfer-${timestamp}`);
    fs.mkdirSync(outputDir, { recursive: true });
    ({ sqlitePath } = ensureIsolatedLongRunDatabase({ outputDir, projectRoot: PROJECT_ROOT }));
    persistence = createPersistenceService();

    const draft = await runS1Draft({ persistence, outputDir, wealthSnapshots });
    save = draft.save;
    pushPhase(outputDir, phases, draft.record);
    save = await continueTransferLoop({ save, persistence, outputDir, phases, wealthSnapshots });

    await finalizePipeline({ outputDir, save, sqlitePath, phases, wealthSnapshots, pipelineStarted, timestamp });
    return;
  }

  save = await continueTransferLoop({ save, persistence, outputDir, phases, wealthSnapshots });
  await finalizePipeline({ outputDir, save, sqlitePath, phases, wealthSnapshots, pipelineStarted, timestamp });
}

main().catch((error) => {
  console.error(`[${TAG}] fatal:`, error);
  process.exit(1);
});
