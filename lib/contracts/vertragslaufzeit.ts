import type { GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";

/**
 * DIE ENDSAISON IST DIE WAHRHEIT — der Countdown wird daraus abgeleitet.
 *
 * ENTSCHIEDEN VON CHRIS, nach einer Fehlerserie an genau einem Tag: „Oder gibts ne bessere
 * methode? der buyout hängt ja auch noch dran."
 *
 * WORAN DER COUNTDOWN KRANKT. `contractLength` zaehlt die Saisons EINSCHLIESSLICH der laufenden
 * und wird beim Saisonwechsel um eins gesenkt. Damit bedeutet dieselbe Zahl zwei verschiedene
 * Dinge, je nachdem ob die Alterung schon gelaufen ist:
 *
 *     Laufzeit 1   VOR der Alterung  = letzte Saison, jetzt entscheiden
 *     Laufzeit 1   NACH der Alterung = noch eine volle Saison
 *
 * An Chris' Spielstand: nach der Alterung standen 128 Spieler auf „auslaufend", die alle noch
 * eine ganze Saison hatten. Aus dieser Doppeldeutigkeit sind an einem Tag vier Fehler entstanden
 * — eine Verlaengerung, die nichts veraenderte; ein Schutz gegen Doppelalterung, der einen
 * Spieler dauerhaft einfror; ein Fallback, der ausgerechnet beim Verlaengern die kuerzestmoegliche
 * Bruecke schrieb; und ein Alterungsschritt, den niemand ausloesen konnte.
 *
 * WAS DIE ENDSAISON BESSER MACHT. Sie ist eine Tatsache und keine Restzahl: „laeuft aus" heisst
 * dann woertlich, dass die Endsaison die laufende IST. Es gibt nichts herunterzuzaehlen, also
 * auch kein Doppelzaehlen, keine Ausnahme fuer frisch Unterschriebene und keine Frage, ob die
 * Alterung schon lief. Und die Restjahre, an denen der Buyout haengt, sind eine Subtraktion
 * statt einer fortgeschriebenen Zahl.
 *
 * WARUM ADDITIV UND NICHT AUSGETAUSCHT. 93 Dateien in `lib/` und `app/` lesen `contractLength`,
 * dazu 562 Fundstellen in den Tests. Ein Austausch in einem Zug waere bei der Reichweite
 * fahrlaessig. Die Endsaison wird deshalb die Wahrheit, der Countdown bleibt als ABGELEITETER
 * Wert bestehen, und die Lesestellen wandern nach und nach.
 */

/** Ohne Angabe laeuft ein Vertrag die laufende Saison und nicht laenger. */
const MINDEST_LAUFZEIT = 0;

function saisonNummerAus(gameState: Pick<GameState, "season">): number | null {
  return getCurrentSeasonNumber(gameState as GameState);
}

/**
 * Die Saison, NACH der der Vertrag endet.
 *
 * Traegt der Eintrag sie schon, gilt sie. Sonst wird sie aus dem Countdown abgeleitet — genau
 * einmal und immer gleich: `laufende Saison + (Laufzeit - 1)`. Eine Laufzeit von 1 heisst „diese
 * Saison ist die letzte", die Endsaison ist also die laufende. Eine Laufzeit von 0 heisst „schon
 * abgelaufen", die Endsaison liegt dann eine Saison zurueck.
 */
export function endSaisonNummer(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season">,
  optionen?: { alterungBereitsGelaufen?: boolean },
): number | null {
  if (typeof entry.contractEndSeasonNumber === "number" && Number.isFinite(entry.contractEndSeasonNumber)) {
    return entry.contractEndSeasonNumber;
  }
  const laufend = saisonNummerAus(gameState);
  if (laufend == null) {
    return null;
  }
  const laufzeit = Math.max(MINDEST_LAUFZEIT, Math.round(entry.contractLength ?? 0));
  /**
   * DER VERSATZ UM EINE SAISON — ohne ihn verliert jeder Vertrag ein Jahr.
   *
   * Die Alterung laeuft am ENDE einer Saison, waehrend diese noch die laufende ist. Ein Spielstand
   * in der Saisonende-Phase traegt danach also bereits Laufzeiten, die sich auf die KOMMENDE
   * Saison beziehen — der Countdown und die laufende Saisonnummer passen nicht mehr zusammen.
   *
   * An Chris' Spielstand nachgerechnet (Saison 1, Alterung gelaufen):
   *
   *     Spieler              vor der Alterung   danach   richtige Endsaison
   *     Jorund                       3             2             3
   *     Xelara                       1             0             1
   *     Lulu                         4             3             4
   *     King Arlen Morgolor          4             3             4
   *
   * Ohne den Versatz kaeme fuer Jorund `1 + 2 - 1 = 2` heraus — eine Saison zu kurz, und zwar
   * fuer jeden Vertrag im Spielstand.
   */
  const versatz = optionen?.alterungBereitsGelaufen === true ? 1 : 0;
  return laufend + laufzeit - 1 + versatz;
}

/**
 * Der Countdown, abgeleitet: wie viele Saisons der Vertrag noch laeuft, die laufende mitgezaehlt.
 *
 * Das ist genau die Bedeutung, die `contractLength` heute hat — nur nicht mehr fortgeschrieben,
 * sondern jedes Mal neu ausgerechnet. Damit kann sie nicht mehr aus dem Tritt geraten.
 */
export function restlaufzeit(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season">,
  optionen?: { alterungBereitsGelaufen?: boolean },
): number {
  const ende = endSaisonNummer(entry, gameState, optionen);
  const laufend = saisonNummerAus(gameState);
  if (ende == null || laufend == null) {
    // Ohne Saisonnummer bleibt der gespeicherte Countdown die beste verfuegbare Auskunft.
    return Math.max(MINDEST_LAUFZEIT, Math.round(entry.contractLength ?? 0));
  }
  return Math.max(MINDEST_LAUFZEIT, ende - laufend + 1);
}

/**
 * Die Jahre NACH der laufenden Saison — die Groesse, an der der Buyout haengt.
 *
 * Bisher stand dafuer `contractLength - 1` an mehreren Stellen. Als eigener Name ist sie schwerer
 * zu verwechseln: sie beantwortet „wie viel Vertrag muesste man wegkaufen", und die laufende
 * Saison ist dabei bereits gespielt.
 */
export function restjahreNachDieserSaison(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season">,
): number {
  return Math.max(0, restlaufzeit(entry, gameState) - 1);
}

/** Laeuft der Vertrag mit der laufenden Saison aus — ist die Entscheidung also jetzt faellig? */
export function laeuftMitDieserSaisonAus(
  entry: Pick<RosterEntry, "contractLength" | "contractEndSeasonNumber">,
  gameState: Pick<GameState, "season">,
): boolean {
  return restlaufzeit(entry, gameState) <= 1;
}

/**
 * Die Endsaison einer NEUEN Unterschrift ueber `laufzeit` Saisons.
 *
 * Bewusst „ab der laufenden Saison": wer waehrend der Saison verlaengert, bindet sie mit. Wer am
 * Saisonende unterschreibt, tut das nach der Alterung — dort ist die laufende Saison bereits die
 * kommende, und dieselbe Rechnung stimmt wieder.
 */
export function endSaisonFuerNeuenVertrag(
  gameState: Pick<GameState, "season">,
  laufzeit: number,
): number | null {
  const laufend = saisonNummerAus(gameState);
  if (laufend == null) {
    return null;
  }
  return laufend + Math.max(1, Math.round(laufzeit)) - 1;
}
