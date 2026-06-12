export type RedraftMode = "target_topup_redraft" | "full_clean_redraft_from_empty";

export type RedraftRunAuditInput = {
  rosterBefore: number;
  rosterAfter: number;
  boughtPlayers: number;
  removedPlayers?: number | null;
  resetTransfersCount?: number | null;
  manualTransfersPreserved?: number | null;
  aiTransfersReset?: number | null;
  facilityEventsPreserved?: number | null;
  seasonResultsPreserved?: boolean | null;
};

export type RedraftRunAudit = Required<RedraftRunAuditInput> & {
  redraftMode: RedraftMode;
  preservedPlayers: number;
  warnings: string[];
};

export type RedraftTeamSpendAuditInput = {
  teamCode: string;
  actualRoster: number | null;
  targetRoster: number | null;
  boughtPlayers: number;
  plannedSpend: number | null;
  spendRatio: number | null;
  laneDistributionCount: number;
};

export type RedraftTeamSpendAudit = {
  teamCode: string;
  spendAuditReason: string | null;
  warnings: string[];
};

export function buildRedraftRunAudit(input: RedraftRunAuditInput): RedraftRunAudit {
  const rosterBefore = Math.max(0, Math.round(input.rosterBefore));
  const rosterAfter = Math.max(0, Math.round(input.rosterAfter));
  const boughtPlayers = Math.max(0, Math.round(input.boughtPlayers));
  const removedPlayers = Math.max(0, Math.round(input.removedPlayers ?? 0));
  const preservedPlayers = Math.max(0, rosterAfter - boughtPlayers);
  const redraftMode: RedraftMode = rosterBefore > 0 ? "target_topup_redraft" : "full_clean_redraft_from_empty";
  const warnings: string[] = [];

  if (redraftMode === "target_topup_redraft" && preservedPlayers <= 0) {
    warnings.push("redraft_preserved_roster_expected_but_missing");
  }
  if (redraftMode === "full_clean_redraft_from_empty" && preservedPlayers > 0) {
    warnings.push("full_clean_redraft_has_preserved_players");
  }
  if (rosterAfter !== rosterBefore - removedPlayers + boughtPlayers) {
    warnings.push("redraft_roster_delta_mismatch");
  }

  return {
    redraftMode,
    rosterBefore,
    rosterAfter,
    removedPlayers,
    boughtPlayers,
    preservedPlayers,
    resetTransfersCount: Math.max(0, Math.round(input.resetTransfersCount ?? 0)),
    manualTransfersPreserved: Math.max(0, Math.round(input.manualTransfersPreserved ?? 0)),
    aiTransfersReset: Math.max(0, Math.round(input.aiTransfersReset ?? 0)),
    facilityEventsPreserved: Math.max(0, Math.round(input.facilityEventsPreserved ?? 0)),
    seasonResultsPreserved: Boolean(input.seasonResultsPreserved),
    warnings,
  };
}

export function buildRedraftTeamSpendAudit(input: RedraftTeamSpendAuditInput): RedraftTeamSpendAudit {
  const warnings: string[] = [];
  const targetReached =
    input.actualRoster != null &&
    input.targetRoster != null &&
    input.actualRoster >= input.targetRoster;
  const noNewPicks = input.boughtPlayers === 0;
  const zeroSpend =
    (input.spendRatio != null && input.spendRatio === 0) ||
    (input.plannedSpend != null && input.plannedSpend === 0);

  let spendAuditReason: string | null = null;
  if (zeroSpend && noNewPicks && targetReached) {
    spendAuditReason = "already_at_target_before_redraft_cash_untouched";
  } else if (zeroSpend && noNewPicks && input.laneDistributionCount === 0) {
    spendAuditReason = "no_new_picks_in_topup_redraft";
  } else if (zeroSpend && input.boughtPlayers > 0) {
    spendAuditReason = "redraft_audit_missing_preserved_roster_spend";
    warnings.push("redraft_audit_missing_preserved_roster_spend");
  } else if (input.spendRatio == null && input.boughtPlayers === 0 && targetReached) {
    spendAuditReason = "already_at_target_before_redraft_cash_untouched";
  }

  return {
    teamCode: input.teamCode,
    spendAuditReason,
    warnings,
  };
}
