import { describe, expect, it } from "vitest";

import {
  advanceRoomArenaReveal,
  applyFoundationRevealToRoomArenaState,
  createRoomArenaState,
  roomArenaStateToFoundationReveal,
} from "@/lib/room/arena-sync-state";
import { advanceFoundationArenaReveal, createFoundationArenaRevealState } from "@/lib/foundation/matchday-arena-reveal-sync";

describe("arena sync state bridge", () => {
  it("roundtrips foundation reveal progress through room arena state", () => {
    const arenaState = createRoomArenaState({
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      disciplineSide: "d1",
      maxSlotRevealIndex: 2,
    });

    const advanced = advanceRoomArenaReveal({
      arenaState,
      participantId: "host-1",
      maxSlotRevealCountByDiscipline: { d1: 2, d2: 1 },
    });

    expect(advanced.phaseId).toBe("slots");
    expect(advanced.revealedSlotCountByDiscipline.d1).toBe(1);
    expect(roomArenaStateToFoundationReveal(advanced).revealedSlotCountByDiscipline.d1).toBe(1);
  });

  it("applies foundation reveal snapshots onto room arena state", () => {
    let foundationState = createFoundationArenaRevealState();
    const limits = { maxD1SlotRevealCount: 2, maxD2SlotRevealCount: 1 };
    foundationState = advanceFoundationArenaReveal(foundationState, limits)!;

    const arenaState = createRoomArenaState({
      seasonId: "season-2",
      matchdayId: "season-2-matchday-1",
      disciplineSide: "d1",
      maxSlotRevealIndex: 2,
    });

    const synced = applyFoundationRevealToRoomArenaState(arenaState, foundationState, limits);
    expect(synced.revealedSlotCountByDiscipline.d1).toBe(1);
    expect(synced.phaseId).toBe("slots");
  });
});
