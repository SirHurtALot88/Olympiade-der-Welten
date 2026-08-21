/**
 * WOHIN DER BILDSCHIRM SPRINGT, WENN MAN „VERKAUFEN" DRUECKT.
 *
 * GEMELDET VON CHRIS: „wenn man sich die wertung anschaut und dort auf verkaufen klickt oder so
 * oder im verträge reiter auf verkaufen, dann sollte der screen auch zum verkaufsmodal springen
 * was unten aufgeht, sonst ist der user nur irritiert. und wenn der spieler verkauft wurde soll es
 * wieder hoch springen zu den verträgen."
 *
 * Der Verkaufsdialog ist KEIN Overlay. Er ist eine eigene Flaeche, die der Shell-Router zusaetzlich
 * einhaengt — die Teamansicht bleibt dabei stehen (`active={activeView === "teams"}` haengt nicht am
 * Panel). Der Dialog erscheint also UNTER dem, was man gerade liest, und genau das meint Chris mit
 * „was unten aufgeht".
 *
 * Vorher sprang die Seite an dieser Stelle nach GANZ OBEN. Das war fuer den Weg aus dem
 * Transfermarkt richtig, wo der Dialog die Seite ersetzt — aus der Teamansicht heraus fuehrt es vom
 * Dialog WEG. Ein frueherer Bericht („springt der screen nicht zum verkaufsmodal, das irritiert")
 * wurde damals so behoben; die Haelfte, die den Dialog anhaengt statt ersetzt, blieb offen.
 *
 * Deshalb wird jetzt zum Dialog selbst gesprungen. Das ist in BEIDEN Faellen richtig: ersetzt er die
 * Seite, steht er ohnehin oben.
 */

/** Wie oft auf das Element gewartet wird, bevor aufgegeben wird (je ein Frame). */
const MAX_FRAMES = 20;

/**
 * Springt zu einem Element, sobald es im Dokument steht.
 *
 * Das Warten ist der Kern: beim Klick auf „Verkaufen" existiert die Flaeche noch nicht — React
 * rendert sie erst nach dem Zustandswechsel. Ein `scrollIntoView` im selben Zug faende nichts und
 * liefe ins Leere. Es wird deshalb Frame fuer Frame nachgesehen, bis das Element da ist.
 */
export function springeZuElement(selector: string, options?: { block?: ScrollLogicalPosition }): void {
  if (typeof window === "undefined") return;
  let frames = 0;
  const versuch = () => {
    const ziel = document.querySelector(selector);
    if (ziel instanceof HTMLElement) {
      ziel.scrollIntoView({ behavior: "auto", block: options?.block ?? "start" });
      return;
    }
    frames += 1;
    if (frames < MAX_FRAMES) window.requestAnimationFrame(versuch);
  };
  window.requestAnimationFrame(versuch);
}

/**
 * Springt an eine gemerkte Scrollposition zurueck — der Rueckweg nach dem Verkauf.
 *
 * Bewusst die POSITION und kein fester Anker: geklickt wird nicht nur im Vertraege-Reiter, sondern
 * auch aus der Wertung und aus dem Auslauf-Center. Ein fester Anker waere fuer zwei von drei Wegen
 * der falsche Ort; die Position bringt jeden dorthin zurueck, wo er den Knopf gedrueckt hat.
 *
 * Nach dem Verkauf ist die Liste eine Zeile kuerzer, die Position also minimal verschoben. Das ist
 * hinnehmbar — sie trifft weiter den Abschnitt, um den es geht.
 */
export function springeZuPosition(position: number): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: Math.max(0, position), behavior: "auto" });
  });
}

/** Der Anker der Verkaufsflaeche — `FoundationDecisionSurface` schreibt ihre `testId` als Attribut. */
export const VERKAUFSFLAECHE_ANKER = '[data-testid="transfer-sell-page"]';
