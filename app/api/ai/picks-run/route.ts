export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveAiBulkTeamWriteScope } from "@/lib/room/ai-bulk-team-write-scope";
import { parseRoomWriteContextFromRequestAndBody } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    teamScope?: "ai" | "all";
    teamIds?: string[] | null;
    allowSetupAllTeams?: boolean;
    includeManualTeams?: boolean;
    stepsPerTeam?: number | null;
    runMode?: "default" | "season1_optimum_execute" | null;
  };
  const dryRun = body.dryRun ?? true;

  if (!dryRun && body.confirmToken !== AI_PICKS_RUN_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "AI picks execute requires the explicit confirm token.",
        confirmTokenRequired: AI_PICKS_RUN_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  const roomWriteContext = parseRoomWriteContextFromRequestAndBody(request, body);
  const writeAuth = authorizeServerRoomWrite({
    ...roomWriteContext,
    saveId,
    action: "ai_picks_run_execute",
    source: "sqlite",
    dryRun,
    confirmToken: body.confirmToken ?? null,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  // Server-side ownership ceiling on top of the host-level `writeAuth` above: a bulk AI picks run
  // may only ever touch AI/passive-controlled teams plus the caller's own team(s), never another
  // human participant's team — see `resolveAiBulkTeamWriteScope`. Read fresh so nothing here trusts
  // a client-supplied claim. When the save can't be resolved yet, omit the restriction and let the
  // service's own save-resolution error surface as before.
  //
  // Stufe 0.3 (Befund B2): die Identitaet fuer den Nicht-Raum-Fall kommt serverseitig aus der
  // Sitzung (`resolveAuthoritativeWriteOwnerId`), nicht mehr aus `roomWriteContext.activeOwnerId`.
  const freshSaveForScope = createPersistenceService().getSaveById(saveId);
  const scopeOwnerId = await resolveAuthoritativeWriteOwnerId();
  const callerWritableTeamIds = freshSaveForScope
    ? Array.from(
        resolveAiBulkTeamWriteScope({
          gameState: freshSaveForScope.gameState,
          room: writeAuth.room,
          participant: writeAuth.participant,
          activeOwnerId: scopeOwnerId,
        }).writableTeamIds,
      )
    : null;

  try {
    const teamIds = Array.isArray(body.teamIds) ? body.teamIds : null;
    const result = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
      teamScope: body.teamScope === "all" ? "all" : "ai",
      ...(teamIds ? { teamIds } : {}),
      allowSetupAllTeams: body.allowSetupAllTeams ?? false,
      // Darf der Lauf ein menschlich gesteuertes Team anfassen? Standard NEIN. Der Client darf das
      // setzen (die Nachpick-Knoepfe brauchen es fuer das EIGENE Team), aber `callerWritableTeamIds`
      // darunter ist serverseitig berechnet und begrenzt jeden Lauf auf die Teams, die der
      // Aufrufer schreiben darf — fremde Koop-Teilnehmer bleiben damit auch hier geschuetzt.
      includeManualTeams: body.includeManualTeams ?? false,
      stepsPerTeam: body.stepsPerTeam ?? parseOptionalNumber(searchParams.get("stepsPerTeam")),
      runMode: body.runMode === "season1_optimum_execute" ? "season1_optimum_execute" : "default",
      ...(callerWritableTeamIds ? { callerWritableTeamIds } : {}),
    });

    if (!dryRun && (result.globalExecution?.appliedPickCount ?? 0) > 0) {
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "ai_picks_run_execute",
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
        error: error instanceof Error ? error.message : "AI picks run failed.",
      },
      { status: 500 },
    );
  }
}
