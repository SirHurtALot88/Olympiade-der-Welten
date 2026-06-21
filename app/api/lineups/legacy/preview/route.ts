export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import { buildLegacyLineupPreview } from "@/lib/lineups/legacy-lineup-context-loader";
import {
  calculateLocalLegacyLineupPreview,
} from "@/lib/lineups/legacy-lineup-local-service";
import { LegacyLineupService } from "@/lib/lineups/legacy-lineup-service";
import type { LegacyLineupEntryInput, LegacyLineupKeyParams } from "@/lib/lineups/legacy-lineup-types";

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

  if (parseSource(request) !== "prisma") {
    const preview = calculateLocalLegacyLineupPreview(params);
    if (!preview.ok) {
      return NextResponse.json({ errors: preview.errors, warnings: preview.warnings }, { status: 422 });
    }
    return NextResponse.json({ preview, source: "sqlite", readOnly: false });
  }

  const service = new LegacyLineupService();
  const preview = await service.calculateLegacyLineupPreview(params);
  return NextResponse.json({ preview, source: "prisma", readOnly: true });
}

export async function POST(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  let body: { entries?: LegacyLineupEntryInput[]; modifiers?: LineupDraftModifiers };
  try {
    body = (await request.json()) as { entries?: LegacyLineupEntryInput[]; modifiers?: LineupDraftModifiers };
  } catch {
    return NextResponse.json({ error: "valid JSON body with entries array is required." }, { status: 400 });
  }
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: "entries array is required." }, { status: 400 });
  }

  if (parseSource(request) !== "prisma") {
    const preview = calculateLocalLegacyLineupPreview(params, body.entries, body.modifiers);
    if (!preview.ok) {
      return NextResponse.json({ errors: preview.errors, warnings: preview.warnings }, { status: 422 });
    }

    return NextResponse.json({ preview, source: "sqlite", readOnly: false });
  }

  const preview = await buildLegacyLineupPreview(params, body.entries);
  if (!preview.ok) {
    return NextResponse.json({ errors: preview.errors, warnings: preview.warnings }, { status: 422 });
  }

  return NextResponse.json({ preview, source: "prisma", readOnly: true });
}
