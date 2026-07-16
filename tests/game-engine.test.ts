import { describe, expect, it } from "vitest";

import { endTurn } from "@/lib/game/apply-end-turn";
import { applyMoveToken } from "@/lib/game/apply-move-token";
import { createInitialRoomState } from "@/lib/game/create-room-state";

describe("game engine", () => {
  it("moves an own token exactly one field", () => {
    const state = createInitialRoomState("TEST");
    const result = applyMoveToken(state, "A", "a-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const moved = result.state.tokens.find((token) => token.id === "a-1");
      expect(moved?.position).toBe(1);
      expect(result.state.moveCommittedThisTurn).toBe(true);
    }
  });

  it("rejects a foreign token move", () => {
    const state = createInitialRoomState("TEST");
    const result = applyMoveToken(state, "A", "b-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/eigenen Tokens/);
    }
  });

  it("switches active role after endTurn", () => {
    const state = createInitialRoomState("TEST");
    const moved = applyMoveToken(state, "A", "a-1");
    expect(moved.ok).toBe(true);
    if (!moved.ok) {
      return;
    }

    const ended = endTurn(moved.state, "A");
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.state.activeRole).toBe("B");
      expect(ended.state.turnNumber).toBe(2);
      expect(ended.state.moveCommittedThisTurn).toBe(false);
    }
  });
});
