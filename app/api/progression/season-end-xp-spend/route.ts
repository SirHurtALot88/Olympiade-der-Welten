import { NextResponse } from "next/server";

import {
  applySeasonEndXpSpend,
  previewSeasonEndXpSpend,
  type SeasonEndXpSpendPlannedUpgradeInput,
} from "@/lib/progression/season-end-xp-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type SeasonEndXpSpendBody = {
  saveId?: string;
  teamId?: string;
  plannedUpgrades?: SeasonEndXpSpendPlannedUpgradeInput[];
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
  controlMode?: "human" | "ai" | "passive" | "manual" | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SeasonEndXpSpendBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const plannedUpgrades = Array.isArray(body.plannedUpgrades) ? body.plannedUpgrades : [];
    const dryRun = body.dryRun !== false;

    if (source === "prisma") {
      return NextResponse.json({ success: false, error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
    }
    if (!saveId || !teamId) {
      return NextResponse.json(
        { success: false, error: "saveId and teamId are required.", summary: null },
        { status: 400 },
      );
    }

    const persistence = createPersistenceService();
    const save = persistence.getSaveById(saveId);
    if (!save) {
      return NextResponse.json({ success: false, error: "save_not_found", summary: null }, { status: 404 });
    }

    const preview = previewSeasonEndXpSpend(save, teamId, plannedUpgrades);
    const writeAuth = authorizeServerRoomWrite({
      roomCode: body.roomCode,
      participantId: body.participantId,
      seatToken: body.seatToken,
      userId: body.userId,
      saveId,
      teamId,
      action: "xp_spend",
      source,
      dryRun,
      confirmToken: body.confirmToken,
      expectedConfirmToken: preview.confirmToken,
      activeManagerTeamId: body.activeManagerTeamId,
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

    const summary = dryRun
      ? preview
      : applySeasonEndXpSpend(save, teamId, plannedUpgrades, body.confirmToken ?? null, persistence);
    const success = "applied" in summary ? summary.applied : summary.ok;

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
        error: error instanceof Error ? error.message : "Season-end XP spend failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
