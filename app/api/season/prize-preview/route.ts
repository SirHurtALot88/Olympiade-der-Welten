export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get("saveId")?.trim() || "active";
    const seasonId = searchParams.get("seasonId")?.trim() || "season-1";
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const phase = searchParams.get("phase")?.trim() === "matchday" ? "matchday" : "season_end";

    const result = await buildPrizeMoneyPreview({ saveId, seasonId, source, phase });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prize preview could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        blockedRules: ["prize_preview_load_failed"],
        globalWarnings: [],
        flowPolicy: "season_end_only",
        summary: { totalTeams: 0, calculableTeams: 0, prizeRowsCount: 0, blockedItemsCount: 0 },
        source: { mode: "sqlite", standings: "local_save", prizeTable: "missing" },
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
