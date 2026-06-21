export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";

  if (!saveId || !seasonId || !matchdayId) {
    return NextResponse.json({ error: "saveId, seasonId and matchdayId are required." }, { status: 400 });
  }

  if (parseSource(request) === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    confirm?: boolean;
    includeWarningTeams?: boolean;
    overwriteExisting?: boolean;
    forceAiTeams?: boolean;
  };

  const dryRun = body.dryRun ?? true;
  if (!dryRun && body.confirm !== true) {
    return NextResponse.json(
      {
        error: "Batch apply requires explicit confirm=true.",
      },
      { status: 409 },
    );
  }

  try {
    const result = applyAiLegacyLineupBatchLocally({
      saveId,
      seasonId,
      matchdayId,
      dryRun,
      includeWarningTeams: body.includeWarningTeams ?? false,
      overwriteExisting: body.overwriteExisting ?? false,
      forceAiTeams: body.forceAiTeams ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI batch apply failed.",
      },
      { status: 500 },
    );
  }
}
