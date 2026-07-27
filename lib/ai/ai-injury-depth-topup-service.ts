import { getPrevSeasonInjuryCount } from "@/lib/ai/ai-team-management-preview-service";
import { isPreseasonRepairCandidateEligible } from "@/lib/ai/chunked-redraft-topup-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { executeLocalTransfermarktBuy, previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

/**
 * Owner request (verbatim, translated): "Can't you also build in that the AI reacts when there
 * are too many injuries, so that one or two cheap players simply get bought as extra depth?"
 *
 * This is a deliberately small, additive preseason step — it does NOT touch `playerOpt`/
 * `playerMin`/roster-target planning (those already have freshly tuned dials elsewhere), does
 * NOT change any injury-risk/fatigue math, and NEVER gifts a player: every purchase goes through
 * the exact same buy primitive (`previewLocalTransfermarktBuy` / `executeLocalTransfermarktBuy`)
 * used by the regular AI market pipeline, so it pays real market price, sets a real
 * salary/contract, and is skipped outright if the team can't afford it or the roster is already
 * full — a broke or full team simply stays thin, which is a legitimate outcome.
 *
 * "Too many injuries" reuses the EXACT previous-season injury count already computed in
 * `ai-team-management-preview-service.ts` (`buildPrevSeasonHealthMetrics` /
 * `getPrevSeasonInjuryCount`) — the same signal that already raises that file's recovery-center
 * build score/threshold. This file does not introduce a second, independent injury metric.
 *
 * "Cheap" reuses the existing `PRESEASON_REPAIR_MARKET_VALUE_CAP` / `isPreseasonRepairCandidateEligible`
 * cap from `chunked-redraft-topup-service.ts` (already-tuned "affordable free agent" definition
 * used by that file's own emergency roster repair), rather than inventing a new price threshold.
 *
 * Preseason-only, AI-only: the caller MUST pass an already AI-scoped `aiTeamIds` list (the same
 * one the preseason route derives via team-control settings + protected-human-team guard); this
 * function re-checks control mode per team as defense in depth so a human/manual team is never
 * touched even if a caller's team-ID list were ever wrong.
 */

/** Buy source label — flags every purchase made by this feature as an AI/system buy (never a human-initiated one), matching the convention used by "ai_preseason_market_buy" etc. */
export const AI_INJURY_DEPTH_TOPUP_TRANSFER_SOURCE = "ai_injury_depth_topup";

/**
 * Injury-count severity bands re-using the cut points already meaningful in
 * `ai-team-management-preview-service.ts` (4 = where the recovery-center build score starts
 * ramping, 8 = where that file already lowers the recovery-center build threshold). 8+ unlocks
 * one extra cheap depth buy, 12+ (a further step up) unlocks a second — capped at two either way.
 */
export const INJURY_DEPTH_TOPUP_ONE_PLAYER_INJURY_THRESHOLD = 8;
export const INJURY_DEPTH_TOPUP_TWO_PLAYER_INJURY_THRESHOLD = 12;
export const INJURY_DEPTH_TOPUP_MAX_PLAYERS = 2;

export function resolveInjuryDepthTopupTargetCount(prevSeasonInjuryCount: number): number {
  if (prevSeasonInjuryCount >= INJURY_DEPTH_TOPUP_TWO_PLAYER_INJURY_THRESHOLD) return INJURY_DEPTH_TOPUP_MAX_PLAYERS;
  if (prevSeasonInjuryCount >= INJURY_DEPTH_TOPUP_ONE_PLAYER_INJURY_THRESHOLD) return 1;
  return 0;
}

export type AiInjuryDepthTopupTeamResult = {
  teamId: string;
  prevSeasonInjuryCount: number;
  targetedExtraPlayers: number;
  boughtPlayerIds: string[];
  totalSpend: number;
  skipped: boolean;
  skipReason: string | null;
};

export type AiInjuryDepthTopupSummary = {
  teams: AiInjuryDepthTopupTeamResult[];
  playersBoughtTotal: number;
  totalSpend: number;
  warnings: string[];
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Runs the injury-depth top-up for a set of AI teams against a persisted save. Each team gets at
 * most `INJURY_DEPTH_TOPUP_MAX_PLAYERS` buy attempts; each attempt re-reads the freshest persisted
 * state (a prior attempt in the same run changes cash/roster/candidate pool) and picks the
 * cheapest still-affordable free agent, buying it through the normal transfer-buy path. A team
 * that is not AI-controlled, not injury-stressed, has no affordable cheap candidate, or is
 * already at its roster limit is left untouched — this never raises the roster target and never
 * forces a purchase.
 */
export function applyAiInjuryDepthTopup(input: {
  saveId: string;
  seasonId: string;
  aiTeamIds: string[];
}): AiInjuryDepthTopupSummary {
  const teams: AiInjuryDepthTopupTeamResult[] = [];
  const warnings: string[] = [];
  let playersBoughtTotal = 0;
  let totalSpend = 0;

  for (const teamId of input.aiTeamIds) {
    const persistence = createPersistenceService();
    const latest = persistence.getSaveById(input.saveId);
    if (!latest) {
      warnings.push(`injury_depth_topup:${teamId}:save_not_found`);
      continue;
    }
    const gameState = latest.gameState;

    // Defense in depth: never buy for a human/manual team, even if the caller's team-ID list
    // were ever wrong (mirrors getAiTeamIds's own defense-in-depth comment in the preseason route).
    if (getTeamControlSettings(gameState, teamId)?.controlMode !== "ai") {
      teams.push({
        teamId,
        prevSeasonInjuryCount: 0,
        targetedExtraPlayers: 0,
        boughtPlayerIds: [],
        totalSpend: 0,
        skipped: true,
        skipReason: "not_ai_controlled",
      });
      continue;
    }

    const prevSeasonInjuryCount = getPrevSeasonInjuryCount(gameState, teamId);
    const targetedExtraPlayers = resolveInjuryDepthTopupTargetCount(prevSeasonInjuryCount);
    if (targetedExtraPlayers <= 0) {
      teams.push({
        teamId,
        prevSeasonInjuryCount,
        targetedExtraPlayers: 0,
        boughtPlayerIds: [],
        totalSpend: 0,
        skipped: true,
        skipReason: "prev_season_injury_count_below_threshold",
      });
      continue;
    }

    const boughtPlayerIds: string[] = [];
    let teamSpend = 0;
    let skipReason: string | null = null;

    for (let attempt = 0; attempt < targetedExtraPlayers; attempt += 1) {
      const iterationPersistence = createPersistenceService();
      const iterationSave = iterationPersistence.getSaveById(input.saveId);
      if (!iterationSave) {
        skipReason = "save_not_found";
        break;
      }
      const iterationState = iterationSave.gameState;
      const team = iterationState.teams.find((entry) => entry.teamId === teamId) ?? null;
      if (!team) {
        skipReason = "team_not_found";
        break;
      }

      const rosteredPlayerIds = new Set(iterationState.rosters.map((entry) => entry.playerId));
      const cheapestAffordable = iterationState.players
        .filter((player) => !rosteredPlayerIds.has(player.id))
        .map((player) => ({
          player,
          marketValue: resolvePlayerEconomyContract({ player }).marketValue ?? 0,
        }))
        .filter(
          (candidate) =>
            candidate.marketValue > 0 &&
            isPreseasonRepairCandidateEligible({
              marketValue: candidate.marketValue,
              teamCash: team.cash ?? 0,
            }),
        )
        .sort((left, right) => left.marketValue - right.marketValue)[0];

      if (!cheapestAffordable) {
        skipReason = "no_affordable_cheap_candidate";
        break;
      }

      const preview = previewLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId,
        playerId: cheapestAffordable.player.id,
        transferSource: AI_INJURY_DEPTH_TOPUP_TRANSFER_SOURCE,
      });
      if (!preview.canBuy) {
        skipReason = preview.blockingReasons[0] ?? "buy_preview_blocked";
        break;
      }

      const result = executeLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId,
        playerId: cheapestAffordable.player.id,
        transferSource: AI_INJURY_DEPTH_TOPUP_TRANSFER_SOURCE,
      });
      if (!result.canBuy || !result.transferCreated) {
        skipReason = result.blockingReasons?.[0] ?? "buy_execute_failed";
        break;
      }

      boughtPlayerIds.push(cheapestAffordable.player.id);
      teamSpend = roundMoney(teamSpend + cheapestAffordable.marketValue);
    }

    playersBoughtTotal += boughtPlayerIds.length;
    totalSpend = roundMoney(totalSpend + teamSpend);
    teams.push({
      teamId,
      prevSeasonInjuryCount,
      targetedExtraPlayers,
      boughtPlayerIds,
      totalSpend: teamSpend,
      skipped: boughtPlayerIds.length === 0,
      skipReason: boughtPlayerIds.length > 0 ? null : skipReason,
    });
    if (boughtPlayerIds.length < targetedExtraPlayers && skipReason) {
      warnings.push(`injury_depth_topup:${teamId}:${skipReason}`);
    }
  }

  return { teams, playersBoughtTotal, totalSpend, warnings };
}
