import { NextResponse } from "next/server";

import { runWholeSeasonDryRun } from "@/lib/season/whole-season-dryrun-service";

type WholeSeasonDryRunBody = {
  saveId?: string;
  seasonId?: string;
  startMatchdayId?: string;
  maxMatchdays?: number;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  options?: {
    includeWarningLineups?: boolean;
    overwriteExistingLineups?: boolean;
    stopOnTie?: boolean;
    stopOnMissingManualLineups?: boolean;
    advanceAfterEachMatchday?: boolean;
    includeMarketPhase?: false;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as WholeSeasonDryRunBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim();
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId) {
      return NextResponse.json({ error: "saveId is required." }, { status: 400 });
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          error: "Prisma/Supabase mode is read-only in this build.",
        },
        { status: 409 },
      );
    }

    if (body.execute === true || body.dryRun === false) {
      return NextResponse.json(
        {
          error: "Whole season simulation is dry-run only in this block.",
        },
        { status: 409 },
      );
    }

    const result = await runWholeSeasonDryRun({
      saveId,
      seasonId,
      startMatchdayId: body.startMatchdayId?.trim() || undefined,
      maxMatchdays: typeof body.maxMatchdays === "number" ? body.maxMatchdays : undefined,
      source,
      dryRun: true,
      options: {
        includeWarningLineups: body.options?.includeWarningLineups ?? false,
        overwriteExistingLineups: body.options?.overwriteExistingLineups ?? false,
        stopOnTie: body.options?.stopOnTie ?? true,
        stopOnMissingManualLineups: body.options?.stopOnMissingManualLineups ?? true,
        advanceAfterEachMatchday: body.options?.advanceAfterEachMatchday ?? true,
        includeMarketPhase: false,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Whole season dryrun is blocked.",
          summary: result,
          blockingReasons: result.blockingReasons,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      summary: result,
      warnings: result.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Whole season dryrun failed.",
        blockingReasons: ["whole_season_dryrun_failed"],
      },
      { status: 500 },
    );
  }
}
