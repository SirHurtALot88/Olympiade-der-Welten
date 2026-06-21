export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";

type SeasonCompletionBody = {
  saveId?: string;
  seasonId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SeasonCompletionBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() || undefined;
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";
    const execute = body.execute === true;
    const dryRun = execute ? false : body.dryRun ?? true;

    if (!saveId) {
      return NextResponse.json({ success: false, error: "saveId is required.", summary: null }, { status: 400 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      action: "season_completion",
      source,
      dryRun,
      confirmToken: body.confirmToken,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason], summary: null },
        { status: writeAuth.status },
      );
    }

    const summary = await runLocalSeasonCompletion({
      saveId,
      seasonId,
      source,
      dryRun,
      execute,
      confirmToken: execute ? body.confirmToken ?? SEASON_COMPLETION_CONFIRM_TOKEN : undefined,
    });

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "season_completion",
      eventType: "season_advanced",
      affectedViews: ["home", "season", "team", "contracts", "history"],
      dryRun,
      success: summary.applied === true,
    });

    return NextResponse.json(
      {
        success: summary.ok,
        summary,
        warnings: [...writeAuth.warnings, ...summary.warnings],
        blockingReasons: summary.blockingReasons,
        error: summary.ok ? undefined : summary.blockingReasons[0] ?? "Season completion blocked.",
      },
      { status: summary.ok || dryRun ? 200 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Season completion failed.",
        summary: null,
        blockingReasons: ["season_completion_failed"],
      },
      { status: 500 },
    );
  }
}
