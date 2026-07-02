import { teamNeedsCashRecoveryMarketAction } from "@/lib/ai/ai-budget-deploy-service";
import {
  buildAiTransfermarktSellPreview,
  type AiSellPreviewCandidate,
  type AiSellPreviewTeamEntry,
} from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { assessTeamSellRunwayPressure } from "@/lib/ai/team-sell-runway-pressure";
import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import {
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";
import type { PersistenceService } from "@/lib/persistence/types";
import { parseSeasonNumber } from "@/lib/season/transfer-standings-balance";

/** Target cash buffer after proactive preseason recovery (S2+). */
export const PRESEASON_CASH_BUFFER_TARGET = 10;

/** Trigger proactive sells when cash falls below this (S2+). */
export const PRESEASON_CASH_PRESSURE_THRESHOLD = 12;

/** Max sells per team in one proactive pass. */
export const PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM = 2;

/** League-wide cap per proactive pass (avoid mass liquidation). */
export const PRESEASON_PROACTIVE_MAX_TOTAL_SELLS = 32;

export type PreseasonCashRecoveryAssessment = {
  needed: boolean;
  targetCash: number;
  maxSells: number;
  reason: string;
  currentCash: number;
  cashPressureScore: number;
};

export type PreseasonProactiveCashRecoveryResult = {
  sold: number;
  teamsAffected: number;
  blockers: string[];
  teamResults: Array<{
    teamId: string;
    shortCode: string;
    cashBefore: number;
    cashAfter: number;
    sells: number;
    reason: string;
  }>;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function getTeamSalaryTotal(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  return round(
    gameState.rosters
      .filter((entry) => entry.teamId === teamId)
      .reduce((sum, entry) => {
        const player = playersById.get(entry.playerId);
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (economy.salary ?? entry.salary ?? 0);
      }, 0),
  );
}

function getTeamCash(gameState: GameState, teamId: string) {
  return gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? 0;
}

export function isPreseasonProactiveCashRecoverySeason(seasonId: string) {
  return parseSeasonNumber(seasonId) >= 2;
}

export function assessPreseasonCashRecoveryNeed(input: {
  gameState: GameState;
  teamId: string;
  seasonId?: string;
}): PreseasonCashRecoveryAssessment {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const currentCash = team?.cash ?? 0;
  const salaryTotal = getTeamSalaryTotal(input.gameState, input.teamId);
  const sellRunway = team
    ? assessTeamSellRunwayPressure({ gameState: input.gameState, team, salaryTotal, seasonId })
    : { cashPressureScore: 0 };
  const cashPressureScore = sellRunway.cashPressureScore;
  const targetCash = PRESEASON_CASH_BUFFER_TARGET;

  if (!isPreseasonProactiveCashRecoverySeason(seasonId)) {
    return {
      needed: currentCash < 0,
      targetCash: Math.max(0, targetCash),
      maxSells: currentCash < 0 ? PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM : 0,
      reason: currentCash < 0 ? "negative_cash_season_one" : "season_one_skip",
      currentCash,
      cashPressureScore,
    };
  }

  const reasons: string[] = [];
  if (currentCash < 0) reasons.push("negatives_cash");
  if (currentCash >= 0 && currentCash < PRESEASON_CASH_PRESSURE_THRESHOLD) {
    reasons.push(`cash_unter_schwelle_${PRESEASON_CASH_PRESSURE_THRESHOLD}`);
  }
  if (cashPressureScore >= 0.42) reasons.push("cash_runway_druck");
  if (teamNeedsCashRecoveryMarketAction(input.gameState, input.teamId)) {
    reasons.push("cash_recovery_strategie");
  }

  const needed =
    currentCash < PRESEASON_CASH_PRESSURE_THRESHOLD ||
    cashPressureScore >= 0.42 ||
    teamNeedsCashRecoveryMarketAction(input.gameState, input.teamId);

  let maxSells = 0;
  if (needed) {
    if (currentCash < 0) maxSells = Math.min(3, PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM + 1);
    else if (currentCash < 5) maxSells = PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM;
    else if (currentCash < PRESEASON_CASH_PRESSURE_THRESHOLD) maxSells = PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM;
    else maxSells = 1;
  }

  return {
    needed,
    targetCash,
    maxSells,
    reason: reasons.join(", ") || "kein_bedarf",
    currentCash,
    cashPressureScore,
  };
}

function isActionableSellCandidate(candidate: AiSellPreviewCandidate) {
  const hasCashReason = candidate.reasonToSell.some(
    (reason) =>
      reason.includes("negatives Teamcash") ||
      reason.includes("Teamcash ist kritisch") ||
      reason.includes("Gehaltslast") ||
      reason.includes("realisierbarer Gewinn") ||
      reason.includes("Vertrag laeuft aus") ||
      reason.includes("Performance blieb unter Erwartung"),
  );
  return (
    candidate.sellPriority >= 28 ||
    hasCashReason ||
    (candidate.expectedSellValue != null &&
      candidate.marketValue != null &&
      candidate.expectedSellValue - candidate.marketValue >= 2)
  );
}

function pickProactiveSellCandidates(
  teamEntry: AiSellPreviewTeamEntry,
  excludedPlayerIds: Set<string>,
  maxCount: number,
) {
  return teamEntry.sellCandidates
    .filter((candidate) => !excludedPlayerIds.has(candidate.activePlayerId))
    .filter(isActionableSellCandidate)
    .sort((left, right) => right.sellPriority - left.sellPriority)
    .slice(0, maxCount);
}

function getFallbackReliefCandidate(gameState: GameState, teamId: string, excludedPlayerIds: Set<string>) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  return (
    gameState.rosters
      .filter((entry) => entry.teamId === teamId && !excludedPlayerIds.has(entry.id))
      .map((entry) => {
        const player = playersById.get(entry.playerId) ?? null;
        const economy = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        const saleValue = economy.marketValue ?? 0;
        const salary = economy.salary ?? 0;
        return { entry, reliefScore: saleValue + salary * 2 };
      })
      .sort((left, right) => right.reliefScore - left.reliefScore)[0] ?? null
  );
}

export async function runPreseasonProactiveCashRecovery(input: {
  saveId: string;
  seasonId: string;
  persistence: PersistenceService;
}): Promise<PreseasonProactiveCashRecoveryResult> {
  const save = input.persistence.getSaveById(input.saveId);
  if (!save) throw new Error("Save missing before preseason proactive cash recovery.");

  const blockers: string[] = [];
  const teamResults: PreseasonProactiveCashRecoveryResult["teamResults"] = [];
  let sold = 0;
  let teamsAffected = 0;

  const teamsNeedingRecovery = save.gameState.teams
    .map((team) => ({
      team,
      assessment: assessPreseasonCashRecoveryNeed({
        gameState: save.gameState,
        teamId: team.teamId,
        seasonId: input.seasonId,
      }),
    }))
    .filter(({ assessment }) => assessment.needed && assessment.maxSells > 0)
    .sort((left, right) => left.assessment.currentCash - right.assessment.currentCash);

  if (teamsNeedingRecovery.length === 0) {
    return { sold: 0, teamsAffected: 0, blockers, teamResults };
  }

  const preview = await buildAiTransfermarktSellPreview({
    source: "sqlite",
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamScope: "all",
    allowSellBelowRosterMin: true,
    limit: 10,
  });

  const previewByTeamId = new Map(preview.teams.map((entry) => [entry.teamId, entry]));
  const runContext = createLocalTransfermarktRunContext({ save, persistence: input.persistence });
  const soldPlayerIdsByTeam = new Map<string, Set<string>>();

  for (const { team, assessment } of teamsNeedingRecovery) {
    if (sold >= PRESEASON_PROACTIVE_MAX_TOTAL_SELLS) break;

    const cashBefore = getTeamCash(runContext.save.gameState, team.teamId);
    const excluded = soldPlayerIdsByTeam.get(team.teamId) ?? new Set<string>();
    const teamPreview = previewByTeamId.get(team.teamId);
    let teamSells = 0;
    const maxSells = Math.min(
      assessment.maxSells,
      PRESEASON_PROACTIVE_MAX_SELLS_PER_TEAM,
      PRESEASON_PROACTIVE_MAX_TOTAL_SELLS - sold,
    );

    while (
      teamSells < maxSells &&
      getTeamCash(runContext.save.gameState, team.teamId) < assessment.targetCash
    ) {
      const candidates = teamPreview
        ? pickProactiveSellCandidates(teamPreview, excluded, 1)
        : [];
      const candidate = candidates[0] ?? null;
      const rosterEntry = candidate
        ? runContext.save.gameState.rosters.find((entry) => entry.id === candidate.activePlayerId) ?? null
        : getFallbackReliefCandidate(runContext.save.gameState, team.teamId, excluded)?.entry ?? null;

      if (!rosterEntry) {
        if (getTeamCash(runContext.save.gameState, team.teamId) < 0) {
          blockers.push(`preseason_cash_recovery_no_candidate:${team.shortCode}:${round(getTeamCash(runContext.save.gameState, team.teamId))}`);
        }
        break;
      }

      const result = executeLocalTransfermarktSell({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: team.teamId,
        activePlayerId: rosterEntry.id,
        transferSource: "preseason_proactive_cash_recovery_sell",
        localRunContext: runContext,
        deferPersist: true,
      });

      if (!result.canSell) {
        blockers.push(
          `preseason_cash_recovery_sell_blocked:${team.shortCode}:${result.blockingReasons.join("|")}`,
        );
        break;
      }

      excluded.add(rosterEntry.id);
      soldPlayerIdsByTeam.set(team.teamId, excluded);
      teamSells += 1;
      sold += 1;
    }

    const cashAfter = getTeamCash(runContext.save.gameState, team.teamId);
    if (teamSells > 0) {
      teamsAffected += 1;
      teamResults.push({
        teamId: team.teamId,
        shortCode: team.shortCode,
        cashBefore: round(cashBefore),
        cashAfter: round(cashAfter),
        sells: teamSells,
        reason: assessment.reason,
      });
    }
  }

  flushLocalTransfermarktRunContext(runContext);

  return { sold, teamsAffected, blockers, teamResults };
}

export function getTeamsBelowPreseasonCashBuffer(gameState: GameState, seasonId = gameState.season.id) {
  if (!isPreseasonProactiveCashRecoverySeason(seasonId)) return [];
  return gameState.teams
    .filter((team) => {
      const cash = team.cash ?? 0;
      return cash >= 0 && cash < PRESEASON_CASH_BUFFER_TARGET;
    })
    .map((team) => {
      const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId);
      const { playerMin } = deriveRosterTargets(team, identity);
      return {
        teamId: team.teamId,
        shortCode: team.shortCode,
        cash: team.cash ?? 0,
        playerMin,
      };
    });
}
