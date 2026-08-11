/**
 * GEMELDET (Chris, Saisonstand): „nein ich meine dass sie nicht angezeigt werden ich habe meine
 * formkarten! aber die berechnung im saisonstand macht wieder oder immernoch ueberall 0!"
 *
 * BEFUND (am Live-Abbild gemessen, Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10):
 * es fehlten keine Daten. Die `(+x)`-Zahl hinter jedem PP-Bereichswert ist die WIRKUNG der
 * gespielten Formkarten — `buildPpAreaFormBonusByTeamId` summiert dafuer `formModifier` ueber die
 * `disciplineResults`. Genau die streicht `compactFoundationInitialGameState` auf den aktiven
 * Spieltag zusammen (640 Zeilen voll, 64 kompakt). Gemessen: voll 32 von 32 Teams mit Bilanz,
 * kompakt 14 — und diese 14 mit den Karten EINES von zehn Spieltagen:
 *
 *   Wicked Wizards      181,8 -> 69,6
 *   Vicious & Delicious 130,9 -> 34,1
 *   Cold Steel / Black Panthers / Zero Heroes: Wert faellt ganz weg
 *   Nunchuck Ninjas     133,6 -> 184,3  (ein guter Spieltag allein ueberholt die Saisonsumme —
 *                                        also nicht einmal als „zu wenig Daten" erkennbar)
 *
 * Die Sortierung der Spalte „Form" im Saisonstand haengt an diesen Zahlen.
 *
 * ZWILLINGSSCHWESTER von `foundation-form-card-projection`: die trug die NENNWERT-Spalte
 * („wie viel Formkarten-Bonus hatte das Team ueberhaupt"), diese hier die danebenstehende
 * WIRKUNGS-Spalte („was hat davon im Ergebnis gezaehlt"). Beide Spalten standen am selben
 * beschnittenen Payload, repariert wurde bisher nur die erste.
 *
 * DAS STREICHEN BLEIBT RICHTIG: die `disciplineResults` sind die schwere Fracht und wachsen mit
 * jedem Spieltag. Also faehrt nach dem Muster der Geschwister-Projektionen die fertige, kleine
 * Antwort mit, serverseitig auf dem VOLLEN Save gerechnet.
 *
 * JE SPIELTAG, NICHT ALS SAISONSUMME. Eine Summe waere kleiner, aber sie waere schon in dem
 * Moment falsch, in dem Chris den naechsten Spieltag spielt: dessen Wirkung kennt nur der
 * Browser, die Projektion stammt vom Laden. Aufgeschluesselt kann der Leser genau die Spieltage
 * uebernehmen, die der Spielstand selbst deckt, und den Rest ergaenzen (siehe
 * `buildPpAreaFormBonusByTeamId`).
 *
 * Reine Anzeigefracht: wird beim Compact-PUT-Roundtrip verworfen und bei jeder Auslieferung
 * frisch gebaut. Es gibt keine zweite Wahrheit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  berechnePpAreaFormBonusJeSpieltag,
  type PpAreaFormBonusByArea,
} from "@/lib/foundation/pp-area-form-bonus";

export type FoundationPpAreaFormBonusEntry = {
  matchdayId: string;
  /**
   * Nur Teams mit von Null verschiedener Wirkung, je Team nur die betroffenen Bereiche.
   *
   * BEWUSST AUCH LEER MOEGLICH: ein gewerteter Spieltag, an dem niemand eine Karte gelegt hat,
   * traegt hier ein leeres Objekt. Der Unterschied zwischen „bekannt und leer" und „unbekannt"
   * ist der ganze Punkt dieser Aufschluesselung — nur an ihm merkt der Leser, dass ihm ein
   * Spieltag fehlt, statt stillschweigend mit 0 weiterzurechnen.
   */
  bonusByTeamId: Record<string, PpAreaFormBonusByArea>;
};

export type FoundationPpAreaFormBonusProjection = {
  seasonId: string;
  matchdays: FoundationPpAreaFormBonusEntry[];
};

export function projizierePpAreaFormBonus(gameState: GameState): FoundationPpAreaFormBonusProjection | undefined {
  try {
    const seasonId = gameState.season.id;
    const jeSpieltag = berechnePpAreaFormBonusJeSpieltag(gameState, seasonId);
    if (jeSpieltag.size === 0) {
      return undefined;
    }

    // In Spielplan-Reihenfolge, damit die Fracht lesbar bleibt; der Leser sucht ohnehin ueber
    // die matchdayId. Eimer ohne Platz im Spielplan (Altstaende ohne gewertete Spieltagskoepfe)
    // haengen hinten dran, damit ihre Wirkung nicht unter den Tisch faellt.
    const imSpielplan = (gameState.season.matchdayIds ?? []).filter((matchdayId) => jeSpieltag.has(matchdayId));
    const uebrig = [...jeSpieltag.keys()].filter((matchdayId) => !imSpielplan.includes(matchdayId));

    return {
      seasonId,
      matchdays: [...imSpielplan, ...uebrig].map((matchdayId) => ({
        matchdayId,
        bonusByTeamId: Object.fromEntries(jeSpieltag.get(matchdayId) ?? new Map()),
      })),
    };
  } catch {
    // Defensiv wie die Geschwister-Projektionen: eine kaputte Projektion darf die
    // Compact-Auslieferung nie zu Fall bringen — dann eben der (unvollstaendige) Fallback.
    return undefined;
  }
}
