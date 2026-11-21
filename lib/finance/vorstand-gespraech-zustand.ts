/**
 * Office 21.11: der gespeicherte Zustand der Vorstandsgespraeche eines Teams (nur Lesen, ohne Abhaengigkeiten).
 * Eigene Datei, damit `lib/board` ihn lesen kann, ohne `lib/finance` zu ziehen.
 */
import type { GameState, VorstandGespraechZustand } from "@/lib/data/olyDataTypes";

/** Hoechstens zwei Gespraeche je Saison (Konzept 18.11.). */
export const GESPRAECHE_JE_SAISON = 2;

export function leeresVorstandGespraech(seasonId: string): VorstandGespraechZustand {
  return { seasonId, genutzt: 0, offen: null, zusagen: [], lieblingFreigegeben: false, protokoll: [] };
}

/** Der Zustand dieser Saison; eine neue Saison beginnt leer (der Vorstand rechnet jede Saison neu). */
export function lesVorstandGespraech(gameState: GameState, teamId: string): VorstandGespraechZustand {
  const z = gameState.seasonState?.vorstandGespraeche?.[teamId];
  if (z && z.seasonId === gameState.season?.id) return z;
  return leeresVorstandGespraech(gameState.season?.id ?? "");
}
