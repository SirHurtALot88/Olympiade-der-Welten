export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_PICK_IMPORT_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-import-contract";
import { runAiPickImportReplace } from "@/lib/ai/ai-pick-import-service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    source?: "sqlite" | "prisma";
    sourceSaveId?: string;
    targetSaveId?: string;
    seasonId?: string;
    dryRun?: boolean;
    confirmToken?: string | null;
  };

  const sourceSaveId = body.sourceSaveId?.trim() ?? "";
  const targetSaveId = body.targetSaveId?.trim() ?? "";
  const seasonId = body.seasonId?.trim() ?? "";
  const source = body.source === "prisma" ? "prisma" : "sqlite";
  const dryRun = body.dryRun ?? true;

  if (!sourceSaveId || !targetSaveId || !seasonId) {
    return NextResponse.json({ error: "sourceSaveId, targetSaveId and seasonId are required." }, { status: 400 });
  }

  if (!dryRun && body.confirmToken !== AI_PICK_IMPORT_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "AI pick import execute requires the explicit confirm token.",
        confirmTokenRequired: AI_PICK_IMPORT_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  try {
    const result = await runAiPickImportReplace({
      source,
      sourceSaveId,
      targetSaveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI pick import failed.",
      },
      { status: 500 },
    );
  }
}

