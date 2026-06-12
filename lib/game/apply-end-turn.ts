import { appendActionLog, createActionLogEntry } from "@/lib/game/action-log";
import { hasMoveCommitted, isRoleActive } from "@/lib/game/selectors";
import type { CoachRole, OlyRoomState } from "@/types/game";

type GameResult =
  | { ok: true; state: OlyRoomState }
  | { ok: false; error: string };

export function canEndTurn(state: OlyRoomState, role: CoachRole): GameResult {
  if (!isRoleActive(state, role)) {
    return { ok: false, error: "Nur der aktive Coach kann den Zug beenden." };
  }

  if (!hasMoveCommitted(state)) {
    return { ok: false, error: "Bewege zuerst genau ein eigenes Token." };
  }

  return { ok: true, state };
}

export function endTurn(state: OlyRoomState, role: CoachRole): GameResult {
  const validation = canEndTurn(state, role);
  if (!validation.ok) {
    return validation;
  }

  const nextRole: CoachRole = role === "A" ? "B" : "A";
  const nextState = {
    ...state,
    activeRole: nextRole,
    turnNumber: state.turnNumber + 1,
    moveCommittedThisTurn: false,
    status: "active" as const,
  };

  return {
    ok: true,
    state: appendActionLog(
      nextState,
      createActionLogEntry({
        turnNumber: nextState.turnNumber,
        actorRole: role,
        type: "endTurn",
        message: `Coach ${role} beendet den Zug. Coach ${nextRole} ist jetzt aktiv.`,
      }),
    ),
  };
}
