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
  /**
   * DIE NOCH NICHT GESPIELTEN KARTEN DER SAISON, namentlich.
   *
   * GEMELDET (Chris, Inbox): eine Warnung „Negative Formkarten offen — am Saisonende drohen 18
   * Strafpunkte" fuer Karten, die laengst gespielt sind. `buildFormCardSeasonUsageAudit` leitet
   * „gespielt" aus den `lineupDrafts` ab, und die sind unten auf den aktiven Spieltag
   * beschnitten (320 voll, 32 kompakt). Gemessen am Live-Save: voll 438 von 532 Karten gespielt
   * und NULL offene negative, im Browser 25 gespielt und 262 offene negative (605 Strafpunkte,
   * fuer S-C 8 Karten / 18 Punkte). Eine Warnung vor einer Strafe, die es nicht gibt.
   *
   * WARUM DIE OFFENEN UND NICHT DIE GESPIELTEN: es sind die wenigeren (94 gegen 438) — und vor
   * allem koennen sie im Lauf der Sitzung nur WENIGER werden. Wer waehrend der Sitzung eine
   * Karte legt, streicht sie aus dieser Liste; die Projektion vom Ladezeitpunkt kann dadurch nie
   * zu wenig anzeigen. Andersherum (gespielte Karten mitschicken) waere die Liste vom Laden
   * schon nach dem naechsten Kartenzug zu kurz.
   *
   * OHNE DIE NULLWERT-KARTEN (der leere Platz im Kartenpaar eines Spielers): sie sind nie
   * spielbar und werden ueberall vorher weggefiltert. Sie mitzuschicken hat 242 statt 94
   * Eintraege gekostet, 13,0 KB statt 5,1 KB — der Leser blendet sie spiegelbildlich aus.
   */
  unusedCardIds: string[];
};

/** Karten-Ids, die in den Aufstellungen dieser Saison in einem Modifier-Slot stecken. */
function sammleGespielteKartenIds(gameState: Pick<GameState, "seasonState">, seasonId: string): Set<string> {
  const gespielt = new Set<string>();
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.seasonId !== seasonId) {
      continue;
    }
    const modifiers = draft.modifiers;
    for (const cardId of [
      modifiers?.d1?.primaryFormCardId,
      modifiers?.d1?.secondaryFormCardId,
      modifiers?.d2?.primaryFormCardId,
      modifiers?.d2?.secondaryFormCardId,
    ]) {
      if (cardId) {
        gespielt.add(cardId);
      }
    }
  }
  return gespielt;
}

/**
 * Die in dieser Saison gespielten Karten-Ids einer bereits geladenen Ansicht.
 *
 * VORRANG PER MENGENVEREINIGUNG, NICHT PER `??`. Auf dem Server gibt es keine Projektion und es
 * bleibt bei den Aufstellungen; im Browser sind die Aufstellungen beschnitten, dafuer sagt die
 * Projektion, welche Karten am Ladezeitpunkt noch offen waren. Beide Seiten koennen nur
 * ZUSAETZLICHE gespielte Karten kennen, nie weniger — also ist die Vereinigung die richtige
 * Antwort und `??` (oder ein Entweder-Oder) waere zu grob: wer waehrend der Sitzung eine Karte
 * legt, wuerde sonst bis zum naechsten Laden als „offen" gefuehrt.
 */
export function leseGespielteFormkartenIds(gameState: GameState, seasonId: string): Set<string> {
  const gespielt = sammleGespielteKartenIds(gameState, seasonId);

  const projektion = gameState.seasonState.foundationFormCardBonus;
  if (!projektion || projektion.seasonId !== seasonId || !Array.isArray(projektion.unusedCardIds)) {
    return gespielt;
  }

  const offenLautProjektion = new Set(projektion.unusedCardIds);
  for (const card of gameState.seasonState.formCards ?? []) {
    // Nullwert-Karten stehen absichtlich nicht in der Projektion (s. o.) — sie hier als
    // „gespielt" zu fuehren waere still falsch, auch wenn heute jeder Leser sie wegfiltert.
    if (card.seasonId === seasonId && card.cardValue !== 0 && !offenLautProjektion.has(card.id)) {
      gespielt.add(card.id);
    }
  }
  return gespielt;
}

export function projiziereFormkartenBilanz(gameState: GameState): FoundationFormCardBonusProjection | undefined {
  try {
    const seasonId = gameState.season.id;
    const bilanz = buildSeasonFormCardBonusByTeamId(gameState, seasonId);
    if (bilanz.size === 0) {
      return undefined;
    }
    const gespielt = sammleGespielteKartenIds(gameState, seasonId);
    const unusedCardIds = (gameState.seasonState.formCards ?? [])
      .filter((card) => card.seasonId === seasonId && card.cardValue !== 0 && !gespielt.has(card.id))
      .map((card) => card.id);
    return { seasonId, byTeamId: Object.fromEntries(bilanz), unusedCardIds };
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
