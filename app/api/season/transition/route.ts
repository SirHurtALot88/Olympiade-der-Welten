export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { buildSeasonTransitionPreview, startSeasonTransition } from "@/lib/season/season-transition-service";

type SeasonTransitionBody = {
  saveId?: string;
  dryRun?: boolean;
  action?: "start_transition" | "preview";
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SeasonTransitionBody;
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
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, summary: null, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason] },
        { status: writeAuth.status },
      );
    }

    const summary = dryRun || body.action !== "start_transition"
      ? buildSeasonTransitionPreview(save)
      : startSeasonTransition(save, persistence);
    const success = "applied" in summary ? Boolean(summary.applied) : summary.ok;
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "season_transition",
      eventType: "season_advanced",
      affectedViews: ["home", "season", "team", "contracts"],
      dryRun,
      success,
    });

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
        error: error instanceof Error ? error.message : "Season transition failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
