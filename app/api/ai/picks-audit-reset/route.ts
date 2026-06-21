export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AI_PICK_AUDIT_RESET_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-audit-reset-contract";
import { runAiPickAuditReset } from "@/lib/ai/ai-pick-audit-reset-service";

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
    force?: boolean;
  };
  const dryRun = body.dryRun ?? true;

  if (!dryRun && body.confirmToken !== AI_PICK_AUDIT_RESET_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "AI pick reset execute requires the explicit confirm token.",
        confirmTokenRequired: AI_PICK_AUDIT_RESET_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  try {
    const result = await runAiPickAuditReset({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
      force: body.force ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI pick audit/reset failed.",
      },
      { status: 500 },
    );
  }
}
