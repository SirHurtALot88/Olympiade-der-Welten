export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildAiMarketPlanPreview } from "@/lib/ai/ai-market-plan-preview-service";

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
    const onlyAiTeams = searchParams.get("onlyAiTeams")?.trim();
    const result = await buildAiMarketPlanPreview({
      source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
      saveId: searchParams.get("saveId")?.trim() || null,
      seasonId: searchParams.get("seasonId")?.trim() || null,
      teamId: searchParams.get("teamId")?.trim() || searchParams.get("teamCode")?.trim() || null,
      teamScope:
        onlyAiTeams === "false" || searchParams.get("teamScope")?.trim() === "all"
          ? "all"
          : "ai",
      buyLimit: parseOptionalNumber(searchParams.get("buyLimit") ?? searchParams.get("limitBuysPerTeam")),
      sellLimit: parseOptionalNumber(searchParams.get("sellLimit") ?? searchParams.get("limitSellsPerTeam")),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI market plan preview could not be loaded.";
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
        holdTeams: 0,
        buyOnlyTeams: 0,
        sellOnlyTeams: 0,
        sellThenBuyTeams: 0,
        warningTeams: 0,
        blockedTeams: 0,
        summary: {
          aiTeams: 0,
          ready: 0,
          hold: 0,
          buyOnly: 0,
          sellOnly: 0,
          sellThenBuy: 0,
          warning: 0,
          blocked: 0,
        },
        teams: [],
        error: message,
      },
      { status },
    );
  }
}
