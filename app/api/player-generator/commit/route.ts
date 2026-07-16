export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { PlayerGeneratorDraft } from "@/lib/data/olyDataTypes";
import { commitDraftAsFreeAgent } from "@/lib/player-generator/commit-draft-to-free-agent";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

/**
 * Player-Generator Phase 2 — "Als Free Agent übernehmen" commit route.
 *
 * Mirrors `app/api/sponsor/choose/route.ts`'s guarded-write idiom exactly:
 * sqlite-only (prisma is read-only in this build), `getActiveRoomBySaveId`
 * skip via `authorizeServerRoomWrite`, dry-run preview support, and a
 * `persistence.saveSingleplayerState` write only on a real (non-dry-run)
 * commit. The actual draft → Player mapping is pure and lives in
 * `lib/player-generator/commit-draft-to-free-agent.ts` so it stays unit
 * testable without hitting persistence.
 *
 * Unlike `sponsor_choice`, this action has no natural `teamId` (a free
 * agent isn't owned by any team), so it is registered as a host-level
 * action in `server-authoritative-write-guard.ts` — unrestricted in local
 * singleplayer, host-only inside a multiplayer room. It also intentionally
 * does NOT run `evaluateGamePhaseAction`: inserting a free agent into the
 * world pool doesn't touch a roster or spend team cash, so it isn't gated
 * by the buy/sell transfer-window phases the way an actual signing would be.
 */

type PlayerGeneratorCommitBody = {
  saveId?: string;
  draft?: PlayerGeneratorDraft;
  dryRun?: boolean;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  activeOwnerId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as PlayerGeneratorCommitBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !body.draft) {
      return NextResponse.json({ success: false, error: "saveId and draft are required.", summary: null }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId: null,
      action: "player_generator_commit",
      source,
      dryRun,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: writeAuth.reason,
          summary: null,
          warnings: writeAuth.warnings,
          blockingReasons: [writeAuth.reason],
        },
        { status: writeAuth.status },
      );
    }

    const result = commitDraftAsFreeAgent({ gameState: save.gameState, draft: body.draft, saveId });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, summary: null }, { status: 400 });
    }

    if (!dryRun) {
      persistence.saveSingleplayerState(saveId, result.gameState);
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId: null,
        action: "player_generator_commit",
        eventType: "save_updated",
        affectedViews: ["home", "generator", "transfermarkt"],
        dryRun: false,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        applied: !dryRun,
        playerId: result.playerId,
        playerName: result.player.name,
        rating: result.player.rating,
        marketValue: result.player.marketValue,
        salaryDemand: result.player.salaryDemand,
        potential: result.player.potential,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "player_generator_commit_failed",
        summary: null,
      },
      { status: 500 },
    );
  }
}
