"use client";

export type FoundationRoomContext = {
  roomCode: string;
  participantId: string;
  userId: string;
  seatToken: string;
  saveId: string;
};

function normalizedParam(params: URLSearchParams, key: keyof FoundationRoomContext) {
  return params.get(key)?.trim() ?? "";
}

function seatStorageKey(roomCode: string) {
  return `oly-seat:${roomCode.toUpperCase()}`;
}

export function readFoundationRoomContextFromLocation(): FoundationRoomContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const roomCode = normalizedParam(params, "roomCode").toUpperCase();
  const participantId = normalizedParam(params, "participantId");
  const userId = normalizedParam(params, "userId");
  const saveId = normalizedParam(params, "saveId");
  const seatToken = normalizedParam(params, "seatToken") || (roomCode ? localStorage.getItem(seatStorageKey(roomCode))?.trim() ?? "" : "");

  if (!roomCode || !participantId || !userId || !seatToken || !saveId) {
    return null;
  }

  return { roomCode, participantId, userId, seatToken, saveId };
}

export function appendRoomContextToParams(params: URLSearchParams, context: FoundationRoomContext | null) {
  if (!context) {
    return params;
  }
  params.set("roomCode", context.roomCode);
  params.set("participantId", context.participantId);
  params.set("userId", context.userId);
  params.set("seatToken", context.seatToken);
  params.set("saveId", context.saveId);
  return params;
}

export function withRoomContextBody<T extends Record<string, unknown>>(body: T, context: FoundationRoomContext | null): T {
  if (!context) {
    return body;
  }
  return {
    ...body,
    roomCode: context.roomCode,
    participantId: context.participantId,
    userId: context.userId,
    seatToken: context.seatToken,
    saveId: context.saveId,
  };
}
