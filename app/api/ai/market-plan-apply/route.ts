export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  applyAiMarketPlanLocally,
} from "@/lib/ai/ai-market-plan-apply-service";
import { isExplicitLocalTransferWindowPhase, LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const teamId = searchParams.get("teamId")?.trim() || searchParams.get("teamCode")?.trim() || null;
  const teamScope = searchParams.get("teamScope")?.trim() === "all" ? "all" : "ai";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (parseSource(request) === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    includeWarningTeams?: boolean;
    confirmToken?: string;
    transferPhase?: string;
    options?: {
      includeWarningTeams?: boolean;
      applySellSteps?: boolean;
      applyBuySteps?: boolean;
      maxBuysPerTeam?: number | null;
      previewBuyLimit?: number | null;
      previewSellLimit?: number | null;
      performanceBudgetMs?: number | null;
      stopOnTeamFailure?: boolean;
    };
  };

  const dryRun = body.dryRun ?? true;
  if (!dryRun && body.confirmToken !== AI_MARKET_APPLY_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "AI market apply requires the explicit confirm token.",
        confirmTokenRequired: AI_MARKET_APPLY_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }
  if (!dryRun && !isExplicitLocalTransferWindowPhase(body.transferPhase)) {
    return NextResponse.json(
      {
        error: "AI market apply requires an explicit local transfer window phase.",
        transferPhaseRequired: LOCAL_TRANSFER_WINDOW_PHASE,
      },
      { status: 409 },
    );
  }

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequestAndBody(request, body),
    saveId,
    teamId,
    action: "ai_market_plan_apply",
    source: "sqlite",
    dryRun,
    confirmToken: body.confirmToken ?? null,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  try {
    const result = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId,
      seasonId,
      teamId,
      teamScope,
      dryRun,
      includeWarningTeams: body.includeWarningTeams ?? false,
      confirmToken: body.confirmToken ?? null,
      transferPhase: body.transferPhase ?? null,
      options: body.options,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI market apply failed.",
      },
      { status: 500 },
    );
  }
}
