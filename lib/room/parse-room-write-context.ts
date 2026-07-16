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

function readRoomWriteStringField(source: Record<string, unknown>, key: keyof ParsedRoomWriteContext): string | null {
  const value = source[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRoomWriteControlMode(source: Record<string, unknown>): ParsedRoomWriteContext["controlMode"] {
  const value = readRoomWriteStringField(source, "controlMode");
  if (value === "human" || value === "ai" || value === "passive" || value === "manual") {
    return value;
  }
  return null;
}

export function parseRoomWriteContextFromBody(body: Record<string, unknown> | null | undefined): Partial<ParsedRoomWriteContext> {
  if (!body || typeof body !== "object") {
    return {};
  }

  return {
    roomCode: readRoomWriteStringField(body, "roomCode"),
    participantId: readRoomWriteStringField(body, "participantId"),
    seatToken: readRoomWriteStringField(body, "seatToken"),
    userId: readRoomWriteStringField(body, "userId"),
    activeManagerTeamId: readRoomWriteStringField(body, "activeManagerTeamId"),
    activeOwnerId: readRoomWriteStringField(body, "activeOwnerId"),
    controlMode: readRoomWriteControlMode(body),
  };
}

export function mergeRoomWriteContext(
  fromParams: ParsedRoomWriteContext,
  fromBody: Partial<ParsedRoomWriteContext>,
): ParsedRoomWriteContext {
  return {
    roomCode: fromBody.roomCode ?? fromParams.roomCode,
    participantId: fromBody.participantId ?? fromParams.participantId,
    seatToken: fromBody.seatToken ?? fromParams.seatToken,
    userId: fromBody.userId ?? fromParams.userId,
    activeManagerTeamId: fromBody.activeManagerTeamId ?? fromParams.activeManagerTeamId,
    activeOwnerId: fromBody.activeOwnerId ?? fromParams.activeOwnerId,
    controlMode: fromBody.controlMode ?? fromParams.controlMode,
  };
}

export function parseRoomWriteContextFromRequestAndBody(
  request: Request,
  body?: Record<string, unknown> | null,
): ParsedRoomWriteContext {
  return mergeRoomWriteContext(parseRoomWriteContextFromRequest(request), parseRoomWriteContextFromBody(body));
}

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
