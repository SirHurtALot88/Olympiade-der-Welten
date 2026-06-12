import { NextResponse } from "next/server";

import { listLocalTransferHistory } from "@/lib/market/transfermarkt-local-service";
import { listTransferHistory } from "@/lib/market/transfer-history-read-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
    const saveId = searchParams.get("saveId")?.trim() || undefined;
    const seasonId = searchParams.get("seasonId")?.trim() || undefined;
    const teamId = searchParams.get("teamId")?.trim() || null;
    const typeParam = searchParams.get("type")?.trim() || null;
    const type = typeParam === "buy" || typeParam === "sell" ? typeParam : null;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await (source === "sqlite" ? listLocalTransferHistory : listTransferHistory)({
      saveId,
      seasonId,
      teamId,
      type,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer history could not be loaded.";
    return NextResponse.json(
      {
        items: [],
        total: 0,
        scope: null,
        error: message,
      },
      { status: 500 },
    );
  }
}
