import { NextResponse } from "next/server";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    confirmToken?: string | null;
    teamScope?: "ai" | "all";
    allowSetupAllTeams?: boolean;
    stepsPerTeam?: number | null;
    runMode?: "default" | "season1_optimum_execute" | null;
  };
  const dryRun = body.dryRun ?? true;

  if (!dryRun && body.confirmToken !== AI_PICKS_RUN_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "AI picks execute requires the explicit confirm token.",
        confirmTokenRequired: AI_PICKS_RUN_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  try {
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
      teamScope: body.teamScope === "all" ? "all" : "ai",
      allowSetupAllTeams: body.allowSetupAllTeams ?? false,
      stepsPerTeam: body.stepsPerTeam ?? parseOptionalNumber(searchParams.get("stepsPerTeam")),
      runMode: body.runMode === "season1_optimum_execute" ? "season1_optimum_execute" : "default",
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI picks run failed.",
      },
      { status: 500 },
    );
  }
}
