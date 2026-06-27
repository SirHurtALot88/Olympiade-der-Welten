import type { TeamGeneralManagerProfile } from "@/lib/data/olyDataTypes";
import type { GmPressureBehavior } from "@/lib/foundation/gm-pressure-behavior";
import { hasKeepReason, hasSellReason, type AiKeepReasonCode, type AiSellReasonCode } from "@/lib/ai/ai-transfer-reason-codes";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function applyGmArchetypeSellScoreModifier(input: {
  baseScore: number;
  gmProfile: TeamGeneralManagerProfile | null;
  pressure: GmPressureBehavior | null;
  sellReasonCodes?: AiSellReasonCode[];
  keepReasonCodes?: AiKeepReasonCode[];
}) {
  let adjusted = input.baseScore;
  const archetype = input.gmProfile?.archetype ?? null;
  const pressure = input.pressure;

  if (archetype === "bargain_hunter" && hasSellReason(input.sellReasonCodes ?? [], "profit_window")) {
    adjusted += 6;
  }
  if (archetype === "star_chaser" && hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")) {
    adjusted -= 10;
  }
  if (archetype === "culture_keeper" && hasKeepReason(input.keepReasonCodes ?? [], "good_team_fit")) {
    adjusted -= 8;
  }
  if (archetype === "risk_gambler" && pressure?.isHotSeat) {
    adjusted += hasSellReason(input.sellReasonCodes ?? [], "underperformance") ? 8 : 4;
  }
  if (archetype === "elite_curator" && hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")) {
    adjusted -= 12;
  }
  if (pressure?.sellCoreUnderPressure && hasSellReason(input.sellReasonCodes ?? [], "profit_window")) {
    adjusted += 5;
  }
  if (pressure?.softBlockStarSell && hasKeepReason(input.keepReasonCodes ?? [], "star_core_protection")) {
    adjusted -= 7;
  }

  return round(clamp(adjusted, 0, 100));
}
