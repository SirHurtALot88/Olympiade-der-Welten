/**
 * GEMELDET: das Spieltags-Ergebnis zeigte fuer ALLE 32 Teams falsche Saison-Raenge
 * („Rang vorher", „nachher", „Δ") und eine falsche Summe der Saisonpunkte.
 *
 * BEFUND (am Live-Abbild gemessen, Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10):
 * es fehlten keine Daten. `buildMatchdaySummary` summiert die Punkt-Eintraege des
 * Saison-Ledgers ueber die Spieltage 1..9, um den Rang VOR dem Spieltag zu bilden. Im Browser
 * hat der Ledger aber nur den aktiven Spieltag, weil `compactFoundationInitialGameState` die
 * `disciplineResults` auf ihn zusammenstreicht (640 Zeilen voll, 64 kompakt) — und ohne
 * Disziplin-Ergebnis bucht der Ledger einen Spieltag bewusst gar nicht erst
 * (`skipped_matchdays_without_discipline_results:9`, siehe `season-points-ledger`).
 * Damit war `beforePoints` fuer jedes Team 0 und der „Rang vorher" frei erfunden:
 *
 *   Z-H  Rang vorher 1 -> 32, nachher 1 -> 5,  Δ 0 -> 27, Summe 160,3 -> 20,7
 *   M-M  Rang vorher 3 -> 12, nachher 2 -> 4,  Δ 1 -> 8,  Summe 143,6 -> 20,7
 *   N-N  Rang vorher 21 -> 15, nachher 11 -> 1, Δ 10 -> 14, Summe 105,4 -> 26,4
 *
 * 32 von 32 Zeilen abweichend; bis in die Inbox durchgeschlagen (S-C: „-1 Platz" voll gegen
 * „+3 Plaetze" im Browser — vorzeichenverkehrt).
 *
 * DAS STREICHEN BLEIBT RICHTIG: die `disciplineResults` sind die schwere Fracht und wachsen
 * mit jedem Spieltag. Also faehrt nach dem Muster der Geschwister-Projektionen
 * (`foundation-field-race-projection`, `foundation-form-card-projection`) die fertige, kleine
 * Antwort mit: je gewertetem Spieltag der laufenden Saison die Tagespunkte je Team,
 * serverseitig auf dem VOLLEN Save gerechnet. Das sind 32 Zahlen pro Spieltag.
 *
 * Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip verworfen und bei jeder Auslieferung
 * frisch gebaut. Es gibt keine zweite Wahrheit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

/** Tagespunkte je Team fuer je einen gewerteten Spieltag. */
export type FoundationMatchdayPointsEntry = {
  matchdayId: string;
  /**
   * `basePoints` (ohne Mutator-Aufschlag) je Team, auf 4 Stellen summiert — exakt die
   * Groesse, mit der `buildMatchdaySummary` seine Saison-Raenge bildet.
   *
   * BEWUSST AUCH LEER MOEGLICH: ein gewerteter Spieltag ohne Punkt-Eintraege traegt hier
   * ein leeres Objekt. Der Unterschied zwischen „bekannt und leer" und „unbekannt" ist der
   * ganze Punkt dieser Projektion — nur an ihm kann der Leser merken, dass ihm ein Spieltag
   * fehlt, statt stillschweigend mit 0 weiterzurechnen.
   */
  pointsByTeamId: Record<string, number>;
};

export type FoundationMatchdayPointsProjection = {
  seasonId: string;
  matchdays: FoundationMatchdayPointsEntry[];
};

/**
 * Die Spieltage der Saison, zu denen ueberhaupt Disziplin-Ergebnisse vorliegen — dieselbe
 * Grenze, die `buildSeasonPointsLedger` zieht, bevor er einen Spieltag bucht. Genau diese
 * Menge ist im Browser auf den aktiven Spieltag geschrumpft.
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
 * Die Rechnung ist absichtlich Zeichen fuer Zeichen dieselbe wie in `buildFieldRaceLedger`
 * (`pointsByMatchday`): `basePoints` aufsummiert, nach jedem Schritt auf 4 Stellen gerundet.
 * Weil BEIDE Seiten — Server wie Browser — ihre Saisonsummen ueber genau diese Zwischenstufe
 * bilden, koennen die beiden Wege nicht in der letzten Stelle auseinanderlaufen.
 */
export function summiereSpieltagsPunkteAusLedger(
  ledger: SeasonPointsLedger,
  gedeckteSpieltage: ReadonlySet<string>,
): Map<string, Map<string, number>> {
  const punkteJeSpieltag = new Map<string, Map<string, number>>();
  // Zuerst jeden GEDECKTEN Spieltag anlegen, auch ohne Punkt-Eintraege: „bekannt und leer".
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
    jeTeam.set(entry.teamId, roundValue((jeTeam.get(entry.teamId) ?? 0) + entry.basePoints, 4));
  }

  return punkteJeSpieltag;
}

export function projiziereSpieltagsPunkte(gameState: GameState): FoundationMatchdayPointsProjection | undefined {
  try {
    const seasonId = gameState.season.id;
    const gedeckt = spieltageMitDisziplinErgebnissen(gameState, seasonId);
    if (gedeckt.size === 0) {
      return undefined;
    }

    const ledger = buildSeasonPointsLedger(gameState, seasonId);
    const punkteJeSpieltag = summiereSpieltagsPunkteAusLedger(ledger, gedeckt);

    return {
      seasonId,
      // In Spielplan-Reihenfolge, damit die Fracht lesbar bleibt; der Leser sucht ohnehin
      // ueber die matchdayId.
      matchdays: gameState.season.matchdayIds
        .filter((matchdayId) => punkteJeSpieltag.has(matchdayId))
        .map((matchdayId) => ({
          matchdayId,
          pointsByTeamId: Object.fromEntries(punkteJeSpieltag.get(matchdayId) ?? new Map()),
        })),
    };
  } catch {
    // Defensiv wie die Geschwister-Projektionen: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen. Der Leser unten merkt die Luecke und
    // zeigt dann lieber nichts als eine falsche Zahl.
    return undefined;
  }
}

/**
 * Die Tagespunkte einer bereits geladenen Ansicht: die selbst gerechneten, wo der Spielstand
 * die Disziplin-Ergebnisse wirklich mitbringt, sonst die mitgefahrene Projektion.
 *
 * VORRANG JE SPIELTAG, NICHT PER `??`. `??` waere hier doppelt falsch: eine leere Map ist
 * nicht nullish (daran ist eine frueherer Reparatur schon einmal gescheitert, siehe
 * `leseSaisonSchnappschuesse`), und ein Entweder-Oder waere obendrein zu grob. Der Browser
 * kennt naemlich WAEHREND der Sitzung mehr als die Projektion: wer den Spieltag gerade
 * gespielt hat, hat dessen Disziplin-Ergebnisse lokal — die Projektion stammt aber vom
 * Laden. Also gewinnt der Spielstand genau fuer die Spieltage, die er selbst deckt, und die
 * Projektion fuellt den Rest.
 */
export function leseSpieltagsPunkteJeSpieltag(
  gameState: GameState,
  seasonId: string,
  ledger: SeasonPointsLedger,
): Map<string, Map<string, number>> {
  const gedeckt = spieltageMitDisziplinErgebnissen(gameState, seasonId);
  const ausSpielstand = summiereSpieltagsPunkteAusLedger(ledger, gedeckt);

  const projektion = gameState.seasonState.foundationMatchdayPoints;
  const zusammen = new Map<string, Map<string, number>>();
  if (projektion && projektion.seasonId === seasonId) {
    for (const eintrag of projektion.matchdays) {
      zusammen.set(eintrag.matchdayId, new Map(Object.entries(eintrag.pointsByTeamId)));
    }
  }
  for (const [matchdayId, jeTeam] of ausSpielstand) {
    zusammen.set(matchdayId, jeTeam);
  }

  return zusammen;
}
