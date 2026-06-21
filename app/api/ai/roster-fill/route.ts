export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { AUTO_ROSTER_FILL_CONFIRM_TOKEN } from "@/lib/ai/auto-roster-fill-contract";
import {
  runAutoRosterFillForMatchdaySetup,
} from "@/lib/ai/auto-roster-fill-service";

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
  };
  const dryRun = body.dryRun ?? true;

  if (!dryRun && body.confirmToken !== AUTO_ROSTER_FILL_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "Roster fill execute requires the explicit confirm token.",
        confirmTokenRequired: AUTO_ROSTER_FILL_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  try {
    const result = await runAutoRosterFillForMatchdaySetup({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Auto roster fill failed.",
      },
      { status: 500 },
    );
  }
}
