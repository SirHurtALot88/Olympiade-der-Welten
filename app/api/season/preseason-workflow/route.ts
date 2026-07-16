export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applySeasonEndContractTick } from "@/lib/contracts/contract-renewal-service";
import {
  applyPreSeasonNextSeasonSetup,
  buildPreSeasonWorkflowPreview,
} from "@/lib/season/preseason-workflow-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type PreSeasonWorkflowBody = {
  saveId?: string;
  dryRun?: boolean;
  stepId?: string | null;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PreSeasonWorkflowBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId) {
      return NextResponse.json({ success: false, error: "saveId is required.", summary: null }, { status: 400 });
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
      action: "season_transition",
      source,
      dryRun,
      confirmToken: body.confirmToken,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, summary: null, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason] },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun
      ? await buildPreSeasonWorkflowPreview(save, persistence)
      : body.stepId === "next_season_setup"
        ? await applyPreSeasonNextSeasonSetup(save, body.confirmToken, persistence)
        : body.stepId === "contract_renewal"
          ? applySeasonEndContractTick(save, body.confirmToken, persistence)
        : null;

    if (!summary) {
      return NextResponse.json(
        { success: false, error: "unsupported_preseason_apply_step", summary: null },
        { status: 409 },
      );
    }

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
        error: error instanceof Error ? error.message : "Pre-Season workflow failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
