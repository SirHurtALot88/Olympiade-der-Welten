export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { istAusruestungAktion, wendeAusruestungAktionAn } from "@/lib/ausruestung/ausruestung-aktionen";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type AusruestungBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  /** "kiste_oeffnen" { truhe } | "fund_waehlen" { index } | "kiste_verwerfen" | "zerlegen" { teilId } (siehe `AusruestungAktion`). */
  aktion?: unknown;
  truhe?: unknown;
  index?: unknown;
  teilId?: unknown;
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
 * Ausruestung (Phase 1a): Truhe oeffnen, Fund waehlen, Kiste verwerfen, Teil zerlegen. Schreibweg wie
 * `app/api/finance/vorstand/route.ts`: Identitaet aus der Sitzung bzw. dem Raum (`authorizeServerRoomWrite` mit
 * `resolveAuthoritativeWriteOwnerId`), nur das eigene Team des Aufrufers, IMMER frisch vom Server gelesen (nie ein vom Client
 * mitgeschickter Stand — der Browser kennt die Lager fremder Teams ohnehin nicht). Die Regeln liegen in `lib/ausruestung/*`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AusruestungBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";

    if (source === "prisma") {
      return NextResponse.json({ ok: false, reason: "prisma_read_only", meldung: "Nur lesbar." }, { status: 409 });
    }
    // Der Aktions-Name steht in `aktion`; die Parameter liegen daneben im Body.
    const eingabe = { aktion: body.aktion, truhe: body.truhe, index: body.index, teilId: body.teilId };
    if (!saveId || !teamId || !istAusruestungAktion(eingabe)) {
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
      action: "ausruestung_update",
      source,
      dryRun: false,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ ok: false, reason: writeAuth.reason, meldung: "Dieses Team gehoert dir nicht." }, { status: writeAuth.status });
    }

    const ergebnis = wendeAusruestungAktionAn(save.gameState, teamId, eingabe);
    if (!ergebnis.ok) {
      return NextResponse.json({ ok: false, reason: ergebnis.reason, meldung: ergebnis.meldung }, { status: 400 });
    }
    persistence.saveSingleplayerState(saveId, ergebnis.gameState);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "ausruestung_update",
      eventType: "save_updated",
      affectedViews: ["home", "ausruestung"],
      dryRun: false,
      success: true,
    });
    return NextResponse.json({ ok: true, reason: null, meldung: ergebnis.meldung });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "ausruestung_update_failed", meldung: "Das hat nicht geklappt." },
      { status: 500 },
    );
  }
}
