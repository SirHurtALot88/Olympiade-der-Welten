/**
 * SAISON-RANG JE LIGA (21.11., Chris: Spieltagswertung zeigte „26. → 12.“ bei 0 Punkten, die
 * Liga-Tabelle „▲25“ in einer 16er-Liga). Mit aktivem Liga-Split (2 × 16 Teams) ist ein Saison-Rang
 * nur innerhalb der eigenen Liga sinnvoll: der Saisonstand (`seasonState.standings[team].rank`,
 * `standings-preview-engine.ts`) rankt seit dem Liga-Split-PR 3 ligalokal, mehrere Anzeigen
 * rechneten Vorher-Rang und Bewegung aber weiter über alle 32 Teams. Gemischt ergab das genau die
 * gemeldeten Sprünge (Vorher über 32, Nachher je Liga).
 *
 * Diese Datei ist die eine Stelle, an der eine Rangfunktion auf Liga-Gruppen verteilt wird. Ohne
 * Liga-Split (Legacy, 32 Teams in einer Tabelle) gibt es genau eine Gruppe — jedes Ranking bleibt
 * dann bit-identisch zum Stand davor.
 */
import type { GameState } from "@/lib/data/olyDataTypes";

/** Liga eines Teams (`"liga1"`/`"liga2"`), `null` ohne Zuordnung. */
export type LigaVon = (teamId: string) => string | null;

/**
 * Liga-Zuordnung aus dem Spielstand — `null`, wenn der Liga-Split nicht aktiv ist (dann bilden alle
 * Teams eine gemeinsame Tabelle).
 */
export function ligaVonAusSpielstand(gameState: { seasonState?: Pick<GameState["seasonState"], "leagueByTeamId"> | null } | null | undefined): LigaVon | null {
  const byTeamId = gameState?.seasonState?.leagueByTeamId;
  if (!byTeamId || Object.keys(byTeamId).length === 0) {
    return null;
  }
  return (teamId) => byTeamId[teamId] ?? null;
}

/**
 * Teilt die Einträge nach Liga. Reihenfolge innerhalb einer Gruppe bleibt die der Eingabe; Teams
 * ohne Zuordnung bilden eine eigene Gruppe. Ohne `ligaVon` (kein Split): eine einzige Gruppe.
 */
export function teileNachLiga<T extends { teamId: string }>(items: readonly T[], ligaVon: LigaVon | null | undefined): T[][] {
  if (!ligaVon) {
    return items.length > 0 ? [[...items]] : [];
  }
  const gruppen = new Map<string, T[]>();
  for (const item of items) {
    const schluessel = ligaVon(item.teamId) ?? "\u0000ohne-liga";
    const gruppe = gruppen.get(schluessel);
    if (gruppe) gruppe.push(item);
    else gruppen.set(schluessel, [item]);
  }
  return [...gruppen.values()];
}

/**
 * Wendet `rangfunktion` je Liga-Gruppe an und führt die Ergebnisse zusammen — jeder Rang zählt
 * damit innerhalb seiner Liga von 1. Ohne `ligaVon` ein einziger Aufruf über alle Einträge.
 */
export function rangJeLiga<T extends { teamId: string }, V>(
  items: readonly T[],
  ligaVon: LigaVon | null | undefined,
  rangfunktion: (gruppe: T[]) => Map<string, V>,
): Map<string, V> {
  const ergebnis = new Map<string, V>();
  for (const gruppe of teileNachLiga(items, ligaVon)) {
    for (const [teamId, wert] of rangfunktion(gruppe)) {
      ergebnis.set(teamId, wert);
    }
  }
  return ergebnis;
}
