/**
 * Einstieg in die Formations-Geometrie für Foundation (Einsatzliste) und später das Arena-Board.
 *
 * Die einzige Stelle, die die kurze Rollen-Id je Slot auflöst — mit `resolveSlotRoleShortId`,
 * DERSELBEN Funktion, mit der `buildArenaAufstellung` (`arena-aufstellung-adapter.ts`) dem Motor
 * `place[name].slot` übergibt, und mit derselben Kadergröße (Battlefield setzt je k eigene Rollen).
 * Die Marke auf dem Mini-Feld und die Figur in der Arena stehen damit für dieselbe Rolle.
 */
import { resolveSlotRoleShortId } from "@/lib/lineups/matchday-slot-roles";

import { legeFormation, type GelegteFormation } from "./formation-registry";

export * from "./formation-registry";

/** Kurze Rollen-Ids für die Slots 0..slotCount-1 einer Disziplin-Seite, exakt wie der Arena-Adapter. */
export function rollenIdsFuerSeite(disziplinId: string | null | undefined, slotCount: number): Array<string | null> {
  return Array.from({ length: Math.max(0, slotCount) }, (_, index) => resolveSlotRoleShortId(disziplinId, null, index, slotCount));
}

/** Die gelegte Formation einer Disziplin-Seite. `variante` bleibt null, bis der Spieltags-Vertrag eine trägt. */
export function formationFuerSeite(disziplinId: string | null | undefined, slotCount: number, variante: string | null = null): GelegteFormation {
  return legeFormation({ disziplinId, variante, rollen: rollenIdsFuerSeite(disziplinId, slotCount) });
}
