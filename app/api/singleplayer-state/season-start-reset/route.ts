export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { assertSaveNotRoomBound } from "@/lib/room/assert-save-not-room-bound";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";

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

  if (!dryRun && body.confirmToken !== SEASON_START_RESET_CONFIRM_TOKEN) {
    return NextResponse.json(
      {
        error: "Season start reset execute requires the explicit confirm token.",
        confirmTokenRequired: SEASON_START_RESET_CONFIRM_TOKEN,
      },
      { status: 409 },
    );
  }

  // Nur der Execute-Pfad (`dryRun === false`) persistiert (season-start-reset-service.ts:326-330) —
  // die Preview darf auf einem raumgebundenen Save weiterhin laufen.
  if (!dryRun) {
    const roomCheck = assertSaveNotRoomBound(saveId, "season_start_reset");
    if (roomCheck.blocked) {
      return NextResponse.json({ error: roomCheck.reason }, { status: roomCheck.status });
    }
  }

  try {
    const result = await runSeasonStartReset({
      source: "sqlite",
      saveId,
      seasonId,
      dryRun,
      confirmToken: body.confirmToken ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Season start reset failed.",
      },
      { status: 500 },
    );
  }
}
