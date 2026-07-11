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

type SponsorChooseBody = {
  saveId?: string;
  teamId?: string;
  offerId?: string;
  termSeasons?: 1 | 2 | 3;
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

    const preparedState = ensureSeasonSponsorOffers(save.gameState);
    const result = chooseSponsorOffer({
      gameState: preparedState,
      teamId,
      offerId,
      saveId,
      termSeasons: 1,
      negotiationProfile: body.negotiationProfile ?? "balanced",
    });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error, summary: null }, { status: 400 });
    }

    if (!dryRun) {
      persistence.saveSingleplayerState(saveId, result.gameState);
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

    return NextResponse.json({
      success: true,
      summary: {
        applied: !dryRun,
        contract: result.contract,
        offers: getTeamSponsorOffers(result.gameState, teamId),
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
