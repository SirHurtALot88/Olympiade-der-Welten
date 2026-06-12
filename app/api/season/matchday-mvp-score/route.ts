import { NextResponse } from "next/server";

import {
  runMatchdayMvpScoring,
} from "@/lib/season/matchday-mvp-scoring-service";

type MatchdayMvpScoreBody = {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string | null;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string | null;
  forceReplace?: boolean;
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
