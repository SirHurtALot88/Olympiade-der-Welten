import type { GameState, Player, RosterEntry, Team, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getImportedPlayerDisplayMarketValue } from "@/lib/data/player-economy-display";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { runAiPickAuditReset } from "@/lib/ai/ai-pick-audit-reset-service";
import { AI_PICK_IMPORT_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-import-contract";
import { isAiPickResettableSource, type AiPickResettableSource } from "@/lib/ai/ai-pick-audit-reset-contract";
import { executeLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type SaveContext = {
  source: "sqlite";
  requestedSaveId: string | null;
  resolvedSaveId: string | null;
  requestedSeasonId: string | null;
  resolvedSeasonId: string | null;
  saveName: string | null;
  saveStatus: string | null;
  scopeWarning: string | null;
};

type ReplayTransferStatus = "ready" | "blocked" | "imported";

type ReplayTransferPreview = {
  transferId: string;
  source: AiPickResettableSource;
  playerId: string;
  playerName: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  happenedAt: string;
  purchasePriceSource: number;
  salarySource: number;
  contractLengthSource: number;
  purchasePriceReplay: number | null;
  salaryReplay: number | null;
  contractLengthReplay: number;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  rosterBefore: number;
  rosterAfter: number;
  status: ReplayTransferStatus;
  blockingReasons: string[];
  warnings: string[];
  importedTransferId: string | null;
};

type TeamImportSummary = {
  teamId: string;
  teamCode: string;
  teamName: string;
  resetAutoTransfers: number;
  importedTransfers: number;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  rosterBefore: number;
  rosterAfter: number;
};

export type AiPickImportResult = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied" | "partial_applied";
  saveContext: {
    sourceSave: SaveContext;
    targetSave: SaveContext;
  };
  summary: {
    sourceTransferCount: number;
    targetResettableTransfers: number;
    sourceTeamsAffected: number;
    targetTeamsAffected: number;
    protectedManualTransfers: number;
    safeResetTransfers: number;
    blockedResetTransfers: number;
    importableTransfers: number;
    blockedImportTransfers: number;
    importedTransfers: number;
  };
  resetPreview: Awaited<ReturnType<typeof runAiPickAuditReset>>["resetPreview"];
  resetExecution: Awaited<ReturnType<typeof runAiPickAuditReset>>["resetExecution"];
  teams: TeamImportSummary[];
  transfers: ReplayTransferPreview[];
  warnings: string[];
  blockingReasons: string[];
};

type RunAiPickImportParams = {
  source?: "sqlite" | "prisma";
  sourceSaveId: string;
  targetSaveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function toSaveContext(input: {
  requestedSaveId: string | null;
  requestedSeasonId: string | null;
  resolvedSaveId: string | null;
  resolvedSeasonId: string | null;
  saveName: string | null;
  saveStatus: string | null;
  scopeWarning: string | null;
}): SaveContext {
  return {
    source: "sqlite",
    requestedSaveId: input.requestedSaveId,
    resolvedSaveId: input.resolvedSaveId,
    requestedSeasonId: input.requestedSeasonId,
    resolvedSeasonId: input.resolvedSeasonId,
    saveName: input.saveName,
    saveStatus: input.saveStatus,
    scopeWarning: input.scopeWarning,
  };
}

function buildScopeWarning(saveId: string, seasonId: string, reason: string) {
  return `Requested save ${saveId} could not be resolved for season ${seasonId}: ${reason}.`;
}

function resolveSave(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return {
      persistence,
      save: null,
      saveContext: toSaveContext({
        requestedSaveId: saveId,
        requestedSeasonId: seasonId,
        resolvedSaveId: null,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: buildScopeWarning(saveId, seasonId, "save_not_found"),
      }),
    };
  }
  if (save.gameState.season.id !== seasonId) {
    return {
      persistence,
      save: null,
      saveContext: toSaveContext({
        requestedSaveId: saveId,
        requestedSeasonId: seasonId,
        resolvedSaveId: save.saveId,
        resolvedSeasonId: null,
        saveName: save.name ?? null,
        saveStatus: save.status ?? null,
        scopeWarning: buildScopeWarning(saveId, seasonId, "season_not_in_save"),
      }),
    };
  }
  return {
    persistence,
    save,
    saveContext: toSaveContext({
      requestedSaveId: saveId,
      requestedSeasonId: seasonId,
      resolvedSaveId: save.saveId,
      resolvedSeasonId: save.gameState.season.id,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    }),
  };
}

function getResettableSourceTransfers(gameState: GameState, seasonId: string) {
  return gameState.transferHistory
    .filter(
      (entry) =>
        entry.seasonId === seasonId &&
        entry.transferType === "buy" &&
        isAiPickResettableSource(entry.source) &&
        entry.toTeamId,
    )
    .sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt));
}

function getRosterPlayers(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

function getVisibleRosterSalaryTotal(rosterPlayers: Array<{ entry: RosterEntry; player: Player }>) {
  return roundValue(
    rosterPlayers.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
      0,
    ),
    2,
  );
}

function getTeamSnapshot(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  const rosterPlayers = getRosterPlayers(gameState, teamId);
  return {
    team,
    cash: team?.cash ?? null,
    salary: getVisibleRosterSalaryTotal(rosterPlayers),
    roster: rosterPlayers.length,
  };
}

function applyResetPreviewToGameState(
  gameState: GameState,
  resetPreview: Awaited<ReturnType<typeof runAiPickAuditReset>>["resetPreview"],
) {
  const safeCandidates = resetPreview.candidates.filter((entry) => entry.status === "safe_reset");
  if (safeCandidates.length === 0) {
    return gameState;
  }

  const rosterIdsToRemove = new Set(
    safeCandidates.map((entry) => entry.rosterEntryId).filter(Boolean) as string[],
  );
  const refundByTeamId = safeCandidates.reduce((map, entry) => {
    map.set(entry.teamId, roundValue((map.get(entry.teamId) ?? 0) + entry.purchasePrice, 2));
    return map;
  }, new Map<string, number>());

  return {
    ...gameState,
    teams: gameState.teams.map((team) =>
      refundByTeamId.has(team.teamId)
        ? {
            ...team,
            cash: roundValue(team.cash + (refundByTeamId.get(team.teamId) ?? 0), 2),
          }
        : team,
    ),
    rosters: gameState.rosters.filter((entry) => !rosterIdsToRemove.has(entry.id)),
  };
}

function buildReplayPreview(input: {
  sourceTransfers: TransferHistoryEntry[];
  targetGameState: GameState;
}) {
  let simulatedState = input.targetGameState;
  const rows: ReplayTransferPreview[] = [];
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  for (const transfer of input.sourceTransfers) {
    const teamId = transfer.toTeamId;
    const playerId = transfer.playerId;
    const team = teamId ? simulatedState.teams.find((entry) => entry.teamId === teamId) ?? null : null;
    const player = simulatedState.players.find((entry) => entry.id === playerId) ?? null;
    const rosterBefore = teamId ? simulatedState.rosters.filter((entry) => entry.teamId === teamId).length : 0;
    const rosterPlayersBefore = teamId ? getRosterPlayers(simulatedState, teamId) : [];
    const salaryBefore = teamId ? getVisibleRosterSalaryTotal(rosterPlayersBefore) : null;
    const cashBefore = team?.cash ?? null;
    const purchasePriceReplay = player ? getImportedPlayerDisplayMarketValue(player) : null;
    const salaryReplay = player ? resolvePlayerEconomyContract({ player }).salary : null;
    const blocking: string[] = [];
    const rowWarnings: string[] = [];

    if (!teamId) blocking.push("source_transfer_missing_target_team");
    if (!team) blocking.push("target_team_not_found");
    if (!player) blocking.push("target_player_not_found");
    if (simulatedState.rosters.some((entry) => entry.playerId === playerId)) blocking.push("player_not_free_agent_in_target_scope");
    if (purchasePriceReplay == null || purchasePriceReplay <= 0) blocking.push("market_value_missing");
    if (salaryReplay == null || salaryReplay <= 0) blocking.push("salary_demand_missing");
    if (team && rosterBefore >= team.rosterLimit) blocking.push("roster_limit_reached");
    if (team && purchasePriceReplay != null && team.cash < purchasePriceReplay) blocking.push("insufficient_cash");
    if (purchasePriceReplay != null && purchasePriceReplay !== transfer.fee) {
      rowWarnings.push(`purchase_price_replay_differs_from_source:${transfer.fee}->${purchasePriceReplay}`);
    }
    if (salaryReplay != null && salaryReplay !== transfer.salary) {
      rowWarnings.push(`salary_replay_differs_from_source:${transfer.salary}->${salaryReplay}`);
    }

    const status: ReplayTransferStatus = blocking.length === 0 ? "ready" : "blocked";
    const cashAfter = status === "ready" && cashBefore != null && purchasePriceReplay != null ? roundValue(cashBefore - purchasePriceReplay, 2) : cashBefore;
    const salaryAfter = status === "ready" && salaryBefore != null && salaryReplay != null ? roundValue(salaryBefore + salaryReplay, 2) : salaryBefore;
    const rosterAfter = status === "ready" ? rosterBefore + 1 : rosterBefore;

    rows.push({
      transferId: transfer.id,
      source: (transfer.source ?? "auto_roster_fill") as AiPickResettableSource,
      playerId,
      playerName: player?.name ?? transfer.playerId,
      teamId: teamId ?? "unknown-team",
      teamCode: team?.shortCode ?? teamId ?? "unknown",
      teamName: team?.name ?? teamId ?? "Unknown Team",
      happenedAt: transfer.happenedAt,
      purchasePriceSource: transfer.fee,
      salarySource: transfer.salary,
      contractLengthSource: transfer.remainingContractLength,
      purchasePriceReplay,
      salaryReplay,
      contractLengthReplay: Math.max(1, transfer.remainingContractLength || 1),
      cashBefore,
      cashAfter,
      salaryBefore,
      salaryAfter,
      rosterBefore,
      rosterAfter,
      status,
      blockingReasons: blocking,
      warnings: rowWarnings,
      importedTransferId: null,
    });

    warnings.push(...rowWarnings);
    if (blocking.length > 0) {
      blockingReasons.push(`${team?.name ?? teamId ?? "Unknown Team"}:${player?.name ?? playerId}:${blocking.join(",")}`);
      continue;
    }

    simulatedState = {
      ...simulatedState,
      teams: simulatedState.teams.map((entry) =>
        entry.teamId === teamId
          ? {
              ...entry,
              cash: cashAfter ?? entry.cash,
            }
          : entry,
      ),
      rosters: [
        ...simulatedState.rosters,
        {
          id: `preview-import-${transfer.id}`,
          teamId: teamId!,
          playerId,
          contractLength: Math.max(1, transfer.remainingContractLength || 1),
          salary: salaryReplay!,
          upkeep: salaryReplay!,
          purchasePrice: purchasePriceReplay!,
          currentValue: purchasePriceReplay!,
          roleTag: "prospect",
          joinedSeasonId: simulatedState.season.id,
        },
      ],
    };
  }

  return {
    rows,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}

function buildTeamSummaries(input: {
  targetBefore: GameState;
  targetAfter: GameState;
  sourceTransfers: TransferHistoryEntry[];
  resetPreview: Awaited<ReturnType<typeof runAiPickAuditReset>>["resetPreview"];
  importedTransfers: ReplayTransferPreview[];
}) {
  const teamIds = Array.from(
    new Set([
      ...input.sourceTransfers.map((entry) => entry.toTeamId).filter(Boolean),
      ...input.resetPreview.candidates.map((entry) => entry.teamId),
    ]),
  ) as string[];

  return teamIds
    .flatMap((teamId) => {
      const beforeSnapshot = getTeamSnapshot(input.targetBefore, teamId);
      const afterSnapshot = getTeamSnapshot(input.targetAfter, teamId);
      const team = afterSnapshot.team ?? beforeSnapshot.team;
      if (!team) {
        return [];
      }
      const resetAutoTransfers = input.resetPreview.candidates.filter(
        (entry) => entry.teamId === teamId && entry.status === "safe_reset",
      ).length;
      const imported = input.importedTransfers.filter((entry) => entry.teamId === teamId && entry.status === "imported").length;
      return [{
        teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        resetAutoTransfers,
        importedTransfers: imported,
        cashBefore: beforeSnapshot.cash,
        cashAfter: afterSnapshot.cash,
        salaryBefore: beforeSnapshot.salary,
        salaryAfter: afterSnapshot.salary,
        rosterBefore: beforeSnapshot.roster,
        rosterAfter: afterSnapshot.roster,
      } satisfies TeamImportSummary];
    })
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "de"));
}

export async function runAiPickImportReplace(params: RunAiPickImportParams): Promise<AiPickImportResult> {
  if (params.source === "prisma") {
    return {
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "blocked",
      saveContext: {
        sourceSave: toSaveContext({
          requestedSaveId: params.sourceSaveId,
          requestedSeasonId: params.seasonId,
          resolvedSaveId: null,
          resolvedSeasonId: null,
          saveName: null,
          saveStatus: null,
          scopeWarning: "Prisma/Supabase mode is read-only in this build.",
        }),
        targetSave: toSaveContext({
          requestedSaveId: params.targetSaveId,
          requestedSeasonId: params.seasonId,
          resolvedSaveId: null,
          resolvedSeasonId: null,
          saveName: null,
          saveStatus: null,
          scopeWarning: "Prisma/Supabase mode is read-only in this build.",
        }),
      },
      summary: {
        sourceTransferCount: 0,
        targetResettableTransfers: 0,
        sourceTeamsAffected: 0,
        targetTeamsAffected: 0,
        protectedManualTransfers: 0,
        safeResetTransfers: 0,
        blockedResetTransfers: 0,
        importableTransfers: 0,
        blockedImportTransfers: 0,
        importedTransfers: 0,
      },
      resetPreview: {
        candidates: [],
        safeTransferIds: [],
        blockedTransferIds: [],
        wouldRemoveRosterEntries: 0,
        wouldAppendHistoryEntries: 0,
        wouldWriteLogs: 0,
      },
      resetExecution: {
        revertedTransferIds: [],
        protectedTransferIds: [],
        appendedHistoryIds: [],
        logIds: [],
      },
      teams: [],
      transfers: [],
      warnings: [],
      blockingReasons: ["source_prisma_read_only"],
    };
  }

  const dryRun = params.dryRun ?? true;
  const sourceResolved = resolveSave(params.sourceSaveId, params.seasonId);
  const targetResolved = resolveSave(params.targetSaveId, params.seasonId);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!sourceResolved.save) {
    blockingReasons.push("source_save_scope_unresolved");
  }
  if (!targetResolved.save) {
    blockingReasons.push("target_save_scope_unresolved");
  }
  if (sourceResolved.save && targetResolved.save && sourceResolved.save.saveId === targetResolved.save.saveId) {
    blockingReasons.push("source_and_target_save_must_differ");
  }

  const emptyResult = {
    source: "sqlite" as const,
    readOnly: dryRun,
    dryRun,
    executed: false,
    status: "blocked" as const,
    saveContext: {
      sourceSave: sourceResolved.saveContext,
      targetSave: targetResolved.saveContext,
    },
    summary: {
      sourceTransferCount: 0,
      targetResettableTransfers: 0,
      sourceTeamsAffected: 0,
      targetTeamsAffected: 0,
      protectedManualTransfers: 0,
      safeResetTransfers: 0,
      blockedResetTransfers: 0,
      importableTransfers: 0,
      blockedImportTransfers: 0,
      importedTransfers: 0,
    },
    resetPreview: {
      candidates: [],
      safeTransferIds: [],
      blockedTransferIds: [],
      wouldRemoveRosterEntries: 0,
      wouldAppendHistoryEntries: 0,
      wouldWriteLogs: 0,
    },
    resetExecution: {
      revertedTransferIds: [],
      protectedTransferIds: [],
      appendedHistoryIds: [],
      logIds: [],
    },
    teams: [],
    transfers: [],
    warnings,
    blockingReasons,
  } satisfies AiPickImportResult;

  if (!sourceResolved.save || !targetResolved.save) {
    return emptyResult;
  }

  const sourceTransfers = getResettableSourceTransfers(sourceResolved.save.gameState, params.seasonId);
  const resetPreviewResult = await runAiPickAuditReset({
    source: "sqlite",
    saveId: targetResolved.save.saveId,
    seasonId: params.seasonId,
    dryRun: true,
    confirmToken: null,
    force: false,
  });
  warnings.push(...resetPreviewResult.warnings);
  if (resetPreviewResult.summary.blockedResetTransfers > 0) {
    blockingReasons.push("target_has_blocked_resettable_transfers");
  }
  if (sourceTransfers.length === 0) {
    blockingReasons.push("source_save_has_no_resettable_ai_buys");
  }

  const targetStateAfterResetPreview = applyResetPreviewToGameState(
    targetResolved.save.gameState,
    resetPreviewResult.resetPreview,
  );
  const replayPreview = buildReplayPreview({
    sourceTransfers,
    targetGameState: targetStateAfterResetPreview,
  });
  warnings.push(...replayPreview.warnings);
  blockingReasons.push(...replayPreview.blockingReasons);

  const importableTransfers = replayPreview.rows.filter((entry) => entry.status === "ready");
  const blockedImportTransfers = replayPreview.rows.filter((entry) => entry.status === "blocked");

  let resetExecution = resetPreviewResult.resetExecution;
  let targetAfterState = targetResolved.save.gameState;
  const importedRows = replayPreview.rows.map((entry) => ({ ...entry }));
  let executed = false;

  if (!dryRun) {
    if (params.confirmToken !== AI_PICK_IMPORT_CONFIRM_TOKEN) {
      blockingReasons.push("confirm_token_missing");
    }
    if (blockingReasons.length === 0) {
      const resetApplied = await runAiPickAuditReset({
        source: "sqlite",
        saveId: targetResolved.save.saveId,
        seasonId: params.seasonId,
        dryRun: false,
        confirmToken: "RESET_AI_SETUP_TRANSFERS_ONLY",
        force: false,
      });
      resetExecution = resetApplied.resetExecution;
      if (!resetApplied.executed) {
        blockingReasons.push(...resetApplied.blockingReasons.map((entry) => `reset:${entry}`));
      } else {
        const refreshedTarget = resolveSave(params.targetSaveId, params.seasonId);
        if (!refreshedTarget.save) {
          blockingReasons.push("target_save_missing_after_reset");
        } else {
          targetAfterState = refreshedTarget.save.gameState;
          for (const row of importedRows) {
            if (row.status !== "ready") {
              continue;
            }
            const executeResult = executeLocalTransfermarktBuy({
              saveId: params.targetSaveId,
              seasonId: params.seasonId,
              teamId: row.teamId,
              playerId: row.playerId,
              contractLength: row.contractLengthReplay,
              transferSource: `imported_${row.source}`,
            });
            if (!executeResult.transferCreated || !executeResult.transferId) {
              row.status = "blocked";
              row.blockingReasons.push(...executeResult.blockingReasons);
              row.warnings.push(...executeResult.warnings);
              blockingReasons.push(`import_failed:${row.teamName}:${row.playerName}`);
              continue;
            }
            row.status = "imported";
            row.importedTransferId = executeResult.transferId;
          }
          const finalTarget = resolveSave(params.targetSaveId, params.seasonId);
          if (finalTarget.save) {
            targetAfterState = finalTarget.save.gameState;
          }
          executed = true;
        }
      }
    }
  }

  const teams = buildTeamSummaries({
    targetBefore: targetResolved.save.gameState,
    targetAfter: targetAfterState,
    sourceTransfers,
    resetPreview: resetPreviewResult.resetPreview,
    importedTransfers: importedRows,
  });

  return {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed,
    status:
      executed && importedRows.some((entry) => entry.status === "blocked")
        ? "partial_applied"
        : executed
          ? "applied"
          : blockingReasons.length > 0
            ? "blocked"
            : warnings.length > 0
              ? "warning"
              : "ready",
    saveContext: {
      sourceSave: sourceResolved.saveContext,
      targetSave: targetResolved.saveContext,
    },
    summary: {
      sourceTransferCount: sourceTransfers.length,
      targetResettableTransfers: resetPreviewResult.summary.autoTransfersFound,
      sourceTeamsAffected: new Set(sourceTransfers.map((entry) => entry.toTeamId).filter(Boolean)).size,
      targetTeamsAffected: teams.length,
      protectedManualTransfers: resetPreviewResult.summary.manualTransfersProtected,
      safeResetTransfers: resetPreviewResult.summary.safeResetTransfers,
      blockedResetTransfers: resetPreviewResult.summary.blockedResetTransfers,
      importableTransfers: importableTransfers.length,
      blockedImportTransfers: importedRows.filter((entry) => entry.status === "blocked").length,
      importedTransfers: importedRows.filter((entry) => entry.status === "imported").length,
    },
    resetPreview: resetPreviewResult.resetPreview,
    resetExecution,
    teams,
    transfers: importedRows,
    warnings: Array.from(new Set(warnings)),
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}
