import { NextResponse } from "next/server";

import { buildAiLegacyLineupPreview } from "@/lib/ai/ai-legacy-lineup-engine";
import { LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
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

export async function GET(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  const source = parseSource(request);
  const contextResult =
    source === "prisma"
      ? await new LegacyLineupContextLoader().loadLegacyLineupContext(params)
      : loadLocalLegacyLineupContext(params);

  if (!contextResult.ok) {
    return NextResponse.json({ errors: contextResult.errors, warnings: contextResult.warnings }, { status: 422 });
  }

  const preview = buildAiLegacyLineupPreview(contextResult.context, source);

  return NextResponse.json({
    preview,
    source,
    readOnly: true,
  });
}
