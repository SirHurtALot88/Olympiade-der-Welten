/**
 * DIE FUENF RAUM-SITZUNGSMELDUNGEN — an EINER Stelle (Befund F6, Aufgabe #44).
 *
 * WARUM ES DIESE DATEI GIBT. `room-store.ts` gibt diese Texte zurueck, und zwei Clients
 * vergleichen eingehende `roomError`-Meldungen ZEICHENGENAU dagegen:
 * `app/room/[roomCode]/RoomPageClient.tsx` (um einen endgueltig abgelehnten Beitritt von einem zu
 * unterscheiden, den ein zweiter Klick loest) und `use-foundation-shell-router-body-scope.tsx`
 * (siehe unten). Bis eben standen sie dort als handkopierte Zeichenketten neben den Originalen —
 * zwei Quellen fuer denselben Text. Wer einen davon umformuliert haette, haette die Erkennung
 * stillschweigend abgeschaltet: kein Typfehler, kein roter Test, nur eine Maske, die ab da falsch
 * reagiert. Jetzt gibt es die Texte genau einmal.
 *
 * DASS DER CLIENT UEBERHAUPT AUF TEXTE SCHAUT, ist nicht schoen — ein eigener Fehlercode im
 * `roomError`-Ereignis waere sauberer. Der Umbau beruehrt aber jede Socket-Aktion und jeden
 * Aufrufer; bis dahin ist EIN gemeinsamer Text allemal besser als zwei getrennte Kopien.
 * Ausdruecklich als offener Punkt notiert, nicht als geloest ausgegeben.
 */

/** `joinRoom`: der Raum hat schon zwei aktive Coaches. Ein zweiter Klick aendert daran nichts. */
export const RAUM_VOLL_MELDUNG = "Der Raum hat bereits zwei aktive Coaches.";

/** `joinRoom`: unter diesem Code existiert kein Raum. Ebenfalls endgueltig. */
export const RAUM_NICHT_GEFUNDEN_MELDUNG = "Dieser Raum wurde nicht gefunden.";

/** Der Raum ist weg — verwaist und ersetzt, geschlossen oder verfallen. */
export const RAUM_EXISTIERT_NICHT_MEHR_MELDUNG = "Der Raum existiert nicht mehr.";

/** `rejoinRoom`: das gespeicherte Sitzplatz-Token gehoert zu keinem Sitz dieses Raums (mehr). */
export const GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG = "Der gespeicherte Sitzplatz ist ungueltig.";

/** Jede andere Aktion mit einem Token, das keinen Sitz trifft. */
export const SITZPLATZ_UNGUELTIG_MELDUNG = "Dein Sitzplatz ist nicht gueltig.";

/**
 * Ist diese Meldung ein SITZUNGS-Fehler — also einer, nach dem die Bedienleiste wirklich weg muss?
 *
 * BEFUND F6, und er tat im Spiel weh: der Foundation-Client behandelte JEDEN `roomError` gleich —
 * Bedienleiste leeren und "Room-Session abgelaufen" melden. Auch bei einer voellig harmlosen
 * Fach-Ablehnung, etwa einem Doppelklick auf "Weiter" oder einer Aktion, die gerade dem Host
 * gehoert. Der Spieler verlor damit fuer einen Bedienfehler seine ganze Bedienung und las dazu,
 * seine Sitzung sei abgelaufen — was schlicht nicht stimmte.
 *
 * Sitzungsfehler sind genau die drei Faelle, in denen der Sitz tatsaechlich nicht mehr gilt: der
 * Raum ist weg, oder das Token trifft keinen Sitz. Alles andere ist eine Fach-Ablehnung und wird
 * als normale Meldung angezeigt, ohne die Bedienung wegzureissen.
 *
 * Vergleich ueber die Konstanten oben statt ueber Teilzeichenketten wie "Sitzplatz": ein
 * Teilstring-Treffer wuerde jede kuenftige Meldung mitreissen, in der zufaellig dasselbe Wort
 * vorkommt.
 */
const SITZUNGS_MELDUNGEN: readonly string[] = [
  RAUM_EXISTIERT_NICHT_MEHR_MELDUNG,
  GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG,
  SITZPLATZ_UNGUELTIG_MELDUNG,
];

export function istRoomSitzungsFehler(message: string | null | undefined): boolean {
  if (!message) {
    // Ohne Text laesst sich nichts feststellen — und "nichts feststellbar" darf NICHT bedeuten,
    // dem Spieler die Bedienleiste wegzunehmen. Im Zweifel die mildere Folge.
    return false;
  }
  return SITZUNGS_MELDUNGEN.includes(message.trim());
}
