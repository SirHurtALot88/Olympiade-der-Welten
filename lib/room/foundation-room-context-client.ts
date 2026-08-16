"use client";

export type FoundationRoomContext = {
  roomCode: string;
  participantId: string;
  userId: string;
  seatToken: string;
  saveId: string;
  /**
   * Die Owner-ID, unter der dieser Teilnehmer im Foundation-Client als "meine Teams" gilt
   * (`teamControlSettings[teamId].ownerId`) — von `/room/[roomCode]/RoomPageClient.tsx` aus der
   * Sitzrolle abgeleitet (`resolveRoomParticipantActiveOwnerId`, lib/room/online-room-model.ts),
   * NICHT aus `userId` (siehe Kommentar dort: `userId` ist ohne Login ein zufaelliger
   * `user-<uuid>`-String, der mit keinem gespeicherten `ownerId` uebereinstimmt).
   *
   * Optional/`null` fuer Rueckwaertskompatibilitaet — alte Links ohne dieses Feld (oder ein
   * Zuschauer-Sitz ohne feste Owner-Spalte) liefern weiterhin einen gueltigen Kontext, nur ohne
   * Identitaets-Hinweis; `use-foundation-page-state.ts` faellt dann auf den naechsten Rang der
   * Kette zurueck (lokaler Speicher/Standard).
   *
   * NUR ANZEIGE, NIE BERECHTIGUNG: die URL ist vom Nutzer editierbar. Ein manipulierter Wert kann
   * die Oberflaeche bestenfalls grosszuegiger ODER enger zeigen als sie sein sollte — nie
   * tatsaechlichen Zugriff verschaffen. Jeder Schreibvorgang im Raum prueft weiterhin
   * ausschliesslich das Sitz-Token (`authorizeServerRoomWrite`/`authorizeTeamWrite`), das dieses
   * Feld nirgends liest.
   */
  ownerId: string | null;
};

function normalizedParam(params: URLSearchParams, key: keyof Omit<FoundationRoomContext, "ownerId">) {
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
  const ownerId = params.get("ownerId")?.trim() || null;

  if (!roomCode || !participantId || !userId || !seatToken || !saveId) {
    return null;
  }

  return { roomCode, participantId, userId, seatToken, saveId, ownerId };
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
  // Ohne dieses Feld hier mit weiterzureichen wuerde jede interne Foundation-Navigation (Tab-/
  // View-Wechsel, die diese Funktion nutzt) es aus der URL werfen — beim naechsten Neuladen faellt
  // die Identitaets-Aufloesung dann bis zum lokalen Speicher durch, statt weiter den Raum-Wert zu
  // sehen. `null` (Alt-Link/Zuschauer) wird bewusst NICHT gesetzt statt als String "null" zu landen.
  if (context.ownerId) {
    params.set("ownerId", context.ownerId);
  }
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
