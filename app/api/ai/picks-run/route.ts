export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

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
    teamIds?: string[] | null;
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

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequest(request),
    saveId,
    action: "ai_picks_run_execute",
    source: "sqlite",
    dryRun,
    confirmToken: body.confirmToken ?? null,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  try {
    const teamIds = Array.isArray(body.teamIds) ? body.teamIds : null;
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
      teamScope: body.teamScope === "all" ? "all" : "ai",
      ...(teamIds ? { teamIds } : {}),
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
