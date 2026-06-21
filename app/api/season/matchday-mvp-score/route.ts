export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  runMatchdayMvpScoring,
} from "@/lib/season/matchday-mvp-scoring-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type MatchdayMvpScoreBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string | null;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string | null;
  forceReplace?: boolean;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json()) as MatchdayMvpScoreBody;
  const saveId = body.saveId?.trim() ?? "";
  const seasonId = body.seasonId?.trim() ?? "";
  const matchdayId = body.matchdayId?.trim() ?? null;
  const source = body.source === "prisma" ? "prisma" : "sqlite";
  const execute = body.execute === true;
  const dryRun = execute ? false : body.dryRun ?? true;

  if (!saveId || !seasonId) {
    return NextResponse.json(
      { error: "saveId and seasonId are required." },
      { status: 400 },
    );
  }

  if (source === "prisma") {
    return NextResponse.json(
      { error: "Prisma/Supabase mode is read-only in this build." },
      { status: 409 },
    );
  }

  try {
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
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, warnings: writeAuth.warnings },
        { status: writeAuth.status },
      );
    }

    const result = await runMatchdayMvpScoring({
      saveId,
      seasonId,
      matchdayId,
      source,
      dryRun,
      execute,
      confirmToken: execute ? body.confirmToken ?? null : undefined,
      forceReplace: body.forceReplace ?? false,
    });
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "matchday_mvp_score",
      eventType: "matchday_applied",
      affectedViews: ["home", "season", "matchday", "arena", "standings"],
      dryRun,
      success: result.executed === true && result.status !== "blocked",
    });

    return NextResponse.json({
      success: result.status !== "blocked",
      summary: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Matchday MVP scoring could not be executed." },
      { status: 500 },
    );
  }
}
