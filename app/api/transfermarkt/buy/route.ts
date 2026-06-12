import { NextResponse } from "next/server";

import { executeLocalTransfermarktBuy, previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import type { ContractShape } from "@/lib/data/olyDataTypes";

type BuyRequestBody = {
  saveId?: string;
  seasonId?: string;
  teamId?: string;
  playerId?: string;
  contractLength?: number;
  contractShape?: ContractShape;
  offeredSalary?: number;
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BuyRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const seasonId = body.seasonId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const dryRun = body.dryRun !== false;
    const source = body.source === "prisma" ? "prisma" : "sqlite";

    if (!saveId || !seasonId || !teamId || !playerId) {
      return NextResponse.json(
        {
          success: false,
          error: "saveId, seasonId, teamId and playerId are required.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 400 },
      );
    }

    const params = {
      saveId,
      seasonId,
      teamId,
      playerId,
      contractLength: body.contractLength,
      contractShape: body.contractShape,
      offeredSalary: body.offeredSalary,
    };

    if (source === "prisma") {
      return NextResponse.json(
        {
          success: false,
          error: "Prisma-Referenz ist read-only. Fuer Kaeufe bitte lokalen Testspielstand starten.",
          summary: null,
          warnings: [],
          scope: { saveId, seasonId, teamId, playerId, dryRun, source },
        },
        { status: 409 },
      );
    }

    const summary = dryRun
      ? previewLocalTransfermarktBuy(params)
      : executeLocalTransfermarktBuy(params);

    return NextResponse.json(
      {
        success: summary.canBuy,
        summary,
        warnings: summary.warnings,
        scope: { saveId, seasonId, teamId, playerId, dryRun, source },
      },
      { status: summary.canBuy ? 200 : 409 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfermarkt buy could not be processed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        summary: null,
        warnings: [],
        scope: null,
      },
      { status: 500 },
    );
  }
}
