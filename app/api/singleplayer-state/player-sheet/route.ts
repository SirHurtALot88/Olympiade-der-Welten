export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerAttributeVisibility } from "@/lib/foundation/server-player-visibility";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim();
  const playerId = searchParams.get("playerId")?.trim();
  // Requesting-Team-Kontext für die Fog-of-War-Maskierung (T-020). Analog zum
  // `teamId`-Query-Param anderer save-scoped Reads (z. B.
  // /api/transfermarkt/free-agents) — es gibt keine Server-Session, aus der
  // sich das anfragende Team ableiten ließe.
  const teamId = searchParams.get("teamId")?.trim() || null;

  if (!saveId || !playerId) {
    return NextResponse.json({ ok: false, error: "saveId and playerId are required." }, { status: 400 });
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ ok: false, error: `Save ${saveId} not found.` }, { status: 404 });
  }

  const player = save.gameState.players.find((entry) => entry.id === playerId) ?? null;
  if (!player) {
    return NextResponse.json({ ok: false, error: `Player ${playerId} not found.` }, { status: 404 });
  }

  const visibility = resolvePlayerAttributeVisibility({
    gameState: save.gameState,
    playerId,
    requestingTeamId: teamId,
  });
  const isExact = visibility === "exact";

  return NextResponse.json({
    ok: true,
    playerId,
    attributeSheetStats: isExact ? player.attributeSheetStats ?? null : null,
    attributeSheetRatings: isExact ? player.attributeSheetRatings ?? null : null,
  });
}
