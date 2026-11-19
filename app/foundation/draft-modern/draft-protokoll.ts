/**
 * Protokoll der Draft-Seite gegen `/api/draft` (Draft-Neubau, 18.11.; docs/design/draft-neubau-kern-18-11.md, Abschnitt 5).
 * Reine Funktionen ohne React, damit Test und Seite dieselben Regeln benutzen:
 *  - GET trägt die Raumfelder als Query (sonst bleibt `mein` leer, Review #1619 A7),
 *  - jeder POST außer `starten` trägt `erwarteteNr` = `ansicht.stand` (A6).
 */
import { appendRoomContextToParams, withRoomContextBody, type FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

/** Obergrenze der Route für `ki_schritt.maxPicks` (A3). */
export const DRAFT_MAX_PICKS_JE_SCHRITT = 8;

export function baueDraftLeseParameter(input: {
  saveId: string;
  teamId: string | null;
  roomContext: FoundationRoomContext | null | undefined;
  vorschau?: number;
  verlauf?: number;
}): URLSearchParams {
  const parameter = new URLSearchParams({ saveId: input.saveId, vorschau: String(input.vorschau ?? 6), verlauf: String(input.verlauf ?? 0) });
  if (input.teamId) {
    parameter.set("teamId", input.teamId);
    parameter.set("activeManagerTeamId", input.teamId);
  }
  // Raum: roomCode, participantId, userId, seatToken — dieselben Felder wie im POST-Körper.
  appendRoomContextToParams(parameter, input.roomContext ?? null);
  return parameter;
}

export function baueDraftPostKoerper(input: {
  saveId: string;
  teamId: string;
  aktion: string;
  stand: number | null | undefined;
  roomContext: FoundationRoomContext | null | undefined;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const extra = { ...(input.extra ?? {}) };
  if (input.aktion === "ki_schritt") {
    const n = Math.floor(Number(extra.maxPicks) || 1);
    extra.maxPicks = Math.max(1, Math.min(DRAFT_MAX_PICKS_JE_SCHRITT, n));
  }
  return withRoomContextBody(
    {
      saveId: input.saveId,
      teamId: input.teamId,
      aktion: input.aktion,
      ...(input.aktion === "starten" ? {} : { erwarteteNr: input.stand ?? undefined }),
      activeManagerTeamId: input.teamId,
      ...extra,
    },
    input.roomContext ?? null,
  );
}
