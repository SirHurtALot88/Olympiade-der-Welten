import { NextResponse } from "next/server";

import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { executeStandingsApply, previewStandingsApply } from "@/lib/standings/standings-apply-service";

type ApplyRequestBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ApplyRequestBody;
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

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      action: "standings_apply",
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

    const params = {
      saveId,
      seasonId,
      matchdayId,
      source,
      dryRun,
      execute,
      confirm: body.confirm,
      forceReplace: body.forceReplace ?? false,
    };
    const result = execute ? await executeStandingsApply(params) : await previewStandingsApply(params);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Standings Apply is blocked.",
          source: result.source,
          canApply: result.canApply,
          blockingReasons: result.blockingReasons,
          summary: result,
        },
        { status: source === "prisma" ? 409 : 422 },
      );
    }

    return NextResponse.json({
      success: true,
      source,
      dryRun: result.dryRun,
      applied: result.applied,
      summary: result,
      warnings: [...writeAuth.warnings, ...result.warnings],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Standings apply preview could not be loaded.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        blockingReasons: ["apply_preview_failed"],
      },
      { status: 500 },
    );
  }
}
