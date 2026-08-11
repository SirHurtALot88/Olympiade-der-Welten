/**
 * GEMELDET (Chris, Saisonstand, mit Bild): „schau dir bitte an dass endlich formkarten,
 * sponsoren, gebaeude, transfers und GuV korrekt im saisonstand ausgewiesen werden!" — in der
 * Spalte „Formkarten" standen Striche.
 *
 * BEFUND: es fehlten keine Daten. Die Spalte rechnet im Browser
 * (`buildSeasonFormCardBonusByTeamId`, aufgerufen in `FoundationSeasonV2Host`), und sie liest
 * dafuer die Modifier-Slots der Aufstellungen. Genau die beschneidet die Anfangsladung auf den
 * aktiven Spieltag (siehe `compactFoundationInitialGameState`). Am Live-Save gemessen: voll
 * 320 `lineupDrafts` und 32 von 32 Teams mit Formkarten-Bilanz, kompakt 32 Drafts und 14 von
 * 32 Teams — und diese 14 zaehlen statt zehn Spieltagen nur einen. Auf einem Spieltag, an dem
 * noch niemand eine Karte gelegt hat, ist die ganze Spalte leer.
 *
 * Die Beschneidung selbst bleibt richtig: die Aufstellungen sind schwer (gemessen 659 KB
 * gegen 70 KB, +3,79 % des Payloads, und sie wachsen mit jedem Spieltag). Also faehrt nach dem
 * Muster von `foundation-field-race-projection` die fertige, kleine Antwort mit — die
 * Formkarten-Bilanz der laufenden Saison, serverseitig auf dem VOLLEN Save gerechnet, gemessen
 * 1,9 KB (+0,012 %).
 *
 * Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip verworfen und bei jeder Auslieferung
 * frisch gebaut. Es gibt keine zweite Wahrheit.
 *
 * NUR DIE LAUFENDE SAISON. Fuer Archiv-Saisons war die Spalte schon vorher leer (deren
 * Aufstellungen fallen aus demselben Grund weg) — das ist im Host ausdruecklich als „lieber
 * leer als geraten" beschrieben und bleibt so.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildSeasonFormCardBonusByTeamId,
  type SeasonFormCardBonusByTeamId,
  type SeasonFormCardBonusEntry,
} from "@/lib/foundation/season-form-card-bonus";

export type FoundationFormCardBonusProjection = {
  seasonId: string;
  byTeamId: Record<string, SeasonFormCardBonusEntry>;
};

export function projiziereFormkartenBilanz(gameState: GameState): FoundationFormCardBonusProjection | undefined {
  try {
    const seasonId = gameState.season.id;
    const bilanz = buildSeasonFormCardBonusByTeamId(gameState, seasonId);
    if (bilanz.size === 0) {
      return undefined;
    }
    return { seasonId, byTeamId: Object.fromEntries(bilanz) };
  } catch {
    // Defensiv wie die Geschwister-Projektionen: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen — dann eben clientseitiger Fallback.
    return undefined;
  }
}

export function hydriereFormkartenProjektion(
  projection: FoundationFormCardBonusProjection,
): SeasonFormCardBonusByTeamId {
  return new Map(Object.entries(projection.byTeamId));
}
