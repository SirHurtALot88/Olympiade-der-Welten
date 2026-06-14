import { NextResponse } from "next/server";

import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { executeCashPrizeApply, previewCashPrizeApply } from "@/lib/season/cash-prize-apply-service";

type CashPrizeApplyRequestBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  source?: "sqlite" | "prisma";
  phase?: "season_end" | "matchday";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CashPrizeApplyRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const matchdayId = body.matchdayId?.trim() || undefined;
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";
    const phase: "season_end" | "matchday" = body.phase === "matchday" ? "matchday" : "season_end";
    const execute = body.execute === true;
    const dryRun = execute ? false : body.dryRun ?? true;

    if (!saveId || !seasonId) {
      return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      action: "cash_prize_apply",
      source,
      dryRun,
      confirmToken: body.confirm,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason] },
        { status: writeAuth.status },
      );
    }

    const params = { saveId, seasonId, matchdayId, source, phase, dryRun, execute, confirm: body.confirm };
    const result = execute ? await executeCashPrizeApply(params) : await previewCashPrizeApply(params);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Cash Apply is blocked.",
          source: result.source,
          canApply: result.canApply,
          blockingReasons: result.blockingReasons,
          summary: result,
        },
        { status: source === "prisma" ? 409 : 422 },
      );
    }
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "cash_prize_apply",
      eventType: "save_updated",
      affectedViews: ["home", "team", "season"],
      dryRun,
      success: result.applied === true,
    });

    return NextResponse.json({
      success: true,
      source,
      dryRun: result.dryRun,
      applied: result.applied,
      summary: result,
      warnings: [...writeAuth.warnings, ...result.warnings],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cash prize apply preview could not be loaded.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        blockingReasons: ["cash_prize_apply_preview_failed"],
      },
      { status: 500 },
    );
  }
}
