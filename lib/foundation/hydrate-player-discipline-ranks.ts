import type { PlayerDisciplineRankOverride } from "@/lib/foundation/player-discipline-rank-service";

export type PlayerDisciplineRankPayload = {
  ok?: boolean;
  playerId?: string;
  seasonPointsRankByDisciplineId?: Record<string, number>;
  allTimePointsRankByDisciplineId?: Record<string, number>;
  /** All-Time-PPs je Disziplin — siehe `PlayerDisciplineRankOverride` (`l4835p`). */
  allTimePointsByDisciplineId?: Record<string, number>;
  allTimeAppearancesByDisciplineId?: Record<string, number>;
};

const playerDisciplineRankCache = new Map<string, PlayerDisciplineRankOverride | null>();

function buildPlayerDisciplineRankCacheKey(saveId: string, playerId: string, teamId: string | null) {
  return `${saveId}:${playerId}:${teamId ?? ""}`;
}

export function invalidatePlayerDisciplineRankCache(input?: { saveId?: string; playerId?: string }) {
  if (!input?.saveId && !input?.playerId) {
    playerDisciplineRankCache.clear();
    return;
  }

  for (const key of [...playerDisciplineRankCache.keys()]) {
    const [saveId, playerId] = key.split(":");
    if (input.saveId && saveId !== input.saveId) {
      continue;
    }
    if (input.playerId && playerId !== input.playerId) {
      continue;
    }
    playerDisciplineRankCache.delete(key);
  }
}

/**
 * Fetcht `PlayerDisciplineRankOverride` für EINEN Spieler
 * (bug-2026-08-04T13-23-39-256Z-uzetn6 — "Top Disziplinen … da fehlt jeweils
 * auch der Rank"). Siehe `buildPlayerDisciplineRankOverride`
 * (player-discipline-rank-service.ts) für die volle Begründung.
 *
 * `null` bei fehlendem `saveId` oder Fetch-Fehler — der Aufrufer fällt dann auf
 * die (auf dem kompakten Payload leere) lokale Berechnung zurück, statt den
 * Profil-Aufruf ganz scheitern zu lassen.
 */
export async function fetchPlayerDisciplineRankOverride(input: {
  saveId: string | null | undefined;
  playerId: string;
  teamId?: string | null;
}): Promise<PlayerDisciplineRankOverride | null> {
  if (!input.saveId || input.saveId === "loading-save") {
    return null;
  }

  const teamId = input.teamId ?? null;
  const cacheKey = buildPlayerDisciplineRankCacheKey(input.saveId, input.playerId, teamId);
  if (playerDisciplineRankCache.has(cacheKey)) {
    return playerDisciplineRankCache.get(cacheKey) ?? null;
  }

  const params = new URLSearchParams({ saveId: input.saveId, playerId: input.playerId });
  if (teamId) {
    params.set("teamId", teamId);
  }

  try {
    const response = await fetch(`/api/singleplayer-state/player-discipline-ranks?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      playerDisciplineRankCache.set(cacheKey, null);
      return null;
    }
    const payload = (await response.json()) as PlayerDisciplineRankPayload;
    const override: PlayerDisciplineRankOverride = {
      seasonPointsRankByDisciplineId: payload.seasonPointsRankByDisciplineId ?? {},
      allTimePointsRankByDisciplineId: payload.allTimePointsRankByDisciplineId ?? {},
      // Leer statt fehlend: eine Antwort ohne diese Felder (aeltere Route) heisst „keine Punkte
      // bekannt" und nicht „Feld unbekannt" — der Verbraucher liest beides gleich.
      allTimePointsByDisciplineId: payload.allTimePointsByDisciplineId ?? {},
      allTimeAppearancesByDisciplineId: payload.allTimeAppearancesByDisciplineId ?? {},
    };
    playerDisciplineRankCache.set(cacheKey, override);
    return override;
  } catch {
    playerDisciplineRankCache.set(cacheKey, null);
    return null;
  }
}
