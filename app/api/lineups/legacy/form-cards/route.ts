export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { generateLocalLegacyFormCardsForSeason } from "@/lib/lineups/legacy-lineup-local-service";
import type { LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";

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

function parseSource(request: Request) {
  return new URL(request.url).searchParams.get("source")?.trim() === "prisma" ? "prisma" : "sqlite";
}

export async function POST(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  if (parseSource(request) === "prisma") {
    return NextResponse.json(
      {
        error: "Prisma/Supabase mode is read-only in this build.",
      },
      { status: 409 },
    );
  }

  const result = generateLocalLegacyFormCardsForSeason(params);
  if (!result.ok) {
    return NextResponse.json(
      {
        errors: result.errors,
        warnings: result.warnings,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    summary: result,
    source: "sqlite",
    readOnly: false,
  });
}
