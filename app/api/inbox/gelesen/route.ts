export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { inboxBesitzerFuerTeam, setzeInboxGelesen } from "@/lib/foundation/inbox-gelesen";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type GelesenBody = {
  saveId?: string;
  teamId?: string;
  itemIds?: unknown;
  gelesen?: boolean;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

const MAX_IDS_JE_AUFRUF = 200;

/**
 * Postfach: Gelesen-Marke je Manager. Schreibweg wie Training und Vorstand: frisch vom Server lesen, das Team muss dem
 * Aufrufer gehören (`authorizeServerRoomWrite`), nur `seasonState.inboxGelesen[<Besitzer des Teams>]` ändert sich.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as GelesenBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length < 300)
      : [];

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || itemIds.length === 0 || typeof body.gelesen !== "boolean") {
      return NextResponse.json({ success: false, error: "saveId, teamId, itemIds and gelesen are required." }, { status: 400 });
    }
    if (itemIds.length > MAX_IDS_JE_AUFRUF) {
      return NextResponse.json({ success: false, error: "too_many_items" }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }
    if (!save.gameState.teams.some((team) => team.teamId === teamId)) {
      return NextResponse.json({ success: false, error: "team_not_found" }, { status: 404 });
    }

    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "inbox_gelesen",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    const besitzer = inboxBesitzerFuerTeam(save.gameState, teamId);
    if (!besitzer) {
      return NextResponse.json({ success: false, error: "team_without_owner" }, { status: 409 });
    }
    const nextGameState = setzeInboxGelesen(save.gameState, besitzer, itemIds, body.gelesen);
    if (nextGameState === save.gameState) {
      return NextResponse.json({ success: true, saveVersion: save.gameState.saveVersion, unveraendert: true });
    }
    const persisted = persistence.saveSingleplayerState(saveId, nextGameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "inbox_gelesen",
      eventType: "save_updated",
      affectedViews: ["inbox"],
      dryRun: false,
      success: true,
    });
    return NextResponse.json({ success: true, saveVersion: persisted.gameState.saveVersion, ownerId: besitzer });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "inbox_gelesen_failed" },
      { status: 500 },
    );
  }
}
