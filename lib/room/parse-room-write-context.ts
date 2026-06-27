export function parseRoomWriteContextFromSearchParams(searchParams: URLSearchParams) {
  return {
    roomCode: searchParams.get("roomCode"),
    participantId: searchParams.get("participantId"),
    seatToken: searchParams.get("seatToken"),
    userId: searchParams.get("userId"),
    activeManagerTeamId: searchParams.get("activeManagerTeamId"),
    activeOwnerId: searchParams.get("activeOwnerId"),
    controlMode: searchParams.get("controlMode") as "human" | "ai" | "passive" | "manual" | null,
  };
}

export function parseRoomWriteContextFromRequest(request: Request) {
  return parseRoomWriteContextFromSearchParams(new URL(request.url).searchParams);
}

export type ParsedRoomWriteContext = ReturnType<typeof parseRoomWriteContextFromSearchParams>;

export function readRoomWriteErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function isStaleSaveVersionError(payload: unknown) {
  return readRoomWriteErrorCode(payload) === "stale_save_version";
}

export function describeRoomWriteError(payload: unknown): string | null {
  const code = readRoomWriteErrorCode(payload);
  if (code === "stale_save_version") {
    return "Der Save-Stand ist veraltet. Bitte neu laden und die Aktion wiederholen.";
  }
  if (code === "forbidden_team_control") {
    return "Diese Aktion ist für dein Team in diesem Raum nicht erlaubt.";
  }
  if (code === "not_room_participant") {
    return "Du bist in diesem Raum nicht angemeldet.";
  }
  if (payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string") {
    return (payload as { error: string }).error;
  }
  return null;
}
