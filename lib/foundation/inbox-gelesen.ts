/**
 * POSTFACH: GELESEN / UNGELESEN JE MANAGER (Chris, 21.11.: „Gelesen/ungelesen je Manager“).
 *
 * Der Zustand hängt am Besitzer (`ownerId`), nicht am Spielstand: liest Franky eine Meldung, bleibt sie für Chris
 * ungelesen. Gespeichert werden nur die Kennungen der gelesenen Meldungen in `seasonState.inboxGelesen[ownerId]`.
 * Reine Funktionen ohne React, damit Route (`/api/inbox/gelesen`) und Oberfläche dieselbe Rechnung benutzen.
 */
import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap, getTeamOwner } from "@/lib/foundation/team-control-settings";

/** Länger merken wir uns nichts: ältere Kennungen sind Meldungen vergangener Spieltage. */
export const INBOX_GELESEN_MAX = 600;

/** Der Besitzer, unter dem die Gelesen-Liste eines Teams geführt wird (der Manager, der es steuert). */
export function inboxBesitzerFuerTeam(gameState: GameState, teamId: string | null | undefined): string | null {
  if (!teamId) return null;
  const settings = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings)[teamId];
  return getTeamOwner(settings) ?? null;
}

export function gelesenIdsFuer(gameState: GameState, ownerId: string | null | undefined): Set<string> {
  if (!ownerId) return new Set();
  return new Set(gameState.seasonState.inboxGelesen?.[ownerId] ?? []);
}

export function istMeldungUngelesen(item: GameInboxItem, gelesen: ReadonlySet<string>): boolean {
  return item.status === "open" && !gelesen.has(item.itemId);
}

/** Setzt oder löscht die Gelesen-Marke für `itemIds`. Gibt den Spielstand unverändert zurück, wenn nichts zu tun ist. */
export function setzeInboxGelesen(
  gameState: GameState,
  ownerId: string,
  itemIds: readonly string[],
  gelesen: boolean,
): GameState {
  const aktuell = gameState.seasonState.inboxGelesen?.[ownerId] ?? [];
  const menge = new Set(aktuell);
  let geaendert = false;
  for (const id of itemIds) {
    if (gelesen && !menge.has(id)) {
      menge.add(id);
      geaendert = true;
    } else if (!gelesen && menge.delete(id)) {
      geaendert = true;
    }
  }
  if (!geaendert) return gameState;
  // Set behält die Einfügereihenfolge: die ältesten Kennungen stehen vorn und fallen als Erste heraus.
  const liste = Array.from(menge).slice(-INBOX_GELESEN_MAX);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      inboxGelesen: { ...(gameState.seasonState.inboxGelesen ?? {}), [ownerId]: liste },
    },
  };
}
