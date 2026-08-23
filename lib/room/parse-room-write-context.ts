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
 * DIE EINE TABELLE: roher Fehlercode aus dem Server-Write-Guard → deutscher Satz.
 *
 * BEFUND F9 (Aufgabe #44): diese Tabelle gab es laengst, benutzt hat sie aber NUR der
 * Transfermarkt. Im Aufstellungs- und im Trainings-Panel landete stattdessen `payload.error`
 * ungefiltert in der Meldung — der Spieler las dort woertlich `participant_offline`,
 * `host_only_action`, `forbidden_team_control`.
 *
 * Wiederverwendbar war sie so nicht: mehrere Eintraege waren KAUFBEZOGEN formuliert ("… — Kauf
 * aktuell nicht möglich"). In der Aufstellung waere das schlicht falsch gewesen. Deshalb jetzt
 * zweigeteilt statt zweimal geschrieben: hier die kontextfreien Saetze, die ueberall gelten, und
 * darunter genau die Codes, fuer die der Transfermarkt seinen eigenen Ton braucht. Jeder Satz
 * steht weiterhin an genau einer Stelle.
 *
 * Unbekannte, bereits menschenlesbare Texte werden unverändert durchgereicht; leere Eingaben → null.
 */
const ROOM_WRITE_ERROR_MESSAGES: Record<string, string> = {
  // ENTSCHEIDUNG VON CHRIS (19.08.): "keiner von uns soll seinen kader per KI füllen! weg damit."
  // Der Knopf dafuer ist raus; dieser Satz faengt jeden zweiten Weg dorthin ab (alte Lesezeichen,
  // Skripte) und sagt, was stattdessen gilt — statt still nichts zu tun und Erfolg zu melden.
  ai_picks_not_allowed_for_human_team:
    "Für ein selbst geführtes Team gibt es keinen KI-Kaderlauf. Spieler holst du über den Transfermarkt.",
  room_not_found: "Der Raum ist abgelaufen oder existiert nicht mehr.",
  room_context_required_for_room_save: "Raum-Kontext fehlt — bitte den Raum neu öffnen.",
  save_bound_to_different_room: "Dieser Spielstand gehört zu einem anderen Raum.",
  room_save_mismatch: "Dieser Spielstand gehört zu einem anderen Raum.",
  room_save_generic_write_forbidden: "In einem Raum wird der ganze Spielstand nicht am Stück geschrieben — bitte die Aktion einzeln auslösen.",
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
  team_id_required_for_team_write: "Kein Team gewählt.",
  prisma_writes_forbidden_in_local_multiplayer: "Der Referenzmodus ist nur zum Anschauen — hier wird nichts geschrieben.",
};

/**
 * Nur die Codes, bei denen der Transfermarkt den Kauf ausdruecklich benennt. Alles andere faellt
 * auf `ROOM_WRITE_ERROR_MESSAGES` durch — es gibt bewusst KEINE zweite Volltabelle.
 */
const MARKET_PREVIEW_ERROR_OVERRIDES: Record<string, string> = {
  room_not_found: "Raum abgelaufen — Kauf aktuell nicht möglich.",
  room_context_required_for_room_save: "Raum-Kontext fehlt — Kauf aktuell nicht möglich.",
  save_bound_to_different_room: "Dieser Spielstand gehört zu einem anderen Raum — Kauf nicht möglich.",
  room_save_mismatch: "Dieser Spielstand gehört zu einem anderen Raum — Kauf nicht möglich.",
  team_id_required_for_team_write: "Kein Team gewählt — Kauf aktuell nicht möglich.",
  prisma_writes_forbidden_in_local_multiplayer: "In diesem Modus sind Käufe nicht möglich.",
};

function trimOrNull(code: string | null | undefined): string | null {
  if (typeof code !== "string") {
    return null;
  }
  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Strenge Variante: nur ein BEKANNTER Code liefert einen Satz, sonst `null`. Wer zwischen
 * "übersetzt" und "war gar kein Code" unterscheiden muss, fragt hier.
 */
export function lookupRoomWriteErrorMessage(code: string | null | undefined): string | null {
  const trimmed = trimOrNull(code);
  return trimmed == null ? null : ROOM_WRITE_ERROR_MESSAGES[trimmed] ?? null;
}

/**
 * Anzeigevariante fuer beliebige Fehlerlisten: bekannter Code → Satz, alles andere unverändert
 * durchgereicht (dort stehen die Validierungstexte der Speicherroute, die bereits Deutsch sind).
 */
export function formatRoomWriteErrorCode(code: string | null | undefined): string | null {
  const trimmed = trimOrNull(code);
  if (trimmed == null) {
    return null;
  }
  return ROOM_WRITE_ERROR_MESSAGES[trimmed] ?? trimmed;
}

export function formatMarketPreviewError(code: string | null | undefined): string | null {
  const trimmed = trimOrNull(code);
  if (trimmed == null) {
    return null;
  }
  return MARKET_PREVIEW_ERROR_OVERRIDES[trimmed] ?? formatRoomWriteErrorCode(trimmed);
}

export function describeRoomWriteError(payload: unknown): string | null {
  // Frueher standen hier drei fest verdrahtete `if`-Zweige mit denselben drei Saetzen, die auch in
  // der Tabelle stehen — eine zweite Quelle fuer dieselbe Groesse. Jetzt fragt diese Funktion die
  // Tabelle; unbekannte Codes fallen unveraendert auf `payload.error` durch wie zuvor.
  const known = lookupRoomWriteErrorMessage(readRoomWriteErrorCode(payload));
  if (known) {
    return known;
  }
  if (payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string") {
    return formatRoomWriteErrorCode((payload as { error: string }).error);
  }
  return null;
}
