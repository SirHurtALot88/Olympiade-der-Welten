import { createActionLogEntry } from "@/lib/game/action-log";
import { createInitialRoomState } from "@/lib/game/create-room-state";
import { MAX_ACTIVE_PLAYERS } from "@/lib/game/constants";
import {
  advanceRoomArenaReveal,
  isRoomArenaReady,
  setRoomArenaParticipantReady,
  startRoomArena as buildStartedRoomArenaState,
  syncRoomArenaParticipants,
} from "@/lib/room/arena-sync-state";
import { createRoomCode } from "@/lib/room/room-code";
import {
  applyOwnershipPresetToState,
  appendRoomEvent,
  buildParticipant,
  buildTurnState,
  canParticipantControlTeam,
  syncParticipantControlledTeams,
} from "@/lib/room/online-room-model";
import { buildRoomFlowState, getNextRoomFlowStepId } from "@/lib/room/room-flow-controller";
import { findSeatByToken } from "@/lib/room/rejoin";
import { createSeatToken } from "@/lib/room/seat-tokens";
import type { RoomOwnershipPreset } from "@/types/events";
import type { CoachRole, RoomRealtimeEventType } from "@/types/game";
import type { RoomSeat, RuntimeRoom } from "@/types/room";

const runtimeRooms = new Map<string, RuntimeRoom>();

function getSeatCount(room: RuntimeRoom) {
  return Object.values(room.seats).filter(Boolean).length;
}

function buildSeat(role: CoachRole, socketId: string, participantId: string): RoomSeat {
  return {
    role,
    participantId,
    seatToken: createSeatToken(),
    socketId,
    connected: true,
    joinedAt: new Date().toISOString(),
  };
}

function syncPlayers(room: RuntimeRoom) {
  const ownership = room.state.teamOwnership;
  const roomParticipants = syncParticipantControlledTeams(
    room.state.roomParticipants.map((participant) => ({
      ...participant,
      connectionStatus: Object.values(room.seats).some(
        (seat) => seat?.participantId === participant.participantId && seat.connected,
      )
        ? "online"
        : "offline",
    })),
    ownership,
  );
  const multiplayerRoom = {
    ...room.state.multiplayerRoom,
    status: getSeatCount(room) > 0 ? room.state.multiplayerRoom.status : "paused",
    updatedAt: new Date().toISOString(),
  };

  const turnState = buildTurnState({
    roomStatus: multiplayerRoom.status,
    participants: roomParticipants,
    ownership,
    currentStep: room.state.turnState.currentStep,
  });
  const systemControlledTeamIds = ownership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId);

  room.state = {
    ...room.state,
    status: getSeatCount(room) === MAX_ACTIVE_PLAYERS ? "active" : "waiting",
    multiplayerRoom,
    roomParticipants,
    systemControlledTeamIds,
    turnState,
    roomFlowState: buildRoomFlowState({
      state: {
        multiplayerRoom,
        roomParticipants,
        teamOwnership: ownership,
        systemControlledTeamIds,
        turnState,
      },
      currentStep: turnState.currentStep,
      aiAutoCompletedTeamIds: room.state.roomFlowState?.aiAutoCompletedTeamIds,
    }),
    arenaSyncState: syncRoomArenaParticipants({
      ...room.state,
      multiplayerRoom,
      roomParticipants,
      systemControlledTeamIds,
    }),
    players: {
      A: room.seats.A && {
        role: "A",
        connected: room.seats.A.connected,
        joinedAt: room.seats.A.joinedAt,
      },
      B: room.seats.B && {
        role: "B",
        connected: room.seats.B.connected,
        joinedAt: room.seats.B.joinedAt,
      },
    },
  };
}

export function createRoom(
  socketId: string,
  input?: {
    displayName?: string | null;
    saveId?: string | null;
    preset?: RoomOwnershipPreset | null;
  },
) {
  let roomCode = createRoomCode();

  while (runtimeRooms.has(roomCode)) {
    roomCode = createRoomCode();
  }

  const participantId = `participant-${crypto.randomUUID()}`;
  const room: RuntimeRoom = {
    roomCode,
    state: createInitialRoomState(roomCode, {
      saveId: input?.saveId,
      hostParticipantId: participantId,
      hostUserId: `user-${participantId}`,
      hostDisplayName: input?.displayName?.trim() || "Chris",
    }),
    seats: {
      A: buildSeat("A", socketId, participantId),
    },
  };

  syncPlayers(room);
  if (input?.preset) {
    room.state = applyOwnershipPresetToState(room.state, input.preset);
    syncPlayers(room);
  }
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "room_created", preset: input?.preset ?? "default" });
  runtimeRooms.set(roomCode, room);

  return {
    room,
    seat: room.seats.A!,
  };
}

export function joinRoom(roomCode: string, socketId: string, input?: { displayName?: string | null }) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const room = runtimeRooms.get(normalizedCode);

  if (!room) {
    return { ok: false as const, error: "Dieser Raum wurde nicht gefunden." };
  }

  if (room.seats.B) {
    return { ok: false as const, error: "Der Raum hat bereits zwei aktive Coaches." };
  }

  const participantId = `participant-${crypto.randomUUID()}`;
  room.seats.B = buildSeat("B", socketId, participantId);
  room.state.roomParticipants = [
    ...room.state.roomParticipants,
    buildParticipant({
      participantId,
      userId: `user-${participantId}`,
      displayName: input?.displayName?.trim() || "Franky",
      role: "player",
    }),
  ];
  room.state = applyOwnershipPresetToState(room.state, "chris_4_franky_4_rest_ai");
  room.state = appendRoomEvent(room.state, "participant_joined", { participantId, displayName: input?.displayName?.trim() || "Franky" });
  room.state.actionLog.push(
    createActionLogEntry({
      turnNumber: room.state.turnNumber,
      actorRole: "B",
      type: "player_joined",
      message: "Coach B ist dem Raum beigetreten.",
    }),
  );
  syncPlayers(room);

  return { ok: true as const, room, seat: room.seats.B };
}

export function rejoinRoom(roomCode: string, seatToken: string, socketId: string) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const room = runtimeRooms.get(normalizedCode);

  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }

  const role = findSeatByToken(room, seatToken);
  if (!role) {
    return { ok: false as const, error: "Der gespeicherte Sitzplatz ist ungueltig." };
  }

  const seat = room.seats[role]!;
  seat.connected = true;
  seat.socketId = socketId;
  room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
    participant.participantId === seat.participantId
      ? { ...participant, connectionStatus: "online", lastSeenAt: new Date().toISOString() }
      : participant,
  );
  room.state.actionLog.push(
    createActionLogEntry({
      turnNumber: room.state.turnNumber,
      actorRole: role,
      type: "player_rejoined",
      message: `Coach ${role} hat den Raum erneut verbunden.`,
    }),
  );
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "participant_rejoined", participantId: seat.participantId });
  syncPlayers(room);

  return { ok: true as const, room, seat };
}

export function markDisconnected(socketId: string) {
  for (const room of runtimeRooms.values()) {
    for (const role of ["A", "B"] as const) {
      const seat = room.seats[role];
      if (seat?.socketId === socketId) {
        seat.connected = false;
        seat.socketId = null;
        room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
          participant.participantId === seat.participantId
            ? { ...participant, connectionStatus: "offline", lastSeenAt: new Date().toISOString() }
            : participant,
        );
        room.state = appendRoomEvent(room.state, "participant_left", { participantId: seat.participantId, connectionStatus: "offline" });
        syncPlayers(room);
      }
    }
  }
}

export function getRoom(roomCode: string) {
  return runtimeRooms.get(roomCode.trim().toUpperCase()) ?? null;
}

export function getActiveRoomBySaveId(saveId: string) {
  for (const room of runtimeRooms.values()) {
    if (
      room.state.multiplayerRoom.saveId === saveId &&
      room.state.multiplayerRoom.status !== "completed" &&
      room.state.multiplayerRoom.status !== "paused"
    ) {
      return room;
    }
  }
  return null;
}

export function recordRoomGameplayWrite(input: {
  roomCode: string;
  saveId: string;
  teamId?: string | null;
  participantId?: string | null;
  action: string;
  eventType: RoomRealtimeEventType;
  affectedViews?: string[];
}) {
  const room = getRoom(input.roomCode);
  if (!room || room.state.multiplayerRoom.saveId !== input.saveId) {
    return { ok: false as const, room: null };
  }

  const participantId = input.participantId ?? null;
  const shouldInvalidateReady = Boolean(
    participantId &&
      room.state.roomParticipants.some(
        (participant) => participant.participantId === participantId && participant.readyState === "ready",
      ),
  );

  room.state = {
    ...room.state,
    roomParticipants: room.state.roomParticipants.map((participant) =>
      participant.participantId === participantId
        ? { ...participant, readyState: "not_ready", lastSeenAt: new Date().toISOString() }
        : participant,
    ),
    arenaSyncState:
      input.eventType === "matchday_applied" || input.eventType === "arena_result_applied"
        ? {
            ...room.state.arenaSyncState,
            status: "result_applied",
            resultStatus: "applied",
            phaseId: "result",
            phaseIndex: 6,
            updatedAt: new Date().toISOString(),
            version: room.state.arenaSyncState.version + 1,
          }
        : room.state.arenaSyncState,
  };
  room.state = appendRoomEvent(room.state, input.eventType, {
    roomCode: room.roomCode,
    saveId: input.saveId,
    teamId: input.teamId ?? null,
    action: input.action,
    participantId,
    affectedViews: input.affectedViews ?? [],
    timestamp: new Date().toISOString(),
  });
  if (shouldInvalidateReady) {
    room.state = appendRoomEvent(room.state, "ready_invalidated", {
      roomCode: room.roomCode,
      saveId: input.saveId,
      teamId: input.teamId ?? null,
      action: input.action,
      participantId,
      affectedViews: input.affectedViews ?? [],
      timestamp: new Date().toISOString(),
    });
  }
  syncPlayers(room);
  return { ok: true as const, room };
}

function findRoomParticipantBySeatToken(room: RuntimeRoom, seatToken: string) {
  const role = findSeatByToken(room, seatToken);
  const participantId = role ? room.seats[role]?.participantId ?? null : null;
  const participant = participantId
    ? room.state.roomParticipants.find((entry) => entry.participantId === participantId) ?? null
    : null;
  return { role, participantId, participant };
}

export function startRoomArenaSync(
  roomCode: string,
  seatToken: string,
  input?: {
    seasonId?: string | null;
    matchdayId?: string | null;
    disciplineSide?: "d1" | "d2" | "overall" | null;
    maxSlotRevealIndex?: number | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
  },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: "Dein Sitzplatz ist nicht gueltig." };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf die gemeinsame Arena starten." };
  }

  room.state = {
    ...room.state,
    roomFlowState: {
      ...room.state.roomFlowState,
      step: "arena",
    },
    arenaSyncState: buildStartedRoomArenaState({
      state: room.state,
      participantId,
      seasonId: input?.seasonId,
      matchdayId: input?.matchdayId,
      disciplineSide: input?.disciplineSide,
      maxSlotRevealIndex: input?.maxSlotRevealIndex,
      maxSlotRevealCountByDiscipline: input?.maxSlotRevealCountByDiscipline,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_started", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    seasonId: room.state.arenaSyncState.seasonId,
    matchdayId: room.state.arenaSyncState.matchdayId,
    disciplineSide: room.state.arenaSyncState.disciplineSide,
    participantId,
    affectedViews: ["arena", "matchday"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function setRoomArenaReadyState(roomCode: string, seatToken: string, ready: boolean) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const { participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!participantId) {
    return { ok: false as const, error: "Dein Sitzplatz ist nicht gueltig." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: setRoomArenaParticipantReady({
      arenaState: room.state.arenaSyncState,
      participantId,
      ready,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_ready_changed", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    participantId,
    ready,
    readyParticipantIds: room.state.arenaSyncState.readyParticipantIds,
    requiredParticipantIds: room.state.arenaSyncState.requiredParticipantIds,
    affectedViews: ["arena"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function advanceRoomArenaStep(
  roomCode: string,
  seatToken: string,
  input?: {
    maxSlotRevealIndex?: number | null;
    maxSlotRevealCountByDiscipline?: { d1: number; d2: number } | null;
    force?: boolean | null;
  },
) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const { role, participantId } = findRoomParticipantBySeatToken(room, seatToken);
  if (!role || !participantId) {
    return { ok: false as const, error: "Dein Sitzplatz ist nicht gueltig." };
  }
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den gemeinsamen Arena-Step fortsetzen." };
  }
  if (!input?.force && room.state.arenaSyncState.status === "ready_check" && !isRoomArenaReady(room.state.arenaSyncState)) {
    return { ok: false as const, error: "Arena wartet noch auf Ready von allen aktiven Coaches." };
  }

  room.state = {
    ...room.state,
    arenaSyncState: advanceRoomArenaReveal({
      arenaState: room.state.arenaSyncState,
      participantId,
      maxSlotRevealIndex: input?.maxSlotRevealIndex,
      maxSlotRevealCountByDiscipline: input?.maxSlotRevealCountByDiscipline,
    }),
  };
  room.state = appendRoomEvent(room.state, "arena_step_changed", {
    roomCode: room.roomCode,
    saveId: room.state.multiplayerRoom.saveId,
    participantId,
    phaseId: room.state.arenaSyncState.phaseId,
    phaseIndex: room.state.arenaSyncState.phaseIndex,
    slotRevealIndex: room.state.arenaSyncState.slotRevealIndex,
    stepIndex: room.state.arenaSyncState.stepIndex,
    affectedViews: ["arena"],
  });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function applyRoomOwnershipPreset(roomCode: string, seatToken: string, preset: RoomOwnershipPreset) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf Team-Presets setzen." };
  }

  room.state = applyOwnershipPresetToState(room.state, preset);
  room.state = appendRoomEvent(room.state, "room_state_updated", { source: "ownership_preset_applied", preset });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function setParticipantReadyState(roomCode: string, seatToken: string, ready: boolean) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const role = findSeatByToken(room, seatToken);
  if (!role) {
    return { ok: false as const, error: "Dein Sitzplatz ist nicht gueltig." };
  }
  const participantId = room.seats[role]?.participantId;
  room.state.roomParticipants = room.state.roomParticipants.map((participant) =>
    participant.participantId === participantId
      ? { ...participant, readyState: ready ? "ready" : "not_ready", lastSeenAt: new Date().toISOString() }
      : participant,
  );
  room.state = appendRoomEvent(room.state, "team_ready_changed", { participantId, ready });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function startRoom(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den Room starten." };
  }
  if (!room.state.turnState.canAdvance) {
    return { ok: false as const, error: "Nicht alle erforderlichen Teilnehmer sind bereit." };
  }

  room.state = {
    ...room.state,
    multiplayerRoom: {
      ...room.state.multiplayerRoom,
      status: "season_active",
      updatedAt: new Date().toISOString(),
    },
    roomParticipants: room.state.roomParticipants.map((participant) => ({ ...participant, readyState: "not_ready" })),
    turnState: {
      ...room.state.turnState,
      currentStep: "training",
      readyParticipants: [],
      canAdvance: false,
    },
    roomFlowState: {
      ...room.state.roomFlowState,
      step: "training",
      completedParticipantIds: [],
      aiAutoCompletedTeamIds: [],
      canHostAdvance: false,
    },
  };
  room.state = appendRoomEvent(room.state, "flow_step_changed", { step: "training", source: "start_room" });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function runRoomAiAutoStep(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf AI-Teams vorbereiten." };
  }

  const aiTeamIds = room.state.teamOwnership.filter((entry) => entry.controllerType === "ai").map((entry) => entry.teamId);
  room.state = {
    ...room.state,
    roomFlowState: {
      ...room.state.roomFlowState,
      aiAutoCompletedTeamIds: aiTeamIds,
      warnings: [...room.state.roomFlowState.warnings.filter((warning) => warning !== "ai_auto_step_pending"), "source:sandbox_auto_ready"],
    },
  };
  room.state = appendRoomEvent(room.state, "save_updated", { source: "sandbox_ai_auto_step", aiTeamCount: aiTeamIds.length });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function advanceRoomFlow(roomCode: string, seatToken: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return { ok: false as const, error: "Der Raum existiert nicht mehr." };
  }
  const role = findSeatByToken(room, seatToken);
  if (role !== "A") {
    return { ok: false as const, error: "Nur der Host darf den Room-Flow fortsetzen." };
  }
  if (!room.state.roomFlowState.canHostAdvance) {
    return { ok: false as const, error: "Room-Flow ist noch blockiert: Human- oder AI-Schritte sind offen." };
  }

  const nextStep = getNextRoomFlowStepId(room.state.roomFlowState.step);
  room.state = {
    ...room.state,
    roomParticipants: room.state.roomParticipants.map((participant) => ({ ...participant, readyState: "not_ready" })),
    turnState: {
      ...room.state.turnState,
      currentStep: nextStep,
      readyParticipants: [],
      canAdvance: false,
    },
    roomFlowState: {
      ...room.state.roomFlowState,
      step: nextStep,
      completedParticipantIds: [],
      aiAutoCompletedTeamIds: [],
      canHostAdvance: false,
      warnings: [],
    },
  };
  room.state = appendRoomEvent(room.state, "flow_step_changed", { step: nextStep, source: "advance_room_flow" });
  syncPlayers(room);
  return { ok: true as const, room };
}

export function canSeatControlTeam(roomCode: string, seatToken: string, teamId: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return false;
  }
  const role = findSeatByToken(room, seatToken);
  const participantId = role ? room.seats[role]?.participantId : null;
  return participantId ? canParticipantControlTeam(room.state, participantId, teamId) : false;
}
