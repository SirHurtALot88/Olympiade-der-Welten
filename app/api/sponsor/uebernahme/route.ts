export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { lehneUebernahmeAb, nimmUebernahmeAn } from "@/lib/sponsor/sponsor-leih-lifecycle";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import type { SponsorUebernahmeAngebot } from "@/lib/data/olyDataTypes";

type SponsorUebernahmeBody = {
  saveId?: string;
  teamId?: string;
  facilityId?: string;
  action?: "annehmen" | "ablehnen";
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
    const body = (await request.json().catch(() => ({}))) as SponsorUebernahmeBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const facilityId = body.facilityId?.trim() ?? "";
    const action = body.action;
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !facilityId) {
      return NextResponse.json({ success: false, error: "saveId, teamId and facilityId are required.", summary: null }, { status: 400 });
    }
    if (action !== "annehmen" && action !== "ablehnen") {
      return NextResponse.json({ success: false, error: "action must be \"annehmen\" or \"ablehnen\".", summary: null }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      // Kein eigener `TeamWriteAction`-Wert fuer die Uebernahme — sie ist eine Sponsor-Entscheidung
      // wie die Wahl selbst (Team-Ebene, kein Host-Recht), deshalb dieselbe Marke wie `sponsor_choice`
      // statt eines neuen Enum-Werts nur fuer diese eine Route.
      action: "sponsor_choice",
      source,
      dryRun,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          summary: null,
          warnings: writeAuth.warnings,
          blockingReasons: [writeAuth.reason],
        },
        { status: writeAuth.status },
      );
    }

    // Existenz zentral pruefen, bevor annehmen/ablehnen ueberhaupt gerufen wird: `lehneUebernahmeAb`
    // hat selbst keinen Fehlerpfad (ein No-Op-Filter ist fuer sie kein Fehler), damit ein unbekanntes
    // Gebaeude bei BEIDEN Aktionen denselben sauberen Fehler gibt statt bei "ablehnen" still zu tun.
    const offeneVorher = save.gameState.seasonState.sponsorUebernahmeAngeboteByTeamId?.[teamId] ?? [];
    const angebotVorher = offeneVorher.find((eintrag) => eintrag.facilityId === facilityId) ?? null;
    if (!angebotVorher) {
      return NextResponse.json({ success: false, error: "uebernahme_angebot_nicht_gefunden", summary: null }, { status: 400 });
    }

    let resultGameState = save.gameState;
    let angebot: SponsorUebernahmeAngebot | null = angebotVorher;
    if (action === "annehmen") {
      const result = nimmUebernahmeAn({ gameState: save.gameState, teamId, facilityId });
      if (result.error) {
        return NextResponse.json({ success: false, error: result.error, summary: null }, { status: 400 });
      }
      resultGameState = result.gameState;
      angebot = result.angebot;
    } else {
      resultGameState = lehneUebernahmeAb({ gameState: save.gameState, teamId, facilityId });
    }

    if (!dryRun) {
      persistence.saveSingleplayerState(saveId, resultGameState);
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId,
        action: "sponsor_uebernahme",
        eventType: "save_updated",
        affectedViews: ["home", "sponsor"],
        dryRun: false,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        applied: !dryRun,
        action,
        angebot,
        offeneAngebote: resultGameState.seasonState.sponsorUebernahmeAngeboteByTeamId?.[teamId] ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "sponsor_uebernahme_failed",
        summary: null,
      },
      { status: 500 },
    );
  }
}
