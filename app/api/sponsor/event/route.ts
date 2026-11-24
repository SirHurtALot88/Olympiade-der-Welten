export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveSponsorEvent } from "@/lib/sponsor/sponsor-event-service";
import { entscheideTermin } from "@/lib/sponsors/sponsor-topf-termine";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

type SponsorEventBody = {
  saveId?: string;
  eventId?: string;
  action?: "accept" | "dismiss";
  /**
   * SPONSORENTERMIN (24.11., lib/sponsors/sponsor-topf-termine.ts): statt `eventId` die Termin-Id und die Antwort. "ki" = an die KI geben.
   * Geschrieben wird wie bei jedem Sponsor-Schreibweg hinter `authorizeServerRoomWrite`, frisch vom Server gelesen, je Team.
   */
  terminId?: string;
  antwort?: "zusagen" | "absagen" | "ki";
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SponsorEventBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const eventId = body.eventId?.trim() ?? "";
    const terminId = body.terminId?.trim() ?? "";
    const action = body.action === "dismiss" ? "dismiss" : "accept";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (terminId) return await beantworteTerminRoute(body, saveId, terminId, source, dryRun);
    if (!saveId || !eventId) {
      return NextResponse.json({ success: false, error: "saveId and eventId are required." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    const event = (save.gameState.seasonState.sponsorEvents ?? []).find((entry) => entry.eventId === eventId);
    if (!event) {
      return NextResponse.json({ success: false, error: "sponsor_event_not_found" }, { status: 404 });
    }

    if (event.status !== "open") {
      return NextResponse.json(
        {
          success: false,
          error: "sponsor_event_not_open",
          eventStatus: event.status,
          applied: false,
          cashDelta: 0,
        },
        { status: 409 },
      );
    }

    // Stufe 0.3 (Befund B2): Identitaet AUSSERHALB eines Raums kommt serverseitig aus der Sitzung,
    // nie aus `body.activeOwnerId` — siehe Kommentar an `resolveAuthoritativeWriteOwnerId`.
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId: event.teamId,
      action: "sponsor_choice",
      source,
      dryRun,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    const nextGameState = resolveSponsorEvent(save.gameState, eventId, action);
    if (nextGameState === save.gameState) {
      return NextResponse.json(
        {
          success: false,
          error: "sponsor_event_unchanged",
          eventStatus: event.status,
          applied: false,
          cashDelta: 0,
        },
        { status: 409 },
      );
    }

    let persisted = null as ReturnType<typeof persistence.saveSingleplayerState> | null;
    if (!dryRun) {
      persisted = persistence.saveSingleplayerState(saveId, nextGameState);
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: event.teamId,
        action: "sponsor_choice",
        eventType: "save_updated",
        affectedViews: ["home", "sponsor"],
        dryRun: false,
        success: true,
      });
    }

    // `saveVersion` mitgeben — siehe Begruendung in `app/api/sponsor/choose/route.ts`.
    return NextResponse.json({
      success: true,
      applied: !dryRun,
      cashDelta: action === "accept" ? event.cashDelta : 0,
      saveVersion: persisted ? persisted.gameState.saveVersion : save.gameState.saveVersion,
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "sponsor_event_failed" },
      { status: 500 },
    );
  }
}

async function beantworteTerminRoute(body: SponsorEventBody, saveId: string, terminId: string, source: "sqlite" | "prisma", dryRun: boolean) {
  const antwort = body.antwort === "absagen" || body.antwort === "ki" ? body.antwort : "zusagen";
  if (!saveId) return NextResponse.json({ success: false, error: "saveId is required." }, { status: 400 });
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
  const termin = (save.gameState.seasonState.sponsorRegel?.termine ?? []).find((t) => t.id === terminId);
  if (!termin) return NextResponse.json({ success: false, error: "sponsor_termin_nicht_gefunden" }, { status: 404 });
  const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
  const writeAuth = authorizeServerRoomWrite({
    roomCode: body.roomCode,
    participantId: body.participantId,
    seatToken: body.seatToken,
    userId: body.userId,
    saveId,
    teamId: termin.teamId,
    action: "sponsor_choice",
    source,
    dryRun,
    activeManagerTeamId: body.activeManagerTeamId,
    activeOwnerId,
    controlMode: body.controlMode,
  });
  if (!writeAuth.allowed) return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
  const ergebnis = entscheideTermin(save.gameState, terminId, antwort, "mensch", { saveId });
  if (ergebnis.error) return NextResponse.json({ success: false, error: ergebnis.error, applied: false }, { status: 409 });
  let persisted = null as ReturnType<typeof persistence.saveSingleplayerState> | null;
  if (!dryRun) {
    persisted = persistence.saveSingleplayerState(saveId, ergebnis.gameState);
    notifyRoomGameplayWrite(writeAuth, { saveId, teamId: termin.teamId, action: "sponsor_choice", eventType: "save_updated", affectedViews: ["home", "sponsor"], dryRun: false, success: true });
  }
  const neu = (ergebnis.gameState.seasonState.sponsorRegel?.termine ?? []).find((t) => t.id === terminId) ?? null;
  return NextResponse.json({
    success: true,
    applied: !dryRun,
    termin: neu,
    cashDelta: neu?.status === "zugesagt" ? neu.betrag : 0,
    saveVersion: persisted ? persisted.gameState.saveVersion : save.gameState.saveVersion,
  });
}
