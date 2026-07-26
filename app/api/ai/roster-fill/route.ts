export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import {
  runAutoRosterFillForMatchdaySetup,
} from "@/lib/ai/auto-roster-fill-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveAiBulkTeamWriteScope } from "@/lib/room/ai-bulk-team-write-scope";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";

  if (!saveId || !seasonId) {
    return NextResponse.json({ error: "saveId and seasonId are required." }, { status: 400 });
  }

  if (source === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    confirmToken?: string | null;
  };
  const dryRun = body.dryRun ?? true;

  if (!dryRun && body.confirmToken !== AUTO_ROSTER_FILL_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "Roster fill execute requires the explicit confirm token.",
        confirmTokenRequired: AUTO_ROSTER_FILL_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body);
  const writeAuth = authorizeServerRoomWrite({
    ...roomWriteContext,
    saveId,
    action: "ai_roster_fill_execute",
    source: "sqlite",
    dryRun,
    confirmToken: body.confirmToken ?? null,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  // Server-side ownership ceiling on top of the host-level `writeAuth` above: a bulk roster-fill run
  // may only ever buy for AI/passive-controlled teams plus the caller's own team(s), never another
  // human participant's team — see `resolveAiBulkTeamWriteScope`. Read fresh so nothing here trusts
  // a client-supplied claim. When the save can't be resolved yet, omit the restriction and let the
  // service's own save-resolution error surface as before.
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
    const result = await runAutoRosterFillForMatchdaySetup({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
      ...(callerWritableTeamIds ? { callerWritableTeamIds } : {}),
    });

    if (!dryRun && result.summary.appliedBuys > 0) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "ai_roster_fill_execute",
        eventType: "roster_updated",
        affectedViews: ["home", "team", "lineup"],
        dryRun: false,
        success: true,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Auto roster fill failed.",
      },
      { status: 500 },
    );
  }
}
