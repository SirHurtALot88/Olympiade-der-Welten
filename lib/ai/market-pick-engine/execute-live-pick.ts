import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";
import { laneFallbackChain } from "@/lib/ai/ai-market-quality-profile-service";
import {
  getBracketBandForPickLane,
  resolvePickLaneBracket,
  type LeagueMarketBrackets,
} from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  resolveTransferBuyAffordabilityCash,
  type LocalTransfermarktRunContext,
} from "@/lib/market/transfermarkt-local-service";

export const EXECUTE_ROSTER_FILL_TRANSFER_SOURCE = "ai_roster_fill";

export function resolveExecuteAffordabilityCash(input: {
  teamRunContext: LocalTransfermarktRunContext;
  teamId: string;
  rosterBefore?: number;
}): number {
  const gameState = input.teamRunContext.save.gameState;
  const team = gameState.teams.find((entry) => entry.teamId === input.teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === input.teamId);
  const { playerMin } = deriveRosterTargets(team, identity);
  const rosterBefore =
    input.rosterBefore ??
    gameState.rosters.filter((entry) => entry.teamId === input.teamId).length;
  return resolveTransferBuyAffordabilityCash({
    gameState,
    teamId: input.teamId,
    teamCash: team?.cash ?? 0,
    rosterBefore,
    playerMin,
    seasonId: gameState.season.id,
    transferSource: EXECUTE_ROSTER_FILL_TRANSFER_SOURCE,
  });
}

export type ExecuteLivePickCandidate = {
  playerId: string;
  name: string;
  className: string | null;
  race: string | null;
  marketValue: number | null;
  salary: number | null;
  ovr: number | null;
  mvs: number | null;
  needRankScore: number;
};

export function canExecuteAffordPick(price: number | null | undefined, affordabilityCash: number | null | undefined) {
  if (price == null || affordabilityCash == null) {
    return true;
  }
  return Math.round((affordabilityCash - price) * 100) / 100 >= 0;
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function roundMw(value: number) {
  return Math.round(value * 100) / 100;
}

export type ExecutePoolMwBounds = {
  minMarketValue: number;
  maxMarketValue: number;
  lanes: MarketPickLane[];
};

/**
 * MW band for execute pool fetch: union of the planned lane + execute fallback chain
 * (excluding cheap_fill unless requested). Keeps the candidate pool small without the
 * old "400 cheapest globally" truncation bug.
 */
export function resolveExecutePoolMwBounds(input: {
  slotLane: MarketPickLane;
  brackets: LeagueMarketBrackets;
  slotPriceCeiling?: number | null;
  affordabilityCash: number;
  includeCheapFill?: boolean;
}): ExecutePoolMwBounds {
  const lanes: MarketPickLane[] =
    input.slotLane === "cheap_fill"
      ? ["cheap_fill"]
      : laneFallbackChain({
          primaryLane: input.slotLane,
          pickPhase: "fill_to_opt",
          starChaser: false,
        });
  if (input.includeCheapFill && !lanes.includes("cheap_fill")) {
    lanes.push("cheap_fill");
  }

  let minMarketValue = Number.POSITIVE_INFINITY;
  let maxMarketValue = 0;
  let hasOpenCeiling = false;

  for (const lane of lanes) {
    const band = getBracketBandForPickLane(lane, input.brackets);
    minMarketValue = Math.min(minMarketValue, band.floorMW);
    if (Number.isFinite(band.ceilingMW)) {
      maxMarketValue = Math.max(maxMarketValue, band.ceilingMW);
    } else {
      hasOpenCeiling = true;
    }
  }

  if (!Number.isFinite(minMarketValue)) {
    minMarketValue = 0;
  }

  let maxCap = input.affordabilityCash;
  if (input.slotPriceCeiling != null && Number.isFinite(input.slotPriceCeiling)) {
    maxCap = Math.min(maxCap, input.slotPriceCeiling);
  }

  const maxMarketValueResolved = hasOpenCeiling ? maxCap : Math.min(Math.max(maxMarketValue, minMarketValue), maxCap);

  let resolvedMin = roundMw(Math.max(0, minMarketValue));
  let resolvedMax = roundMw(Math.max(resolvedMin, maxMarketValueResolved));

  // Cash below lane floor: drop to cheap_fill/reserve band instead of an empty min>max window.
  if (maxCap + 0.01 < resolvedMin && input.slotLane !== "superstar") {
    const cheapBand = getBracketBandForPickLane("cheap_fill", input.brackets);
    resolvedMin = roundMw(Math.max(0, cheapBand.floorMW));
    const cheapCeiling = Number.isFinite(cheapBand.ceilingMW) ? cheapBand.ceilingMW : maxCap;
    resolvedMax = roundMw(Math.max(resolvedMin, Math.min(maxCap, cheapCeiling)));
  }

  if (resolvedMax + 0.01 < resolvedMin) {
    resolvedMin = roundMw(Math.max(0, Math.min(resolvedMin, maxCap)));
    resolvedMax = roundMw(Math.max(resolvedMin, maxCap));
  }

  return {
    minMarketValue: resolvedMin,
    maxMarketValue: resolvedMax,
    lanes,
  };
}

function dedupeFreeAgents(items: TransfermarktFreeAgentItem[]) {
  const seen = new Set<string>();
  const result: TransfermarktFreeAgentItem[] = [];
  for (const item of items) {
    if (seen.has(item.playerId)) {
      continue;
    }
    seen.add(item.playerId);
    result.push(item);
  }
  return result;
}

function listExecuteFreeAgentsInBounds(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamRunContext: LocalTransfermarktRunContext;
  minMarketValue: number;
  maxMarketValue: number;
  /**
   * Pre-built, availability-filtered free-agent feed for this team. When provided, the MW-band
   * pool is derived by an in-memory filter instead of re-entering the local market service — this
   * avoids rebuilding the whole league free-agent base feed on every draft-execute pick. The bounds
   * filter mirrors `matchesFreeAgentFilters` (min/max MW) exactly, so the returned set is identical
   * to a fresh `listLocalTransfermarktFreeAgents` call over the same available players.
   */
  precomputedFreeAgents?: TransfermarktFreeAgentItem[];
}): TransfermarktFreeAgentItem[] {
  if (input.precomputedFreeAgents) {
    return input.precomputedFreeAgents.filter(
      (item) =>
        (item.marketValue ?? Number.NEGATIVE_INFINITY) >= input.minMarketValue &&
        (item.marketValue ?? Number.POSITIVE_INFINITY) <= input.maxMarketValue,
    );
  }
  return listLocalTransfermarktFreeAgents({
    saveId: input.saveId,
    seasonId: input.seasonId,
    teamId: input.teamId,
    mode: "ai_preview",
    minMarketValue: input.minMarketValue,
    maxMarketValue: input.maxMarketValue,
    localRunContext: input.teamRunContext,
  }).items;
}

/** Load execute candidates filtered to planner lane MW bands (fast; no global full-pool scan). */
export function listExecuteFreeAgentsForSlot(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamRunContext: LocalTransfermarktRunContext;
  slotLane: MarketPickLane;
  brackets: LeagueMarketBrackets;
  slotPriceCeiling?: number | null;
  affordabilityCash: number;
  includeCheapFillFallback?: boolean;
  poolCache?: Map<string, TransfermarktFreeAgentItem[]>;
  /**
   * Availability-filtered league free-agent feed for this team, built once per draft-execute team
   * loop. Threaded to `listExecuteFreeAgentsInBounds` so per-pick pool loads are an in-memory MW
   * filter rather than a full league feed rebuild. Behaviour-preserving: the caller filters taken
   * players out of this feed before each pick, so bounded pools match a fresh service call.
   */
  precomputedFreeAgents?: TransfermarktFreeAgentItem[];
}): TransfermarktFreeAgentItem[] {
  const cacheKey = (bounds: ExecutePoolMwBounds) =>
    `${input.teamId}:${input.slotLane}:${bounds.minMarketValue}:${bounds.maxMarketValue}:${input.slotPriceCeiling ?? "na"}`;

  const loadBounds = (bounds: ExecutePoolMwBounds) => {
    const key = cacheKey(bounds);
    const cached = input.poolCache?.get(key);
    if (cached) {
      return cached;
    }
    const items = listExecuteFreeAgentsInBounds({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: input.teamId,
      teamRunContext: input.teamRunContext,
      minMarketValue: bounds.minMarketValue,
      maxMarketValue: bounds.maxMarketValue,
      precomputedFreeAgents: input.precomputedFreeAgents,
    });
    input.poolCache?.set(key, items);
    return items;
  };

  const mainBounds = resolveExecutePoolMwBounds({
    slotLane: input.slotLane,
    brackets: input.brackets,
    slotPriceCeiling: input.slotPriceCeiling,
    affordabilityCash: input.affordabilityCash,
    includeCheapFill: input.includeCheapFillFallback === true && input.slotLane === "cheap_fill",
  });
  let mainPool = loadBounds(mainBounds);

  if (mainPool.length === 0 && input.affordabilityCash > 0) {
    const affordableMax = roundMw(
      input.slotPriceCeiling != null && Number.isFinite(input.slotPriceCeiling)
        ? Math.min(input.affordabilityCash, input.slotPriceCeiling)
        : input.affordabilityCash,
    );
    const widenBounds: ExecutePoolMwBounds = {
      minMarketValue: 0,
      maxMarketValue: Math.max(affordableMax, mainBounds.minMarketValue),
      lanes: mainBounds.lanes,
    };
    mainPool = loadBounds(widenBounds);
  }

  if (input.includeCheapFillFallback !== true || input.slotLane === "cheap_fill") {
    return mainPool;
  }

  const cheapBounds = resolveExecutePoolMwBounds({
    slotLane: "cheap_fill",
    brackets: input.brackets,
    slotPriceCeiling: input.slotPriceCeiling,
    affordabilityCash: input.affordabilityCash,
    includeCheapFill: true,
  });
  const cheapPool = loadBounds(cheapBounds);

  return dedupeFreeAgents([...mainPool, ...cheapPool]);
}

function resolveNeedAxisScore(item: TransfermarktFreeAgentItem, bestNeedDisciplineId: string | null) {
  if (!bestNeedDisciplineId) {
    return (item.mvs ?? item.ovr ?? 0) * 0.15;
  }
  const disciplineHit = item.preferredDisciplineIds?.includes(bestNeedDisciplineId) ? 12 : 0;
  const statPool = [item.pow ?? 0, item.spe ?? 0, item.men ?? 0, item.soc ?? 0];
  const topStat = statPool.length > 0 ? Math.max(...statPool) : 0;
  return disciplineHit + topStat * 0.22 + (item.mvs ?? item.ovr ?? 0) * 0.12;
}

/**
 * Mild value-tilt for the execute pick ranking (G1: milder Tilt, G2: Top-Stars leicht positiv).
 * Within an MW band the raw quality sort (mvs/ovr desc) always lands on the priciest player in the
 * band. This discounts a candidate's quality by how far its price sits above the band floor, so a
 * cheaper comparable player can beat the most expensive one — "hier und da ein 60er/70er". Kept mild
 * so a genuinely superior star (much higher mvs) still wins its slot.
 */
const EXECUTE_VALUE_TILT_STRENGTH = 0.15;

function executeValueAdjustedQuality(input: {
  quality: number;
  marketValue: number | null | undefined;
  slotLane: MarketPickLane;
  brackets: LeagueMarketBrackets;
}): number {
  const price = input.marketValue ?? 0;
  if (price <= 0 || input.quality <= 0) {
    return input.quality;
  }
  const band = getBracketBandForPickLane(input.slotLane, input.brackets);
  const floor = band.floorMW;
  // Superstar has no ceiling — use a nominal band width so the tilt still applies at the top end.
  const ceiling = Number.isFinite(band.ceilingMW) ? band.ceilingMW : floor * 1.65;
  const bandRef = Math.max(1, ceiling - floor);
  const priceExcess = Math.max(0, price - floor);
  const tilt = EXECUTE_VALUE_TILT_STRENGTH * Math.min(1, priceExcess / bandRef);
  return input.quality * (1 - tilt);
}

function isPriceInSlotBand(input: {
  price: number;
  slotLane: MarketPickLane;
  brackets: LeagueMarketBrackets;
  slotPriceCeiling: number | null;
}) {
  const band = getBracketBandForPickLane(input.slotLane, input.brackets);
  const ceiling = input.slotPriceCeiling ?? band.ceilingMW;
  if (input.price + 0.01 < band.floorMW) {
    return false;
  }
  if (Number.isFinite(ceiling) && input.price > ceiling + 0.01 && input.slotLane !== "superstar") {
    return false;
  }
  return true;
}

/**
 * Live execute for a planned lane slot: pick the best current free agent in the MW band,
 * ranked by team need (e.g. power-need player can fill an open core slot — lane stays core).
 */
export function resolveExecuteLivePickForSlot(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamRunContext: LocalTransfermarktRunContext;
  slotLane: MarketPickLane;
  bestNeedDisciplineId: string | null;
  /** Spend ceiling aligned with transfer buy gate (not raw team.cash). */
  affordabilityCash: number;
  unavailablePlayerIds: Set<string>;
  brackets: LeagueMarketBrackets;
  slotPriceCeiling?: number | null;
  freeAgents: TransfermarktFreeAgentItem[];
  useFastBatchExecute?: boolean;
  allowMinFillFallback?: boolean;
}): ExecuteLivePickCandidate | null {
  const lanesForSlot = laneFallbackChain({
    primaryLane: input.slotLane,
    pickPhase: "fill_to_opt",
    starChaser: false,
  });
  if (input.allowMinFillFallback !== false) {
    lanesForSlot.push("cheap_fill");
  }

  for (const lane of lanesForSlot) {
    const pick = resolveExecuteLivePickForLane({
      ...input,
      slotLane: lane,
    });
    if (pick) {
      return pick;
    }
  }
  return null;
}

function resolveExecuteLivePickForLane(input: {
  saveId: string;
  seasonId: string;
  teamId: string;
  teamRunContext: LocalTransfermarktRunContext;
  slotLane: MarketPickLane;
  bestNeedDisciplineId: string | null;
  /** Spend ceiling aligned with transfer buy gate (not raw team.cash). */
  affordabilityCash: number;
  unavailablePlayerIds: Set<string>;
  brackets: LeagueMarketBrackets;
  slotPriceCeiling?: number | null;
  freeAgents: TransfermarktFreeAgentItem[];
  useFastBatchExecute?: boolean;
}): ExecuteLivePickCandidate | null {
  const ranked = input.freeAgents
    .filter((item) => !input.unavailablePlayerIds.has(item.playerId))
    .filter((item) => item.marketValue != null && item.marketValue > 0)
    .filter((item) => canExecuteAffordPick(item.marketValue, input.affordabilityCash))
    .filter((item) =>
      isPriceInSlotBand({
        price: item.marketValue ?? 0,
        slotLane: input.slotLane,
        brackets: input.brackets,
        slotPriceCeiling: input.slotPriceCeiling ?? null,
      }),
    )
    .map((item) => ({
      item,
      needRankScore: resolveNeedAxisScore(item, input.bestNeedDisciplineId),
      valueAdjustedQuality: executeValueAdjustedQuality({
        quality: item.mvs ?? item.ovr ?? 0,
        marketValue: item.marketValue,
        slotLane: input.slotLane,
        brackets: input.brackets,
      }),
    }))
    .sort((left, right) => {
      if (right.needRankScore !== left.needRankScore) {
        return right.needRankScore - left.needRankScore;
      }
      return right.valueAdjustedQuality - left.valueAdjustedQuality;
    });

  for (const entry of ranked) {
    if (!input.useFastBatchExecute) {
      const buyPreview = previewLocalTransfermarktBuy({
        saveId: input.saveId,
        seasonId: input.seasonId,
        teamId: input.teamId,
        playerId: entry.item.playerId,
        transferSource: "ai_roster_fill",
        localRunContext: input.teamRunContext,
      });
      if (!buyPreview.canBuy) {
        continue;
      }
    }
    return {
      playerId: entry.item.playerId,
      name: entry.item.name,
      className: entry.item.className ?? null,
      race: entry.item.race ?? null,
      marketValue: entry.item.marketValue ?? null,
      salary: entry.item.salary ?? null,
      ovr: entry.item.ovr ?? null,
      mvs: entry.item.mvs ?? null,
      needRankScore: entry.needRankScore,
    };
  }
  return null;
}

export function resolveSlotLaneFromPick(input: {
  plannedLane?: string | null;
  pickLane?: string | null;
  budgetLane?: string | null;
}): MarketPickLane {
  const lane = normalizeToken(input.plannedLane || input.pickLane || input.budgetLane || "depth");
  if (
    lane === "superstar" ||
    lane === "star" ||
    lane === "core" ||
    lane === "specialist" ||
    lane === "depth" ||
    lane === "backup" ||
    lane === "cheap_fill"
  ) {
    return lane;
  }
  return "depth";
}

export function resolveBracketLaneLabel(lane: MarketPickLane) {
  return resolvePickLaneBracket(lane);
}
