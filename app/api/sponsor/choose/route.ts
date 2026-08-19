export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  chooseSponsorOffer,
  ensureSeasonSponsorOffers,
  getTeamSponsorContract,
  getTeamSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";

type SponsorChooseBody = {
  saveId?: string;
  teamId?: string;
  offerId?: string;
  /**
   * @deprecated wird IGNORIERT — die Laufzeit steht am gewaehlten Angebot (Umsetzungsplan D), nicht
   * mehr an einem separaten Request-Feld. Bleibt nur, damit Alt-Clients kein 400 bekommen.
   */
  termSeasons?: 1 | 2 | 3;
  /** @deprecated Verhandlungs-Achse entfernt. Feld wird bei Alt-Requests ignoriert (kein 400). */
  negotiationProfile?: "safe" | "balanced" | "ambitious";
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
    const body = (await request.json().catch(() => ({}))) as SponsorChooseBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const offerId = body.offerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !offerId) {
      return NextResponse.json({ success: false, error: "saveId, teamId and offerId are required.", summary: null }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const phaseGate = evaluateGamePhaseAction(save.gameState, "sponsor_choice");
    if (!phaseGate.allowed && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
          blockingReasons: phaseGate.reason ? [phaseGate.reason] : [],
        },
        { status: 409 },
      );
    }

    const existingContract = getTeamSponsorContract(save.gameState, teamId);
    if (existingContract && !dryRun) {
      return NextResponse.json(
        {
          success: false,
          error: "sponsor_contract_already_signed",
          summary: { contract: existingContract, offers: getTeamSponsorOffers(save.gameState, teamId) },
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
      teamId,
      action: "sponsor_choice",
      source,
      dryRun,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId,
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

    const preparedState = ensureSeasonSponsorOffers(save.gameState);
    const result = chooseSponsorOffer({
      gameState: preparedState,
      teamId,
      offerId,
      saveId,
    });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error, summary: null }, { status: 400 });
    }

    let persisted = null as ReturnType<typeof persistence.saveSingleplayerState> | null;
    if (!dryRun) {
      persisted = persistence.saveSingleplayerState(saveId, result.gameState);
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId,
        action: "sponsor_choice",
        eventType: "save_updated",
        affectedViews: ["home", "sponsor"],
        dryRun: false,
        success: true,
      });
    }

    // `saveVersion` mitgeben: `saveSingleplayerState` zaehlt sie bei JEDEM Schreiben hoch (siehe
    // `persistence-service.ts`), egal ob ueber diese Route oder den generischen PUT. Ohne sie in
    // der Antwort merkt der Client die neue Version nicht und der naechste generische PUT rechnet
    // noch mit der alten -> 409 "Save-Konflikt erkannt" fuer eine Aenderung, die er selbst gemacht
    // hat (GEMELDET von Chris beim Trainings-Speichern).
    return NextResponse.json({
      success: true,
      saveVersion: persisted ? persisted.gameState.saveVersion : save.gameState.saveVersion,
      summary: {
        applied: !dryRun,
        contract: result.contract,
        offers: getTeamSponsorOffers(result.gameState, teamId),
        // Die drei folgenden Felder sind der REST dessen, was `chooseSponsorOffer` neben dem
        // Vertrag noch aendert (Vorschuss-Cash, Sponsor-Leihgabe, Payout-Log, Marken-Historie).
        // Der Aufrufer verzichtet jetzt auf ein volles `loadSave` (das verwirft ungespeicherte
        // lokale Aenderungen anderswo — siehe Commit "Zwei Fehler beim Blaettern") und patcht
        // stattdessen NUR diese bekannten Felder in sein lokales gameState. Fehlte hier auch nur
        // eines, wuerde der naechste generische PUT (voller gameState-Ueberschreiber) den
        // serverseitig berechneten Wert wieder zuruecksetzen — deshalb muss diese Liste
        // vollstaendig bleiben, wenn `chooseSponsorOffer` je ein weiteres Feld schreibt.
        teamCash: result.gameState.teams.find((entry) => entry.teamId === teamId)?.cash ?? null,
        sponsorLeihgabe: result.gameState.seasonState.sponsorLeihgabenByTeamId?.[teamId] ?? null,
        sponsorPayoutLogs: result.gameState.seasonState.sponsorPayoutLogs ?? null,
        sponsorBrandHistory: result.gameState.seasonState.sponsorBrandHistoryByTeamId?.[teamId] ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "sponsor_choice_failed",
        summary: null,
      },
      { status: 500 },
    );
  }
}
