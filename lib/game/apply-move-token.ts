import { appendActionLog, createActionLogEntry } from "@/lib/game/action-log";
import { getTokenById, hasMoveCommitted, isRoleActive } from "@/lib/game/selectors";
import type { CoachRole, OlyRoomState } from "@/types/game";

type GameResult =
  | { ok: true; state: OlyRoomState }
  | { ok: false; error: string };

export function canMoveToken(state: OlyRoomState, role: CoachRole, tokenId: string): GameResult {
  const token = getTokenById(state, tokenId);

  if (!token) {
    return { ok: false, error: "Dieser Token existiert nicht." };
  }

  if (token.ownerRole !== role) {
    return { ok: false, error: "Du kannst nur deine eigenen Tokens bewegen." };
  }

  if (!isRoleActive(state, role)) {
    return { ok: false, error: "Du bist gerade nicht am Zug." };
  }

  if (hasMoveCommitted(state)) {
    return { ok: false, error: "In diesem Zug wurde bereits ein Move ausgefuehrt." };
  }

  if (token.position >= state.board.laneLength - 1) {
    return { ok: false, error: "Dieser Token steht bereits am Ende der Bahn." };
  }

  return { ok: true, state };
}

export function applyMoveToken(state: OlyRoomState, role: CoachRole, tokenId: string): GameResult {
  const validation = canMoveToken(state, role, tokenId);
  if (!validation.ok) {
    return validation;
  }

  const token = getTokenById(state, tokenId)!;
  const nextPosition = token.position + 1;

  const nextState = {
    ...state,
    status: "active" as const,
    moveCommittedThisTurn: true,
    tokens: state.tokens.map((entry) =>
      entry.id === tokenId ? { ...entry, position: nextPosition } : entry,
    ),
  };

  return {
    ok: true,
    state: appendActionLog(
      nextState,
      createActionLogEntry({
        turnNumber: state.turnNumber,
        actorRole: role,
        type: "moveToken",
        tokenId,
        from: token.position,
        to: nextPosition,
        message: `${token.label} bewegt sich von Feld ${token.position + 1} auf Feld ${nextPosition + 1}.`,
      }),
    ),
  };
}
