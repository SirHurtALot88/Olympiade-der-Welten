import type { GameState } from "@/lib/data/olyDataTypes";
import {
  RECENTLY_SOLD_SAME_PRESEASON_BLOCKER,
  RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING,
  isRecentlySoldBySameTeam,
} from "@/lib/market/anti-rebuy-guard";
import {
  SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER,
  SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING,
  isPlayerSoldThisSeason,
} from "@/lib/market/transfer-sold-cooldown";

/**
 * Unified anti-churn decision surface for the in-season transfer engine.
 *
 * Two independent guards exist today, checked ad hoc in `transfermarkt-local-service.ts` with their
 * own override flags:
 *   1. Season cooldown — a player sold anywhere this season cannot be re-bought
 *      (`bypassSoldThisSeasonCooldown` overrides).
 *   2. Same-preseason anti-rebuy — a team cannot re-buy a player it sold in the SAME preseason
 *      window (`allowRecentlySoldRebuyOverride` overrides).
 *
 * This composes both into one call with the exact same precedence: when a guard is hit and its
 * override is off it contributes a blocking reason; when hit and the override is on it contributes a
 * (non-blocking) override warning instead. The strings are the same constants the executor already
 * emits, so downstream reason matching is unchanged.
 */
export type AntiChurnInput = {
  gameState: GameState;
  teamId: string;
  playerId: string;
  seasonId?: string;
  bypassSoldThisSeasonCooldown?: boolean;
  allowRecentlySoldRebuyOverride?: boolean;
};

export type AntiChurnResult = {
  blocked: boolean;
  blockingReasons: string[];
  warnings: string[];
  soldThisSeasonCooldownHit: boolean;
  recentlySoldBySameTeamHit: boolean;
};

export function evaluateAntiChurn(input: AntiChurnInput): AntiChurnResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const soldThisSeasonCooldownHit = isPlayerSoldThisSeason({
    gameState: input.gameState,
    playerId: input.playerId,
    seasonId: input.seasonId,
  });
  if (soldThisSeasonCooldownHit && !input.bypassSoldThisSeasonCooldown) {
    blockingReasons.push(SOLD_PLAYER_SEASON_COOLDOWN_BLOCKER);
  }
  if (soldThisSeasonCooldownHit && input.bypassSoldThisSeasonCooldown) {
    warnings.push(SOLD_PLAYER_SEASON_COOLDOWN_OVERRIDE_WARNING);
  }

  const recentlySoldBySameTeamHit = isRecentlySoldBySameTeam({
    gameState: input.gameState,
    teamId: input.teamId,
    playerId: input.playerId,
    seasonId: input.seasonId,
  });
  if (recentlySoldBySameTeamHit && !input.allowRecentlySoldRebuyOverride) {
    blockingReasons.push(RECENTLY_SOLD_SAME_PRESEASON_BLOCKER);
  }
  if (recentlySoldBySameTeamHit && input.allowRecentlySoldRebuyOverride) {
    warnings.push(RECENTLY_SOLD_SAME_PRESEASON_OVERRIDE_WARNING);
  }

  return {
    blocked: blockingReasons.length > 0,
    blockingReasons,
    warnings,
    soldThisSeasonCooldownHit,
    recentlySoldBySameTeamHit,
  };
}

/** Normalize the two override flags into an explicit shape (single place to reason about overrides). */
export function resolveAntiChurnOverrides(input: {
  bypassSoldThisSeasonCooldown?: boolean;
  allowRecentlySoldRebuyOverride?: boolean;
}): { bypassSoldThisSeasonCooldown: boolean; allowRecentlySoldRebuyOverride: boolean } {
  return {
    bypassSoldThisSeasonCooldown: input.bypassSoldThisSeasonCooldown ?? false,
    allowRecentlySoldRebuyOverride: input.allowRecentlySoldRebuyOverride ?? false,
  };
}
