import { describe, expect, it } from "vitest";

import {
  advanceFoundationArenaReveal,
  canAdvanceFoundationArenaReveal,
  createFoundationArenaRevealState,
} from "@/lib/foundation/matchday-arena-reveal-sync";

describe("matchday arena reveal sync", () => {
  it("reveals slots one step at a time before moving to push", () => {
    let state = createFoundationArenaRevealState();
    const limits = { maxD1SlotRevealCount: 3, maxD2SlotRevealCount: 4 };

    expect(canAdvanceFoundationArenaReveal(state, limits)).toBe(true);
    state = advanceFoundationArenaReveal(state, limits)!;
    expect(state.revealedSlotCountByDiscipline.d1).toBe(1);

    state = advanceFoundationArenaReveal(state, limits)!;
    expect(state.revealedSlotCountByDiscipline.d1).toBe(2);

    state = advanceFoundationArenaReveal(state, limits)!;
    expect(state.revealedSlotCountByDiscipline.d1).toBe(3);

    state = advanceFoundationArenaReveal(state, limits)!;
    expect(state.phaseIndex).toBe(1);
    expect(state.revealedSlotCountByDiscipline.d1).toBe(3);
  });

  it("switches from d1 result into d2 slots", () => {
    let state = {
      activeDisciplinePhase: "d1" as const,
      phaseIndex: 5,
      revealedSlotCountByDiscipline: { d1: 3, d2: 0 },
      completedDisciplinePhases: { d1: false, d2: false },
    };
    const limits = { maxD1SlotRevealCount: 3, maxD2SlotRevealCount: 2 };

    state = advanceFoundationArenaReveal(state, limits)!;
    expect(state.activeDisciplinePhase).toBe("d2");
    expect(state.phaseIndex).toBe(0);
    expect(state.completedDisciplinePhases.d1).toBe(true);
    expect(state.revealedSlotCountByDiscipline.d2).toBe(0);
  });
});
