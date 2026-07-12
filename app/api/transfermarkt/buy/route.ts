export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { executeLocalTransfermarktBuy, previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import type { ContractShape } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type BuyRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  playerId?: string;
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
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
    const body = (await request.json().catch(() => ({}))) as BuyRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !playerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and playerId are required.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 400 },
      );
    }

    const params = {
      saveId,
      seasonId,
      teamId,
      playerId,
      contractLength: body.contractLength,
      contractShape: body.contractShape,
      offeredSalary: body.offeredSalary,
    };

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Für Käufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
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
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 404 },
      );
    }

    const phaseGate = evaluateGamePhaseAction(save.gameState, "buy_players");
    if (!phaseGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: phaseGate.reason,
          summary: null,
          warnings: phaseGate.warnings,
          scope: { saveId, seasonId, teamId, playerId, dryRun, source, phase: phaseGate.phase },
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
      action: "buy",
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
          scope: { saveId, seasonId, teamId, playerId, dryRun, source, roomCode: body.roomCode ?? null },
        },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun
      ? previewLocalTransfermarktBuy(params)
      : executeLocalTransfermarktBuy(params);
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId,
      action: "transfermarkt_buy",
      eventType: "transfer_completed",
      affectedViews: ["home", "team", "market", "contracts"],
      dryRun,
      success: summary.canBuy,
    });

    return NextResponse.json(
      {
        success: summary.canBuy,
        summary,
        warnings: [...phaseGate.warnings, ...writeAuth.warnings, ...summary.warnings],
        scope: { saveId, seasonId, teamId, playerId, dryRun, source },
      },
      { status: summary.canBuy ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt buy could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
        scope: null,
      },
      { status: 500 },
    );
  }
}
