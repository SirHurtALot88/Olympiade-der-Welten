export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildAiNeedsPicksCompare } from "@/lib/ai/ai-needs-picks-compare-service";

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTeamIds(value: string | null) {
  if (!value) {
    return null;
  }

  const rows = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return rows.length > 0 ? rows : null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await buildAiNeedsPicksCompare({
      source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
      saveId: searchParams.get("saveId")?.trim() || null,
      seasonId: searchParams.get("seasonId")?.trim() || null,
      teamId: searchParams.get("teamId")?.trim() || searchParams.get("teamCode")?.trim() || null,
      teamScope: searchParams.get("teamScope")?.trim() === "all" ? "all" : "ai",
      teamIds: parseTeamIds(searchParams.get("teamIds")),
      limit: parseOptionalNumber(searchParams.get("limit")),
      steps: parseOptionalNumber(searchParams.get("steps")),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI needs/picks compare could not be loaded.";
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
        comparedTeams: 0,
        matchedTeams: 0,
        partialTeams: 0,
        deviatedTeams: 0,
        missingRetoolTeams: 0,
        blockedTeams: 0,
        teams: [],
        retoolParityMatrix: [],
        error: message,
      },
      { status },
    );
  }
}
