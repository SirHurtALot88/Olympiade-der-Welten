import { NextResponse } from "next/server";

import { executeLocalTransfermarktSell, previewLocalTransfermarktSell } from "@/lib/market/transfermarkt-local-service";

type SellRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  activePlayerId?: string;
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SellRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const activePlayerId = body.activePlayerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !activePlayerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and activePlayerId are required.",
          summary: null,
          warnings: [],
        },
        { status: 400 },
      );
    }

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Fuer Verkaeufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
        },
        { status: 409 },
      );
    }

    const params = { saveId, seasonId, teamId, activePlayerId };
    const summary = dryRun ? previewLocalTransfermarktSell(params) : executeLocalTransfermarktSell(params);

    return NextResponse.json(
      {
        success: summary.canSell,
        summary,
        warnings: summary.warnings,
      },
      { status: summary.canSell ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt sell could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
      },
      { status: 500 },
    );
  }
}
