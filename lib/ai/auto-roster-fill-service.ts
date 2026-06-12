import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import type { GameState, Team, TeamControlMode } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  executeLocalTransfermarktBuy,
  listLocalTransferHistory,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
} from "@/lib/market/transfermarkt-local-service";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { getMercenaryNegativeFitPenalty } from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";

export type AutoRosterFillTargetSource =
  | "team_identity_player_opt"
  | "strategy_profile_roster_opt"
  | "target_roster_size_missing";

export type AutoRosterFillTeamStatus =
  | "already_at_target"
  | "planned"
  | "filled"
  | "partially_filled"
  | "target_roster_size_missing"
  | "target_unreachable_cash"
  | "target_unreachable_no_free_agents"
  | "buy_blocked_by_existing_rules";

export type AutoRosterFillAcquisition = {
  playerId: string;
  playerName: string;
  purchasePrice: number | null;
  salary: number | null;
  contractLength: number;
  transferHistoryId: string | null;
  recommendationScore: number | null;
  status: "planned" | "applied";
  warnings: string[];
  blockingReasons: string[];
};

export type AutoRosterFillTeamResult = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  targetRosterSize: number | null;
  targetSource: AutoRosterFillTargetSource;
  rosterBefore: number;
  rosterAfter: number;
  missingBefore: number | null;
  missingAfter: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  marketValueBefore: number | null;
  marketValueAfter: number | null;
  freeAgentsAvailable: number | null;
  acquiredPlayers: AutoRosterFillAcquisition[];
  transferHistoryIds: string[];
  warnings: string[];
  blockingReasons: string[];
  status: AutoRosterFillTeamStatus;
};

export type AutoRosterFillSummary = {
  totalTeams: number;
  targetResolvedTeams: number;
  missingTargetTeams: number;
  teamsNeedingBuys: number;
  alreadyAtTargetTeams: number;
  filledTeams: number;
  partialTeams: number;
  blockedTeams: number;
  plannedBuys: number;
  appliedBuys: number;
  historyWrites: number;
};

export type AutoRosterFillResult = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied";
  scope: {
    saveId: string;
    seasonId: string;
    mode: "fill_all_teams_to_target_for_matchday_setup";
  };
  saveContext: {
    source: "sqlite";
    requestedSaveId: string | null;
    resolvedSaveId: string;
    requestedSeasonId: string | null;
    resolvedSeasonId: string;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  };
  summary: AutoRosterFillSummary;
  teams: AutoRosterFillTeamResult[];
  warnings: string[];
  blockingReasons: string[];
};

export type AutoRosterFillParams = {
  source?: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function resolveStrictLocalSave(persistence: PersistenceService, saveId: string) {
  const requestedSave = persistence.getSaveById(saveId);
  if (!requestedSave) {
    throw new Error(`Requested save ${saveId} could not be resolved for roster fill.`);
  }

  return requestedSave;
}

function getTeamRosterPlayers(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { entry: GameState["rosters"][number]; player: GameState["players"][number] } => Boolean(item.player));
}

function buildTeamEconomySnapshot(gameState: GameState, team: Team) {
  const rosterPlayers = getTeamRosterPlayers(gameState, team.teamId);
  return {
    rosterCount: rosterPlayers.length,
    cash: team.cash ?? null,
    salaryTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).salary ?? 0),
        0,
      ),
      2,
    ),
    marketValueTotal: roundValue(
      rosterPlayers.reduce(
        (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
        0,
      ),
      2,
    ),
  };
}

function resolveTargetRoster(team: Team, gameState: GameState) {
  const teamIdentity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  if (teamIdentity && Number.isFinite(teamIdentity.playerOpt) && teamIdentity.playerOpt > 0) {
    return {
      targetRosterSize: Math.round(teamIdentity.playerOpt),
      targetSource: "team_identity_player_opt" as const,
    };
  }

  const strategyProfile = getTeamStrategyProfile(gameState, team.teamId);
  if (strategyProfile?.rosterOptTarget != null && Number.isFinite(strategyProfile.rosterOptTarget) && strategyProfile.rosterOptTarget > 0) {
    return {
      targetRosterSize: Math.round(strategyProfile.rosterOptTarget),
      targetSource: "strategy_profile_roster_opt" as const,
    };
  }

  return {
    targetRosterSize: null,
    targetSource: "target_roster_size_missing" as const,
  };
}

function classifyUnreachableReason(input: {
  missingCount: number;
  freeAgentsAvailable: number;
  acquisitions: AutoRosterFillAcquisition[];
  fallbackWarnings: string[];
  fallbackBlockingReasons: string[];
}) {
  if (input.missingCount <= 0) {
    return {
      status: "already_at_target" as const,
      blockingReasons: [] as string[],
      warnings: [] as string[],
    };
  }

  if (input.freeAgentsAvailable <= 0) {
    return {
      status: "target_unreachable_no_free_agents" as const,
      blockingReasons: ["target_unreachable_no_free_agents"],
      warnings: ["Keine Free Agents mehr im aktuellen Save verfuegbar."],
    };
  }

  const combinedReasons = unique([
    ...input.fallbackBlockingReasons,
    ...input.acquisitions.flatMap((entry) => entry.blockingReasons),
  ]);

  if (combinedReasons.some((reason) => reason.includes("insufficient_cash"))) {
    return {
      status: "target_unreachable_cash" as const,
      blockingReasons: unique(["target_unreachable_cash", ...combinedReasons]),
      warnings: unique(["Mindestens ein noetiger Kauf scheitert am verfuegbaren Cash.", ...input.fallbackWarnings]),
    };
  }

  return {
    status: "buy_blocked_by_existing_rules" as const,
    blockingReasons: unique(["buy_blocked_by_existing_rules", ...combinedReasons]),
    warnings: unique(input.fallbackWarnings),
  };
}

function buildCandidatePool(items: TransfermarktFreeAgentItem[]) {
  const seen = new Set<string>();
  return items.filter((entry) => {
    if (seen.has(entry.playerId)) {
      return false;
    }
    seen.add(entry.playerId);
    return true;
  });
}

function getRosterFillPreviewLimit(missingCount: number | null | undefined) {
  const normalizedMissing = missingCount != null && Number.isFinite(missingCount) ? Math.max(1, Math.round(missingCount)) : 1;
  return Math.max(36, Math.min(84, normalizedMissing * 12));
}

function scoreRosterFillCandidate(input: {
  gameState: GameState;
  teamId: string;
  item: TransfermarktFreeAgentItem;
  cash: number | null;
}) {
  const needs = evaluateAiNeeds(input.gameState, input.teamId);
  const weakestAxes = needs.uncoveredNeedAxes.slice(0, 2);
  const itemNeedCoverage = input.item.topDisciplineScores.filter((entry) => needs.topNeedDisciplineIds.includes(entry.disciplineId)).length;
  const axisMap = {
    pow: roundValue((input.item.pow ?? 0) / 100, 3),
    spe: roundValue((input.item.spe ?? 0) / 100, 3),
    men: roundValue((input.item.men ?? 0) / 100, 3),
    soc: roundValue((input.item.soc ?? 0) / 100, 3),
  };
  const weakestAxisScore =
    weakestAxes.length > 0
      ? weakestAxes.reduce((sum, axis) => sum + axisMap[axis], 0) / weakestAxes.length
      : Math.max(axisMap.pow, axisMap.spe, axisMap.men, axisMap.soc);
  const fitScore = clamp(((input.item.fit ?? 0) + 8) / 16, 0, 1);
  const valueScore = clamp((input.item.marketValueSalaryRatio ?? 0) / 20, 0, 1);
  const mercenaryNegativeFitPenalty = getMercenaryNegativeFitPenalty({
    teamId: input.teamId,
    isMercenary: input.item.mercenary,
    teamFit: input.item.fit,
  });
  const pricePenalty =
    input.cash != null && input.cash > 0 && input.item.marketValue != null
      ? clamp(input.item.marketValue / input.cash, 0, 1)
      : 0;
  const overall =
    fitScore * 0.38 +
    valueScore * 0.22 +
    clamp(itemNeedCoverage / 2, 0, 1) * 0.2 +
    weakestAxisScore * 0.2 -
    pricePenalty * 0.1 +
    mercenaryNegativeFitPenalty / 100;

  return roundValue(overall * 100, 2);
}

function buildRosterFillCandidates(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  team: Team;
  limit: number;
}) {
  const freeAgentFeed = listLocalTransfermarktFreeAgents({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.team.teamId,
    limit: input.limit,
  });

  const scored = buildCandidatePool(freeAgentFeed.items ?? [])
    .map((item) => ({
      item,
      score: scoreRosterFillCandidate({
        gameState: input.gameState,
        teamId: input.team.teamId,
        item,
        cash: input.team.cash ?? null,
      }),
    }))
    .sort((left, right) => right.score - left.score);

  return {
    freeAgentFeed,
    candidates: scored.map((entry) => entry.item),
    warnings: [] as string[],
    blockingReasons: [] as string[],
  };
}

export async function runAutoRosterFillForMatchdaySetup(
  input: AutoRosterFillParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<AutoRosterFillResult> {
  if (input.source === "prisma") {
    throw new Error("Prisma/Supabase mode is read-only in this build.");
  }

  const dryRun = input.dryRun ?? true;
  if (!dryRun && input.confirmToken !== AUTO_ROSTER_FILL_CONFIRM_TOKEN) {
    throw new Error("Roster fill execute requires explicit confirm token.");
  }

  const save = resolveStrictLocalSave(persistence, input.saveId);
  const seasonId = input.seasonId?.trim() || save.gameState.season.id;
  if (seasonId !== save.gameState.season.id) {
    throw new Error(`Requested season ${seasonId} is not available in save ${save.saveId}.`);
  }

  const teamResults: AutoRosterFillTeamResult[] = [];

  for (const team of save.gameState.teams) {
    const beforeGameState = resolveStrictLocalSave(persistence, save.saveId).gameState;
    const beforeSnapshot = buildTeamEconomySnapshot(beforeGameState, team);
    const targetInfo = resolveTargetRoster(team, beforeGameState);
    const previewLimit = getRosterFillPreviewLimit(
      targetInfo.targetRosterSize != null ? Math.max(0, targetInfo.targetRosterSize - beforeSnapshot.rosterCount) : 1,
    );
    const beforeHistoryCount = listLocalTransferHistory({
      saveId: save.saveId,
      seasonId,
      teamId: team.teamId,
      type: "buy",
      limit: 500,
    }).items.length;

    const teamResult: AutoRosterFillTeamResult = {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      controlMode: beforeGameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai"),
      targetRosterSize: targetInfo.targetRosterSize,
      targetSource: targetInfo.targetSource,
      rosterBefore: beforeSnapshot.rosterCount,
      rosterAfter: beforeSnapshot.rosterCount,
      missingBefore: targetInfo.targetRosterSize != null ? Math.max(0, targetInfo.targetRosterSize - beforeSnapshot.rosterCount) : null,
      missingAfter: targetInfo.targetRosterSize != null ? Math.max(0, targetInfo.targetRosterSize - beforeSnapshot.rosterCount) : null,
      cashBefore: beforeSnapshot.cash,
      cashAfter: beforeSnapshot.cash,
      salaryBefore: beforeSnapshot.salaryTotal,
      salaryAfter: beforeSnapshot.salaryTotal,
      marketValueBefore: beforeSnapshot.marketValueTotal,
      marketValueAfter: beforeSnapshot.marketValueTotal,
      freeAgentsAvailable: null,
      acquiredPlayers: [],
      transferHistoryIds: [],
      warnings: [],
      blockingReasons: [],
      status: "already_at_target",
    };

    if (targetInfo.targetRosterSize == null) {
      teamResult.status = "target_roster_size_missing";
      teamResult.blockingReasons = ["target_roster_size_missing"];
      teamResults.push(teamResult);
      continue;
    }

    if (beforeSnapshot.rosterCount >= targetInfo.targetRosterSize) {
      teamResult.status = "already_at_target";
      teamResults.push(teamResult);
      continue;
    }

    const candidateSetup = buildRosterFillCandidates({
      gameState: beforeGameState,
      saveId: save.saveId,
      seasonId,
      team,
      limit: previewLimit,
    });
    const freeAgentFeed = candidateSetup.freeAgentFeed;
    teamResult.freeAgentsAvailable = freeAgentFeed.total;

    const candidatePool = candidateSetup.candidates;
    const fallbackWarnings = unique(candidateSetup.warnings);
    const fallbackBlockingReasons = unique(candidateSetup.blockingReasons);

    if (dryRun) {
      let simulatedCash = beforeSnapshot.cash;
      let simulatedSalary = beforeSnapshot.salaryTotal;
      let simulatedMarketValue = beforeSnapshot.marketValueTotal;
      let simulatedRoster = beforeSnapshot.rosterCount;

      for (const candidate of candidatePool) {
        if (simulatedRoster >= targetInfo.targetRosterSize) {
          break;
        }

        const buyPreview = previewLocalTransfermarktBuy({
          saveId: save.saveId,
          seasonId,
          teamId: team.teamId,
          playerId: candidate.playerId,
          transferSource: "auto_roster_fill",
        });
        const purchasePrice = buyPreview.purchasePrice ?? candidate.marketValue ?? null;
        const salary = buyPreview.salary ?? candidate.salary ?? null;

        if (!buyPreview.canBuy) {
          teamResult.acquiredPlayers.push({
            playerId: candidate.playerId,
            playerName: candidate.name,
            purchasePrice,
            salary,
            contractLength: buyPreview.contractLength,
            transferHistoryId: null,
            recommendationScore: scoreRosterFillCandidate({
              gameState: beforeGameState,
              teamId: team.teamId,
              item: candidate,
              cash: simulatedCash,
            }),
            status: "planned",
            warnings: buyPreview.warnings,
            blockingReasons: buyPreview.blockingReasons,
          });
          continue;
        }

        teamResult.acquiredPlayers.push({
          playerId: candidate.playerId,
          playerName: candidate.name,
          purchasePrice,
          salary,
          contractLength: buyPreview.contractLength,
          transferHistoryId: null,
          recommendationScore: scoreRosterFillCandidate({
            gameState: beforeGameState,
            teamId: team.teamId,
            item: candidate,
            cash: simulatedCash,
          }),
          status: "planned",
          warnings: buyPreview.warnings,
          blockingReasons: [],
        });

        simulatedCash = simulatedCash != null && purchasePrice != null ? roundValue(simulatedCash - purchasePrice, 2) : simulatedCash;
        simulatedSalary = simulatedSalary != null && salary != null ? roundValue(simulatedSalary + salary, 2) : simulatedSalary;
        simulatedMarketValue =
          simulatedMarketValue != null && purchasePrice != null ? roundValue(simulatedMarketValue + purchasePrice, 2) : simulatedMarketValue;
        simulatedRoster += 1;
      }

      teamResult.rosterAfter = simulatedRoster;
      teamResult.missingAfter = Math.max(0, targetInfo.targetRosterSize - simulatedRoster);
      teamResult.cashAfter = simulatedCash;
      teamResult.salaryAfter = simulatedSalary;
      teamResult.marketValueAfter = simulatedMarketValue;
      if (teamResult.missingAfter === 0) {
        teamResult.status = "planned";
      } else {
        const unreachable = classifyUnreachableReason({
          missingCount: teamResult.missingAfter,
          freeAgentsAvailable: freeAgentFeed.total,
          acquisitions: teamResult.acquiredPlayers,
          fallbackWarnings,
          fallbackBlockingReasons,
        });
        teamResult.status = teamResult.acquiredPlayers.some((entry) => entry.blockingReasons.length === 0)
          ? "partially_filled"
          : unreachable.status;
        teamResult.blockingReasons = unreachable.blockingReasons;
        teamResult.warnings = unreachable.warnings;
      }
      teamResults.push(teamResult);
      continue;
    }

    let failedToAdvance = false;
    while (teamResult.rosterAfter < targetInfo.targetRosterSize) {
      const latestPreview = buildRosterFillCandidates({
        gameState: resolveStrictLocalSave(persistence, save.saveId).gameState,
        saveId: save.saveId,
        seasonId,
        team,
        limit: previewLimit,
      });
      const latestCandidates = latestPreview.candidates;
      const nextCandidate = latestCandidates[0] ?? null;
      if (!nextCandidate) {
        const latestFreeAgents = latestPreview.freeAgentFeed;
        teamResult.freeAgentsAvailable = latestFreeAgents.total;
        const unreachable = classifyUnreachableReason({
          missingCount: Math.max(0, targetInfo.targetRosterSize - teamResult.rosterAfter),
          freeAgentsAvailable: latestFreeAgents.total,
          acquisitions: teamResult.acquiredPlayers,
          fallbackWarnings: latestPreview.warnings,
          fallbackBlockingReasons: latestPreview.blockingReasons,
        });
        teamResult.status = teamResult.acquiredPlayers.length > 0 ? "partially_filled" : unreachable.status;
        teamResult.blockingReasons = unique([...teamResult.blockingReasons, ...unreachable.blockingReasons]);
        teamResult.warnings = unique([...teamResult.warnings, ...unreachable.warnings]);
        failedToAdvance = true;
        break;
      }

      const buyPreview = previewLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId,
        teamId: team.teamId,
        playerId: nextCandidate.playerId,
        transferSource: "auto_roster_fill",
      });
      if (!buyPreview.canBuy) {
        teamResult.acquiredPlayers.push({
          playerId: nextCandidate.playerId,
          playerName: nextCandidate.name,
          purchasePrice: buyPreview.purchasePrice ?? nextCandidate.marketValue ?? null,
          salary: buyPreview.salary ?? nextCandidate.salary ?? null,
          contractLength: buyPreview.contractLength,
          transferHistoryId: null,
          recommendationScore: scoreRosterFillCandidate({
            gameState: resolveStrictLocalSave(persistence, save.saveId).gameState,
            teamId: team.teamId,
            item: nextCandidate,
            cash: teamResult.cashAfter,
          }),
          status: "planned",
          warnings: buyPreview.warnings,
          blockingReasons: buyPreview.blockingReasons,
        });
        const unreachable = classifyUnreachableReason({
          missingCount: Math.max(0, targetInfo.targetRosterSize - teamResult.rosterAfter),
          freeAgentsAvailable: listLocalTransfermarktFreeAgents({ saveId: save.saveId, teamId: team.teamId, limit: previewLimit }).total,
          acquisitions: teamResult.acquiredPlayers,
          fallbackWarnings: latestPreview.warnings,
          fallbackBlockingReasons: latestPreview.blockingReasons,
        });
        teamResult.status = teamResult.acquiredPlayers.some((entry) => entry.status === "applied")
          ? "partially_filled"
          : unreachable.status;
        teamResult.blockingReasons = unique([...teamResult.blockingReasons, ...unreachable.blockingReasons]);
        teamResult.warnings = unique([...teamResult.warnings, ...unreachable.warnings]);
        failedToAdvance = true;
        break;
      }

      const buyResult = executeLocalTransfermarktBuy({
        saveId: save.saveId,
        seasonId,
        teamId: team.teamId,
        playerId: nextCandidate.playerId,
        transferSource: "auto_roster_fill",
      });
      if (!buyResult.canBuy || !buyResult.transferCreated || !buyResult.transferId) {
        teamResult.acquiredPlayers.push({
          playerId: nextCandidate.playerId,
          playerName: nextCandidate.name,
          purchasePrice: buyResult.purchasePrice ?? nextCandidate.marketValue ?? null,
          salary: buyResult.salary ?? nextCandidate.salary ?? null,
          contractLength: buyResult.contractLength,
          transferHistoryId: buyResult.transferId,
          recommendationScore: scoreRosterFillCandidate({
            gameState: resolveStrictLocalSave(persistence, save.saveId).gameState,
            teamId: team.teamId,
            item: nextCandidate,
            cash: teamResult.cashAfter,
          }),
          status: "planned",
          warnings: buyResult.warnings,
          blockingReasons: unique([...buyResult.blockingReasons, "transfer_history_missing"]),
        });
        teamResult.status = "buy_blocked_by_existing_rules";
        teamResult.blockingReasons = unique([...teamResult.blockingReasons, ...buyResult.blockingReasons, "transfer_history_missing"]);
        failedToAdvance = true;
        break;
      }

      teamResult.acquiredPlayers.push({
        playerId: nextCandidate.playerId,
        playerName: nextCandidate.name,
        purchasePrice: buyResult.purchasePrice,
        salary: buyResult.salary,
        contractLength: buyResult.contractLength,
        transferHistoryId: buyResult.transferId,
        recommendationScore: scoreRosterFillCandidate({
          gameState: resolveStrictLocalSave(persistence, save.saveId).gameState,
          teamId: team.teamId,
          item: nextCandidate,
          cash: teamResult.cashAfter,
        }),
        status: "applied",
        warnings: buyResult.warnings,
        blockingReasons: [],
      });
      teamResult.transferHistoryIds.push(buyResult.transferId);
      const currentGameState = resolveStrictLocalSave(persistence, save.saveId).gameState;
      const currentTeam = currentGameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
      const snapshotAfterBuy = buildTeamEconomySnapshot(currentGameState, currentTeam);
      const previousRosterAfter = teamResult.rosterAfter;
      teamResult.rosterAfter = snapshotAfterBuy.rosterCount;
      teamResult.cashAfter = snapshotAfterBuy.cash;
      teamResult.salaryAfter = snapshotAfterBuy.salaryTotal;
      teamResult.marketValueAfter = snapshotAfterBuy.marketValueTotal;
      teamResult.missingAfter = Math.max(0, targetInfo.targetRosterSize - snapshotAfterBuy.rosterCount);

      if (snapshotAfterBuy.rosterCount <= previousRosterAfter) {
        failedToAdvance = true;
        teamResult.status = "buy_blocked_by_existing_rules";
        teamResult.blockingReasons = unique([...teamResult.blockingReasons, "roster_fill_no_progress"]);
        break;
      }
    }

    const afterGameState = resolveStrictLocalSave(persistence, save.saveId).gameState;
    const afterTeam = afterGameState.teams.find((entry) => entry.teamId === team.teamId) ?? team;
    const afterSnapshot = buildTeamEconomySnapshot(afterGameState, afterTeam);
    teamResult.rosterAfter = afterSnapshot.rosterCount;
    teamResult.cashAfter = afterSnapshot.cash;
    teamResult.salaryAfter = afterSnapshot.salaryTotal;
    teamResult.marketValueAfter = afterSnapshot.marketValueTotal;
    teamResult.missingAfter = Math.max(0, targetInfo.targetRosterSize - afterSnapshot.rosterCount);
    const afterHistory = listLocalTransferHistory({
      saveId: save.saveId,
      seasonId,
      teamId: team.teamId,
      type: "buy",
      limit: 500,
    }).items;
    const newHistoryCount = Math.max(0, afterHistory.length - beforeHistoryCount);
    if (newHistoryCount < teamResult.acquiredPlayers.filter((entry) => entry.status === "applied").length) {
      teamResult.status = "buy_blocked_by_existing_rules";
      teamResult.blockingReasons = unique([...teamResult.blockingReasons, "transfer_history_write_mismatch"]);
      teamResult.warnings = unique([...teamResult.warnings, "Mindestens ein Kauf hat keine saubere Transferspur hinterlassen."]);
    } else if (!failedToAdvance && teamResult.missingAfter === 0) {
      teamResult.status = "filled";
    } else if (!failedToAdvance && teamResult.acquiredPlayers.some((entry) => entry.status === "applied")) {
      teamResult.status = "partially_filled";
    }

    teamResults.push(teamResult);
  }

  const summary: AutoRosterFillSummary = {
    totalTeams: teamResults.length,
    targetResolvedTeams: teamResults.filter((team) => team.targetRosterSize != null).length,
    missingTargetTeams: teamResults.filter((team) => team.targetRosterSize == null).length,
    teamsNeedingBuys: teamResults.filter((team) => (team.missingBefore ?? 0) > 0).length,
    alreadyAtTargetTeams: teamResults.filter((team) => team.status === "already_at_target").length,
    filledTeams: teamResults.filter((team) => team.status === "filled" || team.status === "planned").length,
    partialTeams: teamResults.filter((team) => team.status === "partially_filled").length,
    blockedTeams: teamResults.filter((team) =>
      [
        "target_roster_size_missing",
        "target_unreachable_cash",
        "target_unreachable_no_free_agents",
        "buy_blocked_by_existing_rules",
      ].includes(team.status),
    ).length,
    plannedBuys: dryRun
      ? teamResults.reduce((sum, team) => sum + team.acquiredPlayers.filter((entry) => entry.status === "planned" && entry.blockingReasons.length === 0).length, 0)
      : 0,
    appliedBuys: dryRun
      ? 0
      : teamResults.reduce((sum, team) => sum + team.acquiredPlayers.filter((entry) => entry.status === "applied").length, 0),
    historyWrites: dryRun ? 0 : teamResults.reduce((sum, team) => sum + team.transferHistoryIds.length, 0),
  };

  const warnings = unique(teamResults.flatMap((team) => team.warnings));
  const blockingReasons = unique(teamResults.flatMap((team) => team.blockingReasons));

  return {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed: !dryRun,
    status: !dryRun
      ? (summary.blockedTeams > 0 ? "warning" : "applied")
      : (summary.blockedTeams > 0 ? "warning" : "ready"),
    scope: {
      saveId: save.saveId,
      seasonId,
      mode: "fill_all_teams_to_target_for_matchday_setup",
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId: input.saveId ?? null,
      resolvedSaveId: save.saveId,
      requestedSeasonId: input.seasonId ?? null,
      resolvedSeasonId: seasonId,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
    summary,
    teams: teamResults,
    warnings,
    blockingReasons,
  };
}
