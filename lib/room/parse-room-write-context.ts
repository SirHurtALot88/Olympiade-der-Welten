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

/**
 * Rohe Raum-/Markt-Fehlercodes (z. B. aus dem Server-Write-Guard oder der
 * Buy-Route) → freundliche deutsche Meldung. Unbekannte, bereits menschenlesbare
 * Texte werden unverändert durchgereicht; leere Eingaben → null.
 */
const MARKET_PREVIEW_ERROR_MESSAGES: Record<string, string> = {
  room_not_found: "Raum abgelaufen — Kauf aktuell nicht möglich.",
  room_context_required_for_room_save: "Raum-Kontext fehlt — Kauf aktuell nicht möglich.",
  save_bound_to_different_room: "Dieser Spielstand gehört zu einem anderen Raum — Kauf nicht möglich.",
  room_save_mismatch: "Dieser Spielstand gehört zu einem anderen Raum — Kauf nicht möglich.",
  not_room_participant: "Du bist in diesem Raum nicht angemeldet.",
  participant_missing: "Du bist in diesem Raum nicht angemeldet.",
  user_participant_mismatch: "Dieser Sitzplatz gehört zu einem anderen Spieler.",
  participant_offline: "Deine Verbindung zum Raum ist getrennt — bitte neu verbinden und erneut versuchen.",
  host_only_action: "Nur der Host kann diese Aktion ausführen.",
  forbidden_team_control: "Diese Aktion ist für dein Team in diesem Raum nicht erlaubt.",
  local_team_not_owned_or_ai_controlled: "Diese Aktion ist für dein Team in diesem Raum nicht erlaubt.",
  confirm_token_invalid_or_stale: "Bestätigung veraltet — bitte erneut versuchen.",
  stale_save_version: "Der Save-Stand ist veraltet. Bitte neu laden und die Aktion wiederholen.",
  save_not_found: "Spielstand nicht gefunden — bitte neu laden.",
  team_id_required_for_team_write: "Kein Team gewählt — Kauf aktuell nicht möglich.",
  prisma_writes_forbidden_in_local_multiplayer: "In diesem Modus sind Käufe nicht möglich.",
};

export function formatMarketPreviewError(code: string | null | undefined): string | null {
  if (typeof code !== "string") {
    return null;
  }
  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return MARKET_PREVIEW_ERROR_MESSAGES[trimmed] ?? trimmed;
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
