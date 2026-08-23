export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerAttributeVisibility } from "@/lib/foundation/server-player-visibility";
import { buildPlayerDisciplineRankOverride } from "@/lib/foundation/player-discipline-rank-service";

/**
 * Saison-/All-Time-Rang je Disziplin für EINEN Spieler, gerechnet auf dem
 * vollständigen Save (bug-2026-08-04T13-23-39-256Z-uzetn6). Siehe
 * `buildPlayerDisciplineRankOverride` für die volle Begründung.
 *
 * Analog zu `player-sheet` (derselbe Ordner): ein saveId+playerId-Read, kein
 * Team-weiter Slice — der Player-Directory-Slice (Spielerliste) ist für diesen
 * einzelnen sichtbaren Spieler unnötig groß.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saveId = searchParams.get("saveId")?.trim();
  const playerId = searchParams.get("playerId")?.trim();
  // Requesting-Team-Kontext für die Fog-of-War-Maskierung (T-022/T-020, wie
  // player-sheet): ohne Server-Session gibt es kein anderes Signal, welches
  // Team hier anfragt.
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

  // Nicht sichtbar (gescoutet/fremd) ⇒ dieselbe Fog-Regel wie
  // `maskPlayerDirectorySliceForRequestingTeam`: leer statt Rang verraten. Der
  // Client zeigt für gescoutete Spieler ohnehin keine Rang-Spalte
  // (`buildScoutedDisciplineValuesFromPlayer` setzt sie hart auf `null`).
  if (visibility !== "exact") {
    return NextResponse.json({
      ok: true,
      playerId,
      seasonPointsRankByDisciplineId: {},
      allTimePointsRankByDisciplineId: {},
      allTimePointsByDisciplineId: {},
      allTimeAppearancesByDisciplineId: {},
    });
  }

  const override = buildPlayerDisciplineRankOverride({
    gameState: save.gameState,
    playerId,
    saveId,
  });

  return NextResponse.json({
    ok: true,
    playerId,
    seasonPointsRankByDisciplineId: override.seasonPointsRankByDisciplineId,
    allTimePointsRankByDisciplineId: override.allTimePointsRankByDisciplineId,
    // All-Time-PPs je Disziplin: im Browser fehlt die Aufschluesselung der Archiv-Saisons ganz,
    // deshalb faehrt die Zahl denselben Weg wie ihr Rang (`l4835p`).
    allTimePointsByDisciplineId: override.allTimePointsByDisciplineId,
    allTimeAppearancesByDisciplineId: override.allTimeAppearancesByDisciplineId,
  });
}
