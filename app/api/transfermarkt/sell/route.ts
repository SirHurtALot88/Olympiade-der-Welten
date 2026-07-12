export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { executeLocalTransfermarktSell, previewLocalTransfermarktSell } from "@/lib/market/transfermarkt-local-service";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type SellRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  activePlayerId?: string;
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
  confirmToken?: string | null;
  expectedConfirmToken?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SellRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const activePlayerId = body.activePlayerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !activePlayerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and activePlayerId are required.",
          summary: null,
          warnings: [],
        },
        { status: 400 },
      );
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Für Verkäufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
        },
        { status: 409 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json(
        {
          success: false,
          error: "save_not_found",
          summary: null,
          warnings: [],
        },
        { status: 404 },
      );
    }

    const phaseGate = evaluateGamePhaseAction(save.gameState, "sell_players");
    if (!phaseGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
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
      action: "sell",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: body.expectedConfirmToken,
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
        },
        { status: writeAuth.status },
      );
    }

    const params = { saveId, seasonId, teamId, activePlayerId };
    const summary = dryRun ? previewLocalTransfermarktSell(params) : executeLocalTransfermarktSell(params);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "transfermarkt_sell",
      eventType: "transfer_completed",
      affectedViews: ["home", "team", "market", "contracts"],
      dryRun,
      success: summary.canSell,
    });

    return NextResponse.json(
      {
        success: summary.canSell,
        summary,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
      },
      { status: summary.canSell ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt sell could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
      },
      { status: 500 },
    );
  }
}
