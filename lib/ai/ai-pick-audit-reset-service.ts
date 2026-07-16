import { randomUUID } from "node:crypto";

import type { GameState, Player, RosterEntry, TeamControlMode, TeamStrategyProfile, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { calculateTransfermarktFit } from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

import {
  AI_PICK_AUDIT_RESET_CONFIRM_TOKEN,
  isAiPickResettableSource,
  type AiPickResettableSource,
} from "@/lib/ai/ai-pick-audit-reset-contract";

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

type AxisDistribution = {
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
};

type PickProfileWarning =
  | "avoided_class_pick"
  | "avoided_race_pick"
  | "disliked_trait_pick"
  | "low_team_fit"
  | "class_spam"
  | "berserker_spam"
  | "warlord_spam";

type TeamAuditPickedPlayer = {
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  source: AiPickResettableSource;
  transferId: string;
  purchasePrice: number | null;
  salary: number | null;
  pow: number;
  spe: number;
  men: number;
  soc: number;
  estimatedTeamFit: number | null;
  profileScore: number | null;
  warnings: PickProfileWarning[];
};

type TeamAuditRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  targetRosterSize: number | null;
  targetSource: "team_identity_player_opt" | "strategy_profile_roster_opt" | "target_roster_size_missing";
  currentRosterCount: number;
  autoPickedCount: number;
  autoPickedPlayers: TeamAuditPickedPlayer[];
  classDistribution: Array<{ label: string; count: number }>;
  raceDistribution: Array<{ label: string; count: number }>;
  axisDistribution: AxisDistribution;
  estimatedTeamFit: number | null;
  warningFlags: PickProfileWarning[];
};

type ResetCandidateStatus = "safe_reset" | "blocked_reset";

type ResetCandidate = {
  transferId: string;
  source: AiPickResettableSource;
  status: ResetCandidateStatus;
  historyAction: "append_revert_entry_keep_original" | "blocked_keep_original";
  playerId: string;
  playerName: string;
  className: string | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  rosterEntryId: string | null;
  purchasePrice: number;
  salary: number;
  contractLength: number;
  cashBefore: number | null;
  cashAfter: number | null;
  salaryBefore: number | null;
  salaryAfter: number | null;
  rosterBefore: number;
  rosterAfter: number;
  wouldAppendHistorySource: string | null;
  blockingReasons: string[];
};

export type AiPickAuditResetResponse = {
  source: "sqlite";
  readOnly: boolean;
  dryRun: boolean;
  executed: boolean;
  status: "ready" | "warning" | "blocked" | "applied" | "partial_applied";
  saveContext: SaveContext;
  summary: {
    totalTransfersInSave: number;
    autoTransfersFound: number;
    manualTransfersProtected: number;
    safeResetTransfers: number;
    blockedResetTransfers: number;
    affectedTeams: number;
    affectedPlayers: number;
    berserkerCount: number;
    warlordCount: number;
    berserkerWarlordSharePct: number | null;
    totalCashRefund: number | null;
    totalSalaryRelief: number | null;
  };
  globalAudit: {
    topClasses: Array<{ label: string; count: number }>;
    topRaces: Array<{ label: string; count: number }>;
    teamsWithWarnings: Array<{ teamId: string; teamName: string; warningCount: number; warnings: PickProfileWarning[] }>;
    teamsWithClassSpam: Array<{ teamId: string; teamName: string; dominantClass: string; count: number }>;
  };
  teams: TeamAuditRow[];
  resetPreview: {
    candidates: ResetCandidate[];
    safeTransferIds: string[];
    blockedTransferIds: string[];
    wouldRemoveRosterEntries: number;
    wouldAppendHistoryEntries: number;
    wouldWriteLogs: number;
  };
  resetExecution: {
    revertedTransferIds: string[];
    protectedTransferIds: string[];
    appendedHistoryIds: string[];
    logIds: string[];
  };
  recommendedRecovery:
    | {
        action: "create_fresh_test_save";
        suggestedName: string;
        reason: string;
      }
    | null;
  warnings: string[];
  blockingReasons: string[];
};

type RunAiPickAuditResetParams = {
  source: "sqlite" | "prisma";
  saveId: string;
  seasonId: string;
  dryRun?: boolean;
  confirmToken?: string | null;
  force?: boolean;
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => normalizeToken(value)).filter(Boolean);
}

function sortCountEntries(map: Map<string, number>) {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0], "de");
    })
    .map(([label, count]) => ({ label, count }));
}

function resolveTargetRoster(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  if (identity && Number.isFinite(identity.playerOpt) && identity.playerOpt > 0) {
    return {
      targetRosterSize: Math.round(identity.playerOpt),
      targetSource: "team_identity_player_opt" as const,
    };
  }

  const strategyProfile = getTeamStrategyProfile(gameState, teamId);
  if (
    strategyProfile?.rosterOptTarget != null &&
    Number.isFinite(strategyProfile.rosterOptTarget) &&
    strategyProfile.rosterOptTarget > 0
  ) {
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

function resolveLocalSave(input: { saveId: string; seasonId: string }) {
  const persistence = createPersistenceService();
  const requestedSave = persistence.getSaveById(input.saveId);
  if (!requestedSave) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: null,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: `Requested save ${input.saveId} could not be resolved for AI pick audit/reset.`,
      },
    };
  }

  if (requestedSave.gameState.season.id !== input.seasonId) {
    return {
      persistence,
      save: null,
      saveContext: {
        source: "sqlite" as const,
        requestedSaveId: input.saveId,
        resolvedSaveId: requestedSave.saveId,
        requestedSeasonId: input.seasonId,
        resolvedSeasonId: null,
        saveName: requestedSave.name ?? null,
        saveStatus: requestedSave.status ?? null,
        scopeWarning: `Requested season ${input.seasonId} is not available in save ${requestedSave.saveId}.`,
      },
    };
  }

  return {
    persistence,
    save: requestedSave,
    saveContext: {
      source: "sqlite" as const,
      requestedSaveId: input.saveId,
      resolvedSaveId: requestedSave.saveId,
      requestedSeasonId: input.seasonId,
      resolvedSeasonId: requestedSave.gameState.season.id,
      saveName: requestedSave.name ?? null,
      saveStatus: requestedSave.status ?? null,
      scopeWarning: null,
    },
  };
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

function getAxisDistribution(players: Player[]): AxisDistribution {
  if (players.length === 0) {
    return { pow: null, spe: null, men: null, soc: null };
  }

  return {
    pow: roundValue(players.reduce((sum, player) => sum + player.coreStats.pow, 0) / players.length, 2),
    spe: roundValue(players.reduce((sum, player) => sum + player.coreStats.spe, 0) / players.length, 2),
    men: roundValue(players.reduce((sum, player) => sum + player.coreStats.men, 0) / players.length, 2),
    soc: roundValue(players.reduce((sum, player) => sum + player.coreStats.soc, 0) / players.length, 2),
  };
}

function computeProfileScore(player: Player, profile: TeamStrategyProfile | null) {
  if (!profile) {
    return null;
  }

  const className = normalizeToken(player.className);
  const race = normalizeToken(player.race);
  const playerTraits = new Set([
    ...normalizeList(player.traitsPositive),
    ...normalizeList(player.traitsNegative),
  ]);

  let score = 50;
  if (normalizeList(profile.preferredClasses).includes(className)) score += 18;
  if (normalizeList(profile.avoidedClasses).includes(className) || normalizeList(profile.dislikedClasses).includes(className)) score -= 22;
  if (normalizeList(profile.preferredRaces).includes(race)) score += 12;
  if (normalizeList(profile.avoidedRaces).includes(race) || normalizeList(profile.dislikedRaces).includes(race)) score -= 14;

  for (const trait of normalizeList(profile.preferredTraits)) {
    if (playerTraits.has(trait)) {
      score += 6;
    }
  }
  for (const trait of normalizeList(profile.dislikedTraits)) {
    if (playerTraits.has(trait)) {
      score -= 6;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function computePickWarnings(input: {
  player: Player;
  profile: TeamStrategyProfile | null;
  teamFit: number | null;
}) {
  const warnings: PickProfileWarning[] = [];
  const profile = input.profile;
  const className = normalizeToken(input.player.className);
  const race = normalizeToken(input.player.race);
  const traits = new Set([
    ...normalizeList(input.player.traitsPositive),
    ...normalizeList(input.player.traitsNegative),
  ]);

  if (profile) {
    if (normalizeList(profile.avoidedClasses).includes(className) || normalizeList(profile.dislikedClasses).includes(className)) {
      warnings.push("avoided_class_pick");
    }
    if (normalizeList(profile.avoidedRaces).includes(race) || normalizeList(profile.dislikedRaces).includes(race)) {
      warnings.push("avoided_race_pick");
    }
    if (normalizeList(profile.dislikedTraits).some((trait) => traits.has(trait))) {
      warnings.push("disliked_trait_pick");
    }
  }
  if (input.teamFit != null && input.teamFit <= 0) {
    warnings.push("low_team_fit");
  }
  if (className === "berserker") {
    warnings.push("berserker_spam");
  }
  if (className === "warlord") {
    warnings.push("warlord_spam");
  }

  return warnings;
}

function buildTeamAuditRow(input: {
  gameState: GameState;
  teamId: string;
  pickedTransfers: TransferHistoryEntry[];
}) {
  const { gameState, teamId, pickedTransfers } = input;
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    return null;
  }

  const controlSettings = gameState.seasonState.teamControlSettings?.[teamId];
  const controlMode = controlSettings?.controlMode ?? (team.humanControlled ? "manual" : "ai");
  const profile = getTeamStrategyProfile(gameState, teamId);
  const rosterPlayers = getRosterPlayers(gameState, teamId);
  const autoPickedPlayerIds = new Set(pickedTransfers.map((entry) => entry.playerId));
  const autoPickedPlayers = rosterPlayers.filter((item) => autoPickedPlayerIds.has(item.player.id));
  const baseRosterPlayers = rosterPlayers
    .filter((item) => !autoPickedPlayerIds.has(item.player.id))
    .map((item) => item.player);

  const pickedRows: TeamAuditPickedPlayer[] = autoPickedPlayers.map((item) => {
    const relatedTransfer = pickedTransfers.find((entry) => entry.playerId === item.player.id && entry.toTeamId === teamId) ?? null;
    const fitBreakdown = calculateTransfermarktFit(item.player, baseRosterPlayers, { teamId });
    const profileScore = computeProfileScore(item.player, profile);
    const warnings = computePickWarnings({
      player: item.player,
      profile,
      teamFit: fitBreakdown.teamFit,
    });

    return {
      playerId: item.player.id,
      playerName: item.player.name,
      className: item.player.className,
      race: item.player.race,
      source: (relatedTransfer?.source ?? "auto_roster_fill") as AiPickResettableSource,
      transferId: relatedTransfer?.id ?? `missing-transfer:${item.player.id}`,
      purchasePrice: relatedTransfer?.fee ?? item.entry.purchasePrice ?? null,
      salary: relatedTransfer?.salary ?? item.entry.salary ?? null,
      pow: item.player.coreStats.pow,
      spe: item.player.coreStats.spe,
      men: item.player.coreStats.men,
      soc: item.player.coreStats.soc,
      estimatedTeamFit: fitBreakdown.teamFit,
      profileScore,
      warnings,
    };
  });

  const classCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();
  for (const row of pickedRows) {
    classCounts.set(row.className, (classCounts.get(row.className) ?? 0) + 1);
    raceCounts.set(row.race, (raceCounts.get(row.race) ?? 0) + 1);
  }

  const warningFlags = new Set<PickProfileWarning>();
  for (const row of pickedRows) {
    row.warnings.forEach((warning) => warningFlags.add(warning));
  }
  const dominantClass = sortCountEntries(classCounts)[0] ?? null;
  if (dominantClass && pickedRows.length >= 3 && dominantClass.count / pickedRows.length >= 0.5) {
    warningFlags.add("class_spam");
  }

  const teamFitValues = pickedRows
    .map((row) => row.estimatedTeamFit)
    .filter(isFiniteNumber);
  const estimatedTeamFit =
    teamFitValues.length > 0
      ? roundValue(teamFitValues.reduce((sum, value) => sum + value, 0) / teamFitValues.length, 2)
      : null;

  const { targetRosterSize, targetSource } = resolveTargetRoster(gameState, teamId);

  return {
    teamId: team.teamId,
    teamCode: team.shortCode,
    teamName: team.name,
    controlMode,
    targetRosterSize,
    targetSource,
    currentRosterCount: rosterPlayers.length,
    autoPickedCount: pickedRows.length,
    autoPickedPlayers: pickedRows,
    classDistribution: sortCountEntries(classCounts),
    raceDistribution: sortCountEntries(raceCounts),
    axisDistribution: getAxisDistribution(autoPickedPlayers.map((item) => item.player)),
    estimatedTeamFit,
    warningFlags: [...warningFlags],
  };
}

function buildResetCandidates(gameState: GameState, pickedTransfers: TransferHistoryEntry[]) {
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  return pickedTransfers.map<ResetCandidate>((transfer) => {
    const team = teamById.get(transfer.toTeamId ?? "");
    const player = playerById.get(transfer.playerId) ?? null;
    const rosterEntry =
      transfer.toTeamId != null
        ? gameState.rosters.find((entry) => entry.teamId === transfer.toTeamId && entry.playerId === transfer.playerId) ?? null
        : null;
    const laterTransfers = gameState.transferHistory.filter(
      (entry) => entry.playerId === transfer.playerId && Date.parse(entry.happenedAt) > Date.parse(transfer.happenedAt),
    );
    const blockingReasons: string[] = [];
    if (!transfer.toTeamId) {
      blockingReasons.push("transfer_missing_target_team");
    }
    if (!team) {
      blockingReasons.push("team_not_found");
    }
    if (!player) {
      blockingReasons.push("player_not_found");
    }
    if (!rosterEntry) {
      blockingReasons.push("player_not_in_expected_roster");
    }
    if (laterTransfers.length > 0) {
      blockingReasons.push("player_has_later_transfer_history");
    }

    const rosterPlayers = transfer.toTeamId ? getRosterPlayers(gameState, transfer.toTeamId) : [];
    const salaryBefore = getVisibleRosterSalaryTotal(rosterPlayers);
    const salary = rosterEntry?.salary ?? transfer.salary ?? 0;
    const cashBefore = team?.cash ?? null;
    const purchasePrice = transfer.fee ?? rosterEntry?.purchasePrice ?? 0;
    const resettable = blockingReasons.length === 0;
    const wouldAppendHistorySource = transfer.source ? `reset_${transfer.source}` : null;

    return {
      transferId: transfer.id,
      source: (transfer.source ?? "auto_roster_fill") as AiPickResettableSource,
      status: resettable ? "safe_reset" : "blocked_reset",
      historyAction: resettable ? "append_revert_entry_keep_original" : "blocked_keep_original",
      playerId: transfer.playerId,
      playerName: player?.name ?? transfer.playerId,
      className: player?.className ?? null,
      teamId: transfer.toTeamId ?? "unknown-team",
      teamCode: team?.shortCode ?? transfer.toTeamId ?? "unknown",
      teamName: team?.name ?? transfer.toTeamId ?? "Unknown Team",
      rosterEntryId: rosterEntry?.id ?? null,
      purchasePrice,
      salary,
      contractLength: rosterEntry?.contractLength ?? transfer.remainingContractLength ?? 0,
      cashBefore,
      cashAfter: resettable && cashBefore != null ? roundValue(cashBefore + purchasePrice, 2) : cashBefore,
      salaryBefore,
      salaryAfter: resettable ? roundValue(Math.max(0, salaryBefore - salary), 2) : salaryBefore,
      rosterBefore: rosterPlayers.length,
      rosterAfter: resettable ? Math.max(0, rosterPlayers.length - 1) : rosterPlayers.length,
      wouldAppendHistorySource,
      blockingReasons,
    };
  });
}

function summarizeWarnings(teams: TeamAuditRow[]) {
  return teams
    .filter((team) => team.warningFlags.length > 0)
    .map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      warningCount: team.warningFlags.length,
      warnings: team.warningFlags,
    }))
    .sort((left, right) => right.warningCount - left.warningCount);
}

export async function runAiPickAuditReset(params: RunAiPickAuditResetParams): Promise<AiPickAuditResetResponse> {
  if (params.source === "prisma") {
    return {
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "blocked",
      saveContext: {
        source: "sqlite",
        requestedSaveId: params.saveId,
        resolvedSaveId: null,
        requestedSeasonId: params.seasonId,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: "Prisma/Supabase mode is read-only in this build.",
      },
      summary: {
        totalTransfersInSave: 0,
        autoTransfersFound: 0,
        manualTransfersProtected: 0,
        safeResetTransfers: 0,
        blockedResetTransfers: 0,
        affectedTeams: 0,
        affectedPlayers: 0,
        berserkerCount: 0,
        warlordCount: 0,
        berserkerWarlordSharePct: null,
        totalCashRefund: null,
        totalSalaryRelief: null,
      },
      globalAudit: {
        topClasses: [],
        topRaces: [],
        teamsWithWarnings: [],
        teamsWithClassSpam: [],
      },
      teams: [],
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
      recommendedRecovery: null,
      warnings: [],
      blockingReasons: ["source_prisma_read_only"],
    };
  }

  const resolved = resolveLocalSave({ saveId: params.saveId, seasonId: params.seasonId });
  if (!resolved.save) {
    return {
      source: "sqlite",
      readOnly: true,
      dryRun: true,
      executed: false,
      status: "blocked",
      saveContext: resolved.saveContext,
      summary: {
        totalTransfersInSave: 0,
        autoTransfersFound: 0,
        manualTransfersProtected: 0,
        safeResetTransfers: 0,
        blockedResetTransfers: 0,
        affectedTeams: 0,
        affectedPlayers: 0,
        berserkerCount: 0,
        warlordCount: 0,
        berserkerWarlordSharePct: null,
        totalCashRefund: null,
        totalSalaryRelief: null,
      },
      globalAudit: {
        topClasses: [],
        topRaces: [],
        teamsWithWarnings: [],
        teamsWithClassSpam: [],
      },
      teams: [],
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
      recommendedRecovery: {
        action: "create_fresh_test_save",
        suggestedName: "Fresh AI Pick Test Save",
        reason: "Der aktuelle Save-Kontext konnte nicht sauber aufgeloest werden.",
      },
      warnings: [],
      blockingReasons: ["save_scope_unresolved"],
    };
  }

  const dryRun = params.dryRun ?? true;
  const gameState = resolved.save.gameState;
  const pickedTransfers = gameState.transferHistory.filter(
    (entry) =>
      entry.seasonId === params.seasonId &&
      entry.transferType === "buy" &&
      isAiPickResettableSource(entry.source),
  );
  const manualTransfersProtected = gameState.transferHistory.length - pickedTransfers.length;
  const teamIds = Array.from(new Set(pickedTransfers.map((entry) => entry.toTeamId).filter(Boolean))) as string[];
  const teams = teamIds
    .map((teamId) => buildTeamAuditRow({ gameState, teamId, pickedTransfers: pickedTransfers.filter((entry) => entry.toTeamId === teamId) }))
    .filter((entry): entry is TeamAuditRow => Boolean(entry))
    .sort((left, right) => left.teamName.localeCompare(right.teamName, "de"));

  const resetCandidates = buildResetCandidates(gameState, pickedTransfers).sort((left, right) =>
    left.teamName === right.teamName
      ? left.playerName.localeCompare(right.playerName, "de")
      : left.teamName.localeCompare(right.teamName, "de"),
  );
  const safeCandidates = resetCandidates.filter((entry) => entry.status === "safe_reset");
  const blockedCandidates = resetCandidates.filter((entry) => entry.status === "blocked_reset");

  const classCounts = new Map<string, number>();
  const raceCounts = new Map<string, number>();
  for (const team of teams) {
    for (const row of team.autoPickedPlayers) {
      classCounts.set(row.className, (classCounts.get(row.className) ?? 0) + 1);
      raceCounts.set(row.race, (raceCounts.get(row.race) ?? 0) + 1);
    }
  }

  const berserkerCount = classCounts.get("Berserker") ?? 0;
  const warlordCount = classCounts.get("Warlord") ?? 0;
  const totalPickedPlayers = pickedTransfers.length;
  const totalCashRefund =
    safeCandidates.length > 0
      ? roundValue(safeCandidates.reduce((sum, entry) => sum + entry.purchasePrice, 0), 2)
      : null;
  const totalSalaryRelief =
    safeCandidates.length > 0
      ? roundValue(safeCandidates.reduce((sum, entry) => sum + entry.salary, 0), 2)
      : null;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  if (blockedCandidates.length > 0) {
    warnings.push("Einige AI-/Setup-Kaeufe sind nicht sicher ruecksetzbar und bleiben geschuetzt.");
  }
  if (teams.some((team) => team.warningFlags.includes("class_spam") || team.warningFlags.includes("berserker_spam") || team.warningFlags.includes("warlord_spam"))) {
    warnings.push("Klassen-Spam erkannt: einzelne Teams haben auffaellig einseitige Auto-Picks.");
  }
  if (totalPickedPlayers === 0) {
    warnings.push("Im aktuellen Save wurden keine ruecksetzbaren AI-/Setup-Kaeufe gefunden.");
  }

  let executed = false;
  let nextState = gameState;
  const revertedTransferIds: string[] = [];
  const protectedTransferIds: string[] = blockedCandidates.map((entry) => entry.transferId);
  const appendedHistoryIds: string[] = [];
  const logIds: string[] = [];

  if (!dryRun) {
    if (params.confirmToken !== AI_PICK_AUDIT_RESET_CONFIRM_TOKEN) {
      blockingReasons.push("confirm_token_missing");
    }
    if (blockedCandidates.length > 0 && !params.force) {
      blockingReasons.push("blocked_transfers_require_force");
    }
    if (safeCandidates.length === 0) {
      blockingReasons.push("no_safe_reset_candidates");
    }

    if (blockingReasons.length === 0) {
      const rosterIdsToRemove = new Set(safeCandidates.map((entry) => entry.rosterEntryId).filter(Boolean) as string[]);
      const historyEntriesToAppend: TransferHistoryEntry[] = safeCandidates.map((entry) => {
        const historyId = `history-${randomUUID()}`;
        appendedHistoryIds.push(historyId);
        revertedTransferIds.push(entry.transferId);
        return {
          id: historyId,
          playerId: entry.playerId,
          seasonId: params.seasonId,
          matchdayId: gameState.matchdayState.matchdayId ?? null,
          phase: "admin_reset_window",
          source: entry.wouldAppendHistorySource ?? "reset_ai_pick",
          seasonLabel: gameState.season.name,
          transferType: "sell",
          fromTeamId: entry.teamId,
          toTeamId: null,
          fee: entry.purchasePrice,
          salary: entry.salary,
          marketValue: entry.purchasePrice,
          remainingContractLength: entry.contractLength,
          happenedAt: new Date().toISOString(),
        } satisfies TransferHistoryEntry;
      });

      const refundByTeamId = safeCandidates.reduce((map, entry) => {
        map.set(entry.teamId, roundValue((map.get(entry.teamId) ?? 0) + entry.purchasePrice, 2));
        return map;
      }, new Map<string, number>());

      const resetLogId = `log-${randomUUID()}`;
      logIds.push(resetLogId);

      nextState = {
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
        transferHistory: [...historyEntriesToAppend, ...gameState.transferHistory],
        logs: [
          {
            id: resetLogId,
            type: "transfer",
            message: `AI-/Setup-Roster-Reset: ${safeCandidates.length} Kaeufe im Save ${resolved.save.saveId} rueckgesetzt.`,
            createdAt: new Date().toISOString(),
          },
          ...gameState.logs,
        ],
      };

      resolved.persistence.saveSingleplayerState(resolved.save.saveId, nextState);
      executed = true;
    }
  }

  return {
    source: "sqlite",
    readOnly: dryRun,
    dryRun,
    executed,
    status:
      executed && blockedCandidates.length > 0
        ? "partial_applied"
        : executed
          ? "applied"
          : blockingReasons.length > 0
            ? "blocked"
            : warnings.length > 0
              ? "warning"
              : "ready",
    saveContext: resolved.saveContext,
    summary: {
      totalTransfersInSave: gameState.transferHistory.length,
      autoTransfersFound: pickedTransfers.length,
      manualTransfersProtected,
      safeResetTransfers: safeCandidates.length,
      blockedResetTransfers: blockedCandidates.length,
      affectedTeams: teams.length,
      affectedPlayers: totalPickedPlayers,
      berserkerCount,
      warlordCount,
      berserkerWarlordSharePct:
        totalPickedPlayers > 0 ? roundValue(((berserkerCount + warlordCount) / totalPickedPlayers) * 100, 2) : null,
      totalCashRefund,
      totalSalaryRelief,
    },
    globalAudit: {
      topClasses: sortCountEntries(classCounts).slice(0, 8),
      topRaces: sortCountEntries(raceCounts).slice(0, 8),
      teamsWithWarnings: summarizeWarnings(teams),
      teamsWithClassSpam: teams
        .map((team) => {
          const dominantClass = team.classDistribution[0] ?? null;
          if (!dominantClass || team.autoPickedCount < 3 || dominantClass.count / Math.max(team.autoPickedCount, 1) < 0.5) {
            return null;
          }
          return {
            teamId: team.teamId,
            teamName: team.teamName,
            dominantClass: dominantClass.label,
            count: dominantClass.count,
          };
        })
        .filter((entry): entry is { teamId: string; teamName: string; dominantClass: string; count: number } => Boolean(entry)),
    },
    teams,
    resetPreview: {
      candidates: resetCandidates,
      safeTransferIds: safeCandidates.map((entry) => entry.transferId),
      blockedTransferIds: blockedCandidates.map((entry) => entry.transferId),
      wouldRemoveRosterEntries: safeCandidates.length,
      wouldAppendHistoryEntries: safeCandidates.length,
      wouldWriteLogs: safeCandidates.length > 0 ? 1 : 0,
    },
    resetExecution: {
      revertedTransferIds,
      protectedTransferIds,
      appendedHistoryIds,
      logIds,
    },
    recommendedRecovery:
      blockedCandidates.length > 0
        ? {
            action: "create_fresh_test_save",
            suggestedName: `Fresh AI Reset Test ${new Date().toLocaleString("de-DE")}`,
            reason: "Mindestens ein AI-/Setup-Kauf ist nicht sicher ruecksetzbar. Ein frischer Test-Save vermeidet gemischte Transferspuren.",
          }
        : null,
    warnings,
    blockingReasons,
  };
}
