/**
 * TAGESPUNKTE JE SPIELTAG UND TEAM — eine Rechenstelle.
 *
 * HERKUNFT: diese beiden Funktionen standen bis hierher in
 * `lib/persistence/foundation-matchday-points-projection.ts`. Diese Datei war eine PROJEKTION: sie
 * rechnete die Tagespunkte serverseitig auf dem vollen Spielstand vor und schickte sie als
 * `seasonState.foundationMatchdayPoints` mit dem kompakten Payload zum Browser, weil der Browser
 * die `disciplineResults` nur fuer den aktiven Spieltag bekam und der Punkte-Ledger einen Spieltag
 * ohne Disziplin-Ergebnis bewusst gar nicht erst bucht. Das Spieltags-Ergebnis zeigte deshalb fuer
 * alle 32 Teams erfundene Saison-Raenge.
 *
 * SEIT `8ec6454b` FAHREN `disciplineResults` UND `lineupDrafts` VOLLSTAENDIG MIT. Nachgemessen an
 * beiden aktiven Spielstaenden (S2/MD10: 640 Disziplin-Zeilen voll wie im Browser; S1/MD2: 64):
 * mit und ohne Projektion kommt Zeichen fuer Zeichen dasselbe heraus. Die Projektion war damit
 * wirkungslos und ist entfernt; die Rechnung bleibt, sie steht nur wieder da, wo sie hingehoert.
 *
 * ZWEITE RECHENSTELLE, BEWUSST BENANNT: `buildFieldRaceLedger`
 * (`lib/foundation/build-field-race-ledger.ts`) bildet mit `pointsByMatchday` dieselbe Summe —
 * `basePoints` je Team, nach jedem Schritt auf 4 Stellen gerundet. Die beiden muessen gleich
 * bleiben, sonst laufen Saisonstand und Feld-Rennen in der letzten Stelle auseinander.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

/**
 * Die Spieltage der Saison, zu denen ueberhaupt Disziplin-Ergebnisse vorliegen — dieselbe
 * Grenze, die `buildSeasonPointsLedger` zieht, bevor er einen Spieltag bucht.
 */
export function spieltageMitDisziplinErgebnissen(gameState: GameState, seasonId: string): Set<string> {
  const matchdayIdByResultId = new Map<string, string>();
  for (const result of gameState.seasonState.matchdayResults ?? []) {
    if (result.seasonId !== seasonId || result.status !== "preview_applied") continue;
    matchdayIdByResultId.set(result.id, result.matchdayId);
  }

  const gedeckt = new Set<string>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    const matchdayId = matchdayIdByResultId.get(result.matchdayResultId);
    if (matchdayId != null) gedeckt.add(matchdayId);
  }
  return gedeckt;
}

/**
 * Tagespunkte je Spieltag je Team aus einem bereits gebauten Ledger.
 *
 * `gedeckteSpieltage` wird VORAB angelegt, auch ohne Punkt-Eintraege: der Unterschied zwischen
 * „bekannt und leer" und „unbekannt" ist der ganze Punkt. Nur an ihm merkt der Leser, dass ihm ein
 * Spieltag fehlt, statt stillschweigend mit 0 weiterzurechnen (siehe `missing_matchday_points` in
 * `buildMatchdaySummary`).
 */
export function summiereSpieltagsPunkteAusLedger(
  ledger: SeasonPointsLedger,
  gedeckteSpieltage: ReadonlySet<string>,
): Map<string, Map<string, number>> {
  const punkteJeSpieltag = new Map<string, Map<string, number>>();
  for (const matchdayId of gedeckteSpieltage) {
    punkteJeSpieltag.set(matchdayId, new Map<string, number>());
  }

  for (const entry of ledger.pointEntries) {
    if (entry.matchdayId == null) continue;
    let jeTeam = punkteJeSpieltag.get(entry.matchdayId);
    if (!jeTeam) {
      jeTeam = new Map<string, number>();
      punkteJeSpieltag.set(entry.matchdayId, jeTeam);
    }
    // `entry.points`, NICHT `entry.basePoints`: `points` ist Rang-Anteil PLUS Mutator-Aufschlag,
    // also die Zahl, die auch gutgeschrieben wird. Mit `basePoints` rankte der Spieltag nach einer
    // anderen Groesse als der Saisonstand bucht — am Live-Abbild bis zu 6,9 Punkte je Team.
    jeTeam.set(entry.teamId, roundValue((jeTeam.get(entry.teamId) ?? 0) + entry.points, 4));
  }

  return punkteJeSpieltag;
}

/** Die Tagespunkte der laufenden Saison, gerechnet auf dem Stand, der vorliegt. */
export function baueSpieltagsPunkteJeSpieltag(
  gameState: GameState,
  seasonId: string,
  ledger: SeasonPointsLedger,
): Map<string, Map<string, number>> {
  return summiereSpieltagsPunkteAusLedger(ledger, spieltageMitDisziplinErgebnissen(gameState, seasonId));
}
