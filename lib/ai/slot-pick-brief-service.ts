import type { MarketPickLane } from "@/lib/ai/ai-market-slot-plan-service";
import type { BudgetEnvelopeSlot } from "@/lib/ai/market-pick-engine/budget-envelope";
import {
  resolvePickLaneBracket,
  type LeagueMarketBrackets,
  type MarketBracketTierLabel,
} from "@/lib/ai/market-pick-engine/market-brackets";
import type { Player } from "@/lib/data/olyDataTypes";

export type TeamAxis = "pow" | "spe" | "men" | "soc";

export type SlotRoleHint = "sprinter" | "allrounder" | "anchor" | "specialist" | "rotation" | "safety";

export type SlotPurposeKind =
  | "minimum_skeleton"
  | "axis_core"
  | "axis_star"
  | "discipline_specialist"
  | "depth_coverage"
  | "backup_safety"
  | "premium_anchor";

export type SlotPickBrief = {
  step: number;
  lane: MarketPickLane;
  bracket: MarketBracketTierLabel;
  purposeKind: SlotPurposeKind;
  primaryAxis: TeamAxis | null;
  secondaryAxis: TeamAxis | null;
  disciplineId: string | null;
  roleHint: SlotRoleHint | null;
  purposeLabel: string;
  targetMw: number | null;
  ceilingMw: number | null;
  minPrimaryStat: number;
  minSecondaryStat: number;
};

export type SlotPickBriefAxisPlan = {
  axis: TeamAxis;
  weight: number;
};

const BRACKET_LABEL: Record<ReturnType<typeof resolvePickLaneBracket>, MarketBracketTierLabel> = {
  superstar: "Superstar",
  star: "Star",
  core: "Core",
  depth: "Depth",
  backup: "Backup",
  reserve: "Reserve",
};

const AXIS_LABEL: Record<TeamAxis, string> = {
  pow: "Power",
  spe: "Speed",
  men: "Mental",
  soc: "Social",
};

function round(value: number, digits = 1) {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lanePurposeKind(lane: MarketPickLane): SlotPurposeKind {
  switch (lane) {
    case "superstar":
    case "star":
      return "axis_star";
    case "core":
      return "axis_core";
    case "specialist":
      return "discipline_specialist";
    case "depth":
      return "depth_coverage";
    case "backup":
    case "cheap_fill":
      return lane === "cheap_fill" ? "minimum_skeleton" : "backup_safety";
    default:
      return "depth_coverage";
  }
}

function laneRoleHint(lane: MarketPickLane, primaryAxis: TeamAxis | null): SlotRoleHint | null {
  if (lane === "superstar" || lane === "star") {
    return primaryAxis === "spe" ? "sprinter" : "allrounder";
  }
  if (lane === "core") {
    return primaryAxis === "spe" ? "sprinter" : "anchor";
  }
  if (lane === "specialist") return "specialist";
  if (lane === "depth") return "rotation";
  if (lane === "backup" || lane === "cheap_fill") return "safety";
  return null;
}

function buildPurposeLabel(input: {
  lane: MarketPickLane;
  purposeKind: SlotPurposeKind;
  primaryAxis: TeamAxis | null;
  secondaryAxis: TeamAxis | null;
  disciplineId: string | null;
  bracket: MarketBracketTierLabel;
}): string {
  const primary = input.primaryAxis ? AXIS_LABEL[input.primaryAxis] : null;
  const secondary = input.secondaryAxis ? AXIS_LABEL[input.secondaryAxis] : null;
  if (input.purposeKind === "discipline_specialist" && input.disciplineId) {
    return `${input.disciplineId} → ${input.bracket} (${input.lane})`;
  }
  if (input.purposeKind === "axis_star" && primary && secondary) {
    return `${primary} Allrounder + ${secondary} → ${input.bracket}`;
  }
  if (input.purposeKind === "axis_core" && primary) {
    return `${primary}${input.primaryAxis === "spe" ? "/Sprint" : ""} → ${input.bracket}`;
  }
  if (input.purposeKind === "minimum_skeleton") {
    return `Minimum-Slot → ${input.bracket}`;
  }
  if (primary) {
    return `${primary} → ${input.bracket} (${input.lane})`;
  }
  return `${input.bracket} (${input.lane})`;
}

function pickAxisPair(input: {
  sortedAxes: SlotPickBriefAxisPlan[];
  step: number;
  lane: MarketPickLane;
  usedPrimary: Map<TeamAxis, number>;
}): { primary: TeamAxis | null; secondary: TeamAxis | null } {
  if (input.sortedAxes.length === 0) {
    return { primary: null, secondary: null };
  }
  const ranked = [...input.sortedAxes].sort((left, right) => {
    const usedDelta = (input.usedPrimary.get(left.axis) ?? 0) - (input.usedPrimary.get(right.axis) ?? 0);
    if (usedDelta !== 0) return usedDelta;
    return right.weight - left.weight;
  });
  const primary = ranked[0]?.axis ?? null;
  const secondary =
    input.lane === "star" || input.lane === "superstar"
      ? ranked.find((entry) => entry.axis !== primary)?.axis ?? ranked[1]?.axis ?? null
      : ranked[1]?.axis ?? null;
  return { primary, secondary };
}

function minStatsForLane(lane: MarketPickLane): { primary: number; secondary: number } {
  if (lane === "superstar" || lane === "star") {
    return { primary: 58, secondary: 50 };
  }
  if (lane === "core" || lane === "specialist") {
    return { primary: 52, secondary: 46 };
  }
  if (lane === "depth") {
    return { primary: 44, secondary: 40 };
  }
  return { primary: 36, secondary: 32 };
}

/**
 * Assigns one semantic brief per planner slot: bracket tier + axis/discipline purpose.
 * Briefs are fixed at plan time; scoring uses them as the primary intent for each step.
 */
export function buildSlotPickBriefs(input: {
  slotPlan: MarketPickLane[];
  envelopeSlots?: BudgetEnvelopeSlot[];
  brackets: LeagueMarketBrackets;
  sortedAxes: SlotPickBriefAxisPlan[];
  topNeedDisciplineIds: string[];
}): SlotPickBrief[] {
  const usedPrimary = new Map<TeamAxis, number>();
  let disciplineQueue = [...input.topNeedDisciplineIds];
  const briefs: SlotPickBrief[] = [];

  input.slotPlan.forEach((lane, step) => {
    const envelope = input.envelopeSlots?.[step];
    const bracketLane = resolvePickLaneBracket(lane);
    const bracket = BRACKET_LABEL[bracketLane];
    const purposeKind = lanePurposeKind(lane);
    const { primary, secondary } = pickAxisPair({
      sortedAxes: input.sortedAxes,
      step,
      lane,
      usedPrimary,
    });
    const disciplineId =
      purposeKind === "discipline_specialist" ? disciplineQueue.shift() ?? input.topNeedDisciplineIds[0] ?? null : null;
    const statFloors = minStatsForLane(lane);
    const targetMw = envelope?.targetMw ?? input.brackets[bracketLane]?.targetMw ?? null;
    const ceilingMw = envelope?.ceilingMw ?? input.brackets[bracketLane]?.ceilingMw ?? null;

    if (primary) {
      usedPrimary.set(primary, (usedPrimary.get(primary) ?? 0) + 1);
    }

    briefs.push({
      step: step + 1,
      lane,
      bracket,
      purposeKind,
      primaryAxis: primary,
      secondaryAxis: secondary,
      disciplineId,
      roleHint: laneRoleHint(lane, primary),
      purposeLabel: buildPurposeLabel({
        lane,
        purposeKind,
        primaryAxis: primary,
        secondaryAxis: secondary,
        disciplineId,
        bracket,
      }),
      targetMw,
      ceilingMw,
      minPrimaryStat: statFloors.primary,
      minSecondaryStat: statFloors.secondary,
    });
  });

  return briefs;
}

export function scoreSlotPurposeMatch(input: {
  brief: SlotPickBrief | null | undefined;
  player: Player | null;
  candidateAxis: TeamAxis | null;
}): number {
  const { brief, player } = input;
  if (!brief || !player) return 0;

  let score = 0;
  if (brief.primaryAxis) {
    const stat = player.coreStats[brief.primaryAxis] ?? 0;
    if (stat + 0.01 >= brief.minPrimaryStat) score += 10;
    else score += (stat / 100) * 7;
    if (input.candidateAxis === brief.primaryAxis) score += 2;
  }
  if (brief.secondaryAxis) {
    const stat = player.coreStats[brief.secondaryAxis] ?? 0;
    if (stat + 0.01 >= brief.minSecondaryStat) score += 6;
    else score += (stat / 100) * 4;
  }
  if (brief.disciplineId) {
    const rating = player.disciplineRatings[brief.disciplineId] ?? 0;
    score += (rating / 100) * 12;
  }
  if (brief.roleHint === "sprinter" && brief.primaryAxis === "spe") {
    const className = (player.className ?? "").toLowerCase();
    if (className.includes("sprinter") || className.includes("charger")) score += 3;
  }
  if ((brief.roleHint === "allrounder" || brief.roleHint === "anchor") && brief.primaryAxis && brief.secondaryAxis) {
    const spread = Math.abs((player.coreStats[brief.primaryAxis] ?? 0) - (player.coreStats[brief.secondaryAxis] ?? 0));
    if (spread <= 18) score += 2.5;
  }
  return round(score);
}

/** Soft preference for envelope target MW — guides spread without hard-blocking stars. */
export function scoreEnvelopeSpreadFit(input: {
  price: number | null;
  brief: SlotPickBrief | null | undefined;
  slotsRemaining: number | null;
}): number {
  const price = input.price;
  const target = input.brief?.targetMw;
  if (price == null || target == null || target <= 0) return 0;
  const ratio = price / target;
  const slots = Math.max(input.slotsRemaining ?? 1, 1);
  let score = round(Math.max(0, 9 - Math.abs(Math.log(ratio)) * 4), 1);
  if (slots >= 4 && ratio > 2.2) score -= round((ratio - 2.2) * 3, 1);
  if (ratio >= 0.75 && ratio <= 1.35) score += 2;
  return round(clamp(score, -8, 12), 1);
}
