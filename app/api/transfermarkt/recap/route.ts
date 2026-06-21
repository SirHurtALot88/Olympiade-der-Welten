export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { buildTransferRecap } from "@/lib/market/transfer-recap-service";

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
    const result = await buildTransferRecap({
      source: searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite",
      saveId: searchParams.get("saveId")?.trim() || null,
      seasonId: searchParams.get("seasonId")?.trim() || null,
      teamId: searchParams.get("teamId")?.trim() || null,
      limit: parseOptionalNumber(searchParams.get("limit")),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer recap could not be loaded.";
    const status = message.includes("could not be loaded") ? 500 : 400;

    return NextResponse.json(
      {
        readOnly: true,
        source: "sqlite",
        scope: {
          saveId: null,
          seasonId: null,
          teamId: null,
        },
        summary: {
          buys: 0,
          sells: 0,
          totalSpend: 0,
          totalIncome: 0,
          totalSalaryFreed: 0,
        },
        topTransfersIn: [],
        topTransfersOut: [],
        biggestSpend: [],
        biggestProfit: [],
        bestValueDeals: [],
        riskyMoves: [],
        teamSummaries: [],
        warnings: [],
        error: message,
      },
      { status },
    );
  }
}
