/**
 * AUSRUESTUNG: SICHTBARKEIT (Phase 1a, 22.11., Konzept §54, Bauplan Risiko „Sichtfilter im Mehrspieler“).
 *
 * Lager, Materialbeutel, Ruhm, Teile, Gutscheine und offene Kisten eines Teams gehoeren diesem Team: sie stehen NICHT in der
 * Nutzlast an den Browser eines anderen Managers. Der Browser eines Menschen bekommt nur die Eintraege der Teams, die er selbst
 * steuert (`canOwnerManageTeam`); alles andere wird vor dem Versand entfernt. Die Saat des Spielstands bleibt ebenfalls auf dem
 * Server (sonst liessen sich die Funde einer Kiste vor dem Oeffnen nachrechnen).
 *
 * Phase 1a hat noch keine getragenen Teile (Ausruesten kommt mit Phase 2); wenn es sie gibt, sind sie „offen“ und kommen als eigene,
 * oeffentliche Liste dazu, nicht durch Lockern dieses Filters.
 *
 * DER SCHREIBWEG LAESST DEN CLIENT NIE `ausruestung` SCHREIBEN: `uebernehmeServerAusruestung` setzt beim Speichern des
 * Browser-Spielstands den Stand des Servers wieder ein. Sonst loeschte jedes Speichern eines gefilterten Spielstands die Lager der
 * fremden Teams — oder haette sie faelschen koennen.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap, canOwnerManageTeam, DEFAULT_ACTIVE_OWNER_ID } from "@/lib/foundation/team-control-settings";
import type { AusruestungSpielstand } from "@/lib/ausruestung/ausruestung-typen";

/** Die Ausruestung, die ein Browser des Besitzers `ownerId` sehen darf: nur eigene Teams, ohne Saat. */
export function ausruestungFuerBesitzer(
  gameState: Pick<GameState, "ausruestung" | "teams" | "seasonState">,
  ownerId: string | null | undefined,
): AusruestungSpielstand | null {
  const a = gameState.ausruestung;
  if (!a) return null;
  const eigener = ownerId?.trim() || DEFAULT_ACTIVE_OWNER_ID;
  const kontrolle = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const teams: AusruestungSpielstand["teams"] = {};
  for (const [teamId, t] of Object.entries(a.teams ?? {})) {
    if (canOwnerManageTeam(kontrolle[teamId], eigener)) teams[teamId] = t;
  }
  return { version: 1, saat: "", spieltage: a.spieltage, teams, gebucht: {}, platzierungGebucht: {} };
}

/** Der Spielstand fuer den Browser: `ausruestung` gefiltert. Gibt dieselbe Referenz zurueck, wenn es keine Ausruestung gibt. */
export function spielstandFuerBrowser<T extends Pick<GameState, "ausruestung" | "teams" | "seasonState">>(gameState: T, ownerId: string | null | undefined): T {
  if (!gameState.ausruestung) return gameState;
  return { ...gameState, ausruestung: ausruestungFuerBesitzer(gameState, ownerId) };
}

/** Beim Speichern eines Browser-Spielstands: den Besitz des Servers behalten, nie den des Clients. */
export function uebernehmeServerAusruestung<T extends Pick<GameState, "ausruestung">>(vomClient: T, vomServer: Pick<GameState, "ausruestung">): T {
  if (vomServer.ausruestung === undefined && vomClient.ausruestung === undefined) return vomClient;
  return { ...vomClient, ausruestung: vomServer.ausruestung };
}
