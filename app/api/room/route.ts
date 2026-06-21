export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  advanceRoomFlow,
  advanceRoomArenaStep,
  createRoom,
  getRoom,
  joinRoom,
  rejoinRoom,
  runRoomAiAutoStep,
  setRoomArenaReadyState,
  setParticipantReadyState,
  startRoomArenaSync,
  startRoom,
} from "@/lib/room/room-store";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import type { RoomOwnershipPreset } from "@/types/events";
import type { TeamWriteAction } from "@/lib/room/online-room-model";

type RoomPostBody = {
  action?: "create" | "join" | "rejoin" | "ready" | "start" | "aiAutoStep" | "advance" | "arenaStart" | "arenaReady" | "arenaNextStep" | "authorizeWrite";
  roomCode?: string | null;
  displayName?: string | null;
  saveId?: string | null;
  preset?: RoomOwnershipPreset | null;
  seatToken?: string | null;
  participantId?: string | null;
  userId?: string | null;
  teamId?: string | null;
  writeAction?: TeamWriteAction | null;
  ready?: boolean | null;
  dryRun?: boolean | null;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
  seasonId?: string | null;
  matchdayId?: string | null;
  disciplineSide?: "d1" | "d2" | "overall" | null;
  maxSlotRevealIndex?: number | null;
  force?: boolean | null;
};

function publicRoomPayload(roomCode: string) {
  const room = getRoom(roomCode);
  if (!room) {
    return null;
  }
  return {
    roomCode: room.roomCode,
    state: room.state,
    seats: Object.fromEntries(
      Object.entries(room.seats).map(([role, seat]) => [
        role,
        seat
          ? {
              role: seat.role,
              participantId: seat.participantId,
              connected: seat.connected,
              joinedAt: seat.joinedAt,
            }
          : null,
      ]),
    ),
  };
}

function publicAuthorizationErrorCode(reason: string) {
  if (reason === "participant_missing" || reason === "room_not_found") {
    return "not_room_participant";
  }
  if (reason === "confirm_token_invalid_or_stale") {
    return "stale_save_version";
  }
  if (reason === "room_save_mismatch") {
    return "stale_save_version";
  }
  if (reason === "host_only_action") {
    return "wrong_phase";
  }
  return "forbidden_team_control";
}

export async function GET(request: Request) {
  const roomCode = new URL(request.url).searchParams.get("roomCode")?.trim() ?? "";
  if (!roomCode) {
    return NextResponse.json({ success: false, error: "roomCode is required." }, { status: 400 });
  }
  const payload = publicRoomPayload(roomCode);
  if (!payload) {
    return NextResponse.json({ success: false, error: "room_not_found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, room: payload });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RoomPostBody;
  const action = body.action ?? "create";
  const socketId = `http-${crypto.randomUUID()}`;

  if (action === "create") {
    const created = createRoom(socketId, {
      displayName: body.displayName,
      saveId: body.saveId,
      preset: body.preset,
    });
    return NextResponse.json({
      success: true,
      room: publicRoomPayload(created.room.roomCode),
      seat: created.seat,
      user: {
        userId: created.room.state.roomParticipants[0]?.userId ?? null,
        displayName: created.room.state.roomParticipants[0]?.displayName ?? body.displayName ?? "Chris",
        role: "host",
      },
    });
  }

  if (action === "join") {
    const roomCode = body.roomCode?.trim() ?? "";
    if (!roomCode) {
      return NextResponse.json({ success: false, error: "roomCode is required." }, { status: 400 });
    }
    const joined = joinRoom(roomCode, socketId, { displayName: body.displayName });
    if (!joined.ok) {
      return NextResponse.json({ success: false, error: joined.error }, { status: 404 });
    }
    const participant = joined.room.state.roomParticipants.find((entry) => entry.participantId === joined.seat.participantId);
    return NextResponse.json({
      success: true,
      room: publicRoomPayload(joined.room.roomCode),
      seat: joined.seat,
      user: {
        userId: participant?.userId ?? null,
        displayName: participant?.displayName ?? body.displayName ?? "Franky",
        role: participant?.role ?? "player",
      },
    });
  }

  if (action === "rejoin") {
    const roomCode = body.roomCode?.trim() ?? "";
    const seatToken = body.seatToken?.trim() ?? "";
    if (!roomCode || !seatToken) {
      return NextResponse.json({ success: false, error: "roomCode and seatToken are required." }, { status: 400 });
    }
    const rejoined = rejoinRoom(roomCode, seatToken, socketId);
    if (!rejoined.ok) {
      return NextResponse.json({ success: false, error: rejoined.error }, { status: 401 });
    }
    const participant = rejoined.room.state.roomParticipants.find((entry) => entry.participantId === rejoined.seat.participantId);
    return NextResponse.json({
      success: true,
      room: publicRoomPayload(rejoined.room.roomCode),
      seat: rejoined.seat,
      user: {
        userId: participant?.userId ?? null,
        displayName: participant?.displayName ?? "Player",
        role: participant?.role ?? "player",
      },
    });
  }

  if (action === "ready") {
    const roomCode = body.roomCode?.trim() ?? "";
    const seatToken = body.seatToken?.trim() ?? "";
    const result = setParticipantReadyState(roomCode, seatToken, body.ready ?? true);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "start") {
    const result = startRoom(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "");
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "aiAutoStep") {
    const result = runRoomAiAutoStep(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "");
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "advance") {
    const result = advanceRoomFlow(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "");
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "arenaStart") {
    const result = startRoomArenaSync(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "", {
      seasonId: body.seasonId,
      matchdayId: body.matchdayId,
      disciplineSide: body.disciplineSide,
      maxSlotRevealIndex: body.maxSlotRevealIndex,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "arenaReady") {
    const result = setRoomArenaReadyState(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "", body.ready ?? true);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "arenaNextStep") {
    const result = advanceRoomArenaStep(body.roomCode?.trim() ?? "", body.seatToken?.trim() ?? "", {
      maxSlotRevealIndex: body.maxSlotRevealIndex,
      force: body.force,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ success: true, room: publicRoomPayload(result.room.roomCode) });
  }

  if (action === "authorizeWrite") {
    const authorization = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId: body.saveId ?? "",
      teamId: body.teamId,
      action: body.writeAction ?? "buy",
      source: "sqlite",
      dryRun: body.dryRun ?? true,
      confirmToken: body.confirmToken,
      expectedConfirmToken: body.expectedConfirmToken,
    });
    return NextResponse.json(
      {
        success: authorization.allowed,
        authorization: authorization.allowed
          ? {
              allowed: true,
              participantId: authorization.participant?.participantId ?? null,
              teamId: authorization.ownership?.teamId ?? body.teamId ?? null,
              warnings: authorization.warnings,
            }
          : {
              allowed: false,
              code: publicAuthorizationErrorCode(authorization.reason),
              reason: authorization.reason,
              status: authorization.status,
              warnings: authorization.warnings,
            },
      },
      { status: authorization.allowed ? 200 : authorization.status },
    );
  }

  return NextResponse.json({ success: false, error: "unsupported_room_action" }, { status: 400 });
}
