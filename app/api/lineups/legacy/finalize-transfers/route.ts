export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { ensureLocalLegacyFormCardsForSeason } from "@/lib/lineups/legacy-lineup-local-service";
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

/**
 * "Transfers finalisieren" confirm endpoint (game-flow step `finalize_transfers`).
 *
 * This calls the EXISTING, unmodified `ensureLocalLegacyFormCardsForSeason`
 * (lib/lineups/legacy-lineup-local-service.ts) -- the same fixed positive/
 * negative-per-player form-card distribution the game already produces. That
 * function is idempotent: it only generates + persists the season's form-card
 * pool when no cards exist yet for that season, so calling this endpoint
 * again after transfers were already finalized is a safe no-op and never
 * re-distributes or replaces cards (unlike the destructive
 * `/api/lineups/legacy/form-cards` "regenerate" endpoint, which always
 * replaces the season's pool and is intentionally NOT used here).
 */
export async function POST(request: Request) {
  const params = parseKeyParams(request);
  if (!params) {
    return NextResponse.json({ error: "saveId, seasonId, matchdayId and teamId are required." }, { status: 400 });
  }

  const writeAuth = authorizeServerRoomWrite({
    ...parseRoomWriteContextFromRequest(request),
    saveId: params.saveId,
    teamId: params.teamId,
    // Reuses the existing "formcards_season_regenerate" write-permission
    // class: same team/save gating as the sibling form-cards endpoint, no
    // new TeamWriteAction literal needed for this confirm gate.
    action: "formcards_season_regenerate",
    source: "sqlite",
    dryRun: false,
  });
  if (!writeAuth.allowed) {
    return NextResponse.json({ error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
  }

  const result = ensureLocalLegacyFormCardsForSeason(params);
  if (!result.ok) {
    return NextResponse.json(
      {
        errors: result.errors,
        warnings: result.warnings,
      },
      { status: 422 },
    );
  }

  notifyRoomGameplayWrite(writeAuth, {
    saveId: params.saveId,
    teamId: params.teamId,
    action: "formcards_season_regenerate",
    eventType: "lineup_updated",
    affectedViews: ["home", "lineup", "matchday", "arena"],
    dryRun: false,
    success: true,
  });

  return NextResponse.json({
    summary: result,
    source: "sqlite",
    readOnly: false,
  });
}
