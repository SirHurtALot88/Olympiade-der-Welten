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
 *
 * PP-BUDGET, REIN LEISTUNGSBASIERT (Teil A, 19.10.): summiert ab jetzt `ledger.tableGroupContributions`
 * statt direkt `ledger.pointEntries[].points` -- fuer eine Duell-Zeile (Battle Mode) ist `points`
 * seitdem die leistungsbasierte Spieler-PP (`ppAusSpielerScore()`), NICHT mehr der 2/1/0-Team-Budget-
 * Anteil. Eine direkte Summe ueber `pointEntries` haette fuer Battle-Saves genau die Fehlerklasse
 * reproduziert, die diese Datei schon einmal fuer den Mutator-Bonus behoben hat: "Platz 1 im
 * Spieltag, aber nur 2. in der Saison, das kann doch gar nicht sein" -- der Spieltagsrang waere
 * dann aus der leistungsbasierten PP-Summe, die Saisontabelle aber weiter aus Σ 2/1/0 gebaut, zwei
 * verschiedene Waehrungen fuer denselben Rang. `tableGroupContributions` traegt fuer eine Duell-Zeile
 * `teamResult.teamPoints` (2/1/0, einmal je Gruppe) und fuer eine Manager-Mode-Zeile bit-identisch
 * Σ Spieler-`points` dieser Gruppe -- GENAU DIESELBE Waehrung wie `teamSummary.totalPoints`.
 */
export function summiereSpieltagsPunkteAusLedger(
  ledger: SeasonPointsLedger,
  gedeckteSpieltage: ReadonlySet<string>,
): Map<string, Map<string, number>> {
  const punkteJeSpieltag = new Map<string, Map<string, number>>();
  for (const matchdayId of gedeckteSpieltage) {
    punkteJeSpieltag.set(matchdayId, new Map<string, number>());
  }

  for (const beitrag of ledger.tableGroupContributions) {
    if (beitrag.matchdayId == null) continue;
    let jeTeam = punkteJeSpieltag.get(beitrag.matchdayId);
    if (!jeTeam) {
      jeTeam = new Map<string, number>();
      punkteJeSpieltag.set(beitrag.matchdayId, jeTeam);
    }
    jeTeam.set(beitrag.teamId, roundValue((jeTeam.get(beitrag.teamId) ?? 0) + beitrag.points, 4));
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
