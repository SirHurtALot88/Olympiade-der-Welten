import {
  buildLeagueMarketAnchors,
  getMarketLaneBand,
  isPriceEligibleForMarketLane,
  resolvePlannerSpendableCash,
  shouldDisableCheapLanes,
  type LeagueMarketAnchors,
  type MarketPickLane,
} from "@/lib/ai/ai-market-slot-plan-service";
import { resolvePostOptUpgradeMandate } from "@/lib/ai/planner-post-opt-upgrade-policy";
import { buildBudgetEnvelope } from "@/lib/ai/market-pick-engine/budget-envelope";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import { buildSeasonStrategyState } from "@/lib/ai/ai-manager-doctrine-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

export type MarketPickPhase = "fill_to_opt" | "post_opt_upgrade";

export type MarketQualityProfile = {
  playerMin: number;
  identityPlayerOpt: number;
  effectiveOptTarget: number;
  comfortTarget: number;
  optFlexSlots: number;
  starChaser: boolean;
  starAllowed: number;
  superstarAllowed: number;
  coreNeeded: number;
  premiumFirst: boolean;
  qualityFloorMw: number;
  disableCheapLanes: boolean;
  pickPhase: MarketPickPhase;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normBias(value: number | undefined, fallback = 5) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp((raw - 1) / 9, 0, 1);
}

export function resolveMarketPickPhase(input: {
  rosterCount: number;
  identityPlayerOpt: number;
}): MarketPickPhase {
  return input.rosterCount < input.identityPlayerOpt ? "fill_to_opt" : "post_opt_upgrade";
}

function countPreseasonPremiumBuys(input: {
  gameState: GameState;
  teamId: string;
  seasonId: string;
  anchors: LeagueMarketAnchors;
}) {
  const brackets = buildLeagueMarketBrackets(
    input.gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
  );
  let starPlus = 0;
  let corePlus = 0;
  let q75Plus = 0;
  for (const entry of input.gameState.transferHistory) {
    if (entry.seasonId !== input.seasonId || entry.toTeamId !== input.teamId || entry.transferType !== "buy") {
      continue;
    }
    if (entry.source !== "ai_preseason_market_buy") continue;
    const price = entry.fee ?? entry.marketValue ?? 0;
    if (price + 0.01 >= brackets.star.floorMw) starPlus += 1;
    if (price + 0.01 >= brackets.depth.targetMw) q75Plus += 1;
    if (price + 0.01 >= brackets.core.floorMw) corePlus += 1;
  }
  return { starPlus, corePlus, q75Plus };
}

function getPreseasonMarketBuySpend(gameState: GameState, seasonId: string, teamId: string) {
  return gameState.transferHistory
    .filter(
      (entry) =>
        entry.seasonId === seasonId &&
        entry.toTeamId === teamId &&
        entry.transferType === "buy" &&
        entry.source === "ai_preseason_market_buy",
    )
    .reduce((sum, entry) => sum + (entry.fee ?? 0), 0);
}

export function getLeagueMarketAnchorsForState(gameState: GameState, anchors?: LeagueMarketAnchors) {
  return (
    anchors ??
    buildLeagueMarketAnchors(
      gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
    )
  );
}

export function teamSatisfiesPremiumOpt(input: {
  gameState: GameState;
  teamId: string;
  profile: MarketQualityProfile;
  anchors?: LeagueMarketAnchors;
}) {
  if (!input.profile.starChaser || input.profile.optFlexSlots <= 0) return false;
  const rosterCount = input.gameState.rosters.filter((entry) => entry.teamId === input.teamId).length;
  if (rosterCount < input.profile.playerMin) return false;
  if (rosterCount < input.profile.identityPlayerOpt - input.profile.optFlexSlots) return false;

  const anchors =
    input.anchors ??
    buildLeagueMarketAnchors(
      input.gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
    );
  const { starPlus, corePlus } = countPreseasonPremiumBuys({
    gameState: input.gameState,
    teamId: input.teamId,
    seasonId: input.gameState.season.id,
    anchors,
  });
  return starPlus >= 1 || corePlus >= 2;
}

export function resolveMarketQualityProfile(input: {
  gameState: GameState;
  teamId: string;
  rosterCount: number;
  spendable?: number | null;
  anchors?: LeagueMarketAnchors;
}): MarketQualityProfile {
  const team = input.gameState.teams.find((entry) => entry.teamId === input.teamId);
  const identity = input.gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
  const plannerTargets = resolvePlannerRosterTargets(input.gameState, input.teamId, team, identity);
  const { playerMin, playerOpt, basePlayerOpt, depthRepairMandate } = plannerTargets;
  const strategyProfile = getTeamStrategyProfile(input.gameState, input.teamId);
  const bias = strategyProfile?.bias;
  const seasonStrategy = buildSeasonStrategyState(input.gameState)[input.teamId]?.seasonStrategy ?? "balanced_growth";
  const ambition = identity?.ambition ?? 5;
  const starScore =
    (normBias(bias?.starPriority) + normBias(bias?.eliteSmallRosterPreference) + normBias(bias?.riskTolerance)) / 3;
  const depthScore =
    (normBias(bias?.rosterDepthPreference) +
      (1 - normBias(bias?.eliteSmallRosterPreference)) +
      (1 - normBias(bias?.starPriority))) /
    3;
  const prefersPremiumRoster =
    (bias?.starPriority ?? 5) >= 6 && (bias?.eliteSmallRosterPreference ?? 5) >= 5 && (bias?.rosterDepthPreference ?? 5) <= 6;
  const starChaser =
    !depthRepairMandate &&
    (starScore >= 0.42 ||
      seasonStrategy === "win_now_push" ||
      (bias?.starPriority ?? 5) >= 7 ||
      prefersPremiumRoster ||
      ambition >= 7.5);
  const preferDepth = depthRepairMandate || depthScore >= 0.62 && starScore < 0.45;
  const pickPhase = resolveMarketPickPhase({ rosterCount: input.rosterCount, identityPlayerOpt: playerOpt });

  const spendable =
    input.spendable ??
    resolvePlannerSpendableCash(input.gameState, input.teamId, team?.cash ?? 0);
  const anchors =
    input.anchors ??
    buildLeagueMarketAnchors(
      input.gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
    );
  const brackets = buildLeagueMarketBrackets(
    input.gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null),
  );

  const canAffordStar = spendable + 0.01 >= brackets.star.floorMw;
  const canAffordCore = spendable + 0.01 >= brackets.core.floorMw;
  const canAffordPremiumCore = spendable + 0.01 >= Math.max(brackets.core.floorMw, brackets.depth.targetMw * 1.2);
  const upgradeMandate = resolvePostOptUpgradeMandate(input.gameState, input.teamId);
  const aspirationalFlexSlots =
    starChaser && !preferDepth ? 1 : upgradeMandate.mode === "expand" ? 1 : 0;
  const optFlexSlots =
    aspirationalFlexSlots > 0 &&
    input.rosterCount >= playerMin &&
    (canAffordStar || canAffordPremiumCore || upgradeMandate.active)
      ? aspirationalFlexSlots
      : 0;
  const effectiveOptTarget =
    upgradeMandate.expandRosterTarget != null
      ? Math.max(playerMin, upgradeMandate.expandRosterTarget)
      : depthRepairMandate
        ? Math.max(playerMin, playerOpt)
        : Math.max(playerMin, playerOpt - (starChaser && !preferDepth ? 1 : 0));

  const starAllowed =
    starChaser && (canAffordStar || canAffordPremiumCore)
      ? (bias?.starPriority ?? 5) >= 8 || ambition >= 8
        ? 2
        : 1
      : 0;
  const superstarAllowed =
    starChaser &&
    spendable + 0.01 >= brackets.superstar.floorMw &&
    ((bias?.starPriority ?? 5) >= 8 || (spendable + 0.01 >= brackets.superstar.targetMw && (bias?.starPriority ?? 5) >= 9))
      ? 1
      : 0;
  const coreNeeded = starChaser && canAffordCore ? 1 : preferDepth ? 0 : input.rosterCount < playerMin ? 1 : 0;
  const qualityFloorMw =
    depthRepairMandate || (pickPhase === "fill_to_opt" && preferDepth)
      ? brackets.backup.floorMw
      : pickPhase === "fill_to_opt"
        ? brackets.backup.floorMw
        : canAffordStar && starChaser
          ? brackets.star.floorMw
          : canAffordCore
            ? brackets.core.floorMw
            : brackets.depth.floorMw;
  const disableCheapLanes =
    !depthRepairMandate &&
    pickPhase === "post_opt_upgrade" &&
    (shouldDisableCheapLanes(spendable, anchors, input.rosterCount >= playerMin, {
      forceDisableCheap: starChaser && canAffordCore && input.rosterCount >= playerOpt,
    }) ||
      (starChaser && input.rosterCount >= playerOpt && canAffordCore) ||
      (upgradeMandate.active && canAffordCore));

  const comfortTarget = (() => {
    if (upgradeMandate.expandRosterTarget != null && upgradeMandate.expandRosterTarget > playerOpt) {
      return upgradeMandate.expandRosterTarget;
    }
    if (starChaser && !preferDepth && aspirationalFlexSlots > 0) {
      return effectiveOptTarget;
    }
    const starPriority = bias?.starPriority ?? 5;
    if (!preferDepth && !starChaser && starPriority >= 6 && playerOpt - 1 >= playerMin) {
      return playerOpt - 1;
    }
    return playerOpt;
  })();

  return {
    playerMin,
    identityPlayerOpt: basePlayerOpt,
    effectiveOptTarget,
    comfortTarget,
    optFlexSlots,
    starChaser,
    starAllowed,
    superstarAllowed,
    coreNeeded,
    premiumFirst: starChaser && !preferDepth,
    qualityFloorMw,
    disableCheapLanes,
    pickPhase,
  };
}

export function getTeamConvergenceOptTarget(
  gameState: GameState,
  teamId: string,
  anchors?: LeagueMarketAnchors,
) {
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
  const profile = resolveMarketQualityProfile({ gameState, teamId, rosterCount, anchors });
  if (teamSatisfiesPremiumOpt({ gameState, teamId, profile, anchors })) {
    return profile.effectiveOptTarget;
  }
  return profile.identityPlayerOpt;
}

export function buildQualityAwareSlotPlan(input: {
  profile: MarketQualityProfile;
  spendable: number;
  rosterCount: number;
  steps: number;
  missingToMin: number;
  rosterGap: number;
  anchors: LeagueMarketAnchors;
  faPrices?: Array<number | null | undefined>;
}): MarketPickLane[] {
  const envelope = buildBudgetEnvelope({
    spendable: input.spendable,
    rosterGap: input.rosterGap,
    missingToMin: input.missingToMin,
    steps: input.steps,
    profile: input.profile,
    faPrices:
      input.faPrices ??
      [
        input.anchors.q25Price,
        input.anchors.q50Price,
        input.anchors.q65Price,
        input.anchors.q75Price,
        input.anchors.q85Price,
        input.anchors.q90Price,
        input.anchors.q95Price,
      ],
  });
  return envelope.slotSequence;
}

export function laneFallbackChain(input: {
  primaryLane: MarketPickLane;
  pickPhase: MarketPickPhase;
  starChaser: boolean;
  upgradeOnly?: boolean;
}): MarketPickLane[] {
  if (input.upgradeOnly) {
    if (input.primaryLane === "superstar") return ["superstar", "star", "core"];
    if (input.primaryLane === "star") return ["star", "core"];
    return ["star", "core"];
  }
  if (input.pickPhase === "post_opt_upgrade") {
    if (input.primaryLane === "superstar") return ["superstar", "star", "core"];
    if (input.primaryLane === "star") return ["star", "core"];
    if (input.primaryLane === "core") return ["core", "star"];
    return ["core", "depth"];
  }
  if (input.primaryLane === "superstar") return ["superstar", "star", "core", "depth"];
  if (input.primaryLane === "star") return ["star", "core", "depth"];
  if (input.primaryLane === "core") return ["core", "star", "depth"];
  if (input.primaryLane === "depth") return ["depth", "core", "star"];
  return input.starChaser ? ["core", "depth", "star"] : ["depth", "core"];
}

export function scoreCandidateForLane(input: {
  price: number | null;
  score: number;
  lane: MarketPickLane;
  anchors: LeagueMarketAnchors;
  qualityFloorMw: number;
  disableCheapLanes: boolean;
  pickPhase: MarketPickPhase;
}) {
  const price = input.price ?? 0;
  if (price <= 0) return -999;

  if (input.pickPhase === "post_opt_upgrade") {
    if (input.disableCheapLanes && price + 0.01 < input.anchors.q50Price) return -999;
    if (price + 0.01 < input.qualityFloorMw && input.lane !== "cheap_fill" && input.lane !== "backup") {
      return input.score - 40;
    }
    if (!isPriceEligibleForMarketLane(price, input.lane, input.anchors)) {
      const band = getMarketLaneBand(input.lane, input.anchors);
      if (price + 0.01 < band.floorMW) return input.score - 25;
    }
  }

  let bonus = 0;
  const brackets = buildLeagueMarketBrackets([
    input.anchors.q25Price,
    input.anchors.q50Price,
    input.anchors.q65Price,
    input.anchors.q75Price,
    input.anchors.q85Price,
    input.anchors.q90Price,
    input.anchors.q95Price,
  ]);
  if (input.lane === "star" || input.lane === "superstar") {
    bonus += price >= brackets.star.floorMw ? 18 : input.pickPhase === "fill_to_opt" ? 8 : -20;
  } else if (input.lane === "core") {
    bonus += price >= brackets.core.floorMw ? 10 : input.pickPhase === "fill_to_opt" ? 6 : -8;
  } else if (input.lane === "depth" || input.lane === "cheap_fill" || input.lane === "backup") {
    bonus -= input.disableCheapLanes ? 15 : 0;
  }
  return input.score + bonus;
}
