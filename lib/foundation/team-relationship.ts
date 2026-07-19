import type { GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { getTeamOwner } from "@/lib/foundation/team-control-settings";
import {
  getActiveTeamAllyTeamIds,
  getActiveTeamRivalTeamIds,
} from "@/lib/rivalries/team-rivalries";

/**
 * Freund/Feind-Kodierung für die Matchday-Arena (blau=deine, grün=verbündet,
 * rot=Rival). Rein presentational/additiv — kombiniert drei bereits vorhandene
 * Signale zu EINER Beziehungs-Einstufung pro Team, ohne Wertung oder Layout zu
 * verändern.
 *
 * Definitionen:
 * - `mine`  = Teams, die derselbe menschliche Owner steuert wie das aktive Team
 *             (Control-Modell: `controlMode === "manual"` + gleicher `ownerId`,
 *             via `getTeamOwner`). Das aktive Team selbst zählt immer als `mine`.
 *             Deckt Mehr-Team-Setups (z. B. lokaler Coach steuert mehrere Clubs)
 *             ab, nicht nur das eine gerade gewählte Team.
 * - `rival` = Rivalen des aktiven Teams aus dem Beziehungs-Sheet
 *             (`getActiveTeamRivalTeamIds`, unverändert wiederverwendet).
 * - `ally`  = Verbündete aus demselben Beziehungs-Sheet
 *             (`getActiveTeamAllyTeamIds`, starke positive Affinität). Es gibt
 *             KEIN Besitz-/Fraktions-Ally-Modell mehr (die `Alliance`-Tabelle
 *             wurde entfernt) — grün erscheint nur, wenn das Sheet Affinität trägt.
 *
 * Präzedenz bei Mehrfachtreffer: `mine` > `rival` > `ally` (dein eigenes Team
 * schlägt alles). Neutrale Feld-Teams ⇒ `null`.
 */
export type TeamRelationshipKind = "mine" | "ally" | "rival";

/**
 * Minimaler Zustand, den die Einstufung braucht — bewusst kein volles
 * `GameState`, damit die Arena (die nur `teams` + `teamControlSettingsMap` hat)
 * den Selektor direkt füttern kann.
 */
export type TeamRelationshipState = Pick<GameState, "teams"> & {
  teamControlSettings: Record<string, TeamControlSettings>;
};

/**
 * Team-IDs aller Teams, die derselbe (menschliche) Owner wie das aktive Team
 * steuert. Das aktive Team ist immer enthalten. Fehlt eine saubere Owner-Zuordnung
 * (kein `manual`-Control / kein Owner), bleibt es beim aktiven Team allein.
 */
export function getActiveOwnerTeamIds(
  state: TeamRelationshipState,
  activeTeamId: string | null | undefined,
): Set<string> {
  const mineTeamIds = new Set<string>();
  if (!activeTeamId) return mineTeamIds;
  mineTeamIds.add(activeTeamId);

  const activeSettings = state.teamControlSettings[activeTeamId];
  const activeOwnerId = getTeamOwner(activeSettings);
  if (!activeSettings || activeSettings.controlMode !== "manual" || !activeOwnerId) {
    return mineTeamIds;
  }

  for (const team of state.teams) {
    const settings = state.teamControlSettings[team.teamId];
    if (settings?.controlMode === "manual" && getTeamOwner(settings) === activeOwnerId) {
      mineTeamIds.add(team.teamId);
    }
  }
  return mineTeamIds;
}

/**
 * Baut eine Beziehungs-Karte `teamId → Kind` (mine/ally/rival) für alle
 * relevanten Teams — die effiziente Form für die Arena (einmal memoisiert,
 * dann O(1)-Lookup pro Zeile/Marker). Präzedenz `mine` > `rival` > `ally`
 * wird über die Schreibreihenfolge erzwungen.
 */
export function buildTeamRelationshipMap(
  state: TeamRelationshipState,
  activeTeamId: string | null | undefined,
): Map<string, TeamRelationshipKind> {
  const relationshipByTeamId = new Map<string, TeamRelationshipKind>();
  if (!activeTeamId) return relationshipByTeamId;

  const rivalryState = { teams: state.teams, teamIdentities: [] };
  for (const teamId of getActiveTeamAllyTeamIds(state, activeTeamId)) {
    relationshipByTeamId.set(teamId, "ally");
  }
  for (const teamId of getActiveTeamRivalTeamIds(rivalryState, activeTeamId)) {
    relationshipByTeamId.set(teamId, "rival");
  }
  for (const teamId of getActiveOwnerTeamIds(state, activeTeamId)) {
    relationshipByTeamId.set(teamId, "mine");
  }
  return relationshipByTeamId;
}

/**
 * Einstufung eines einzelnen Teams gegenüber dem aktiven Team. Für Einzelabfragen
 * gedacht; wer viele Teams einstuft, nutzt `buildTeamRelationshipMap` einmal.
 */
export function getTeamRelationship(
  state: TeamRelationshipState,
  activeTeamId: string | null | undefined,
  teamId: string,
): TeamRelationshipKind | null {
  return buildTeamRelationshipMap(state, activeTeamId).get(teamId) ?? null;
}
