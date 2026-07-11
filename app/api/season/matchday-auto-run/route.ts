export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
  runLocalMatchdayAutoRun,
} from "@/lib/season/matchday-auto-run-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type MatchdayAutoRunBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  options?: {
    includeWarningLineups?: boolean;
    overwriteExistingLineups?: boolean;
    stopOnTie?: boolean;
    advanceAfterCashApply?: boolean;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MatchdayAutoRunBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const matchdayId = body.matchdayId?.trim() ?? "";
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";
    const execute = body.execute === true;
    const dryRun = execute ? false : body.dryRun ?? true;

    if (!saveId || !seasonId || !matchdayId) {
      return NextResponse.json(
        { error: "saveId, seasonId and matchdayId are required." },
        { status: 400 },
      );
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          error: "Prisma/Supabase mode is read-only in this build.",
        },
        { status: 409 },
      );
    }

    if (!dryRun && body.confirmToken !== MATCHDAY_AUTO_RUN_CONFIRM_TOKEN) {
      return NextResponse.json(
        {
          error: "Matchday Auto-Run execute requires explicit confirmToken.",
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
      action: "matchday_resolve",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: dryRun ? null : MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          warnings: writeAuth.warnings,
          blockingReasons: [writeAuth.reason],
        },
        { status: writeAuth.status },
      );
    }

    const result = await runLocalMatchdayAutoRun({
      saveId,
      seasonId,
      matchdayId,
      source,
      dryRun,
      execute,
      confirmToken: body.confirmToken,
      options: {
        includeWarningLineups: body.options?.includeWarningLineups ?? false,
        overwriteExistingLineups: body.options?.overwriteExistingLineups ?? false,
        stopOnTie: body.options?.stopOnTie ?? true,
        advanceAfterCashApply: body.options?.advanceAfterCashApply ?? true,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Matchday Auto-Run is blocked.",
          summary: result,
          blockingReasons: result.blockingReasons,
        },
        { status: 422 },
      );
    }

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "matchday_auto_run",
      eventType: "matchday_resolved",
      affectedViews: ["home", "season", "matchday", "arena", "lineup"],
      dryRun,
      success: result.executed === true || dryRun,
    });

    return NextResponse.json({
      success: true,
      summary: result,
      dryRun: result.dryRun,
      executed: result.executed,
      warnings: [...writeAuth.warnings, ...result.warnings],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Matchday Auto-Run failed.",
        blockingReasons: ["matchday_auto_run_failed"],
      },
      { status: 500 },
    );
  }
}
