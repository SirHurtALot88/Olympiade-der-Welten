export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import {
  advanceSeasonTransitionStep,
  advanceSeasonTransitionToTransferWindow,
  buildSeasonTransitionPreview,
  startSeasonTransition,
} from "@/lib/season/season-transition-service";

type SeasonTransitionBody = {
  saveId?: string;
  dryRun?: boolean;
  /**
   * `advance_step` schaltet den Assistenten eine Station weiter. Ohne diese Aktion endete die
   * Kette bei `season_review` — und weil Verkaufen erst in `preseason_management` /
   * `transfer_sell_phase` oeffnet, war es nach dem ersten Spieltag dauerhaft zu.
   */
  /**
   * `open_transfer_window` schaltet in einem Zug bis zur ersten Phase mit offenem
   * Transferfenster durch. Der Saisonabschluss-Bildschirm schickt zum Kader ("Im Kader kannst
   * du verhandeln") — ohne diesen Weg war dort jede Handlung gesperrt.
   */
  action?: "start_transition" | "advance_step" | "open_transfer_window" | "preview";
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SeasonTransitionBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId) {
      return NextResponse.json({ success: false, error: "saveId is required.", summary: null }, { status: 400 });
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
      action: "season_transition",
      source,
      dryRun,
    });
    if (!writeAuth.allowed) {
      return NextResponse.json(
        { success: false, error: writeAuth.reason, summary: null, warnings: writeAuth.warnings, blockingReasons: [writeAuth.reason] },
        { status: writeAuth.status },
      );
    }

    // `advance_step` ist seit der KI-Verkaufs-Verdrahtung asynchron (der Schritt „Verkaeufe" laesst
    // die Transferfenster-Sitzung laufen). Das `await` steht vor dem ganzen Ausdruck, damit die
    // uebrigen, weiterhin synchronen Zweige unveraendert bleiben — `await` auf einen Nicht-Promise
    // reicht ihn unveraendert durch.
    const summary = await (dryRun
      ? buildSeasonTransitionPreview(save)
      : body.action === "start_transition"
        ? startSeasonTransition(save, persistence)
        : body.action === "advance_step"
          ? advanceSeasonTransitionStep(save, persistence)
          : body.action === "open_transfer_window"
            ? advanceSeasonTransitionToTransferWindow(save, persistence)
            : buildSeasonTransitionPreview(save));
    const success = "applied" in summary ? Boolean(summary.applied) : summary.ok;
    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      action: "season_transition",
      eventType: "season_advanced",
      affectedViews: ["home", "season", "team", "contracts"],
      dryRun,
      success,
    });

    return NextResponse.json(
      {
        success,
        summary,
        warnings: [...writeAuth.warnings, ...summary.warnings],
        blockingReasons: summary.blockingReasons,
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Season transition failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
