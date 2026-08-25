export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerAttributeVisibility } from "@/lib/foundation/server-player-visibility";

/**
 * Bulk-Variante von /api/singleplayer-state/player-sheet: die Battle Arena
 * (app/foundation/battle-arena/) braucht die vollen Attribut-Bögen eines
 * KOMPLETTEN Kaders, nicht eines einzelnen Spielers — die kompakte Initial-
 * Payload streift `attributeSheetStats` bei allen außer dem eigenen Team
 * (siehe lib/persistence/foundation-initial-compact-state.ts), sonst müsste
 * der Host einen Request pro Spieler schicken.
 *
 * Dieselbe Fog-of-War-Maskierung wie bei der Einzelspieler-Route — aktuell
 * per DEBUG_FORCE_PLAYER_VISIBILITY global auf "exact", die Route ist aber
 * bereits korrekt fürs spätere Wieder-Einschalten des echten Scoutings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim();
  const teamId = searchParams.get("teamId")?.trim();
  const requestingTeamId = searchParams.get("requestingTeamId")?.trim() || null;

  if (!saveId || !teamId) {
    return NextResponse.json({ ok: false, error: "saveId and teamId are required." }, { status: 400 });
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    return NextResponse.json({ ok: false, error: `Save ${saveId} not found.` }, { status: 404 });
  }

  const rosterPlayerIds = new Set(
    save.gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId),
  );
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));

  const sheets = [...rosterPlayerIds].flatMap((playerId) => {
    const player = playerById.get(playerId);
    if (!player) return [];
    const visibility = resolvePlayerAttributeVisibility({
      gameState: save.gameState,
      playerId,
      requestingTeamId,
    });
    const isExact = visibility === "exact";
    return [
      {
        playerId,
        attributeSheetStats: isExact ? player.attributeSheetStats ?? null : null,
      },
    ];
  });

  return NextResponse.json({ ok: true, teamId, sheets });
}
