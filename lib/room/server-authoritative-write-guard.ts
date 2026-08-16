import { getActiveRoomBySaveId, getRoom, healParticipantPresenceByToken } from "@/lib/room/room-store";
import { findSeatByToken } from "@/lib/room/rejoin";
import { assertSaveNotRoomBound } from "@/lib/room/assert-save-not-room-bound";
import { authorizeTeamWrite, type TeamWriteAction } from "@/lib/room/online-room-model";
import { DEFAULT_ACTIVE_OWNER_ID, canLocalUserManageTeam } from "@/lib/foundation/team-control-settings";
import { canFoundationLocalUserManageTeam } from "@/lib/foundation/foundation-admin-dev-flags";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { broadcastRoomGameplayUpdate } from "@/lib/socket/room-gameplay-broadcast";
import type { RoomParticipant, TeamControllerType, TeamOwnershipRecord } from "@/types/game";
import type { RuntimeRoom } from "@/types/room";

export type ServerWriteSource = "sqlite" | "prisma";

export type ServerRoomWriteContext = {
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  saveId: string;
  teamId?: string | null;
  action: TeamWriteAction;
  source?: ServerWriteSource;
  dryRun?: boolean;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
  activeManagerTeamId?: string | null;
  /**
   * NUR AUSSERHALB eines Raums relevant (siehe `authorizeLocalSingleplayerTeamWrite` unten) — im
   * Raum entscheidet ausschliesslich das Sitz-Token (`resolveParticipant`/`authorizeTeamWrite`),
   * dieses Feld wird dort nie gelesen.
   *
   * MUSS serverseitig aufgeloest sein — NIE roh aus dem Request-Body oder der Query durchreichen.
   * Stufe 0.3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Befund B2): bis eben las
   * `authorizeLocalSingleplayerTeamWrite` diesen Wert direkt aus dem Client-Body, und der Client
   * schickte dort nicht die eigene Identitaet, sondern die Owner-ID des ZIELTEAMS
   * (use-foundation-shell-router-body-scope.tsx:1352-1368) — der Besitzvergleich war damit fuer
   * jedes `manual`-Team immer wahr. Aufrufer holen den echten Wert ueber
   * `resolveAuthoritativeWriteOwnerId()` (lib/auth/session.ts): angemeldete Sitzung, sonst der
   * lokale Standard-Owner. Diese Datei importiert diese Funktion bewusst NICHT selbst — sie haengt
   * an `next/headers`, und dieses Modul wird auch vom socket.io-Server geladen, der ausserhalb
   * jedes Next.js-Request-Kontexts laeuft (siehe Kommentar an lib/auth/session-cookie.ts).
   */
  activeOwnerId?: string | null;
  controlMode?: TeamControllerType | "manual" | null;
  allowSandboxHostOverride?: boolean;
};

export type ServerRoomWriteAllowed = {
  allowed: true;
  room: RuntimeRoom | null;
  participant: RoomParticipant | null;
  ownership: TeamOwnershipRecord | null;
  warnings: string[];
};

export type ServerRoomWriteBlocked = {
  allowed: false;
  status: 401 | 403 | 404 | 409;
  reason: string;
  warnings: string[];
};

export type ServerRoomWriteAuthorization = ServerRoomWriteAllowed | ServerRoomWriteBlocked;

const HOST_LEVEL_ACTIONS = new Set<TeamWriteAction>([
  "formcards_season_regenerate",
  "lineup_ai_batch_apply",
  "ai_preseason_background",
  "ai_picks_run_execute",
  "ai_market_plan_apply",
  "ai_roster_fill_execute",
  "ai_xp_spend_apply",
  "matchday_resolve",
  "season_transition",
  "season_completion",
  "cash_prize_apply",
  "standings_apply",
  // Player-Generator commit inserts a brand-new free agent into the shared
  // save — it isn't a team-owned write (no roster/team is touched), so it
  // has no natural `teamId` to authorize against. Treating it as host-level
  // means: unrestricted in local singleplayer (no active room), host-only
  // in a room, exactly like the other save-wide admin actions above.
  "player_generator_commit",
]);

function resolveParticipant(room: RuntimeRoom, input: ServerRoomWriteContext): RoomParticipant | null {
  if (input.participantId) {
    return room.state.roomParticipants.find((participant) => participant.participantId === input.participantId) ?? null;
  }
  if (input.seatToken) {
    const role = findSeatByToken(room, input.seatToken);
    const participantId = role ? room.seats[role]?.participantId : null;
    return participantId
      ? room.state.roomParticipants.find((participant) => participant.participantId === participantId) ?? null
      : null;
  }
  return null;
}

function isSandboxLikeSave(saveId: string) {
  return /sandbox|manager|test|local/i.test(saveId);
}

/**
 * Wer hat `saveId` urspruenglich angelegt? Direkter, ungecachter SQLite-Read auf dieselbe Spalte,
 * die `save-repository.ts` beim Anlegen schreibt (`created_by`, siehe `tests/save-created-by.test.ts`)
 * — dasselbe Zugriffsmuster wie `room-persistence.ts` (`getDatabase()` direkt statt ueber die
 * Persistence-Fassade), weil `getSaveById()`/`PersistedSaveGame` diese Spalte NICHT mitfuehrt
 * (`loadSaveRow` selektiert sie nicht — nur `listSaves()` tut das, und das ist fuer einen
 * Schreibvorgang je Team zu teuer). `null`, wenn die Spalte leer ist (Alt-Save von vor der Spalte
 * oder ohne Login angelegt) — Befund B3 unten greift dann bewusst nicht.
 */
function resolveSaveCreatedByOwnerId(saveId: string): string | null {
  const database = getDatabase();
  const row = database.prepare(`SELECT created_by FROM saves WHERE save_id = ?`).get(saveId) as
    | { created_by?: string | null }
    | undefined;
  return row?.created_by ? row.created_by : null;
}

function authorizeLocalSingleplayerTeamWrite(input: ServerRoomWriteContext, warnings: string[]): ServerRoomWriteAuthorization {
  if (HOST_LEVEL_ACTIONS.has(input.action)) {
    return {
      allowed: true,
      room: null,
      participant: null,
      ownership: null,
      warnings,
    };
  }

  if (!input.teamId) {
    return { allowed: false, status: 409, reason: "team_id_required_for_team_write", warnings };
  }

  const save = createPersistenceService().getSaveById(input.saveId);
  if (!save) {
    return {
      allowed: true,
      room: null,
      participant: null,
      ownership: null,
      warnings: [...warnings, "local_team_ownership_unverified_save_not_found"],
    };
  }

  const activeOwnerId = input.activeOwnerId?.trim() || DEFAULT_ACTIVE_OWNER_ID;
  const ownsAsResolvedIdentity = canLocalUserManageTeam(save.gameState, input.teamId, activeOwnerId);

  // BEFUND B3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md), Regression aus Stufe 0.3: `lib/game/new-game-
  // setup-service.ts` legt jedes Solo-Team (egal wer eingeloggt ist) auf den generischen Standard-
  // Platz `DEFAULT_ACTIVE_OWNER_ID` ("der eine lokale Mensch", historisch "Chris" genannt) — nicht
  // auf die reale Sitzungs-`ownerId` des Anlegenden. Mit aktivem Login (`OLY_AUTH_ENABLED=1`) ist
  // Chris' Sitzungs-ID zufaellig identisch mit diesem Standard-Platz, Frankys nicht
  // (`franky_remote_placeholder`) — er fiel deshalb selbst in seinem EIGENEN Solo-Save auf jedem
  // team-bezogenen Schreibvorgang durch `local_team_not_owned_or_ai_controlled`.
  //
  // DER FIX GREIFT NUR UNTER DREI BEDINGUNGEN GLEICHZEITIG: (1) die direkte Identitaets-Pruefung
  // ist bereits gescheitert, (2) das Team haengt WEITERHIN am generischen Standard-Platz (ein Team,
  // das explizit dem JEWEILS ANDEREN benannten Menschen gehoert — z. B. Frankys Team in Chris'
  // Save — bleibt exakt so gesperrt wie vorher, siehe `tests/identitaet-kommt-vom-server.test.ts`
  // Eigenschaft 1), UND (3) `activeOwnerId` ist der URHEBER dieses konkreten Saves
  // (`created_by`, save-repository.ts) — NICHT irgendeine beliebige zweite Identitaet. Damit
  // bleibt die Identitaet weiterhin serverseitig aufgeloest (nie aus dem Body, siehe Kommentar an
  // `activeOwnerId` oben) — es wird nur die Frage "wessen Save ist das" um eine zweite, ebenfalls
  // serverseitige Quelle ergaenzt.
  const ownsAsSaveCreatorOnDefaultSlot =
    !ownsAsResolvedIdentity &&
    activeOwnerId !== DEFAULT_ACTIVE_OWNER_ID &&
    canLocalUserManageTeam(save.gameState, input.teamId, DEFAULT_ACTIVE_OWNER_ID) &&
    resolveSaveCreatedByOwnerId(input.saveId) === activeOwnerId;

  if (!canFoundationLocalUserManageTeam(ownsAsResolvedIdentity || ownsAsSaveCreatorOnDefaultSlot)) {
    return {
      allowed: false,
      status: 403,
      reason: "local_team_not_owned_or_ai_controlled",
      warnings,
    };
  }

  return {
    allowed: true,
    room: null,
    participant: null,
    ownership: null,
    warnings: ownsAsSaveCreatorOnDefaultSlot ? [...warnings, "source:local_team_owned_via_save_creator"] : warnings,
  };
}

export function isRoomWriteContextPresent(input: Pick<ServerRoomWriteContext, "roomCode" | "participantId" | "seatToken" | "userId">) {
  return Boolean(input.roomCode || input.participantId || input.seatToken || input.userId);
}

export function authorizeServerRoomWrite(input: ServerRoomWriteContext): ServerRoomWriteAuthorization {
  const warnings: string[] = [];
  const source = input.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    return {
      allowed: false,
      status: 409,
      reason: "prisma_writes_forbidden_in_local_multiplayer",
      warnings,
    };
  }

  const activeRoomForSave = getActiveRoomBySaveId(input.saveId);

  if (!input.roomCode) {
    if (activeRoomForSave) {
      return {
        allowed: false,
        status: 401,
        reason: "room_context_required_for_room_save",
        warnings,
      };
    }
    // Stufe 0.2 (Befund B1): `activeRoomForSave` ist null hier NICHT nur, wenn der Save nie an
    // einen Raum gebunden war — auch dann, wenn er es WAR, der Raum aber im Moment aus der
    // In-Memory-Map nicht auffindbar ist (Neustart kurz vor dem Rehydrieren, echter Verlust).
    // Ohne diese Pruefung wuerde genau das still auf den Einzelspieler-Pfad durchrutschen — beide
    // Browser schreiben unbemerkt weiter in denselben Spielstand, ohne dass je wieder gebroadcastet
    // wird. `assertSaveNotRoomBound` fragt zusaetzlich die persistierte Ablage (room-persistence.ts)
    // und faengt so auch den Fall, den die In-Memory-Map allein nicht mehr sieht.
    const roomBoundCheck = assertSaveNotRoomBound(input.saveId, "server_room_write_fallback");
    if (roomBoundCheck.blocked) {
      return {
        allowed: false,
        status: roomBoundCheck.status,
        reason: roomBoundCheck.reason,
        warnings,
      };
    }
    return authorizeLocalSingleplayerTeamWrite(input, warnings);
  }

  const room = getRoom(input.roomCode);
  if (!room) {
    return { allowed: false, status: 404, reason: "room_not_found", warnings };
  }

  if (activeRoomForSave && activeRoomForSave.roomCode !== room.roomCode) {
    return {
      allowed: false,
      status: 409,
      reason: "save_bound_to_different_room",
      warnings,
    };
  }

  if (room.state.multiplayerRoom.saveId !== input.saveId) {
    return {
      allowed: false,
      status: 409,
      reason: "room_save_mismatch",
      warnings,
    };
  }

  let participant = resolveParticipant(room, input);
  if (!participant) {
    return { allowed: false, status: 401, reason: "participant_missing", warnings };
  }
  if (input.userId && input.userId !== participant.userId) {
    return { allowed: false, status: 403, reason: "user_participant_mismatch", warnings };
  }
  if (participant.connectionStatus === "offline") {
    // Der Ping-Heartbeat verpasst den Teilnehmer regelmaessig, waehrend eine schwere Route
    // (Liga-Draft, Spieltagsaufloesung, grosse Kauf-Batches) die Event-Loop synchron blockiert —
    // `markDisconnected` markiert ihn dann offline, obwohl der Client nie weg war (siehe Koop-
    // Audit `scripts/audit-koop-spielbarkeit.ts`). Ein Schreibvorgang mit GUELTIGEM Sitzplatz-
    // Token traegt dasselbe Geheimnis, das `rejoinRoom` akzeptiert, um diesen Teilnehmer wieder
    // online zu setzen — er darf also heilen statt hart abzulehnen. Die Sicherheitsgrenze bleibt:
    // heilt nur, wenn der Token zum SELBEN Teilnehmer gehoert, der hier schreiben will (siehe
    // Kommentar an `healParticipantPresenceByToken`) — ein fremder/veralteter Token faellt weiter
    // auf den 403 unten durch.
    const healedRoom = input.seatToken
      ? healParticipantPresenceByToken(room, input.seatToken, participant.participantId)
      : null;
    if (!healedRoom) {
      return { allowed: false, status: 403, reason: "participant_offline", warnings };
    }
    participant = healedRoom.state.roomParticipants.find(
      (entry) => entry.participantId === participant!.participantId,
    )!;
    warnings.push("source:offline_presence_healed_by_valid_seat_token");
    // Sofort broadcasten statt auf den naechsten Schreibvorgang zu warten: sonst wartet der
    // Mitspieler in der UI weiter auf jemanden, der laengst wieder da ist (siehe Kommentar an
    // `markDisconnected` — gleiches Muster, gleicher Unfall ohne den Broadcast).
    broadcastRoomGameplayUpdate(healedRoom);
  }

  if (input.expectedConfirmToken != null && input.dryRun === false && input.confirmToken !== input.expectedConfirmToken) {
    return { allowed: false, status: 409, reason: "confirm_token_invalid_or_stale", warnings };
  }

  if (HOST_LEVEL_ACTIONS.has(input.action)) {
    if (participant.role === "host") {
      return { allowed: true, room, participant, ownership: null, warnings };
    }
    return { allowed: false, status: 403, reason: "host_only_action", warnings };
  }

  if (!input.teamId) {
    return { allowed: false, status: 409, reason: "team_id_required_for_team_write", warnings };
  }

  const ownership = room.state.teamOwnership.find((entry) => entry.teamId === input.teamId) ?? null;
  const teamAuth = authorizeTeamWrite({
    state: room.state,
    participantId: participant.participantId,
    teamId: input.teamId,
    action: input.action,
    activeManagerTeamId: input.activeManagerTeamId,
    controlMode: input.controlMode,
  });

  if (teamAuth.allowed) {
    return { allowed: true, room, participant, ownership, warnings };
  }

  if (input.allowSandboxHostOverride && participant.role === "host" && isSandboxLikeSave(input.saveId)) {
    return {
      allowed: true,
      room,
      participant,
      ownership,
      warnings: [`source:sandbox_host_override:${teamAuth.reason}`],
    };
  }

  return {
    allowed: false,
    status: teamAuth.reason === "participant_missing" ? 401 : 403,
    reason: teamAuth.reason,
    warnings,
  };
}
