import { NextResponse } from "next/server";

import {
  applySeasonEndXpSpend,
  previewSeasonEndXpSpend,
  type SeasonEndXpSpendPlannedUpgradeInput,
} from "@/lib/progression/season-end-xp-apply-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

type SeasonEndXpSpendBody = {
  saveId?: string;
  teamId?: string;
  plannedUpgrades?: SeasonEndXpSpendPlannedUpgradeInput[];
  dryRun?: boolean;
  confirmToken?: string | null;
  source?: "sqlite" | "prisma";
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

    const summary = dryRun
      ? previewSeasonEndXpSpend(save, teamId, plannedUpgrades)
      : applySeasonEndXpSpend(save, teamId, plannedUpgrades, body.confirmToken ?? null, persistence);
    const success = "applied" in summary ? summary.applied : summary.ok;

    return NextResponse.json(
      {
        success,
        summary,
        warnings: summary.warnings,
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
