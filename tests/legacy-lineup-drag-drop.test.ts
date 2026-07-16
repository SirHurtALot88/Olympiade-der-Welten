import { describe, expect, it } from "vitest";

import {
  formatLegacyLineupDragBlockReason,
  getLegacyLineupDragFitTier,
  resolveLegacyLineupDragBlockReason,
} from "@/lib/lineups/legacy-lineup-drag-drop";

describe("legacy lineup drag and drop helpers", () => {
  it("accepts a valid lineup drop without blocker", () => {
    expect(
      resolveLegacyLineupDragBlockReason({
        availabilityBlocker: null,
        selectedSides: [],
        targetDisciplineSide: "d1",
        captainSide: null,
        hasBaseScore: true,
      }),
    ).toBeNull();
  });

  it("blocks injured players", () => {
    expect(
      resolveLegacyLineupDragBlockReason({
        availabilityBlocker: "player_injured_unavailable",
        selectedSides: [],
        targetDisciplineSide: "d1",
        captainSide: null,
        hasBaseScore: true,
      }),
    ).toBe("player_injured_unavailable");
  });

  it("blocks players already assigned in another discipline", () => {
    expect(
      resolveLegacyLineupDragBlockReason({
        availabilityBlocker: null,
        selectedSides: ["d2"],
        targetDisciplineSide: "d1",
        captainSide: null,
        hasBaseScore: true,
      }),
    ).toBe("already_assigned_other_discipline");
  });

  it("maps fit colors from projected score tiers", () => {
    expect(
      getLegacyLineupDragFitTier({
        blocked: false,
        projectedScore: 74.5,
        bestProjectedScore: 74.7,
        currentProjectedScore: 69,
      }),
    ).toBe("best");

    expect(
      getLegacyLineupDragFitTier({
        blocked: false,
        projectedScore: 72.9,
        bestProjectedScore: 74.2,
        currentProjectedScore: 72.3,
      }),
    ).toBe("great");

    expect(
      getLegacyLineupDragFitTier({
        blocked: false,
        projectedScore: 68.1,
        bestProjectedScore: 74.2,
        currentProjectedScore: 70.4,
      }),
    ).toBe("okay");

    expect(
      getLegacyLineupDragFitTier({
        blocked: false,
        projectedScore: 60.2,
        bestProjectedScore: 74.2,
        currentProjectedScore: 66.1,
      }),
    ).toBe("poor");

    expect(
      getLegacyLineupDragFitTier({
        blocked: true,
        projectedScore: 77,
        bestProjectedScore: 77,
        currentProjectedScore: 70,
      }),
    ).toBe("blocked");
  });

  it("formats blocker labels for the UI", () => {
    expect(formatLegacyLineupDragBlockReason("already_assigned_other_discipline")).toBe(
      "bereits in anderer Diszi eingesetzt",
    );
    expect(formatLegacyLineupDragBlockReason("captain_not_allowed")).toBe("Captain nicht erlaubt");
    expect(formatLegacyLineupDragBlockReason("slot_rule_not_fulfilled")).toBe("Slot-Regel nicht erfüllt");
  });
});
