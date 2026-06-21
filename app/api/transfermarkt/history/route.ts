export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { listLocalTransferHistory } from "@/lib/market/transfermarkt-local-service";
import { listTransferHistory } from "@/lib/market/transfer-history-read-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || undefined;
    const allSeasons = searchParams.get("allSeasons") === "1";
    const teamId = searchParams.get("teamId")?.trim() || null;
    const typeParam = searchParams.get("type")?.trim() || null;
    const type = typeParam === "buy" || typeParam === "sell" ? typeParam : null;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const offsetParam = searchParams.get("offset");
    const offset = offsetParam ? Number(offsetParam) : undefined;

    const result = await (source === "sqlite" ? listLocalTransferHistory : listTransferHistory)({
      saveId,
      seasonId: allSeasons ? undefined : seasonId,
      allSeasons,
      teamId,
      type,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer history could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        total: 0,
        offset: 0,
        limit: 0,
        returned: 0,
        hasMore: false,
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
