import type { TeamGeneralManagerProfile } from "@/lib/data/olyDataTypes";
import type { GmPressureBehavior } from "@/lib/foundation/gm-pressure-behavior";
import { hasKeepReason, hasSellReason, type AiKeepReasonCode, type AiSellReasonCode } from "@/lib/ai/ai-transfer-reason-codes";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

const PREMIUM_QUALITY_ARCHETYPES = new Set(["elite_curator", "star_chaser"]);

export function applyGmArchetypeSellScoreModifier(input: {
  baseScore: number;
  gmProfile: TeamGeneralManagerProfile | null;
  pressure: GmPressureBehavior | null;
  sellReasonCodes?: AiSellReasonCode[];
  keepReasonCodes?: AiKeepReasonCode[];
  /** Remaining contract length — lets culture_keeper's loyalty malus also bite on medium (2y) deals. */
  contractLength?: number | null;
}) {
  let adjusted = input.baseScore;
  const archetype = input.gmProfile?.archetype ?? null;
  const pressure = input.pressure;
  const sellReasons = input.sellReasonCodes ?? [];
  const keepReasons = input.keepReasonCodes ?? [];

  if (archetype === "bargain_hunter" && hasSellReason(sellReasons, "profit_window")) {
    adjusted += 10;
  }
  if (archetype === "star_chaser" && hasKeepReason(keepReasons, "star_core_protection")) {
    adjusted -= 10;
  }
  if (archetype === "culture_keeper") {
    // Culture keeper protects the working core far beyond a soft team-fit nudge: good/core players
    // are pushed below the sell threshold, and the loyalty malus also applies on medium (2-year)
    // contracts, not just long ones. Keeps chemistry intact instead of trading proven contributors.
    if (hasKeepReason(keepReasons, "good_team_fit")) adjusted -= 8;
    if (hasKeepReason(keepReasons, "star_core_protection")) adjusted -= 12;
    if (hasKeepReason(keepReasons, "strong_contribution")) adjusted -= 10;
    if (hasKeepReason(keepReasons, "top10_presence")) adjusted -= 8;
    if ((input.contractLength ?? 0) === 2) adjusted -= 6;
  }
  if (archetype === "risk_gambler" && pressure?.isHotSeat) {
    adjusted += hasSellReason(sellReasons, "underperformance") ? 8 : 4;
  }
  if (archetype === "elite_curator" && hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")) {
    adjusted -= 12;
  }
  if (archetype === "elite_curator") {
    if (hasSellReason(sellReasons, "roster_quality_floor")) adjusted += 20;
    if (hasSellReason(sellReasons, "weak_contribution")) adjusted += 14;
    if (hasSellReason(sellReasons, "underperformance")) adjusted += 12;
  }
  if (archetype === "star_chaser") {
    if (hasSellReason(sellReasons, "roster_quality_floor")) adjusted += 16;
    if (hasSellReason(sellReasons, "weak_contribution")) adjusted += 12;
    if (hasSellReason(sellReasons, "underperformance")) adjusted += 10;
  }
  if (archetype === "bargain_hunter" && hasSellReason(sellReasons, "weak_contribution")) {
    adjusted += 6;
  }
  if (pressure?.sellCoreUnderPressure && hasSellReason(sellReasons, "profit_window")) {
    adjusted += 5;
  }
  if (pressure?.softBlockStarSell && hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")) {
    adjusted -= 7;
  }
  if (
    archetype &&
    PREMIUM_QUALITY_ARCHETYPES.has(archetype) &&
    hasSellReason(sellReasons, "roster_quality_floor") &&
    !hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")
  ) {
    adjusted += 4;
  }

  return round(clamp(adjusted, 0, 100));
}
