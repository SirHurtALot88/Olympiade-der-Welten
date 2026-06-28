export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { applyAiSeasonEndXpSpend, previewAiSeasonEndXpSpend } from "@/lib/progression/ai-xp-spend-planner";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type AiXpSpendBody = {
  saveId?: string;
  teamId?: string;
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AiXpSpendBody;
    const source = body.source === "prisma" ? "prisma" : "sqlite";
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
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

    if (!dryRun) {
      const writeAuth = authorizeServerRoomWrite({
        ...parseRoomWriteContextFromRequest(request),
        saveId,
        teamId,
        action: "ai_xp_spend_apply",
        source: "sqlite",
        dryRun,
        confirmToken: body.confirmToken ?? null,
      });
      if (!writeAuth.allowed) {
        return NextResponse.json(
          { success: false, error: writeAuth.reason, summary: null, warnings: writeAuth.warnings },
          { status: writeAuth.status },
        );
      }
    }

    const summary = dryRun
      ? previewAiSeasonEndXpSpend(save, teamId)
      : applyAiSeasonEndXpSpend(save, teamId, body.confirmToken ?? null, persistence);
    const success = "applied" in summary ? summary.applied : summary.blockers.length === 0 && summary.normalizedPlannedUpgrades.length > 0;
    const blockingReasons = "applied" in summary ? summary.blockingReasons : summary.blockers;

    return NextResponse.json(
      {
        success,
        summary,
        warnings: summary.warnings,
        blockingReasons,
      },
      { status: success || dryRun ? 200 : 409 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "AI XP spend failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
