import { NextResponse } from "next/server";

import {
  applyContractRenewalAction,
  previewContractRenewalAction,
  type ContractRenewalAction,
} from "@/lib/contracts/contract-renewal-service";
import type { ContractShape } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type ContractRenewalBody = {
  saveId?: string;
  teamId?: string;
  playerId?: string;
  action?: ContractRenewalAction;
  contractLength?: number | null;
  offeredSalary?: number | null;
  contractShape?: ContractShape;
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ContractRenewalBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const action = body.action === "release" ? "release" : body.action === "renew" ? "renew" : null;
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !playerId || !action) {
      return NextResponse.json(
        { success: false, error: "saveId, teamId, playerId and action are required.", summary: null },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const preview = previewContractRenewalAction({
      save,
      teamId,
      playerId,
      action,
      contractLength: body.contractLength,
      offeredSalary: body.offeredSalary,
      contractShape: body.contractShape,
    });
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "contract_renewal",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: preview.confirmToken,
      activeManagerTeamId: body.activeManagerTeamId,
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

    const summary = dryRun
      ? preview
      : applyContractRenewalAction({
          save,
          teamId,
          playerId,
          action,
          confirmToken: body.confirmToken,
          persistence,
          contractLength: body.contractLength,
          offeredSalary: body.offeredSalary,
          contractShape: body.contractShape,
          source: action === "renew" ? "manual_contract_renewal" : "manual_player_release",
        });
    const success = "applied" in summary ? summary.applied : summary.ok;

    return NextResponse.json(
      {
        success,
        summary,
        warnings: [...writeAuth.warnings, ...summary.warnings],
        blockingReasons: summary.blockingReasons,
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Contract renewal failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
