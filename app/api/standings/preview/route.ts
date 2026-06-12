import { NextResponse } from "next/server";

import { buildStandingsPreview } from "@/lib/standings/standings-preview-engine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || "active";
    const seasonId = searchParams.get("seasonId")?.trim() || "season-1";
    const matchdayId = searchParams.get("matchdayId")?.trim() || "matchday-1";
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

    const result = await buildStandingsPreview({
      saveId,
      seasonId,
      matchdayId,
      source,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Standings preview could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        summary: {
          totalTeams: 0,
          matchdayResultFound: false,
          readyTeams: 0,
          blockedTeamCount: 0,
        },
        blockedRules: ["preview_load_failed"],
        source: {
          mode: "sqlite",
          matchdayResult: "missing",
          currentPoints: "sheet_mapping_missing",
          standingsRules: "global_total_score_preview",
          fixtureCoverage: "missing_before_after_snapshots",
        },
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
