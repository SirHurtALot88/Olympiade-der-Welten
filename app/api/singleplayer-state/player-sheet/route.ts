export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim();
  const playerId = searchParams.get("playerId")?.trim();

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

  return NextResponse.json({
    ok: true,
    playerId,
    attributeSheetStats: player.attributeSheetStats ?? null,
    attributeSheetRatings: player.attributeSheetRatings ?? null,
  });
}
