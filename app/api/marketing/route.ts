export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { waehleAushaengeschild } from "@/lib/marketing/marketing-aushaengeschild";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type MarketingBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  /** "aushaengeschild" { playerId } */
  aktion?: unknown;
  playerId?: unknown;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

/**
 * Marketing (23.11., docs/design/werbeklausel-aushaengeschild-23-11.md): Aushaengeschild waehlen. Schreibweg wie `app/api/arena/route.ts`:
 * Identitaet aus Sitzung bzw. Raum (`authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId`), nur das eigene Team des Aufrufers
 * (andere Menschen lesen nur), IMMER frisch vom Server gelesen. Die Regeln liegen in `lib/marketing/marketing-aushaengeschild.ts`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MarketingBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const aktion = typeof body.aktion === "string" ? body.aktion.trim() : "";
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";

    if (source === "prisma") {
      return NextResponse.json({ ok: false, reason: "prisma_read_only", meldung: "Nur lesbar." }, { status: 409 });
    }
    if (!saveId || !teamId || aktion !== "aushaengeschild" || !playerId) {
      return NextResponse.json({ ok: false, reason: "missing_fields", meldung: "Angaben fehlen." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) return NextResponse.json({ ok: false, reason: "save_not_found", meldung: "Spielstand nicht gefunden." }, { status: 404 });
    if (seasonId && seasonId !== save.gameState.season.id) {
      return NextResponse.json({ ok: false, reason: "stale_season", meldung: "Die Saison hat gewechselt." }, { status: 409 });
    }

    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "marketing_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ ok: false, reason: writeAuth.reason, meldung: "Dieses Team gehoert dir nicht." }, { status: writeAuth.status });
    }

    const r = waehleAushaengeschild(save.gameState, teamId, playerId);
    if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, meldung: r.meldung }, { status: 400 });
    persistence.saveSingleplayerState(saveId, r.gameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "marketing_update",
      eventType: "save_updated",
      affectedViews: ["home", "marketing"],
      dryRun: false,
      success: true,
    });
    return NextResponse.json({ ok: true, reason: null, meldung: "Das Aushängeschild steht bis Saisonende fest." });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "marketing_update_failed", meldung: "Das hat nicht geklappt." },
      { status: 500 },
    );
  }
}
