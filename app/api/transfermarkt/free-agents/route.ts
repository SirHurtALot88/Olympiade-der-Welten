export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { listLocalTransfermarktFreeAgents } from "@/lib/market/transfermarkt-local-service";
import { listTransfermarktFreeAgents } from "@/lib/market/transfermarkt-read-service";

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
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const read = source === "sqlite" ? listLocalTransfermarktFreeAgents : listTransfermarktFreeAgents;
    const scoutingLevel = parseOptionalNumber(searchParams.get("scoutingLevel"));
    const compactList = searchParams.get("compact") !== "false";
    const result = await read({
      saveId: searchParams.get("saveId")?.trim() || null,
      seasonId: searchParams.get("seasonId")?.trim() || null,
      teamId: searchParams.get("teamId")?.trim() || null,
      limit: parseOptionalNumber(searchParams.get("limit")),
      offset: parseOptionalNumber(searchParams.get("offset")),
      search: searchParams.get("search")?.trim() || null,
      minMarketValue: parseOptionalNumber(searchParams.get("minMarketValue")),
      maxMarketValue: parseOptionalNumber(searchParams.get("maxMarketValue")),
      minSalary: parseOptionalNumber(searchParams.get("minSalary")),
      maxSalary: parseOptionalNumber(searchParams.get("maxSalary")),
      scoutingLevel,
      compactList,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt free agents could not be loaded.";
    const status = message.includes("DATABASE_URL") || message.includes("No save available") || message.includes("No season available")
      ? 500
      : 400;

    return NextResponse.json(
      {
        error: message,
        items: [],
        total: 0,
        offset: 0,
        limit: 0,
        returned: 0,
        hasMore: false,
        scope: null,
        teamContext: null,
        source: "derived_free_agents",
        notes: [],
        warnings: [],
        poolAudit: {
          activeFreeAgentCount: 0,
          visibleFeedCount: 0,
          marketValueBuckets: [
            { label: "0-5", count: 0 },
            { label: "5-10", count: 0 },
            { label: "10-20", count: 0 },
            { label: "20-30", count: 0 },
            { label: "30-50", count: 0 },
            { label: "50+", count: 0 },
          ],
          marketValueBrackets: Array.from({ length: 9 }, (_, index) => ({
            bracket: index + 1,
            label: `Bracket ${index + 1}`,
            rangeLabel:
              index === 0 ? "0-12.5"
                : index === 1 ? "12.5-17.5"
                : index === 2 ? "17.5-22.5"
                : index === 3 ? "22.5-30"
                : index === 4 ? "30-37.5"
                : index === 5 ? "37.5-45"
                : index === 6 ? "45-55"
                : index === 7 ? "55-70"
                : "70+",
            count: 0,
          })),
          cheapestVisiblePlayer: null,
          cheapestBuyablePlayer: null,
          cheapestCandidatePoolPlayer: null,
        },
      },
      { status },
    );
  }
}
