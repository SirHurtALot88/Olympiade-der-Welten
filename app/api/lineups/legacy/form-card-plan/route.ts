export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { saveLocalLegacyFormCardPlan } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";

function parseKeyParams(request: Request): LegacyLineupKeyParams | null {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim() ?? "";
  const seasonId = searchParams.get("seasonId")?.trim() ?? "";
  const matchdayId = searchParams.get("matchdayId")?.trim() ?? "";
  const teamId = searchParams.get("teamId")?.trim() ?? "";

  if (!saveId || !seasonId || !matchdayId || !teamId) {
    return null;
  }

  return { saveId, seasonId, matchdayId, teamId };
}

export async function PUT(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  if (new URL(request.url).searchParams.get("source")?.trim() === "prisma") {
    return NextResponse.json({ error: "Prisma/Supabase mode is read-only in this build." }, { status: 409 });
  }

  const body = (await request.json()) as {
    disciplineSide?: "d1" | "d2";
    disciplineId?: string | null;
    primaryFormCardId?: string | null;
    secondaryFormCardId?: string | null;
  };
  if (body.disciplineSide !== "d1" && body.disciplineSide !== "d2") {
    return NextResponse.json({ error: "disciplineSide must be d1 or d2." }, { status: 400 });
  }

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequest(request),
    saveId: params.saveId,
    teamId: params.teamId,
    action: "formcards",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  const result = saveLocalLegacyFormCardPlan({
    ...params,
    disciplineSide: body.disciplineSide,
    disciplineId: body.disciplineId ?? null,
    primaryFormCardId: body.primaryFormCardId ?? null,
    secondaryFormCardId: body.secondaryFormCardId ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors, warnings: result.warnings, plans: result.plans }, { status: 422 });
  }

  notifyRoomGameplayWrite(writeAuth, {
    saveId: params.saveId,
    teamId: params.teamId,
    action: "formcards",
    eventType: "lineup_updated",
    affectedViews: ["home", "lineup", "matchday", "arena"],
    dryRun: false,
    success: true,
  });

  return NextResponse.json({ source: "sqlite", readOnly: false, plans: result.plans, warnings: result.warnings });
}
