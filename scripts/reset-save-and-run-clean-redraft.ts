import fs from "node:fs";
import path from "node:path";

import {
  CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
  runChunkedRedraftTopup,
  type ChunkedRedraftTarget,
} from "@/lib/ai/chunked-redraft-topup-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function argValue(name: string) {
  const inline = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function numberArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function resetDraftState(gameState: GameState): GameState {
  const seasonState = gameState.seasonState ?? {};
  const nextSeasonState = {
    ...seasonState,
    lineupDrafts: [],
    legacyLineups: [],
    aiPreseasonAutomationRuns: {},
  };
  const unsafeSeasonState = nextSeasonState as Record<string, unknown>;
  delete unsafeSeasonState.preSeasonWorkflowState;

  return {
    ...gameState,
    rosters: [],
    transferHistory: [],
    teams: gameState.teams.map((team) => ({
      ...team,
      cash: Number.isFinite(team.budget) ? team.budget : team.cash,
    })),
    seasonState: nextSeasonState,
    matchdayState: {
      ...gameState.matchdayState,
      currentMatchdayIndex: 0,
    },
    gamePhase: "preseason_management",
    logs: [
      {
        id: `clean-redraft-reset-${Date.now()}`,
        type: "ai",
        message: "Save fuer echten Clean-Redraft zurueckgesetzt: Roster, Transferhistorie und Lineups geleert.",
        createdAt: new Date().toISOString(),
      },
      ...(gameState.logs ?? []),
    ],
  };
}

function contractLengthDistribution(gameState: GameState) {
  const result = new Map<number, number>();
  for (const roster of gameState.rosters) {
    const length = Math.max(1, Math.round(roster.contractLength ?? 1));
    result.set(length, (result.get(length) ?? 0) + 1);
  }
  return Object.fromEntries([...result.entries()].sort((left, right) => left[0] - right[0]));
}

function teamRosterRows(gameState: GameState) {
  return gameState.teams.map((team) => {
    const rosters = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rosterCount: rosters.length,
      playerMin: identity?.playerMin ?? null,
      playerOpt: identity?.playerOpt ?? null,
      cash: team.cash,
      avgContractLength: rosters.length
        ? Number((rosters.reduce((sum, roster) => sum + (roster.contractLength ?? 1), 0) / rosters.length).toFixed(2))
        : 0,
    };
  });
}

function main() {
  const persistence = createPersistenceService();
  const requestedSaveId = argValue("--save-id");
  const save = (requestedSaveId ? persistence.getSaveById(requestedSaveId) : null) ?? persistence.getActiveSave();
  if (!save) throw new Error("No active save found.");
  if (save.gameState.season.id !== "season-1" && !hasArg("--allow-non-season1")) {
    throw new Error(`clean_redraft_reset_requires_season1:${save.gameState.season.id}`);
  }

  const target = (argValue("--target") ?? "playerOpt") as ChunkedRedraftTarget;
  const outputDir =
    argValue("--output-dir") ??
    path.join(process.cwd(), "outputs", `active-save-clean-redraft-${new Date().toISOString().replaceAll(/[:.]/g, "-")}`);
  const teamTimeLimitMs = numberArg("--team-time-limit-ms", 90_000);
  const watchdogMs = numberArg("--watchdog-ms", 120_000);
  const roundLimit = numberArg("--round-limit", 18);
  const maxTeams = numberArg("--max-teams", Number.NaN);
  const includeManual = !hasArg("--ai-only");
  const write = hasArg("--write");

  fs.mkdirSync(outputDir, { recursive: true });

  if (!write) {
    console.log(JSON.stringify({
      dryRun: true,
      saveId: save.saveId,
      outputDir,
      includeManual,
      targetTeamCount: includeManual
        ? save.gameState.teams.length
        : save.gameState.teams.filter((team) => save.gameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode !== "manual").length,
      rosterCountBefore: save.gameState.rosters.length,
      transferHistoryBefore: save.gameState.transferHistory.length,
    }, null, 2));
    return;
  }

  const backup = persistence.cloneSave(save.saveId, `${save.name} · Backup vor Clean-Redraft ${new Date().toLocaleString("de-DE")}`);
  persistence.saveSingleplayerState(backup.saveId, backup.gameState, { status: "archived" });

  const resetGameState = resetDraftState(save.gameState);
  persistence.saveSingleplayerState(save.saveId, resetGameState, { status: "active" });
  persistence.activateSave(save.saveId);

  const targetTeamIds = includeManual
    ? undefined
    : resetGameState.teams
        .filter((team) => resetGameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode !== "manual")
        .map((team) => team.teamId);

  const startedAt = Date.now();
  const result = runChunkedRedraftTopup({
    persistence,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    dryRun: false,
    confirmToken: CHUNKED_REDRAFT_TOPUP_CONFIRM_TOKEN,
    mode: "full_clean_redraft",
    target,
    roundLimit,
    teamTimeLimitMs,
    watchdogMs,
    reportMode: "light",
    outputDir,
    targetTeamIds,
    maxTeams: Number.isFinite(maxTeams) ? maxTeams : undefined,
  });

  const finalSave = persistence.getSaveById(save.saveId);
  if (!finalSave) throw new Error(`final_save_missing:${save.saveId}`);
  persistence.activateSave(save.saveId);

  const summary = {
    saveId: save.saveId,
    backupSaveId: backup.saveId,
    outputDir,
    includeManual,
    durationMs: Date.now() - startedAt,
    draftValid: result.summary.draftValid,
    invalidReasons: result.summary.invalidReasons,
    picksTotal: result.summary.picksTotal,
    teamsBelowMin: result.summary.teamsBelowMin,
    negativeCashTeams: result.summary.negativeCashTeams,
    duplicatePlayers: result.summary.duplicatePlayers,
    contractLengths: contractLengthDistribution(finalSave.gameState),
    teamRosters: teamRosterRows(finalSave.gameState),
  };

  fs.writeFileSync(path.join(outputDir, "active-save-clean-redraft-final-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main();
