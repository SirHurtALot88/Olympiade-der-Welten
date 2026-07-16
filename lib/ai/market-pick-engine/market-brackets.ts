import type { LeagueMarketAnchors, MarketLaneBand, MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";

export type MarketBracketLane = "superstar" | "star" | "core" | "depth" | "backup" | "reserve";

export type MarketBracketDefinition = {
  lane: MarketBracketLane;
  minMw: number;
  minPercentile: number;
  ceilingMw: number | null;
  defaultTargetMw: number;
};

export const MARKET_BRACKET_DEFINITIONS: readonly MarketBracketDefinition[] = [
  { lane: "superstar", minMw: 65, minPercentile: 0.97, ceilingMw: null, defaultTargetMw: 72 },
  { lane: "star", minMw: 45, minPercentile: 0.87, ceilingMw: 65, defaultTargetMw: 52 },
  { lane: "core", minMw: 30, minPercentile: 0.64, ceilingMw: 45, defaultTargetMw: 36 },
  { lane: "depth", minMw: 20, minPercentile: 0.35, ceilingMw: 30, defaultTargetMw: 24 },
  { lane: "backup", minMw: 12, minPercentile: 0.1, ceilingMw: 20, defaultTargetMw: 15 },
  { lane: "reserve", minMw: 0, minPercentile: 0, ceilingMw: 12, defaultTargetMw: 6 },
] as const;

export type MarketBracketBand = {
  lane: MarketBracketLane;
  floorMw: number;
  targetMw: number;
  ceilingMw: number | null;
};

export type LeagueMarketBrackets = Record<MarketBracketLane, MarketBracketBand>;

export type MarketBracketTierLabel = "Superstar" | "Star" | "Core" | "Depth" | "Backup" | "Reserve";

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function quantilePrice(values: Array<number | null | undefined>, ratio: number) {
  const finite = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (finite.length === 0) return 0;
  const index = clamp(Math.floor((finite.length - 1) * ratio), 0, finite.length - 1);
  return finite[index] ?? 0;
}

export function buildLeagueMarketBrackets(prices: Array<number | null | undefined>): LeagueMarketBrackets {
  const finite = prices.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  const result = {} as LeagueMarketBrackets;
  for (const definition of MARKET_BRACKET_DEFINITIONS) {
    const percentileFloor = definition.minPercentile > 0 ? quantilePrice(prices, definition.minPercentile) : 0;
    const floorMw = round(definition.minMw);
    let ceilingMw = definition.ceilingMw;
    if (ceilingMw != null) {
      ceilingMw = round(Math.max(ceilingMw, floorMw + 0.01));
    }
    const percentileTarget =
      finite.length >= 50 && percentileFloor > floorMw
        ? round((floorMw + percentileFloor) / 2)
        : definition.defaultTargetMw;
    const targetMw = round(
      ceilingMw != null
        ? clamp(percentileTarget, floorMw, ceilingMw)
        : Math.max(definition.defaultTargetMw, percentileTarget, floorMw),
    );
    result[definition.lane] = {
      lane: definition.lane,
      floorMw,
      targetMw,
      ceilingMw,
    };
  }
  return result;
}

export function classifyMarketBracket(price: number | null, brackets: LeagueMarketBrackets): MarketBracketTierLabel {
  const value = price ?? 0;
  if (value <= 0) return "Reserve";
  if (value >= brackets.superstar.floorMw) return "Superstar";
  if (value >= brackets.star.floorMw) return "Star";
  if (value >= brackets.core.floorMw) return "Core";
  if (value >= brackets.depth.floorMw) return "Depth";
  if (value >= brackets.backup.floorMw) return "Backup";
  return "Reserve";
}

export function resolvePickLaneBracket(lane: MarketPickLane): MarketBracketLane {
  switch (lane) {
    case "superstar":
      return "superstar";
    case "star":
      return "star";
    case "core":
    case "specialist":
      return "core";
    case "depth":
      return "depth";
    case "backup":
      return "backup";
    case "cheap_fill":
      return "reserve";
    default:
      return "depth";
  }
}

export function getBracketBandForPickLane(lane: MarketPickLane, brackets: LeagueMarketBrackets): MarketLaneBand {
  const bracketLane = resolvePickLaneBracket(lane);
  const band = brackets[bracketLane];
  return {
    lane,
    floorMW: band.floorMw,
    ceilingMW: band.ceilingMw ?? Number.POSITIVE_INFINITY,
  };
}

export function isPriceEligibleForBracketLane(
  price: number | null,
  lane: MarketPickLane,
  brackets: LeagueMarketBrackets,
) {
  if (price == null || !Number.isFinite(price) || price <= 0) return false;
  const band = getBracketBandForPickLane(lane, brackets);
  if (price + 0.01 < band.floorMW) return false;
  if (Number.isFinite(band.ceilingMW) && price > band.ceilingMW + 0.01 && lane !== "superstar") {
    return false;
  }
  return true;
}

export function resolveCashBufferMw(spendable: number) {
  return round(Math.max(10, spendable * 0.08));
}

/** Legacy anchor adapter for scoring paths still keyed on quantiles. */
export function bracketsToLegacyAnchors(brackets: LeagueMarketBrackets): LeagueMarketAnchors {
  return {
    q25Price: brackets.reserve.ceilingMw ?? 12,
    q50Price: brackets.depth.floorMw,
    q65Price: brackets.core.floorMw,
    q75Price: round((brackets.depth.targetMw + brackets.core.floorMw) / 2),
    q85Price: brackets.star.floorMw,
    q90Price: round((brackets.star.targetMw + brackets.superstar.floorMw) / 2),
    q95Price: brackets.superstar.floorMw,
  };
}
