/**
 * Shared helpers for S11 iterate loop: restore S10 baseline, run sell/buy pipeline, metrics.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { resolveTeamRosterMarketValue } from "@/lib/ai/planner-cash-buffer-policy";
import {
  getTeamHardMinRequired,
  getTeamOptTarget,
  getTeamsNeedingConvergence,
  runCompareRescueBeforeEmergencyRepair,
  runEmergencyRosterRepairForTeams,
} from "@/lib/ai/ai-market-plan-convergence-service";
import { runPreseasonProactiveCashRecovery } from "@/lib/ai/preseason-cash-recovery-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  overwriteSaveFromSourceDb,
  readSaveDbSnapshot,
  type SaveDbSnapshot,
} from "@/lib/persistence/overwrite-save-from-source-db";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabasePath } from "@/lib/persistence/sqlite";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { getLongRunPlannerMaxLeagueRounds, getLongRunPlannerMaxTeamCycles } from "@/lib/season/long-run-profile";

import { classifyPickFidelity, seasonBuyFidelity } from "@/scripts/generate-balancing-report";

export const PROJECT_ROOT = path.resolve(__dirname, "..");

export const S10_BASELINE = {
  atOpt: 9,
  emergencyPct: 43.6,
  marketBuys: 94,
};

export type TeamCheckpointRow = {
  teamId: string;
  teamCode: string;
  cash: number;
  mw: number;
  roster: number;
  hardMin: number;
  optTarget: number;
  salary: number;
  atOpt: boolean;
  belowHardMin: boolean;
  rank?: number;
};

export type IterateMetrics = {
  iteration: number;
  runAt: string;
  saveId: string;
  atOpt: number;
  emergencyPct: number;
  plannedPct: number;
  marketBuys: number;
  seasonEndSells: number;
  convergenceBuys: number;
  convergenceSells: number;
  recoverySells: number;
  emergencyRepairTeams: number;
  topUpTeams: number;
  cashFloor: number;
  hoardingProxy: number;
  trashEstimatePct: number;
  sensibleEstimatePct: number;
  top8TrashPct: number;
  bottom8SensiblePct: number;
  teamsBelowHardMin: number;
  minRosterTeam: { teamCode: string; roster: number } | null;
  cashUnderOptHighCash: number;
  zeroBuyTeamsUnderOpt: number;
};

export function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function fmt(value: number | null) {
  return value == null
    ? "—"
    : round(value, 1).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function iterDir(outputDir: string, iteration: number) {
  return path.join(outputDir, `iter-${String(iteration).padStart(2, "0")}`);
}

export function topUpCash(gameState: GameState, floor: number) {
  const touched: Array<{ shortCode: string; before: number; after: number }> = [];
  for (const team of gameState.teams) {
    const cash = team.cash ?? 0;
    if (cash >= floor) continue;
    touched.push({ shortCode: team.shortCode, before: round(cash), after: floor });
    team.cash = floor;
  }
  return touched;
}

export function buildTeamRows(gameState: GameState): TeamCheckpointRow[] {
  return gameState.teams.map((team) => {
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const hardMin = getTeamHardMinRequired(gameState, team.teamId);
    const optTarget = getTeamOptTarget(gameState, team.teamId);
    const salary = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => sum + (entry.salary ?? entry.upkeep ?? 0), 0);
    const mw = resolveTeamRosterMarketValue(gameState, team.teamId);
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      cash: team.cash ?? 0,
      mw,
      roster,
      hardMin,
      optTarget,
      salary,
      atOpt: roster >= optTarget,
      belowHardMin: roster < hardMin,
    };
  });
}

function isEmergencySource(source: string | null | undefined) {
  const s = (source ?? "").toLowerCase();
  return s.includes("repair") || s.includes("topup") || s.includes("fallback") || s.includes("emergency");
}

export function classifyBuyQuality(
  entry: TransferHistoryEntry,
  teamRows: TeamCheckpointRow[],
  teamAvgMwBefore: Map<string, number>,
) {
  const team = teamRows.find((row) => row.teamCode === entry.toTeamId || row.teamId === entry.toTeamId);
  const teamCode = team?.teamCode ?? entry.toTeamId ?? "?";
  const avgMw = teamAvgMwBefore.get(teamCode) ?? 0;
  const mw = entry.marketValue ?? 0;
  const fee = entry.fee ?? 0;

  const trashSignals = {
    emergency: isEmergencySource(entry.source) || classifyPickFidelity(entry) === "emergency",
    mwBelowAvg: avgMw > 0 && mw < avgMw * 0.85,
    veryLowMw: mw < 5,
    badFeeRatio: mw > 0 && fee > mw * 1.25,
  };
  const sensibleSignals = {
    planned: classifyPickFidelity(entry) === "planned_market" || classifyPickFidelity(entry) === "planned_other",
    mwFeeOk: mw > 0 && fee <= mw * 1.25 && (avgMw <= 0 || mw >= avgMw * 0.7),
    notEmergency: !trashSignals.emergency,
  };

  const trashCount = Object.values(trashSignals).filter(Boolean).length;
  const sensibleCount = Object.values(sensibleSignals).filter(Boolean).length;

  let label: "trash" | "sensible" | "mixed" = "mixed";
  if (trashSignals.emergency && !sensibleSignals.planned) label = "trash";
  else if (trashCount >= 2 && sensibleCount <= 1) label = "trash";
  else if (sensibleCount >= 2 && trashCount <= 1) label = "sensible";

  return { label, teamCode, trashCount, sensibleCount };
}

export function analyzeBuyQuality(gameState: GameState, seasonId: string, s10TeamRows: TeamCheckpointRow[]) {
  const buys = (gameState.transferHistory ?? []).filter(
    (entry) => entry.seasonId === seasonId && entry.transferType === "buy",
  );
  const teamAvgMw = new Map(s10TeamRows.map((row) => [row.teamCode, row.roster > 0 ? row.mw / row.roster : 0]));

  const ranked = [...s10TeamRows].sort((a, b) => b.mw - a.mw);
  const top8 = new Set(ranked.slice(0, 8).map((row) => row.teamCode));
  const bottom8 = new Set(ranked.slice(-8).map((row) => row.teamCode));

  let trash = 0;
  let sensible = 0;
  let mixed = 0;
  let top8Trash = 0;
  let top8Total = 0;
  let bottom8Sensible = 0;
  let bottom8Total = 0;

  for (const buy of buys) {
    const q = classifyBuyQuality(buy, s10TeamRows, teamAvgMw);
    if (q.label === "trash") trash += 1;
    else if (q.label === "sensible") sensible += 1;
    else mixed += 1;

    if (top8.has(q.teamCode)) {
      top8Total += 1;
      if (q.label === "trash") top8Trash += 1;
    }
    if (bottom8.has(q.teamCode)) {
      bottom8Total += 1;
      if (q.label === "sensible") bottom8Sensible += 1;
    }
  }

  const total = buys.length || 1;
  return {
    trashEstimatePct: round((trash / total) * 100, 1),
    sensibleEstimatePct: round((sensible / total) * 100, 1),
    mixedPct: round((mixed / total) * 100, 1),
    top8TrashPct: top8Total > 0 ? round((top8Trash / top8Total) * 100, 1) : 0,
    bottom8SensiblePct: bottom8Total > 0 ? round((bottom8Sensible / bottom8Total) * 100, 1) : 0,
  };
}

export function buildCheckpointMarkdown(input: {
  saveId: string;
  seasonId: string;
  gameState: GameState;
  label: string;
}) {
  const teamRows = buildTeamRows(input.gameState);
  const atOpt = teamRows.filter((row) => row.atOpt).length;
  const fidelity = seasonBuyFidelity(input.gameState.transferHistory ?? [], input.seasonId);
  const hoardingTeams = teamRows.filter((row) => row.cash > 30 && row.mw < 200 && row.roster <= 9).length;

  const lines = [
    `# ${input.label}`,
    "",
    `**Save:** \`${input.saveId}\``,
    `**Season:** ${input.seasonId} · Phase: ${input.gameState.gamePhase ?? "?"}`,
    `**Erstellt:** ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `- **Teams ≥ Opt:** ${atOpt}/32`,
    `- **Emergency-Filler-Quote:** ${fidelity.emergency}/${fidelity.buys} (${fidelity.emergencyPct}%)`,
    `- **Planned-Quote:** ${fidelity.planned}/${fidelity.buys} (${fidelity.plannedPct}%)`,
    `- **Market-Buys:** ${fidelity.buys}`,
    `- **Cash-Hoarding-Risiko (Cash>30, MW<200, Kader≤9):** ${hoardingTeams} teams`,
    "",
    "## Teams",
    "",
    "| Team | Cash | MW | Kader | hardMin | Opt | Gehalt | ≥Opt |",
    "|---|---:|---:|---:|---:|---:|---:|:--:|",
    ...teamRows.map(
      (row) =>
        `| ${row.teamCode} | ${fmt(row.cash)} | ${fmt(row.mw)} | ${row.roster} | ${row.hardMin} | ${row.optTarget} | ${fmt(row.salary)} | ${row.atOpt ? "✅" : "—"} |`,
    ),
    "",
  ];

  return { markdown: lines.join("\n"), atOpt, fidelity, hoardingTeams, teamRows };
}

export function snapshotLine(snapshot: SaveDbSnapshot) {
  return `${snapshot.seasonId ?? "?"} · ${snapshot.gamePhase ?? "?"} · rosters=${snapshot.rosterCount} · transfer_history=${snapshot.transferHistoryCount}`;
}

export function restoreSaveFromBaseline(input: {
  saveId: string;
  sourceDbPath: string;
  targetDbPath?: string;
}) {
  const targetDb = input.targetDbPath ?? getDatabasePath();
  const live = new Database(targetDb, { readonly: true });
  const liveBefore = readSaveDbSnapshot(live, input.saveId);
  live.close();
  if (!liveBefore) {
    throw new Error(`Live save ${input.saveId} not found in ${targetDb}`);
  }

  const restoreResult = overwriteSaveFromSourceDb({
    sourceDbPath: input.sourceDbPath,
    targetDbPath: targetDb,
    saveId: input.saveId,
    preserveTargetStatus: true,
  });

  if (restoreResult.targetSnapshotAfter.seasonId !== "season-10" || restoreResult.targetSnapshotAfter.gamePhase !== "season_completed") {
    throw new Error(`Restored state is not S10 season_completed: ${snapshotLine(restoreResult.targetSnapshotAfter)}`);
  }
  if (restoreResult.targetSnapshotAfter.season11TransferCount > 0) {
    throw new Error(`Restored state still has season-11 transfers (${restoreResult.targetSnapshotAfter.season11TransferCount}).`);
  }

  return { liveBefore, restoreResult, targetDb };
}

export async function runTransferPipeline(input: { saveId: string; outputDir: string; cashFloor: number }) {
  const persistence = createPersistenceService();
  let save = persistence.getSaveById(input.saveId);
  if (!save) throw new Error(`Save not found: ${input.saveId}`);

  const topUp = topUpCash(save.gameState, input.cashFloor);
  if (topUp.length > 0) {
    save = persistence.saveSingleplayerState(input.saveId, save.gameState);
  }

  const seasonBefore = save.gameState.season.id;
  const phaseBefore = save.gameState.gamePhase ?? "";

  let seasonEndSells = 0;
  if (seasonBefore === "season-10" && phaseBefore === "season_completed") {
    const seasonEnd = await runTransferWindowSession({
      saveId: input.saveId,
      seasonId: "season-10",
      persistence,
      phase: "season_end",
      dryRun: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: "manual_transfer_window",
      teamScope: "all",
      maxTeamCycles: getLongRunPlannerMaxTeamCycles(),
      maxLeagueRounds: getLongRunPlannerMaxLeagueRounds(),
      allowBuys: false,
      skipIfExistingMarketTransfers: false,
      progressLog: true,
    });
    seasonEndSells = seasonEnd.appliedSells;
    save = persistence.getSaveById(input.saveId)!;
  }

  if ((save.gameState.gamePhase ?? "") === "season_completed") {
    const setup = buildPreSeasonNextSeasonSetupToken(save);
    const next = applyPreSeasonNextSeasonSetupLightweight(save, setup.confirmToken, persistence);
    if (!next.applied) {
      throw new Error(`S11 setup blocked: ${next.blockingReasons.join(" | ")}`);
    }
    save = persistence.getSaveById(input.saveId)!;
  }

  const seasonId = save.gameState.season.id;
  if (seasonId !== "season-11") {
    throw new Error(`Expected season-11 after setup, got ${seasonId}`);
  }

  const recovery = await runPreseasonProactiveCashRecovery({ saveId: input.saveId, seasonId, persistence });

  const convergence = await runTransferWindowSession({
    saveId: input.saveId,
    seasonId,
    persistence,
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

  save = persistence.getSaveById(input.saveId)!;
  const collectEmergencyTeamIds = () => {
    const needing = getTeamsNeedingConvergence(save!.gameState).map((entry) => entry.teamId);
    const belowMin = save!.gameState.teams
      .filter((team) => {
        const roster = save!.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
        return roster < getTeamHardMinRequired(save!.gameState, team.teamId);
      })
      .map((team) => team.teamId);
    return [...new Set([...needing, ...belowMin])];
  };

  let emergencyTeamIds = collectEmergencyTeamIds();
  let emergencyTeams = 0;
  if (emergencyTeamIds.length > 0) {
    await runCompareRescueBeforeEmergencyRepair({
      saveId: input.saveId,
      seasonId,
      teamIds: emergencyTeamIds,
      persistence,
    });
    save = persistence.getSaveById(input.saveId)!;
    emergencyTeamIds = collectEmergencyTeamIds();
  }
  if (emergencyTeamIds.length > 0) {
    emergencyTeams = emergencyTeamIds.length;
    runEmergencyRosterRepairForTeams({
      saveId: input.saveId,
      seasonId,
      teamIds: emergencyTeamIds,
      persistence,
      outputDir: input.outputDir,
    });
    save = persistence.getSaveById(input.saveId)!;
  }

  const result = buildCheckpointMarkdown({
    saveId: input.saveId,
    seasonId,
    gameState: save.gameState,
    label: `S11 Preseason · Iteration`,
  });

  return {
    topUp,
    seasonEndSells,
    recovery,
    convergence,
    emergencyTeams,
    result,
    gameState: save.gameState,
  };
}

export function writeTransfersCsv(gameState: GameState, seasonId: string, filePath: string) {
  const rows = (gameState.transferHistory ?? []).filter((entry) => entry.seasonId === seasonId);
  const header = "transferType,source,fromTeamId,toTeamId,playerName,fee,marketValue,salary";
  const lines = rows.map((entry) =>
    [
      entry.transferType,
      entry.source ?? "",
      entry.fromTeamId ?? "",
      entry.toTeamId ?? "",
      (entry.playerName ?? entry.playerId ?? "").replace(/,/g, " "),
      entry.fee ?? "",
      entry.marketValue ?? "",
      entry.salary ?? "",
    ].join(","),
  );
  fs.writeFileSync(filePath, [header, ...lines].join("\n") + "\n");
}

export function appendProgressLog(outputDir: string, line: string) {
  const logPath = path.join(outputDir, "progress-log.md");
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, "# S11 Iterate 10x Progress\n\n");
  }
  fs.appendFileSync(logPath, `- ${new Date().toISOString()} — ${line}\n`);
}
