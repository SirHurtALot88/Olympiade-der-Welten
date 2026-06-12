import { NextResponse } from "next/server";

import { buildAiTransfermarktPreview } from "@/lib/ai/ai-transfermarkt-preview-service";

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await buildAiTransfermarktPreview({
      source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
      saveId: searchParams.get("saveId")?.trim() || null,
      seasonId: searchParams.get("seasonId")?.trim() || null,
      teamId: searchParams.get("teamId")?.trim() || null,
      teamScope: searchParams.get("teamScope")?.trim() === "all" ? "all" : "ai",
      limit: parseOptionalNumber(searchParams.get("limit")),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI transfer preview could not be loaded.";
    const status = message.includes("could not be loaded") ? 500 : 400;

    return NextResponse.json(
      {
        readOnly: true,
        source: "sqlite",
        scope: null,
        totalTeams: 0,
        aiTeams: 0,
        skippedManual: 0,
        skippedPassive: 0,
        skippedDisabled: 0,
        readyTeams: 0,
        warningTeams: 0,
        blockedTeams: 0,
        teams: [],
        error: message,
      },
      { status },
    );
  }
}
