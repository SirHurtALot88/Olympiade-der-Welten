import { buildTeamRelationshipCards } from "@/lib/rivalries/team-relationship-dynamics";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getLatestBlockOneSaveId() {
  const persistence = createPersistenceService();
  return persistence
    .listSaves()
    .filter((save) => save.name.includes("Block 1 Full Season Smoke"))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.saveId ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickCompletedSeasonId(saveId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const explicitSeasonId = process.env.BLOCK2_SEASON_ID?.trim();
  if (explicitSeasonId) return explicitSeasonId;
  const snapshots = [...(save.gameState.seasonState.seasonSnapshots ?? [])].sort((left, right) =>
    right.seasonId.localeCompare(left.seasonId, "de", { numeric: true }),
  );
  return snapshots[0]?.seasonId ?? null;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((summary, value) => {
    summary[value] = (summary[value] ?? 0) + 1;
    return summary;
  }, {});
}

function main() {
  const persistence = createPersistenceService();
  const saveId = process.env.BLOCK2_SAVE_ID?.trim() || getLatestBlockOneSaveId();
  if (!saveId) {
    throw new Error("No Block 1 save found. Run `npm run season:smoke-block-1` first or set BLOCK2_SAVE_ID.");
  }
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const seasonId = requireValue(pickCompletedSeasonId(saveId), "No completed season snapshot found for Block 2 audit.");
  const gameState = save.gameState;
  const snapshot = gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === seasonId) ?? null;
  const seasonConsequences = asRecord(asRecord(gameState.seasonReviewState).seasonConsequences);
  const consequence = asRecord(seasonConsequences[seasonId]);
  const objectiveSettlement = asRecord(consequence.objectiveSettlement);
  const objectiveRows = Array.isArray(objectiveSettlement.rows) ? objectiveSettlement.rows.map((row) => asRecord(row)) : [];
  const objectiveTotals = asRecord(objectiveSettlement.totals);
  const objectiveTeamSummaries = Object.values(asRecord(objectiveSettlement.byTeamId)).map(asRecord);
  const relationshipEvents = (gameState.seasonState.teamRelationshipEvents ?? []).filter((event) => event.seasonId === seasonId);
  const relationshipReasonCounts = countBy(relationshipEvents.map((event) => event.reason));
  const seasonGameState = {
    ...gameState,
    season: { ...gameState.season, id: seasonId },
    seasonState: { ...gameState.seasonState, seasonId },
  };
  const relationshipCards = gameState.teams.flatMap((team) => {
    const cards = buildTeamRelationshipCards(seasonGameState, team.teamId);
    return [...cards.allies, ...cards.rivals];
  });
  const changedRelationshipCards = relationshipCards.filter((card) => card.changed);
  const progressionEvents = (gameState.playerProgressionEvents ?? []).filter((event) => event.seasonId === seasonId);
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const progressionRows = progressionEvents.map((event) => {
    const attributeDelta = event.upgrades.reduce((sum, upgrade) => sum + (upgrade.toValue - upgrade.fromValue), 0);
    const beforeMarket = event.progressionSnapshotBefore?.marketValue;
    const afterMarket = event.progressionSnapshotAfter?.marketValuePreview ?? event.progressionSnapshotAfter?.marketValue;
    const beforeSalary = event.progressionSnapshotBefore?.salary;
    const afterSalary = event.progressionSnapshotAfter?.salaryPreview ?? event.progressionSnapshotAfter?.salary;
    const player = playersById.get(event.playerId) as (typeof gameState.players)[number] & {
      lastOrganicProgression?: { traitModifierPct?: number | null; topGains?: unknown[]; topLosses?: unknown[] };
    } | undefined;
    return {
      event,
      attributeDelta,
      fairSnapshot: event.progressionSnapshotBefore != null && event.progressionSnapshotAfter != null,
      marketValueDelta: isFiniteNumber(beforeMarket) && isFiniteNumber(afterMarket) ? round(afterMarket - beforeMarket, 2) : null,
      salaryDelta: isFiniteNumber(beforeSalary) && isFiniteNumber(afterSalary) ? round(afterSalary - beforeSalary, 2) : null,
      traitModifierPct: player?.lastOrganicProgression?.traitModifierPct ?? null,
    };
  });
  const cashLogs = (gameState.seasonState.cashPrizeApplyLogs ?? []).filter((log) => log.seasonId === seasonId);
  const cashPrizeConsequence = asRecord(consequence.cashPrize);
  const totalSalary = gameState.rosters.reduce((sum, roster) => sum + (roster.salary ?? roster.upkeep ?? 0), 0);
  const totalMarketValue = gameState.rosters.reduce((sum, roster) => sum + (roster.currentValue ?? roster.marketValue ?? 0), 0);
  const negativeCashTeams = gameState.teams.filter((team) => (team.cash ?? 0) < 0);
  const invalidEconomyPlayers = gameState.players.filter(
    (player) =>
      !isFiniteNumber(player.marketValue) ||
      player.marketValue < 0 ||
      !isFiniteNumber(player.salaryDemand) ||
      player.salaryDemand < 0,
  );
  const transferHistory = (gameState.transferHistory ?? []).filter((entry) => entry.seasonId === seasonId);
  const aiSeasonAudit = asRecord(consequence.aiSeasonAudit);
  const aiTotals = asRecord(aiSeasonAudit.totals);
  const aiRates = asRecord(aiSeasonAudit.rates);
  const aiTeams = Array.isArray(aiSeasonAudit.teams) ? aiSeasonAudit.teams.map((team) => asRecord(team)) : [];
  const aiWarningCounts = countBy(aiTeams.flatMap((team) => (Array.isArray(team.warnings) ? team.warnings : []) as string[]));

  const blockers = [
    Object.keys(consequence).length === 0 ? "season_consequences_missing" : null,
    snapshot == null ? "season_snapshot_missing" : null,
    objectiveRows.length === 0 ? "board_objectives_missing" : null,
    Number(objectiveTotals.completed ?? 0) + Number(objectiveTotals.failed ?? 0) <= 0 ? "board_objective_results_missing" : null,
    objectiveTeamSummaries.length < gameState.teams.length ? "board_objective_team_coverage_incomplete" : null,
    objectiveRows.every((row) => Number(row.boardConfidenceDelta ?? 0) === 0) ? "board_confidence_delta_missing" : null,
    objectiveRows.some((row) => typeof row.reason !== "string" || !row.reason.includes("/")) ? "board_objective_explanations_missing" : null,
    relationshipEvents.length === 0 ? "relationship_events_missing" : null,
    relationshipEvents.some((event) => event.source !== "matchday_result") ? "relationship_event_source_not_persisted" : null,
    changedRelationshipCards.length === 0 ? "relationship_card_changes_missing" : null,
    progressionEvents.length === 0 ? "progression_events_missing" : null,
    progressionRows.filter((row) => row.fairSnapshot).length < Math.max(1, Math.floor(progressionRows.length * 0.8))
      ? "progression_before_after_snapshots_missing"
      : null,
    progressionRows.every((row) => row.attributeDelta === 0) ? "progression_attribute_deltas_missing" : null,
    progressionRows.filter((row) => row.traitModifierPct != null && row.traitModifierPct !== 0).length === 0
      ? "progression_trait_bonus_malus_missing"
      : null,
    cashLogs.length === 0 ? "cash_prize_logs_missing_after_transition" : null,
    Number(cashPrizeConsequence.totalPrizeMoney ?? 0) <= 0 ? "cash_prize_consequence_missing" : null,
    negativeCashTeams.length > 0 ? "economy_negative_cash_after_season" : null,
    invalidEconomyPlayers.length > 0 ? "economy_invalid_player_values" : null,
    totalSalary <= 0 ? "economy_salary_total_missing" : null,
    totalMarketValue <= 0 ? "economy_market_value_total_missing" : null,
    Number(aiTotals.aiDrafts ?? 0) <= 0 ? "ai_audit_drafts_missing" : null,
    Number(aiRates.aiDraftCoveragePct ?? 0) < 99 ? "ai_audit_draft_coverage_low" : null,
    Number(aiTotals.captainUses ?? 0) <= 0 ? "ai_audit_captains_missing" : null,
    Number(aiTotals.formCardUses ?? 0) <= 0 ? "ai_audit_formcards_missing" : null,
    Number(aiTotals.secondaryFormCardUses ?? 0) <= 0 ? "ai_audit_secondary_formcards_missing" : null,
    Number(aiTotals.teamPowerUses ?? 0) <= 0 ? "ai_audit_team_powers_missing" : null,
    Number(aiTotals.mutatorTraits ?? 0) <= 0 ? "ai_audit_mutators_missing" : null,
    Number(aiTotals.pushSides ?? 0) <= 0 ? "ai_audit_push_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));

  const warnings = [
    transferHistory.length === 0 ? "transfer_history_empty_in_block_smoke" : null,
    Object.keys(aiWarningCounts).length > 0 ? `ai_audit_team_warnings:${JSON.stringify(aiWarningCounts)}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  if (blockers.length > 0) {
    throw new Error(`Block 2 consequence audit failed: ${blockers.join(" | ")}`);
  }

  console.log(
    JSON.stringify(
      {
        saveId,
        seasonId,
        testStatus: "passed",
        boardObjectives: {
          rows: objectiveRows.length,
          completed: Number(objectiveTotals.completed ?? 0),
          failed: Number(objectiveTotals.failed ?? 0),
          cashDelta: Number(objectiveTotals.cashDelta ?? 0),
          boardConfidenceDelta: Number(objectiveTotals.boardConfidenceDelta ?? 0),
          teamSummaries: objectiveTeamSummaries.length,
          sampleReasons: objectiveRows.slice(0, 3).map((row) => row.reason),
        },
        relationships: {
          events: relationshipEvents.length,
          changedCards: changedRelationshipCards.length,
          reasonCounts: relationshipReasonCounts,
          sample: changedRelationshipCards.slice(0, 3).map((card) => ({
            teamId: card.teamId,
            type: card.type,
            delta: card.delta,
            reasons: card.reasons,
          })),
        },
        progression: {
          events: progressionEvents.length,
          fairSnapshots: progressionRows.filter((row) => row.fairSnapshot).length,
          positive: progressionRows.filter((row) => row.attributeDelta > 0).length,
          negative: progressionRows.filter((row) => row.attributeDelta < 0).length,
          traitModified: progressionRows.filter((row) => row.traitModifierPct != null && row.traitModifierPct !== 0).length,
          marketValueDeltaTotal: round(progressionRows.reduce((sum, row) => sum + (row.marketValueDelta ?? 0), 0), 2),
          salaryDeltaTotal: round(progressionRows.reduce((sum, row) => sum + (row.salaryDelta ?? 0), 0), 2),
        },
        economy: {
          cashPrizeLogs: cashLogs.length,
          totalPrizeMoney: Number(cashPrizeConsequence.totalPrizeMoney ?? 0),
          rankChangePrize: Number(cashPrizeConsequence.rankChangePrize ?? 0),
          teamCashTotal: round(gameState.teams.reduce((sum, team) => sum + (team.cash ?? 0), 0), 2),
          salaryTotal: round(totalSalary, 2),
          marketValueTotal: round(totalMarketValue, 2),
          transfers: transferHistory.length,
        },
        aiAudit: {
          totals: aiTotals,
          rates: aiRates,
          warningCounts: aiWarningCounts,
        },
        warnings,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
