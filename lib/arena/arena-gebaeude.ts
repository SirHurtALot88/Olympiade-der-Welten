/**
 * ARENA UND DAS ALTE GEBAEUDE (22.11.): mit der Arena-Regel "an" ersetzen die Platzarten das Gebaeude "Arena Upgrade". Es zahlt keine
 * Einnahme (die Tageskasse ersetzt sie) und keinen Unterhalt (der Unterhalt je Ausbau-Schritt ersetzt ihn), und es laesst sich nicht
 * mehr ausbauen. Ohne gueltige Regel aendert sich nichts (alter Spielstand rechnet bit-identisch zu Ende).
 */
import type { GameState, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import { unterhaltSaison } from "@/lib/arena/arena-modell";
import { arenaAktiv } from "@/lib/arena/arena-regel";
import { holeArenaStand } from "@/lib/arena/arena-stand";

/** Eine Kopie des Gebaeudezustands, in der "Arena Upgrade" nichts bringt und nichts kostet. */
export function ohneAltesArenaGebaeude(gameState: GameState, teamFacilities: TeamFacilityCollection): TeamFacilityCollection {
  if (!arenaAktiv(gameState)) return teamFacilities;
  const arena = teamFacilities.facilities.arena_upgrade;
  if (!arena || arena.level <= 0) return teamFacilities;
  return {
    ...teamFacilities,
    facilities: { ...teamFacilities.facilities, arena_upgrade: { ...arena, level: 0, enabled: false } },
  };
}

/** Der Unterhalt der gebauten Ausbau-Schritte eines Teams je Saison (0 ohne gueltige Regel). Er laeuft je Spieltag (1/N), auch bei leeren Plaetzen. */
export function arenaUnterhaltDerSaison(gameState: GameState, teamId: string): number {
  if (!arenaAktiv(gameState)) return 0;
  return unterhaltSaison(holeArenaStand(gameState, teamId).plaetze);
}
