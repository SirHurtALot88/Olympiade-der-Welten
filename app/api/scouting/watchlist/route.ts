export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  addScoutingWatchlistEntry,
  getScoutingWatchlistForTeam,
  removeScoutingWatchlistEntry,
} from "@/lib/scouting/scouting-watchlist-service";
import {
  canAddManualScoutingWatchEntry,
  getScoutingWishlistSlotMessage,
} from "@/lib/scouting/scouting-wishlist-slots";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";

type ScoutingWatchlistBody = {
  saveId?: string;
  teamId?: string;
  playerId?: string;
  action?: "add" | "remove";
  note?: string | null;
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
    const body = (await request.json().catch(() => ({}))) as ScoutingWatchlistBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const action = body.action === "remove" ? "remove" : "add";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId || !playerId) {
      return NextResponse.json({ success: false, error: "saveId, teamId and playerId are required." }, { status: 400 });
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found" }, { status: 404 });
    }

    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "buy",
      source,
      dryRun,
      activeManagerTeamId: body.activeManagerTeamId,
      activeOwnerId: body.activeOwnerId,
      controlMode: body.controlMode,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason }, { status: writeAuth.status });
    }

    const currentWatchlist = getScoutingWatchlistForTeam(save.gameState, teamId);
    if (action === "add") {
      if (currentWatchlist.some((entry) => entry.playerId === playerId)) {
        return NextResponse.json(
          {
            success: false,
            error: "watchlist_player_already_listed",
            applied: false,
            watchlist: currentWatchlist,
          },
          { status: 409 },
        );
      }

      const slotCheck = canAddManualScoutingWatchEntry(save.gameState, teamId);
      if (!slotCheck.ok) {
        return NextResponse.json(
          {
            success: false,
            error: slotCheck.reason ?? "watchlist_slots_full",
            message: getScoutingWishlistSlotMessage(slotCheck),
            applied: false,
            watchlist: currentWatchlist,
          },
          { status: 409 },
        );
      }
    } else if (!currentWatchlist.some((entry) => entry.playerId === playerId)) {
      return NextResponse.json(
        {
          success: false,
          error: "watchlist_player_not_listed",
          applied: false,
          watchlist: currentWatchlist,
        },
        { status: 404 },
      );
    }

    const nextGameState =
      action === "remove"
        ? removeScoutingWatchlistEntry({ gameState: save.gameState, teamId, playerId })
        : addScoutingWatchlistEntry({ gameState: save.gameState, teamId, playerId, note: body.note });

    if (nextGameState === save.gameState) {
      return NextResponse.json(
        {
          success: false,
          error: "watchlist_unchanged",
          applied: false,
          watchlist: currentWatchlist,
        },
        { status: 409 },
      );
    }

    if (!dryRun) {
      persistence.saveSingleplayerState(saveId, nextGameState);
      notifyRoomGameplayWrite(writeAuth, {
        saveId,
        teamId,
        action: "scouting_watchlist",
        eventType: "save_updated",
        affectedViews: ["home", "scouting"],
        dryRun: false,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      applied: !dryRun,
      watchlist: getScoutingWatchlistForTeam(nextGameState, teamId),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "scouting_watchlist_failed" },
      { status: 500 },
    );
  }
}
