export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import {
  applyAiMarketPlanLocally,
} from "@/lib/ai/ai-market-plan-apply-service";
import { isExplicitLocalTransferWindowPhase, LOCAL_TRANSFER_WINDOW_PHASE } from "@/lib/market/transfer-window-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveAiBulkTeamWriteScope } from "@/lib/room/ai-bulk-team-write-scope";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
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

  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body);
  const writeAuth = authorizeServerRoomWrite({
    ...roomWriteContext,
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

  // Server-side ownership ceiling on top of the host-level `writeAuth` above: a bulk AI market
  // apply may only ever buy/sell for AI/passive-controlled teams plus the caller's own team(s),
  // never another human participant's team — see `resolveAiBulkTeamWriteScope`. Read fresh so
  // nothing here trusts a client-supplied claim (including the `teamId` query param above, which
  // this route's host-level action does not otherwise validate ownership of). When the save can't
  // be resolved yet, omit the restriction and let the service's own save-resolution error surface
  // as before.
  const freshSaveForScope = createPersistenceService().getSaveById(saveId);
  const callerWritableTeamIds = freshSaveForScope
    ? Array.from(
        resolveAiBulkTeamWriteScope({
          gameState: freshSaveForScope.gameState,
          room: writeAuth.room,
          participant: writeAuth.participant,
          activeOwnerId: roomWriteContext.activeOwnerId,
        }).writableTeamIds,
      )
    : null;

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
      ...(callerWritableTeamIds ? { callerWritableTeamIds } : {}),
    });

    if (!dryRun && result.summary.appliedBuys + result.summary.appliedSells > 0) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId,
        action: "ai_market_plan_apply",
        eventType: "transfer_completed",
        affectedViews: ["home", "team", "market", "lineup"],
        dryRun: false,
        success: true,
      });
    }

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
