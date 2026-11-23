export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { bauArenaAus } from "@/lib/arena/arena-ausbau";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { setzeDauerkarten } from "@/lib/arena/arena-stand";
import { DAUERKARTEN_STUFEN } from "@/lib/arena/arena-modell";
import { ARENA_BEREICHE, type ArenaBereich, type DauerkartenStufe } from "@/lib/arena/arena-typen";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type ArenaBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  /** "ausbau" { schritte } | "dauerkarten" { stufe } */
  aktion?: unknown;
  schritte?: unknown;
  stufe?: unknown;
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
 * Arena (22.11., docs/design/arena-tickets-medaillen-22-11.md): Ausbau von Hand und Dauerkarten-Wahl. Schreibweg wie
 * `app/api/finance/vorstand/route.ts`: Identitaet aus der Sitzung bzw. dem Raum (`authorizeServerRoomWrite` mit
 * `resolveAuthoritativeWriteOwnerId`), nur das eigene Team des Aufrufers, IMMER frisch vom Server gelesen. Die Regeln (Kasse, Obergrenzen,
 * harte Vorstands-Freigabe aus dem Investitionstopf) liegen in `lib/arena/arena-ausbau.ts` und gelten fuer Mensch und KI gleich.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ArenaBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const aktion = typeof body.aktion === "string" ? body.aktion.trim() : "";

    if (source === "prisma") {
      return NextResponse.json({ ok: false, reason: "prisma_read_only", meldung: "Nur lesbar." }, { status: 409 });
    }
    if (!saveId || !teamId || (aktion !== "ausbau" && aktion !== "dauerkarten")) {
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
      action: "arena_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ ok: false, reason: writeAuth.reason, meldung: "Dieses Team gehoert dir nicht." }, { status: writeAuth.status });
    }
    if (!arenaAktiv(save.gameState)) {
      return NextResponse.json({ ok: false, reason: "arena_regel_aus", meldung: "In dieser Saison gilt noch das alte Gebäude „Arena Upgrade“." }, { status: 400 });
    }

    let nextState = save.gameState;
    let meldung = "";
    if (aktion === "ausbau") {
      const roh = (body.schritte ?? {}) as Record<string, unknown>;
      const schritte: Partial<Record<ArenaBereich, number>> = {};
      for (const b of ARENA_BEREICHE) schritte[b] = typeof roh[b] === "number" ? (roh[b] as number) : 0;
      const r = bauArenaAus(save.gameState, teamId, schritte, { von: "mensch" });
      if (!r.ok) return NextResponse.json({ ok: false, reason: r.reason, meldung: r.meldung }, { status: 400 });
      nextState = r.gameState;
      meldung = r.meldung;
    } else {
      const stufe = body.stufe as DauerkartenStufe;
      if (!DAUERKARTEN_STUFEN.includes(stufe)) return NextResponse.json({ ok: false, reason: "ungueltig", meldung: "Die Stufe ist unbekannt." }, { status: 400 });
      if ((save.gameState.seasonState.spieltagFinanzen ?? []).some((z) => z.seasonId === save.gameState.season.id && z.teamId === teamId)) {
        return NextResponse.json({ ok: false, reason: "zu_spaet", meldung: "Die Dauerkarten werden nur vor Spieltag 1 gewählt." }, { status: 400 });
      }
      nextState = setzeDauerkarten(save.gameState, teamId, stufe);
      meldung = `Dauerkarten „${stufe}“ gewählt. Das Geld ist gutgeschrieben.`;
    }
    persistence.saveSingleplayerState(saveId, nextState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "arena_update",
      eventType: "save_updated",
      affectedViews: ["home", "finances", "facilities"],
      dryRun: false,
      success: true,
    });
    return NextResponse.json({ ok: true, reason: null, meldung });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "arena_update_failed", meldung: "Das hat nicht geklappt." },
      { status: 500 },
    );
  }
}
