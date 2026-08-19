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
import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

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

    // Stufe 0.3 (Befund B2): Identitaet AUSSERHALB eines Raums kommt serverseitig aus der Sitzung,
    // nie aus `body.activeOwnerId` — siehe Kommentar an `resolveAuthoritativeWriteOwnerId`.
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
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
      activeOwnerId,
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

    let persisted = null as ReturnType<typeof persistence.saveSingleplayerState> | null;
    if (!dryRun) {
      persisted = persistence.saveSingleplayerState(saveId, nextGameState);
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

    // `saveVersion` mitgeben — siehe Begruendung in `app/api/sponsor/choose/route.ts`.
    return NextResponse.json({
      success: true,
      applied: !dryRun,
      watchlist: getScoutingWatchlistForTeam(nextGameState, teamId),
      saveVersion: persisted ? persisted.gameState.saveVersion : save.gameState.saveVersion,
    });
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "scouting_watchlist_failed" },
      { status: 500 },
    );
  }
}
