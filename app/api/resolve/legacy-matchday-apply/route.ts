export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  LegacyMatchdayResultApplyService,
} from "@/lib/resolve/legacy-matchday-result-apply-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type ApplyBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
  forceReplace?: boolean;
  allowIncompleteOverride?: boolean;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ApplyBody;
  const saveId = body.saveId?.trim() ?? "";
  const seasonId = body.seasonId?.trim() ?? "";
  const matchdayId = body.matchdayId?.trim() ?? "";
  const source = body.source === "prisma" ? "prisma" : "sqlite";
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
    action: "matchday_resolve",
    source,
    dryRun,
    confirmToken: body.confirm,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: writeAuth.reason,
        warnings: writeAuth.warnings,
      },
      { status: writeAuth.status },
    );
  }

  const service = new LegacyMatchdayResultApplyService();
  const result = await service.applyLegacyMatchdayResult({
    saveId,
    seasonId,
    matchdayId,
    source,
    dryRun,
    execute,
    confirm: body.confirm,
    forceReplace: body.forceReplace ?? false,
    allowIncompleteOverride: body.allowIncompleteOverride ?? false,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        source: result.source,
        previewStatus: result.previewStatus ?? null,
        canApply: result.canApply ?? false,
        blockingReasons: result.blockingReasons ?? [],
      },
      { status: source === "prisma" ? 409 : 422 },
    );
  }
  notifyRoomGameplayWrite(writeAuth, {
    saveId,
    action: "matchday_apply",
    eventType: "matchday_applied",
    affectedViews: ["home", "season", "matchday", "arena", "standings"],
    dryRun,
    success: result.applied === true,
  });

  return NextResponse.json({
    success: true,
    source,
    dryRun: result.dryRun,
    applied: result.applied,
    previewStatus: result.previewStatus,
    summary: result,
    warnings: [...writeAuth.warnings, ...result.blockingReasons],
  });
}
