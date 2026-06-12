import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildSeasonTransitionPreview, startSeasonTransition } from "@/lib/season/season-transition-service";

type SeasonTransitionBody = {
  saveId?: string;
  dryRun?: boolean;
  action?: "start_transition" | "preview";
  source?: "sqlite" | "prisma";
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

    const summary = dryRun || body.action !== "start_transition"
      ? buildSeasonTransitionPreview(save)
      : startSeasonTransition(save, persistence);
    const success = "applied" in summary ? Boolean(summary.applied) : summary.ok;

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
        error: error instanceof Error ? error.message : "Season transition failed.",
        summary: null,
      },
      { status: 500 },
    );
  }
}
