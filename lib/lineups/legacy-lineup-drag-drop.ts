export type LegacyLineupDragBlockReason =
  | "player_injured_unavailable"
  | "already_assigned_other_discipline"
  | "captain_not_allowed"
  | "slot_rule_not_fulfilled";

export type LegacyLineupDragFitTier = "best" | "great" | "okay" | "poor" | "blocked";

export function resolveLegacyLineupDragBlockReason(input: {
  availabilityBlocker?: string | null;
  selectedSides?: Array<"d1" | "d2">;
  targetDisciplineSide: "d1" | "d2";
  captainSide?: "d1" | "d2" | null;
  hasBaseScore: boolean;
}) : LegacyLineupDragBlockReason | null {
  if (input.availabilityBlocker === "player_injured_unavailable") {
    return "player_injured_unavailable";
  }

  if (
    input.selectedSides?.some((side) => side !== input.targetDisciplineSide)
  ) {
    return "already_assigned_other_discipline";
  }

  if (input.captainSide && input.captainSide !== input.targetDisciplineSide) {
    return "captain_not_allowed";
  }

  if (!input.hasBaseScore) {
    return "slot_rule_not_fulfilled";
  }

  return null;
}

export function getLegacyLineupDragFitTier(input: {
  blocked: boolean;
  projectedScore: number | null;
  bestProjectedScore: number | null;
  currentProjectedScore: number | null;
}) : LegacyLineupDragFitTier {
  if (input.blocked || input.projectedScore == null) {
    return "blocked";
  }

  const bestProjectedScore = input.bestProjectedScore ?? input.projectedScore;
  const gapToBest = Number((bestProjectedScore - input.projectedScore).toFixed(1));
  const deltaToCurrent =
    input.currentProjectedScore == null
      ? null
      : Number((input.projectedScore - input.currentProjectedScore).toFixed(1));

  if (gapToBest <= 0.4) {
    return "best";
  }

  if (gapToBest <= 1.8 && (deltaToCurrent == null || deltaToCurrent >= -0.8)) {
    return "great";
  }

  if (deltaToCurrent == null || deltaToCurrent >= -4) {
    return "okay";
  }

  return "poor";
}

export function formatLegacyLineupDragBlockReason(reason: LegacyLineupDragBlockReason | null) {
  switch (reason) {
    case "player_injured_unavailable":
      return "player_injured_unavailable";
    case "already_assigned_other_discipline":
      return "bereits in anderer Diszi eingesetzt";
    case "captain_not_allowed":
      return "Captain nicht erlaubt";
    case "slot_rule_not_fulfilled":
      return "Slot-Regel nicht erfüllt";
    default:
      return null;
  }
}
