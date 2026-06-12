import { NextResponse } from "next/server";

import {
  createSeasonSnapshot,
  SEASON_SNAPSHOT_CONFIRM_TOKEN,
} from "@/lib/season/season-snapshot-service";

type SeasonSnapshotBody = {
  saveId?: string;
  seasonId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirmToken?: string;
  forceCreate?: boolean;
  replaceExisting?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SeasonSnapshotBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim();
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";
    const execute = body.execute === true;
    const dryRun = execute ? false : body.dryRun ?? true;

    if (!saveId) {
      return NextResponse.json(
        { success: false, error: "saveId is required." },
        { status: 400 },
      );
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma/Supabase mode is read-only in this build.",
          blockingReasons: ["prisma_read_only"],
        },
        { status: 409 },
      );
    }

    if (!dryRun && body.confirmToken !== SEASON_SNAPSHOT_CONFIRM_TOKEN) {
      return NextResponse.json(
        {
          success: false,
          error: "Season Snapshot execute requires explicit confirmToken.",
          blockingReasons: ["missing_confirm_token"],
        },
        { status: 409 },
      );
    }

    const result = createSeasonSnapshot({
      saveId,
      seasonId,
      source,
      dryRun,
      execute,
      confirm: body.confirmToken,
      forceCreate: body.forceCreate === true,
      replaceExisting: body.replaceExisting === true,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Season snapshot is blocked.",
          summary: result,
          blockingReasons: result.blockingReasons,
          warnings: result.warnings,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      summary: result,
      dryRun: result.dryRun,
      applied: result.applied,
      warnings: result.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Season snapshot failed.",
        blockingReasons: ["season_snapshot_failed"],
      },
      { status: 500 },
    );
  }
}
