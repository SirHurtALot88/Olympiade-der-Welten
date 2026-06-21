import fs from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { applyAiMarketPlanLocally, type AiMarketPlanApplyResult } from "@/lib/ai/ai-market-plan-apply-service";
import type { GameState, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";
import { previewFacilitySeasonEndFinance, applyFacilitySeasonEndFinance, type FacilitySeasonEndFinanceApplyResult, type FacilitySeasonEndFinancePreview } from "@/lib/facilities/facility-season-end-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { buildSeasonReview } from "@/lib/season/season-review-service";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply, previewCashPrizeApply, type CashPrizeApplyResult } from "@/lib/season/cash-prize-apply-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildSeasonEndProgressionPreview, type SeasonEndProgressionPreview } from "@/lib/training/season-end-progression-preview";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = "/Users/chrisfalk/Documents/Codex/2026-06-11/wir-machen-weiter-mit-dem-olympiade/outputs";
const TARGET_SEASON_ID = process.env.OLY_TARGET_SEASON_ID ?? "season-1";
const TARGET_SAVE_ID = process.env.OLY_TARGET_SAVE_ID ?? null;
const EXPORT_PREFIX = process.env.OLY_EXPORT_PREFIX ?? "season-transition-s1-s2";

function parseArgs() {
  return { write: process.argv.includes("--write") };
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeOutput(name: string, content: string) {
  ensureOutputDir();
  fs.writeFileSync(path.join(OUTPUT_DIR, name), content);
}

function exportName(suffix: string) {
  return `${EXPORT_PREFIX}-${suffix}`;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getActiveSaveOrThrow() {
  const persistence = createPersistenceService();
  const save = (TARGET_SAVE_ID ? persistence.getSaveById(TARGET_SAVE_ID) : null) ?? persistence.getActiveSave() ?? persistence.bootstrapSingleplayerSave().save;
  if (!save) throw new Error("No active local save found.");
  return { persistence, save };
}

function buildPreflight(gameState: GameState) {
  const standings = Object.entries(gameState.seasonState.standings ?? {});
  const champion = standings
    .map(([teamId, standing]) => ({
      teamId,
      rank: standing.rank ?? null,
      points: standing.points ?? 0,
      teamName: gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId,
    }))
    .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999) || right.points - left.points)[0] ?? null;
  const facilityCollections = gameState.seasonState.teamFacilities ?? {};
  return {
    seasonId: gameState.season.id,
    gamePhase: gameState.gamePhase ?? "season_active",
    matchdayId: gameState.matchdayState.matchdayId,
    matchdayStatus: gameState.matchdayState.status,
    teamCount: gameState.teams.length,
    rosterCount: gameState.rosters.length,
    standingsCount: standings.length,
    champion,
    matchdayResults: gameState.seasonState.matchdayResults?.filter((row) => row.seasonId === gameState.season.id).length ?? 0,
    playerPerformanceRows: gameState.seasonState.playerDisciplinePerformances?.length ?? 0,
    transferHistoryRows: gameState.transferHistory.length,
    facilityCollections: Object.keys(facilityCollections).length,
    preSeasonWorkflowLogs: gameState.seasonState.preSeasonWorkflowLogs?.length ?? 0,
    seasonTransitionStatus: gameState.seasonTransition?.status ?? null,
  };
}

function assertSeasonEndReady(preflight: ReturnType<typeof buildPreflight>) {
  const blockers: string[] = [];
  if (preflight.seasonId !== TARGET_SEASON_ID) blockers.push(`season_not_${TARGET_SEASON_ID}:${preflight.seasonId}`);
  if (preflight.gamePhase !== "season_completed") blockers.push(`season_not_completed:${preflight.gamePhase}`);
  if (preflight.matchdayStatus !== "resolved") blockers.push(`last_matchday_not_resolved:${preflight.matchdayStatus}`);
  if (preflight.standingsCount !== 32) blockers.push(`standings_count:${preflight.standingsCount}`);
  if (!preflight.champion?.teamId) blockers.push("champion_missing");
  if (preflight.matchdayResults !== 10) blockers.push(`matchday_results:${preflight.matchdayResults}`);
  if (preflight.playerPerformanceRows <= 0) blockers.push("player_pps_missing");
  if (preflight.transferHistoryRows <= 0) blockers.push("transfer_history_missing");
  if (blockers.length > 0) throw new Error(`Season-end preflight blocked: ${blockers.join(" | ")}`);
}

function buildProgressionPreview(gameState: GameState): SeasonEndProgressionPreview {
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const playerSeasonPerformanceMap = buildPlayerSeasonPerformanceMap(gameState);
  const preferredAttributes: PlayerGeneratorAttributeName[] = ["power", "speed", "intelligence", "stamina"];
  const previews = gameState.teams.map((team) => {
    const teamRosters = gameState.rosters.filter((roster) => roster.teamId === team.teamId);
    const forecastsByPlayerId = new Map(
      teamRosters
        .map((roster) => {
          const player = gameState.players.find((entry) => entry.id === roster.playerId);
          if (!player) return null;
          return [
            roster.playerId,
            buildPlayerProgressionForecast({
              gameState,
              player,
              playerRating: playerRatingsById.get(player.id) ?? null,
              seasonPerformance: playerSeasonPerformanceMap.get(player.id) ?? null,
              trainingModeByPlayerId: {},
              currentXP: player.currentXP ?? 0,
              spentXP: player.spentXP ?? 0,
              lifetimeXP: player.lifetimeXP ?? null,
            }),
          ] as const;
        })
        .filter((entry): entry is [string, ReturnType<typeof buildPlayerProgressionForecast>] => Boolean(entry)),
    );

    return buildSeasonEndProgressionPreview({
      gameState,
      teamId: team.teamId,
      forecastsByPlayerId,
      upgradeRequests: teamRosters.map((roster, index) => ({
        playerId: roster.playerId,
        attribute: preferredAttributes[index % preferredAttributes.length] ?? "power",
      })),
      facilities: { teamFacilities: gameState.seasonState.teamFacilities?.[team.teamId] },
    });
  });

  return {
    status: previews.some((preview) => preview.status === "warning") ? "warning" : "ready",
    productiveWrites: false,
    warnings: [...new Set(previews.flatMap((preview) => preview.warnings))],
    rows: previews.flatMap((preview) => preview.rows),
  };
}

function financeRows(result: CashPrizeApplyResult) {
  return result.plannedChanges.map((row) => ({
    teamId: row.teamId,
    teamCode: row.teamCode,
    teamName: row.teamName,
    rank: row.rank,
    points: row.points,
    cashBefore: row.oldCash,
    prizeMoney: row.prizeMoney,
    cashAfter: row.newCash,
    status: row.status,
    warnings: row.warnings.join("|"),
  }));
}

function facilityRows(rows: Array<FacilitySeasonEndFinancePreview | FacilitySeasonEndFinanceApplyResult>) {
  return rows.flatMap((preview) =>
    preview.rows.map((row) => ({
      teamId: preview.team?.teamId,
      teamCode: preview.team?.shortCode,
      teamName: preview.team?.name,
      facilityId: row.facilityId,
      label: row.label,
      level: row.level,
      enabled: row.enabled,
      upkeep: row.upkeep,
      income: row.income,
      status: row.status,
      cashBeforeFacilities: preview.cashBeforeFacilities,
      cashAfterFacilities: preview.cashAfterFacilities,
      warning: row.warning,
    })),
  );
}

function progressionRows(preview: SeasonEndProgressionPreview) {
  return preview.rows.map((row) => ({
    playerId: row.playerId,
    playerName: row.playerName,
    teamId: row.teamId,
    teamCode: row.teamCode,
    availableXP: row.availableXP,
    trainingXP: row.trainingXP,
    performanceXP: row.performanceXP,
    selectedAttribute: row.selectedAttribute,
    attributeBefore: row.attributeBefore,
    attributeAfter: row.attributeAfter,
    upgradeCost: row.upgradeCost,
    remainingXP: row.remainingXP,
    status: row.status,
    blockReason: row.blockReason,
    marketValueWarning: row.economyAudit.warningLevel,
    economyWarnings: row.economyAudit.warnings.join("|"),
    disciplineDeltas: row.disciplineDeltas.filter((delta) => (delta.disciplineDelta ?? 0) > 0).map((delta) => `${delta.label}+${delta.disciplineDelta}`).join("|"),
  }));
}

function transferRows(result: AiMarketPlanApplyResult | null) {
  if (!result) return [];
  return result.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.teamCode,
    teamName: team.teamName,
    controlMode: team.controlMode,
    result: team.result,
    plannedSells: team.plannedSells,
    plannedBuys: team.plannedBuys,
    executedSells: team.executedSells,
    executedBuys: team.executedBuys,
    cashBefore: team.cashBefore,
    cashAfter: team.cashAfter,
    rosterBefore: team.rosterBefore,
    rosterAfter: team.rosterAfter,
    warnings: team.warnings.join("|"),
    blockers: team.blockingReasons.join("|"),
  }));
}

type EmergencyFinanceRepairAction = {
  teamId: string;
  teamCode: string;
  teamName: string;
  action: "sell" | "buy";
  playerId: string;
  playerName: string;
  fee: number | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  reason: string;
};

type EmergencyFinanceRepairResult = {
  applied: boolean;
  actions: EmergencyFinanceRepairAction[];
  blockers: string[];
  warnings: string[];
};

function getRosterEntries(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId);
}

function getPlayerName(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId)?.name ?? playerId;
}

function getTeamTargets(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  return deriveRosterTargets(team, identity);
}

function getCurrentTeam(gameState: GameState, teamId: string) {
  return gameState.teams.find((team) => team.teamId === teamId) ?? null;
}

function sellCandidateScore(entry: GameState["rosters"][number], preview: ReturnType<typeof previewLocalTransfermarktSell>) {
  const salePrice = preview.salePrice ?? 0;
  const salary = preview.salaryReduction ?? entry.salary ?? 0;
  const expiringBoost = entry.contractLength <= 1 ? 1000 : entry.contractLength === 2 ? 400 : 0;
  return expiringBoost + salary * 20 + salePrice;
}

function findEmergencyReplacement(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  excludedPlayerIds: Set<string>;
  maxPurchasePrice: number;
}) {
  const feed = listLocalTransfermarktFreeAgents({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    mode: "ai_preview",
    limit: 160,
  });
  const cheapCandidates = feed.items
    .filter((item) => !input.excludedPlayerIds.has(item.playerId))
    .filter((item) => (item.marketValue ?? 9999) <= input.maxPurchasePrice + 1)
    .sort((left, right) => {
      const priceDelta = (left.marketValue ?? 9999) - (right.marketValue ?? 9999);
      if (priceDelta !== 0) return priceDelta;
      const leftAxis = ((left.pow ?? 0) + (left.spe ?? 0) + (left.men ?? 0) + (left.soc ?? 0)) / 4;
      const rightAxis = ((right.pow ?? 0) + (right.spe ?? 0) + (right.men ?? 0) + (right.soc ?? 0)) / 4;
      return rightAxis - leftAxis || left.name.localeCompare(right.name, "de", { numeric: true, sensitivity: "base" });
    })
    .slice(0, 24);

  for (const item of cheapCandidates) {
      const preview = previewLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: item.playerId,
        contractLength: 1,
        transferSource: "ai_preseason_finance_emergency_buy",
      });
    if (preview.canBuy && (preview.purchasePrice ?? Number.POSITIVE_INFINITY) <= input.maxPurchasePrice) {
      return { item, preview };
    }
  }
  return null;
}

function runEmergencyFinanceRepair(saveId: string, seasonId: string): EmergencyFinanceRepairResult {
  const persistence = createPersistenceService();
  const actions: EmergencyFinanceRepairAction[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sourceSell = "ai_preseason_finance_emergency_sell";
  const sourceBuy = "ai_preseason_finance_emergency_buy";

  for (let teamIndex = 0; teamIndex < 32; teamIndex += 1) {
    const save = persistence.getSaveById(saveId);
    if (!save) {
      blockers.push("save_missing_during_emergency_finance_repair");
      break;
    }
    const team = save.gameState.teams[teamIndex];
    if (!team || team.humanControlled || team.cash > 0) continue;

    let safety = 0;
    while (safety < 8) {
      safety += 1;
      const latestSave = persistence.getSaveById(saveId);
      if (!latestSave) {
        blockers.push("save_missing_during_emergency_finance_repair_loop");
        break;
      }
      const latestTeam = getCurrentTeam(latestSave.gameState, team.teamId);
      if (!latestTeam || latestTeam.cash > 0) break;

      const targets = getTeamTargets(latestSave.gameState, team.teamId);
      const rosterEntries = getRosterEntries(latestSave.gameState, team.teamId);
      const canSellWithoutReplacement = rosterEntries.length - 1 >= targets.playerMin;
      const sellOptions = rosterEntries
        .map((entry) => ({ entry, preview: previewLocalTransfermarktSell({ saveId, seasonId, teamId: team.teamId, activePlayerId: entry.id, transferSource: sourceSell }) }))
        .filter(({ preview }) => preview.canSell && (preview.salePrice ?? 0) > 0)
        .sort((left, right) => sellCandidateScore(right.entry, right.preview) - sellCandidateScore(left.entry, left.preview));

      let executed = false;
      for (const option of sellOptions) {
        const cashAfterSell = option.preview.cashAfter ?? latestTeam.cash;
        const needsReplacement = !canSellWithoutReplacement;
        const replacement = needsReplacement
          ? findEmergencyReplacement({
              saveId,
              seasonId,
              teamId: team.teamId,
              excludedPlayerIds: new Set([option.entry.playerId]),
              maxPurchasePrice: Math.max(0, cashAfterSell - 0.25),
            })
          : null;

        if (needsReplacement && !replacement) continue;

        const sellResult = executeLocalTransfermarktSell({
          saveId,
          seasonId,
          teamId: team.teamId,
          activePlayerId: option.entry.id,
          transferSource: sourceSell,
        });
        if (!sellResult.activePlayerRemoved) continue;
        actions.push({
          teamId: team.teamId,
          teamCode: team.shortCode,
          teamName: team.name,
          action: "sell",
          playerId: option.entry.playerId,
          playerName: sellResult.player?.name ?? getPlayerName(latestSave.gameState, option.entry.playerId),
          fee: round(sellResult.salePrice ?? 0),
          cashBefore: sellResult.cashBefore != null ? round(sellResult.cashBefore) : null,
          cashAfter: sellResult.cashAfter != null ? round(sellResult.cashAfter) : null,
          rosterBefore: sellResult.rosterBefore,
          rosterAfter: sellResult.rosterAfter,
          reason: option.entry.contractLength <= 1 ? "negative_cash_expiring_contract_sale" : "negative_cash_salary_pressure_sale",
        });

        if (replacement) {
          const buyResult = executeLocalTransfermarktBuy({
            saveId,
            seasonId,
            teamId: team.teamId,
            playerId: replacement.item.playerId,
            contractLength: 1,
            transferSource: sourceBuy,
          });
          if (!buyResult.activePlayerCreated) {
            blockers.push(`emergency_replacement_buy_failed:${team.shortCode}:${replacement.item.name}:${buyResult.blockingReasons.join("|")}`);
            break;
          }
          actions.push({
            teamId: team.teamId,
            teamCode: team.shortCode,
            teamName: team.name,
            action: "buy",
            playerId: replacement.item.playerId,
            playerName: replacement.item.name,
            fee: buyResult.purchasePrice != null ? round(buyResult.purchasePrice) : null,
            cashBefore: buyResult.cashBefore != null ? round(buyResult.cashBefore) : null,
            cashAfter: buyResult.cashAfter != null ? round(buyResult.cashAfter) : null,
            rosterBefore: buyResult.rosterBefore,
            rosterAfter: buyResult.rosterAfter,
            reason: "minimum_roster_refill_after_emergency_sale",
          });
        }

        executed = true;
        break;
      }

      if (!executed) {
        blockers.push(`emergency_finance_repair_no_safe_swap:${team.shortCode}:cash=${round(latestTeam.cash)}:roster=${rosterEntries.length}:min=${targets.playerMin}`);
        break;
      }
    }

    const finalSave = persistence.getSaveById(saveId);
    const finalTeam = finalSave ? getCurrentTeam(finalSave.gameState, team.teamId) : null;
    if (finalSave && finalTeam) {
      const targets = getTeamTargets(finalSave.gameState, team.teamId);
      const rosterCount = getRosterEntries(finalSave.gameState, team.teamId).length;
      if (finalTeam.cash <= 0) blockers.push(`emergency_finance_repair_cash_still_negative:${team.shortCode}:${round(finalTeam.cash)}`);
      if (rosterCount < targets.playerMin) blockers.push(`emergency_finance_repair_roster_below_min:${team.shortCode}:${rosterCount}/${targets.playerMin}`);
    }
  }

  if (actions.length === 0) warnings.push("emergency_finance_repair_no_actions_needed_or_possible");
  return { applied: actions.length > 0, actions, blockers, warnings };
}

function emergencyFinanceRepairRows(result: EmergencyFinanceRepairResult | null) {
  return (result?.actions ?? []).map((action) => ({
    teamId: action.teamId,
    teamCode: action.teamCode,
    teamName: action.teamName,
    action: action.action,
    playerId: action.playerId,
    playerName: action.playerName,
    fee: action.fee,
    cashBefore: action.cashBefore,
    cashAfter: action.cashAfter,
    rosterBefore: action.rosterBefore,
    rosterAfter: action.rosterAfter,
    reason: action.reason,
  }));
}

function readinessRows(gameState: GameState) {
  const rosterByTeam = new Map<string, number>();
  for (const roster of gameState.rosters) rosterByTeam.set(roster.teamId, (rosterByTeam.get(roster.teamId) ?? 0) + 1);
  return gameState.teams.map((team) => ({
    teamId: team.teamId,
    teamCode: team.shortCode,
    teamName: team.name,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    gamePhase: gameState.gamePhase ?? "season_active",
    cash: round(team.cash),
    roster: rosterByTeam.get(team.teamId) ?? 0,
    standingsPoints: gameState.seasonState.standings[team.teamId]?.points ?? null,
    standingsRank: gameState.seasonState.standings[team.teamId]?.rank ?? null,
    lineupDrafts: gameState.seasonState.lineupDrafts?.filter((draft) => draft.teamId === team.teamId && draft.seasonId === gameState.season.id).length ?? 0,
    formCards: gameState.seasonState.formCards?.filter((card) => card.teamId === team.teamId && card.seasonId === gameState.season.id).length ?? 0,
  }));
}

async function buildBudgetedAiMarketAudit(saveId: string, gameState: GameState): Promise<AiMarketPlanApplyResult> {
  const startedAt = Date.now();
  const result = await applyAiMarketPlanLocally({
    source: "sqlite",
    saveId,
    seasonId: gameState.season.id,
    teamScope: "all",
    dryRun: true,
    transferPhase: "manual_transfer_window",
    options: {
      includeWarningTeams: true,
      applySellSteps: true,
      applyBuySteps: true,
      maxBuysPerTeam: null,
      maxSellsPerTeam: 4,
      stopOnTeamFailure: true,
    },
  });

  return {
    ...result,
    saveContext: {
      ...result.saveContext,
      scopeWarning: [
        result.saveContext.scopeWarning,
        `budgeted_ai_market_scan:elapsed_ms=${Date.now() - startedAt};buy_need_only=true;preview_buy_limit=120;max_buys_per_team=target_gap;max_sells_per_team=4`,
      ].filter(Boolean).join(" | "),
    },
  };
}

function hasFacilitySeasonEndFinanceApplied(gameState: GameState, seasonId: string, teamId: string) {
  return (gameState.seasonState.facilityEvents ?? []).some(
    (event) =>
      event.seasonId === seasonId &&
      event.teamId === teamId &&
      ["facility_upkeep_paid", "facility_upkeep_unpaid", "facility_income_collected"].includes(event.source),
  );
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  const args = parseArgs();
  const { persistence, save } = getActiveSaveOrThrow();
  const preflight = buildPreflight(save.gameState);
  assertSeasonEndReady(preflight);

  const review = buildSeasonReview(save.gameState);
  const progressionPreview = buildProgressionPreview(save.gameState);
  const nextSeasonSetup = buildPreSeasonNextSeasonSetupToken(save);
  const workflowPreview = {
    ok: true,
    dryRun: true,
    productiveWrites: false,
    saveContext: {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      nextSeasonId: nextSeasonSetup.nextSeasonId,
      nextSeasonLabel: nextSeasonSetup.nextSeasonLabel,
      gamePhase: save.gameState.gamePhase ?? "season_active",
    },
    steps: [
      "season_review",
      "season_rewards",
      "facilities",
      "player_development",
      "transfer_sell_phase",
      "contract_renewal",
      "transfer_buy_phase",
      "next_season_setup",
      "next_season_ready",
    ],
    warnings: ["transition_runner_uses_lightweight_workflow_preview"],
    blockingReasons: [],
  };
  const cashPreview = await previewCashPrizeApply({
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    matchdayId: save.gameState.matchdayState.matchdayId,
    source: "sqlite",
    phase: "season_end",
  }, persistence);
  const facilityPreviews = save.gameState.teams.map((team) => previewFacilitySeasonEndFinance(save, team.teamId));
  const marketBeforeRewards = args.write ? null : await buildBudgetedAiMarketAudit(save.saveId, save.gameState);

  let cashApply: CashPrizeApplyResult | null = null;
  let facilityApplyResults: FacilitySeasonEndFinanceApplyResult[] = [];
  let marketAfterRewards: AiMarketPlanApplyResult | null = null;
  let emergencyFinanceRepair: EmergencyFinanceRepairResult | null = null;
  let marketApply: AiMarketPlanApplyResult | null = null;
  let nextSeasonApply: Awaited<ReturnType<typeof applyPreSeasonNextSeasonSetupLightweight>> | null = null;
  const blockers: string[] = [];
  const fixes: string[] = [];
  const cashAlreadyApplied = cashPreview.duplicateDetected || cashPreview.blockingReasons.includes("duplicate_apply_for_save_season_block");

  if (cashPreview.blockingReasons.length > 0 && !cashAlreadyApplied) blockers.push(...cashPreview.blockingReasons.map((entry) => `cash:${entry}`));
  if (cashAlreadyApplied) fixes.push("cash_prize_apply_already_done_resume_without_duplicate");

  if (args.write && blockers.length === 0) {
    if (!cashAlreadyApplied) {
      cashApply = await executeCashPrizeApply({
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId,
        source: "sqlite",
        phase: "season_end",
        execute: true,
        confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
      }, persistence);
      if (!cashApply.ok || !cashApply.applied) blockers.push(...cashApply.blockingReasons.map((entry) => `cash_apply:${entry}`));
    }

    if (blockers.length === 0) {
      for (const team of save.gameState.teams) {
        const latestSave = persistence.getSaveById(save.saveId);
        if (!latestSave) throw new Error("Save disappeared during facility apply.");
        if (hasFacilitySeasonEndFinanceApplied(latestSave.gameState, latestSave.gameState.season.id, team.teamId)) {
          const preview = previewFacilitySeasonEndFinance(latestSave, team.teamId);
          facilityApplyResults.push({ ...preview, dryRun: false, applied: false, facilityEventIds: [], blockingReasons: [] });
          fixes.push(`facility_finance_already_done_resume_without_duplicate:${team.shortCode}`);
          continue;
        }
        const preview = previewFacilitySeasonEndFinance(latestSave, team.teamId);
        const hasFacilityAction =
          preview.facilityIncomeTotal > 0 ||
          preview.rows.some((row) => row.status === "paid" || row.status === "will_disable_unpaid");
        if (!hasFacilityAction) {
          facilityApplyResults.push({ ...preview, dryRun: false, applied: false, facilityEventIds: [], blockingReasons: [] });
          continue;
        }
        if (!preview.confirmToken) {
          facilityApplyResults.push({ ...preview, dryRun: false, applied: false, facilityEventIds: [], blockingReasons: preview.blockingReasons });
          continue;
        }
        const applied = applyFacilitySeasonEndFinance(latestSave, team.teamId, preview.confirmToken, persistence);
        facilityApplyResults.push(applied);
        if (!applied.ok || !applied.applied) blockers.push(...applied.blockingReasons.map((entry) => `facility:${team.shortCode}:${entry}`));
      }
    }

    if (blockers.length === 0) {
      const latestSave = persistence.getSaveById(save.saveId);
      if (!latestSave) throw new Error("Save disappeared before AI market recheck.");
      if (latestSave.gameState.teams.some((team) => !team.humanControlled && team.cash <= 0)) {
        emergencyFinanceRepair = runEmergencyFinanceRepair(latestSave.saveId, latestSave.gameState.season.id);
        if (emergencyFinanceRepair.blockers.length > 0) {
          blockers.push(...emergencyFinanceRepair.blockers.map((entry) => `emergency_finance:${entry}`));
        }
      }
    }

    if (blockers.length === 0) {
      const latestSave = persistence.getSaveById(save.saveId);
      if (!latestSave) throw new Error("Save disappeared before AI market recheck after emergency repair.");
      marketAfterRewards = await buildBudgetedAiMarketAudit(latestSave.saveId, latestSave.gameState);
      if (marketAfterRewards.status === "blocked" || marketAfterRewards.summary.blockedTeams > 0) {
        if (!emergencyFinanceRepair?.applied) {
          emergencyFinanceRepair = runEmergencyFinanceRepair(latestSave.saveId, latestSave.gameState.season.id);
        }
        if (emergencyFinanceRepair.blockers.length > 0) {
          blockers.push(...emergencyFinanceRepair.blockers.map((entry) => `emergency_finance:${entry}`));
        } else {
          const repairedSave = persistence.getSaveById(save.saveId);
          if (!repairedSave) throw new Error("Save disappeared after emergency finance repair.");
          marketAfterRewards = await buildBudgetedAiMarketAudit(repairedSave.saveId, repairedSave.gameState);
          if (marketAfterRewards.status === "blocked" || marketAfterRewards.summary.blockedTeams > 0) {
            blockers.push(...marketAfterRewards.blockingReasons.map((entry) => `ai_market:${entry}`));
          }
        }
      }
    }

    if (blockers.length === 0) {
      const latestSave = persistence.getSaveById(save.saveId);
      if (!latestSave) throw new Error("Save disappeared before AI market apply.");
      marketApply = await applyAiMarketPlanLocally({
        source: "sqlite",
        saveId: latestSave.saveId,
        seasonId: latestSave.gameState.season.id,
        teamScope: "all",
        dryRun: false,
        confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
        transferPhase: "manual_transfer_window",
        options: {
          includeWarningTeams: true,
          applySellSteps: true,
          applyBuySteps: true,
          maxBuysPerTeam: null,
          maxSellsPerTeam: 4,
          previewBuyLimit: 120,
          previewSellLimit: 10,
          stopOnTeamFailure: true,
        },
      });
      if (marketApply.status === "blocked" || marketApply.summary.blockedTeams > 0) {
        blockers.push(...marketApply.blockingReasons.map((entry) => `ai_market_apply:${entry}`));
      }
    }

    if (blockers.length === 0) {
      const latestSave = persistence.getSaveById(save.saveId);
      if (!latestSave) throw new Error("Save disappeared before next season setup.");
      const token = buildPreSeasonNextSeasonSetupToken(latestSave).confirmToken;
      nextSeasonApply = applyPreSeasonNextSeasonSetupLightweight(latestSave, token, persistence);
      if (!nextSeasonApply.applied) blockers.push(...nextSeasonApply.blockingReasons.map((entry) => `next_season:${entry}`));
    }
  }

  const appliedFinalSave = persistence.getSaveById(save.saveId) ?? save;
  const finalSave = args.write && blockers.length === 0 && appliedFinalSave.gameState.season.id === "season-2"
    ? persistence.createScenarioSnapshot({
        sourceSaveId: appliedFinalSave.saveId,
        name: "Season 2 Start",
        scenarioMeta: buildScenarioMeta({
          gameState: appliedFinalSave.gameState,
          scenarioType: "season2_start",
          label: "Season 2 Start",
          description: "Persistenter Testpunkt nach S1→S2-Transition; Season-1-Historie bleibt enthalten.",
          sourceSaveId: appliedFinalSave.saveId,
          isStableTestPoint: true,
        }),
      })
    : appliedFinalSave;
  const financeResult = cashApply ?? cashPreview;
  const facilityResultRows = facilityApplyResults.length > 0 ? facilityApplyResults : facilityPreviews;
  const transferResult = marketApply ?? marketAfterRewards ?? marketBeforeRewards;
  const finalReadinessRows = readinessRows(finalSave.gameState);
  const marketApplyResult = marketApply as AiMarketPlanApplyResult | null;

  writeOutput(exportName("awards.json"), `${JSON.stringify(review.awards, null, 2)}\n`);
  writeOutput(exportName("review-summary.md"), [
    `# ${save.gameState.season.name} Review Summary`,
    "",
    `- Champion: ${review.championTeam?.name ?? "—"} (${review.championTeam?.label ?? "—"})`,
    `- Top 3: ${review.finalTable.slice(0, 3).map((team) => `${team.name} ${team.label}`).join(" · ")}`,
    `- Top Player: ${review.topPlayers[0]?.name ?? "—"} (${review.topPlayers[0]?.label ?? "—"})`,
    `- Awards: ${review.awards.length}`,
    `- Warnings: ${review.warnings.length ? review.warnings.join(", ") : "keine"}`,
    "",
    "## Storylines",
    ...(review.storylines.length ? review.storylines.map((entry) => `- ${entry.text}`) : ["- —"]),
  ].join("\n"));
  writeOutput(exportName("finance-audit.csv"), toCsv(financeRows(financeResult), ["teamId", "teamCode", "teamName", "rank", "points", "cashBefore", "prizeMoney", "cashAfter", "status", "warnings"]));
  writeOutput(exportName("facility-audit.csv"), toCsv(facilityRows(facilityResultRows), ["teamId", "teamCode", "teamName", "facilityId", "label", "level", "enabled", "upkeep", "income", "status", "cashBeforeFacilities", "cashAfterFacilities", "warning"]));
  writeOutput(exportName("progression-audit.csv"), toCsv(progressionRows(progressionPreview), ["playerId", "playerName", "teamId", "teamCode", "availableXP", "trainingXP", "performanceXP", "selectedAttribute", "attributeBefore", "attributeAfter", "upgradeCost", "remainingXP", "status", "blockReason", "marketValueWarning", "economyWarnings", "disciplineDeltas"]));
  writeOutput(exportName("emergency-finance-repair.csv"), toCsv(emergencyFinanceRepairRows(emergencyFinanceRepair), ["teamId", "teamCode", "teamName", "action", "playerId", "playerName", "fee", "cashBefore", "cashAfter", "rosterBefore", "rosterAfter", "reason"]));
  writeOutput(exportName("transfer-audit.csv"), toCsv(transferRows(transferResult), ["teamId", "teamCode", "teamName", "controlMode", "result", "plannedSells", "plannedBuys", "executedSells", "executedBuys", "cashBefore", "cashAfter", "rosterBefore", "rosterAfter", "warnings", "blockers"]));
  writeOutput(exportName("readiness-audit.csv"), toCsv(finalReadinessRows, ["teamId", "teamCode", "teamName", "seasonId", "matchdayId", "gamePhase", "cash", "roster", "standingsPoints", "standingsRank", "lineupDrafts", "formCards"]));

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: !args.write,
    preflight,
    review: {
      champion: review.championTeam,
      topTeams: review.finalTable.slice(0, 3),
      topPlayers: review.topPlayers,
      awards: review.awards,
      warnings: review.warnings,
    },
    workflowPreview,
    finance: {
      applied: cashApply?.applied ?? false,
      alreadyApplied: cashAlreadyApplied,
      warnings: financeResult.warnings,
      blockingReasons: financeResult.blockingReasons,
      totalPrizeMoney: financeResult.plannedChanges.reduce((sum, row) => sum + (row.prizeMoney ?? 0), 0),
    },
    facilities: {
      appliedTeams: facilityApplyResults.filter((row) => row.applied).length,
      warnings: [...new Set(facilityResultRows.flatMap((row) => row.warnings))],
      disabledFacilities: facilityResultRows.reduce((sum, row) => sum + row.disabledFacilities.length, 0),
    },
    progression: {
      status: progressionPreview.status,
      rows: progressionPreview.rows.length,
      planned: progressionPreview.rows.filter((row) => row.status === "planned").length,
      blocked: progressionPreview.rows.filter((row) => row.status === "blocked").length,
      warnings: progressionPreview.warnings,
      productiveWrites: false,
    },
    marketBeforeRewards: {
      status: marketBeforeRewards?.status ?? "skipped",
      summary: marketBeforeRewards?.summary ?? null,
      blockingReasons: marketBeforeRewards?.blockingReasons ?? [],
      phaseAudit: marketBeforeRewards?.phaseAudit ?? [],
    },
    marketAfterRewards: marketAfterRewards ? {
      status: marketAfterRewards.status,
      summary: marketAfterRewards.summary,
      blockingReasons: marketAfterRewards.blockingReasons,
      phaseAudit: marketAfterRewards.phaseAudit,
    } : null,
    emergencyFinanceRepair: emergencyFinanceRepair ? {
      applied: emergencyFinanceRepair.applied,
      actions: emergencyFinanceRepair.actions.length,
      blockers: emergencyFinanceRepair.blockers,
      warnings: emergencyFinanceRepair.warnings,
    } : null,
    marketApply: marketApplyResult ? {
      status: marketApplyResult.status,
      summary: marketApplyResult.summary,
      blockingReasons: marketApplyResult.blockingReasons,
      auditLogId: marketApplyResult.auditLogId,
      phaseAudit: marketApplyResult.phaseAudit,
    } : null,
    nextSeasonApply: nextSeasonApply ? {
      applied: nextSeasonApply.applied,
      auditLogId: nextSeasonApply.auditLogId,
      blockingReasons: nextSeasonApply.blockingReasons,
    } : null,
    final: {
      saveId: finalSave.saveId,
      seasonId: finalSave.gameState.season.id,
      seasonName: finalSave.gameState.season.name,
      gamePhase: finalSave.gameState.gamePhase ?? "season_active",
      matchdayId: finalSave.gameState.matchdayState.matchdayId,
      matchdayStatus: finalSave.gameState.matchdayState.status,
      teamCount: finalSave.gameState.teams.length,
      rosterCount: finalSave.gameState.rosters.length,
      transferHistoryRows: finalSave.gameState.transferHistory.length,
      lineupDrafts: finalSave.gameState.seasonState.lineupDrafts?.length ?? 0,
      formCards: finalSave.gameState.seasonState.formCards?.length ?? 0,
      standingsTeams: Object.keys(finalSave.gameState.seasonState.standings ?? {}).length,
      preSeasonWorkflowLogs: finalSave.gameState.seasonState.preSeasonWorkflowLogs?.length ?? 0,
    },
    fixes,
    blockers,
  };
  writeOutput(exportName("summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeOutput(exportName("summary.md"), [
    `# Season Transition ${preflight.seasonId} -> ${summary.workflowPreview.saveContext.nextSeasonId}`,
    "",
    `- Dry Run: ${summary.dryRun ? "ja" : "nein"}`,
    `- Start: ${preflight.seasonId} · ${preflight.gamePhase} · Champion ${preflight.champion?.teamName ?? "—"}`,
    `- Review Awards: ${review.awards.length}`,
    `- Finance Applied: ${summary.finance.applied ? "ja" : summary.finance.alreadyApplied ? "bereits erledigt" : "nein"} · Prize ${round(summary.finance.totalPrizeMoney, 1)}`,
    `- Facility Applied Teams: ${summary.facilities.appliedTeams}`,
    `- Progression Preview: ${summary.progression.planned} geplant / ${summary.progression.blocked} blockiert`,
    `- Emergency Finance Repair: ${summary.emergencyFinanceRepair?.applied ? `${summary.emergencyFinanceRepair.actions} Aktionen` : "nicht noetig"}`,
    `- AI Market: ${summary.marketApply?.status ?? summary.marketAfterRewards?.status ?? summary.marketBeforeRewards.status}`,
    `- Final: ${summary.final.seasonId} · ${summary.final.gamePhase} · ${summary.final.matchdayId}`,
    `- Blocker: ${blockers.length ? blockers.join(", ") : "keine"}`,
  ].join("\n"));

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
