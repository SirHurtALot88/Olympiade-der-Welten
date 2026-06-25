import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { endTurn } from "@/lib/game/apply-end-turn";
import { applyMoveToken } from "@/lib/game/apply-move-token";
import {
  applyRoomOwnershipPreset,
  advanceRoomArenaStep,
  advanceRoomFlow,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  rejoinRoom,
  runRoomAiAutoStep,
  setRoomArenaReadyState,
  setParticipantReadyState,
  startRoomArenaSync,
  startRoom,
} from "@/lib/room/room-store";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import type { ClientToServerEvents, EndTurnRequest, MoveTokenRequest, ServerToClientEvents } from "@/types/events";
import type { CoachRole } from "@/types/game";

declare global {
  var __olyIo: Server<ClientToServerEvents, ServerToClientEvents> | undefined;
}

function emitRoomError(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socketId: string,
  message: string,
  roomCode?: string,
) {
  io.to(socketId).emit("roomError", { roomCode, message });
}

function resolveRole(roomCode: string, seatToken: string): CoachRole | null {
  const room = getRoom(roomCode);
  if (!room) {
    return null;
  }

  for (const role of ["A", "B"] as const) {
    if (room.seats[role]?.seatToken === seatToken) {
      return role;
    }
  }

  return null;
}

function publicAuthorizationErrorCode(reason: string) {
  if (reason === "participant_missing" || reason === "room_not_found") {
    return "not_room_participant" as const;
  }
  if (reason === "confirm_token_invalid_or_stale" || reason === "room_save_mismatch") {
    return "stale_save_version" as const;
  }
  if (reason === "host_only_action") {
    return "wrong_phase" as const;
  }
  return "forbidden_team_control" as const;
}

export function ensureSocketServer(httpServer: HttpServer) {
  if (global.__olyIo) {
    return global.__olyIo;
  }

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    socket.on("createRoom", (payload) => {
      const { room, seat } = createRoom(socket.id, payload);
      const participant = room.state.roomParticipants.find((entry) => entry.participantId === seat.participantId)!;
      socket.join(room.roomCode);
      socket.emit("roomJoined", {
        roomCode: room.roomCode,
        role: seat.role,
        participantId: participant.participantId,
        userId: participant.userId,
        seatToken: seat.seatToken,
        state: room.state,
      });
      io.to(room.roomCode).emit("roomState", room.state);
    });

    socket.on("joinRoom", ({ roomCode, displayName }) => {
      const result = joinRoom(roomCode, socket.id, { displayName });
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      const participant = result.room.state.roomParticipants.find((entry) => entry.participantId === result.seat.participantId)!;
      socket.join(result.room.roomCode);
      socket.emit("roomJoined", {
        roomCode: result.room.roomCode,
        role: result.seat.role,
        participantId: participant.participantId,
        userId: participant.userId,
        seatToken: result.seat.seatToken,
        state: result.room.state,
      });
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("rejoinRoom", ({ roomCode, seatToken }) => {
      const result = rejoinRoom(roomCode, seatToken, socket.id);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      const participant = result.room.state.roomParticipants.find((entry) => entry.participantId === result.seat.participantId)!;
      socket.join(result.room.roomCode);
      socket.emit("roomJoined", {
        roomCode: result.room.roomCode,
        role: result.seat.role,
        participantId: participant.participantId,
        userId: participant.userId,
        seatToken: result.seat.seatToken,
        state: result.room.state,
      });
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("applyRoomPreset", ({ roomCode, seatToken, preset }) => {
      const result = applyRoomOwnershipPreset(roomCode, seatToken, preset);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("setReadyState", ({ roomCode, seatToken, ready }) => {
      const result = setParticipantReadyState(roomCode, seatToken, ready);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("startRoom", ({ roomCode, seatToken }) => {
      const result = startRoom(roomCode, seatToken);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("runRoomAiAutoStep", ({ roomCode, seatToken }) => {
      const result = runRoomAiAutoStep(roomCode, seatToken);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("advanceRoomFlow", ({ roomCode, seatToken }) => {
      const result = advanceRoomFlow(roomCode, seatToken);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }

      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("startRoomArena", ({ roomCode, seatToken, seasonId, matchdayId, disciplineSide, maxSlotRevealIndex, maxSlotRevealCountByDiscipline }) => {
      const result = startRoomArenaSync(roomCode, seatToken, {
        seasonId,
        matchdayId,
        disciplineSide,
        maxSlotRevealIndex,
        maxSlotRevealCountByDiscipline,
      });
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      const latestEvent = result.room.state.roomEvents.at(-1) ?? null;
      if (latestEvent) io.to(result.room.roomCode).emit("roomGameplayEvent", latestEvent);
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("setRoomArenaReady", ({ roomCode, seatToken, ready }) => {
      const result = setRoomArenaReadyState(roomCode, seatToken, ready);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      const latestEvent = result.room.state.roomEvents.at(-1) ?? null;
      if (latestEvent) io.to(result.room.roomCode).emit("roomGameplayEvent", latestEvent);
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("advanceRoomArenaStep", ({ roomCode, seatToken, maxSlotRevealIndex, maxSlotRevealCountByDiscipline, force }) => {
      const result = advanceRoomArenaStep(roomCode, seatToken, { maxSlotRevealIndex, maxSlotRevealCountByDiscipline, force });
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      const latestEvent = result.room.state.roomEvents.at(-1) ?? null;
      if (latestEvent) io.to(result.room.roomCode).emit("roomGameplayEvent", latestEvent);
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("authorizeRoomWrite", (payload, callback) => {
      const authorization = authorizeServerRoomWrite({
        roomCode: payload.roomCode,
        participantId: payload.participantId,
        seatToken: payload.seatToken,
        userId: payload.userId,
        saveId: payload.saveId,
        teamId: payload.teamId,
        action: payload.writeAction,
        source: "sqlite",
        dryRun: payload.dryRun ?? true,
        confirmToken: payload.confirmToken,
        expectedConfirmToken: payload.expectedConfirmToken,
      });

      callback(
        authorization.allowed
          ? {
              success: true,
              authorization: {
                allowed: true,
                participantId: authorization.participant?.participantId ?? null,
                teamId: authorization.ownership?.teamId ?? payload.teamId ?? null,
                warnings: authorization.warnings,
              },
            }
          : {
              success: false,
              authorization: {
                allowed: false,
                code: publicAuthorizationErrorCode(authorization.reason),
                reason: authorization.reason,
                status: authorization.status,
                warnings: authorization.warnings,
              },
            },
      );
    });

    socket.on("moveToken", (payload: MoveTokenRequest) => {
      const room = getRoom(payload.roomCode);
      if (!room) {
        emitRoomError(io, socket.id, "Der Raum existiert nicht mehr.", payload.roomCode);
        return;
      }

      const role = resolveRole(payload.roomCode, payload.seatToken);
      if (!role) {
        emitRoomError(io, socket.id, "Dein Sitzplatz ist nicht gueltig.", payload.roomCode);
        return;
      }

      const result = applyMoveToken(room.state, role, payload.tokenId);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, payload.roomCode);
        return;
      }

      room.state = result.state;
      io.to(room.roomCode).emit("roomState", room.state);
    });

    socket.on("endTurn", (payload: EndTurnRequest) => {
      const room = getRoom(payload.roomCode);
      if (!room) {
        emitRoomError(io, socket.id, "Der Raum existiert nicht mehr.", payload.roomCode);
        return;
      }

      const role = resolveRole(payload.roomCode, payload.seatToken);
      if (!role) {
        emitRoomError(io, socket.id, "Dein Sitzplatz ist nicht gueltig.", payload.roomCode);
        return;
      }

      const result = endTurn(room.state, role);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, payload.roomCode);
        return;
      }

      room.state = result.state;
      io.to(room.roomCode).emit("roomState", room.state);
    });

    socket.on("disconnect", () => {
      markDisconnected(socket.id);
    });
  });

  global.__olyIo = io;
  return io;
}
