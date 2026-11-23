import type { GameState } from "@/lib/data/olyDataTypes";
import { FACILITY_CATALOG_BY_ID, getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";
import { getDevelopmentWeightedFacilityUpgradeDiscount, getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

/**
 * Was der Ausbau auf `zielLevel` dieses Teams tatsaechlich kostet — die EINE Rechenstelle, die `previewFacilityUpgrade` bucht und die
 * die Gebaeude-Seite zeigt (gezeigt = gebucht). Der Katalogpreis wird fuer Entwicklungs-Gebaeude (Trainingszentrum, Scouting, Akademie)
 * um den Entwicklungsrabatt des Teams gesenkt. Rein und ohne Node-Abhaengigkeit, damit auch die Oberflaeche sie aufrufen darf.
 * `null`, wenn das Gebaeude oder die Stufe nicht existiert.
 */
export function berechneAusbauKosten(gameState: GameState, teamId: string, facilityId: FacilityId, zielLevel: number): number | null {
  const definition = getFacilityLevelDefinition(facilityId, zielLevel);
  if (!definition) return null;
  const team = gameState.teams.find((entry) => entry.teamId === teamId) ?? null;
  if (!team) return definition.upgradeCost;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const profile = getTeamStrategyProfile(gameState, teamId);
  const tendency = getTeamDevelopmentTendency({ team, identity, profile });
  return getDevelopmentWeightedFacilityUpgradeDiscount({ baseUpgradeCost: definition.upgradeCost, facilityId, tendency });
}

/** Kosten je Stufe 1..maxLevel (Index 0 = Stufe 1), jeweils so, wie sie beim Ausbau von der Vorstufe aus gebucht wuerden. */
export function berechneAusbauLeiter(gameState: GameState, teamId: string, facilityId: FacilityId): Array<number | null> {
  const facility = FACILITY_CATALOG_BY_ID[facilityId];
  if (!facility) return [];
  return Array.from({ length: facility.maxLevel }, (_, i) => berechneAusbauKosten(gameState, teamId, facilityId, i + 1));
}
