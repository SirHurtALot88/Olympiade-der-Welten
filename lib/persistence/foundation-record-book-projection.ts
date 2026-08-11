/**
 * GEMELDET (Nachmessung, Live-Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10):
 * das Rekordbuch zeigte in JEDEM der sieben Eintraege den falschen Halter und den falschen Wert.
 *
 * BEFUND: es fehlten keine Daten. `buildLeagueRecordBook` laeuft in einer `"use client"`-Karte
 * (`LeagueLeadersNewLook`) auf dem kompakten Payload, und der beschneidet `disciplineResults`
 * auf den aktiven Spieltag (`compactFoundationInitialGameState`). Damit faellt auch der
 * Punkte-Ledger auf einen Spieltag zurueck — er bucht bewusst keinen Spieltag ohne
 * Disziplin-Ergebnisse (`season-points-ledger`). Gemessen, 7 von 7 falsch:
 *
 *   bester Einzelauftritt   164,6 Sir Quacksalot   -> 112,7 Lyraeth Vael
 *   bester Spielertag       6,1 PPs T Mask         -> 4,6 PPs Lyraeth Vael
 *   bestes Team-Ergebnis    606,9 Lost Kingdom     -> 413,7 Nunchuck Ninjas
 *   knappster Sieg          0,00 Lost Kingdom      -> 35,00 Nunchuck Ninjas
 *   hoechster Form-Schub    +196,5 Armageddon A.   -> +157,8 Nunchuck Ninjas
 *   laengste Siegesserie    2 Spieltage Blazing B. -> 1 Last Ride
 *   laengste Top-10-Serie   4 Spieltage Jasper K.  -> 1 Umbra
 *
 * Besonders haesslich war die Kartenueberschrift: `matchdaysPlayed` stimmte („aus 10 gespielten
 * Spieltagen"), weil `matchdayResults` vollstaendig mitfahren — das Etikett beglaubigte also
 * Zahlen aus einem einzigen Spieltag.
 *
 * Nach dem Muster von `foundation-field-race-projection` / `foundation-form-card-projection`:
 * statt der schweren Quelle faehrt die fertige, kleine Antwort mit — das Rekordbuch,
 * serverseitig auf dem VOLLEN Save gerechnet (gemessen rund 2 KB gegen 271 KB volle
 * `disciplineResults`). Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip verworfen und bei
 * jeder Auslieferung frisch gebaut, es gibt keine zweite Wahrheit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildLeagueRecordBook,
  type LeagueRecordBook,
  type RecordBookEntry,
} from "@/lib/foundation/league-record-book";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { zaehleBelegteSpieltage } from "@/lib/foundation/season-discipline-tally";

export type FoundationRecordBookProjection = {
  seasonId: string;
  spieltagsSuperlative: RecordBookEntry[];
  serien: RecordBookEntry[];
  /** Wie viele Spieltage der Projektion zugrunde liegen — zugleich das Vorrangmass. */
  matchdaysPlayed: number;
};

export function projiziereRekordbuch(gameState: GameState): FoundationRecordBookProjection | undefined {
  try {
    const buch = buildLeagueRecordBook(gameState);
    if (buch.spieltagsSuperlative.length === 0 && buch.serien.length === 0) {
      return undefined;
    }
    return {
      seasonId: gameState.season.id,
      spieltagsSuperlative: buch.spieltagsSuperlative,
      serien: buch.serien,
      matchdaysPlayed: buch.matchdaysPlayed,
    };
  } catch {
    // Defensiv wie die Geschwister-Projektionen: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen — dann eben clientseitiger Fallback.
    return undefined;
  }
}

/**
 * Das Rekordbuch der bereits geladenen Ansicht: selbst gerechnet, wenn der Stand die Spieltage
 * wirklich traegt (Server), sonst die mitgefahrene Projektion (Browser).
 *
 * DER VORRANG HAENGT AN DER ABDECKUNG, NICHT AN `??`. Ein leeres Rekordbuch ist ein Objekt mit
 * leeren Listen und damit nicht nullish — `??` haette den beschnittenen Eigenbau immer gewinnen
 * lassen. Verglichen werden deshalb die BELEGTEN Spieltage: traegt der Stand mindestens so
 * viele wie die Projektion, ist er der vollstaendigere (Server, oder ein Browser, dem
 * inzwischen ein weiterer Spieltag zugelaufen ist) und gewinnt.
 */
export function leseRekordbuch(gameState: GameState, ledgerInput?: SeasonPointsLedger): LeagueRecordBook {
  const projektion = gameState.seasonState.foundationRecordBook;
  if (
    projektion &&
    projektion.seasonId === gameState.season.id &&
    projektion.matchdaysPlayed > zaehleBelegteSpieltage(gameState)
  ) {
    return {
      spieltagsSuperlative: projektion.spieltagsSuperlative,
      serien: projektion.serien,
      matchdaysPlayed: projektion.matchdaysPlayed,
    };
  }
  return buildLeagueRecordBook(gameState, ledgerInput);
}
