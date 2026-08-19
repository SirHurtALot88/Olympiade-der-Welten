import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import {
  applyRoomOwnershipPreset,
  applyRoomTeamSelection,
  advanceRoomArenaStep,
  advanceRoomFlow,
  createRoom,
  getRoom,
  joinRoom,
  markDisconnected,
  quickSimRoomArenaRevealState,
  setRoomArenaDisciplinePhaseState,
  rejoinRoom,
  resetRoomArenaRevealState,
  runRoomAiAutoStep,
  setRoomArenaPausedState,
  setRoomArenaReadyState,
  setParticipantReadyState,
  startRoomArenaSync,
  startRoom,
} from "@/lib/room/room-store";
import { UnknownRoomOwnershipPresetError } from "@/lib/room/online-room-model";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
// WICHTIG: aus lib/auth/session-cookie importieren, NICHT aus lib/auth/session -
// letzteres importiert next/headers, was hier (server.ts laedt dieses Modul vor
// der Next.js-App-Initialisierung) zum Absturz fuehrt. Siehe Kommentar dort.
import { getSessionUserFromCookieHeader } from "@/lib/auth/session-cookie";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/events";

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
    // Vorgabe waere pingInterval=25000/pingTimeout=20000 -> maximal 45s bis ein ausbleibender
    // Pong als Disconnect gilt. Der Liga-Draft (kickoffLeagueSetupDraft, ~40s synchron, siehe
    // lib/game/league-setup-draft-service.ts) blockiert genau in dieser Groessenordnung die
    // Event-Loop dieses Custom-Servers - waehrenddessen kann der Server ueberhaupt keinen Pong
    // verarbeiten, egal wie kurz das Zeitfenster ist. 45s reicht damit kaum, 60s pingTimeout gibt
    // ~2x Marge auf den EINEN gemessenen Wert.
    //
    // NACHTEIL, nicht nur Kosmetik: ein WIRKLICH abgebrochener Client (Tab zu, Laptop zu) wird
    // jetzt erst nach bis zu pingInterval+pingTimeout = 85s als offline erkannt statt nach 45s -
    // 40s laenger "Warten auf <Name>" fuer den verbliebenen Mitspieler, bevor der Server ueberhaupt
    // reagiert.
    //
    // Das ist bewusst NUR Linderung: andere schwere Routen ohne eigene Messung (Spieltags-
    // Aufloesung, KI-Markt-Batches, Standings-Apply - siehe Bericht) koennten laenger als 40s
    // laufen und dieses Fenster trotzdem reissen. Die eigentliche Heilung ist serverseitig in
    // `authorizeServerRoomWrite` (lib/room/server-authoritative-write-guard.ts): ein Schreibvorgang
    // mit gueltigem Sitzplatz-Token stellt die Praesenz wieder her, UNABHAENGIG davon, wie lange
    // die Event-Loop blockiert war - dieser Wert hier verkleinert nur, wie oft es ueberhaupt dazu
    // kommt.
    pingTimeout: 60_000,
  });

  io.on("connection", (socket) => {
    // Phase-1-Login (nur aktiv bei OLY_AUTH_ENABLED=1): die Session kommt aus dem
    // Cookie des Handshake-Requests, nicht aus dem Client-Payload - so kann sich
    // niemand per createRoom/joinRoom-Payload als eine andere Person ausgeben.
    // Bei deaktiviertem Login ist sessionUser immer null (unveraendertes Verhalten).
    const sessionUser = getSessionUserFromCookieHeader(socket.handshake.headers.cookie);

    socket.on("createRoom", (payload) => {
      /**
       * GEMESSEN, nicht vermutet (Paket 3, docs/MULTIPLAYER_MODI_1V1_2V2_PLAN.md): schickt ein
       * Client einen Modus-Namen, den DIESER Serverstand nicht kennt, warf `createRoom` bis hier
       * ungefangen durch -- `buildOwnershipForPreset` wirft seit Paket 1
       * `UnknownRoomOwnershipPresetError` (richtig so: vorher vergab derselbe Fall still vier
       * Teams). Sonde gegen den laufenden Server: der Client bekam WEDER `roomJoined` NOCH
       * `roomError` -- er haengt stumm --, und der Wurf landete als `uncaughtException`. Dass der
       * Prozess weiterlief, verdankte er allein dem Auffangnetz des Next-Dev-Servers; ein eigenes
       * gibt es nicht (kein `process.on("uncaughtException")` in server.ts).
       *
       * DER REALE WEG DORTHIN ist ein Deploy: nach dem Umbenennen oder Entfernen eines Modus
       * schickt jeder noch offene Browser-Tab weiter den alten Namen. Deshalb hier gefangen und
       * als gewoehnliche, lesbare Ablehnung gemeldet -- derselbe `roomError`-Weg, den jede andere
       * Ablehnung in dieser Datei nimmt und den der Foundation-Client seit Befund F6 anzeigt, ohne
       * die Bedienleiste wegzuraeumen.
       *
       * Bewusst NUR dieser eine Fehlertyp: alles andere fliegt weiter, damit ein echter
       * Programmfehler nicht als hoefliche Meldung verschwindet.
       */
      let erstellterRaum: ReturnType<typeof createRoom>;
      try {
        erstellterRaum = createRoom(socket.id, payload, sessionUser);
      } catch (error) {
        if (error instanceof UnknownRoomOwnershipPresetError) {
          emitRoomError(
            io,
            socket.id,
            "Dieser Spiel-Modus ist dem Server nicht bekannt. Bitte die Seite neu laden und den Modus erneut wählen.",
          );
          return;
        }
        throw error;
      }
      const { room, seat } = erstellterRaum;
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
      const result = joinRoom(roomCode, socket.id, { displayName }, sessionUser);
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

    socket.on("setTeamSelection", ({ roomCode, seatToken, chrisTeamIds, frankyTeamIds }) => {
      const result = applyRoomTeamSelection(roomCode, seatToken, { chrisTeamIds, frankyTeamIds });
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

    socket.on("advanceRoomFlow", ({ roomCode, seatToken, getrennteUeberspringen }) => {
      const result = advanceRoomFlow(roomCode, seatToken, { getrennteUeberspringen });
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

    socket.on(
      "advanceRoomArenaStep",
      ({ roomCode, seatToken, maxSlotRevealIndex, maxSlotRevealCountByDiscipline, force, getrennteUeberspringen }) => {
      const result = advanceRoomArenaStep(roomCode, seatToken, {
        maxSlotRevealIndex,
        maxSlotRevealCountByDiscipline,
        force,
        getrennteUeberspringen,
      });
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      const latestEvent = result.room.state.roomEvents.at(-1) ?? null;
      if (latestEvent) io.to(result.room.roomCode).emit("roomGameplayEvent", latestEvent);
      io.to(result.room.roomCode).emit("roomState", result.room.state);
      },
    );

    // Stufe 3.6: letzte Meile fuer Pause/Reset/Quick-Sim als Raum-Aktion — reine Weiterleitung an
    // die Huellen aus room-store.ts, danach der Raum-Zustand-Broadcast wie bei jedem anderen
    // Room-Write (kein eigener `roomEvents`-Eintrag, siehe Kommentar dort: reine Verkabelung,
    // keine neue Mechanik).
    socket.on("setRoomArenaPaused", ({ roomCode, seatToken, paused }) => {
      const result = setRoomArenaPausedState(roomCode, seatToken, paused);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("resetRoomArenaReveal", ({ roomCode, seatToken }) => {
      const result = resetRoomArenaRevealState(roomCode, seatToken);
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    socket.on("quickSimRoomArenaReveal", ({ roomCode, seatToken, maxSlotRevealCountByDiscipline }) => {
      const result = quickSimRoomArenaRevealState(roomCode, seatToken, { maxSlotRevealCountByDiscipline });
      if (!result.ok) {
        emitRoomError(io, socket.id, result.error, roomCode);
        return;
      }
      io.to(result.room.roomCode).emit("roomState", result.room.state);
    });

    // Der Diszi-Wechsel bekommt — anders als Pause/Reset/Quick-Sim — auch den
    // `roomGameplayEvent`-Broadcast, weil `setRoomArenaDisciplinePhaseState` einen echten
    // `roomEvents`-Eintrag schreibt (Begruendung dort).
    socket.on("setRoomArenaDisciplinePhase", ({ roomCode, seatToken, phase, maxSlotRevealCountByDiscipline }) => {
      const result = setRoomArenaDisciplinePhaseState(roomCode, seatToken, { phase, maxSlotRevealCountByDiscipline });
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

    socket.on("disconnect", () => {
      // Den neuen Stand auch senden: `markDisconnected` nimmt den Teilnehmer aus der
      // Bereit-Pflicht, aber ohne Broadcast erfaehrt der verbliebene Spieler das erst beim
      // naechsten beliebigen Ereignis und wartet solange auf jemanden, der gar nicht mehr da ist.
      for (const room of markDisconnected(socket.id)) {
        io.to(room.roomCode).emit("roomState", room.state);
      }
    });
  });

  global.__olyIo = io;
  return io;
}
