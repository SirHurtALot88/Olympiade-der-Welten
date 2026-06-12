import { NextResponse } from "next/server";

import { executeMatchdayAdvance, previewMatchdayAdvance } from "@/lib/season/matchday-progress-service";

type MatchdayAdvanceRequestBody = {
  saveId?: string;
  seasonId?: string;
  source?: "sqlite" | "prisma";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MatchdayAdvanceRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const source: "sqlite" | "prisma" = body.source === "prisma" ? "prisma" : "sqlite";
    const execute = body.execute === true;
    const dryRun = execute ? false : body.dryRun ?? true;

    if (!saveId || !seasonId) {
      return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
    }

    const params = { saveId, seasonId, source, dryRun, execute, confirm: body.confirm };
    const result = execute ? await executeMatchdayAdvance(params) : await previewMatchdayAdvance(params);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.blockingReasons[0] ?? "Matchday advance is blocked.",
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
      warnings: result.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matchday advance preview could not be loaded.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        blockingReasons: ["matchday_advance_preview_failed"],
      },
      { status: 500 },
    );
  }
}
