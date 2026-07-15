"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";
import { normalizeRoomArenaState } from "@/lib/room/arena-sync-state";
import { getClientSocket } from "@/lib/socket/client";
import type { RoomJoinedPayload } from "@/types/events";
import type { CoachRole, OlyRoomState, RoomArenaState, RoomParticipant } from "@/types/game";

/**
 * Shared co-op arena room-sync logic — used by BOTH the classic
 * `MatchdayArenaV2Client` and the New-Look `MatchdayArenaNewLook`, so the two
 * arenas can never drift on the "both ready" gate / host-driven lockstep
 * reveal semantics.
 *
 * The hook owns:
 * - subscribing to `roomJoined`/`roomState` and force-applying the host's
 *   reveal step (via `onApplyRevealSync`) whenever a new, matching,
 *   non-idle `RoomArenaState` version arrives;
 * - deriving co-op/ready-gate/host-control booleans from that state;
 * - the socket emits (`setRoomArenaReady`, `advanceRoomArenaStep`,
 *   `startRoomArena`).
 *
 * It does NOT own any reveal-rendering state — each arena keeps its own
 * local reveal state shape (classic: per-discipline slot counts + phase
 * index; New Look: a single `boardSide` + `phaseIndex`) and maps the
 * normalized `RoomArenaState` onto it inside `onApplyRevealSync`.
 *
 * Solo / no-room safety: every derived flag here is `false`/inert when
 * `roomContext` is null, and `isRoomArenaCoop` requires more than one
 * required participant — a room with only the host present never gates.
 */
export type UseArenaRoomSyncInput = {
  roomContext: FoundationRoomContext | null | undefined;
  /** Currently displayed arena scope — used to ignore stale/foreign syncs. */
  saveId: string | null | undefined;
  seasonId: string | null | undefined;
  matchdayId: string | null | undefined;
  /**
   * Called with the normalized, force-applied `RoomArenaState` whenever the
   * host advances (or a fresh join delivers an in-progress sync). Map it
   * onto whatever local reveal state the consumer renders.
   */
  onApplyRevealSync: (normalized: RoomArenaState) => void;
};

export type UseArenaRoomSyncResult = {
  roomSyncRole: CoachRole | null;
  roomArenaSyncState: RoomArenaState | null;
  roomSyncParticipants: RoomParticipant[];
  isRoomHost: boolean;
  /** True whenever this arena instance is mounted inside a Room (solo-in-room included). */
  isRoomRevealSyncActive: boolean;
  arenaRequiredParticipantIds: string[];
  arenaReadyParticipantIds: string[];
  /** True only for a REAL co-op room (>1 human participant controlling teams). */
  isRoomArenaCoop: boolean;
  /** True while co-op is waiting on the "both ready" gate. */
  arenaCoopReadyGateActive: boolean;
  selfArenaParticipantId: string | null;
  isSelfArenaReady: boolean;
  arenaCoopGateParticipants: RoomParticipant[];
  arenaCoopWaitingNames: string[];
  /** Reveal controls should be enabled/rendered-interactive only when this is true. */
  canControlArenaReveal: boolean;
  roomRevealWaitingForHost: boolean;
  emitHostRoomArenaAdvance: (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => void;
  emitArenaCoopReadyToggle: () => void;
  emitStartRoomArena: (input: {
    seasonId?: string | null;
    matchdayId?: string | null;
    disciplineSide?: "d1" | "d2" | "overall" | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  }) => void;
};

export function useArenaRoomSync(input: UseArenaRoomSyncInput): UseArenaRoomSyncResult {
  const { roomContext, saveId, seasonId, matchdayId } = input;

  const [roomSyncRole, setRoomSyncRole] = useState<CoachRole | null>(null);
  const [roomArenaSyncState, setRoomArenaSyncState] = useState<RoomArenaState | null>(null);
  const [roomSyncParticipants, setRoomSyncParticipants] = useState<RoomParticipant[]>([]);
  const lastAppliedRoomArenaVersionRef = useRef<number | null>(null);

  // Keep the latest callback without forcing the subscription effect below to
  // re-run (and re-subscribe sockets) whenever the consumer re-renders with a
  // fresh inline function.
  const onApplyRevealSyncRef = useRef(input.onApplyRevealSync);
  onApplyRevealSyncRef.current = input.onApplyRevealSync;

  const scopeRef = useRef({ saveId, seasonId, matchdayId });
  scopeRef.current = { saveId, seasonId, matchdayId };

  function applyRoomArenaSync(arenaSync: RoomArenaState | null | undefined) {
    if (!arenaSync || arenaSync.status === "idle") {
      return;
    }
    const scope = scopeRef.current;
    if (arenaSync.saveId !== scope.saveId) {
      return;
    }
    if (arenaSync.seasonId && arenaSync.seasonId !== scope.seasonId) {
      return;
    }
    if (arenaSync.matchdayId && arenaSync.matchdayId !== scope.matchdayId) {
      return;
    }
    if (lastAppliedRoomArenaVersionRef.current === arenaSync.version) {
      return;
    }

    lastAppliedRoomArenaVersionRef.current = arenaSync.version;
    onApplyRevealSyncRef.current(normalizeRoomArenaState(arenaSync));
  }

  useEffect(() => {
    if (!roomContext) {
      setRoomSyncRole(null);
      setRoomArenaSyncState(null);
      setRoomSyncParticipants([]);
      lastAppliedRoomArenaVersionRef.current = null;
      return undefined;
    }

    const socket = getClientSocket();

    function handleRoomJoined(payload: RoomJoinedPayload) {
      if (!roomContext) {
        return;
      }
      if (payload.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      if (payload.participantId !== roomContext.participantId) {
        return;
      }
      setRoomSyncRole(payload.role);
      setRoomArenaSyncState(payload.state.arenaSyncState ?? null);
      setRoomSyncParticipants(payload.state.roomParticipants ?? []);
      applyRoomArenaSync(payload.state.arenaSyncState);
    }

    function handleRoomState(nextState: OlyRoomState) {
      if (!roomContext) {
        return;
      }
      if (nextState.roomCode !== roomContext.roomCode.toUpperCase()) {
        return;
      }
      setRoomArenaSyncState(nextState.arenaSyncState ?? null);
      setRoomSyncParticipants(nextState.roomParticipants ?? []);
      applyRoomArenaSync(nextState.arenaSyncState);
    }

    socket.emit("rejoinRoom", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
    });
    socket.on("roomJoined", handleRoomJoined);
    socket.on("roomState", handleRoomState);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("roomState", handleRoomState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomContext, saveId, seasonId, matchdayId]);

  const isRoomHost = roomSyncRole === "A";
  const isRoomRevealSyncActive = Boolean(roomContext);
  // Co-op means the arena sync currently requires more than one connected human
  // participant (host + guest both control at least one team). A room where only the
  // host is present (solo-in-room) must keep behaving exactly like solo: no ready
  // gate, the reveal auto-starts. Only true co-op gets the "both ready" gate.
  const arenaRequiredParticipantIds = roomArenaSyncState?.requiredParticipantIds ?? [];
  const arenaReadyParticipantIds = roomArenaSyncState?.readyParticipantIds ?? [];
  const isRoomArenaCoop = isRoomRevealSyncActive && arenaRequiredParticipantIds.length > 1;
  const arenaCoopReadyGateActive = isRoomArenaCoop && (roomArenaSyncState?.status ?? "idle") === "ready_check";
  const selfArenaParticipantId = roomContext?.participantId ?? null;
  const isSelfArenaReady = Boolean(
    selfArenaParticipantId && arenaReadyParticipantIds.includes(selfArenaParticipantId),
  );
  const arenaCoopGateParticipants = arenaRequiredParticipantIds
    .map((participantId) => roomSyncParticipants.find((participant) => participant.participantId === participantId) ?? null)
    .filter((participant): participant is RoomParticipant => Boolean(participant));
  const arenaCoopWaitingNames = arenaCoopGateParticipants
    .filter(
      (participant) =>
        participant.participantId !== selfArenaParticipantId &&
        !arenaReadyParticipantIds.includes(participant.participantId),
    )
    .map((participant) => participant.displayName);
  const canControlArenaReveal = (!isRoomRevealSyncActive || isRoomHost) && !arenaCoopReadyGateActive;
  const roomRevealWaitingForHost =
    isRoomRevealSyncActive && !isRoomHost && (roomArenaSyncState?.status ?? "idle") === "idle";

  // Stable identities (via useCallback) so consumers can safely list these in
  // effect dependency arrays without re-firing on every render.
  const emitHostRoomArenaAdvance = useCallback(
    (maxSlotRevealCountByDiscipline: { d1: number; d2: number }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("advanceRoomArenaStep", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        maxSlotRevealCountByDiscipline,
        // Real co-op (>1 human participant) must respect the server's both-ready gate,
        // so the default advance no longer force-bypasses it. A room with only the host
        // present (solo-in-room) keeps the previous unconditional force:true behavior —
        // there is nobody else to wait for and the ready gate never engages for it.
        force: !isRoomArenaCoop,
      });
    },
    [roomContext, isRoomArenaCoop],
  );

  const emitArenaCoopReadyToggle = useCallback(() => {
    if (!roomContext) {
      return;
    }
    const socket = getClientSocket();
    socket.emit("setRoomArenaReady", {
      roomCode: roomContext.roomCode,
      seatToken: roomContext.seatToken,
      ready: !isSelfArenaReady,
    });
  }, [roomContext, isSelfArenaReady]);

  const emitStartRoomArena = useCallback(
    (startInput: {
      seasonId?: string | null;
      matchdayId?: string | null;
      disciplineSide?: "d1" | "d2" | "overall" | null;
      maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
    }) => {
      if (!roomContext) {
        return;
      }
      const socket = getClientSocket();
      socket.emit("startRoomArena", {
        roomCode: roomContext.roomCode,
        seatToken: roomContext.seatToken,
        seasonId: startInput.seasonId,
        matchdayId: startInput.matchdayId,
        disciplineSide: startInput.disciplineSide ?? "d1",
        maxSlotRevealCountByDiscipline: startInput.maxSlotRevealCountByDiscipline,
      });
    },
    [roomContext],
  );

  return {
    roomSyncRole,
    roomArenaSyncState,
    roomSyncParticipants,
    isRoomHost,
    isRoomRevealSyncActive,
    arenaRequiredParticipantIds,
    arenaReadyParticipantIds,
    isRoomArenaCoop,
    arenaCoopReadyGateActive,
    selfArenaParticipantId,
    isSelfArenaReady,
    arenaCoopGateParticipants,
    arenaCoopWaitingNames,
    canControlArenaReveal,
    roomRevealWaitingForHost,
    emitHostRoomArenaAdvance,
    emitArenaCoopReadyToggle,
    emitStartRoomArena,
  };
}
