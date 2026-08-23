/**
 * EINE ANTWORT LESEN, OHNE DEN ZUSTAND ZU VERSCHLEIERN.
 *
 * GEMELDET (`lwlrwd`, „Spieltag · Arena", Spielstand `swnjlk`, Saison 2, Spieltag 4):
 * „Die Punkte wurden nicht gebucht — Failed to execute 'json' on 'Response': Unexpected end of
 * JSON input"
 *
 * NACHGEMESSEN WAR DIE MELDUNG FALSCH: am Live-Abbild tragen alle sieben gewerteten Spieltage der
 * Saison sowohl ein Ergebnis als auch einen Standings-Apply-Eintrag — Spieltag 4 eingeschlossen.
 * Gebucht wurde also sehr wohl; nur die ANTWORT kam nicht (oder nicht als JSON) beim Browser an.
 *
 * Das ist die gefaehrlichste Sorte Fehlmeldung: sie behauptet das Gegenteil des Zustands. Wer ihr
 * glaubt, bucht denselben Spieltag ein zweites Mal.
 *
 * `await response.json()` wirft bei leerem Koerper genau jenen Satz und verliert dabei alles, was
 * man zur Einordnung braeuchte — Statuscode, Statustext, den Anfang des Koerpers. Diese Funktion
 * behaelt es und macht daraus einen Fehler, den man lesen kann.
 *
 * SIE REPARIERT DEN LEEREN KOERPER NICHT. Warum der Server nichts zurueckgab (Zeitueberschreitung,
 * Absturz ohne Koerper, Abbruch unterwegs), steht in seinen Protokollen, an die von hier niemand
 * herankommt. Was sie leistet: beim naechsten Mal steht die Antwort in der Meldung.
 */

/** Fehler mit erhaltenem Zustand — die Arena unterscheidet daran „nicht gebucht" von „unbekannt". */
export class AntwortUnlesbarError extends Error {
  readonly status: number;
  readonly statusText: string;
  /** true, wenn der Koerper leer war (kein Inhalt), statt ungueltiges JSON zu enthalten. */
  readonly koerperLeer: boolean;

  constructor(input: { status: number; statusText: string; koerperLeer: boolean; message: string }) {
    super(input.message);
    this.name = "AntwortUnlesbarError";
    this.status = input.status;
    this.statusText = input.statusText;
    this.koerperLeer = input.koerperLeer;
  }
}

const KOERPER_AUSZUG = 160;

export async function leseAntwortAlsJson<T>(response: Response): Promise<T> {
  const roh = await response.text();
  const zustand = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;

  if (roh.trim().length === 0) {
    // Genau der gemeldete Fall. Statt „Unexpected end of JSON input" steht hier, WAS ankam.
    throw new AntwortUnlesbarError({
      status: response.status,
      statusText: response.statusText,
      koerperLeer: true,
      message: `Der Server antwortete mit ${zustand} und leerem Inhalt.`,
    });
  }

  try {
    return JSON.parse(roh) as T;
  } catch {
    // Kein JSON — meist eine HTML-Fehlerseite von einem Proxy davor. Der Anfang reicht, um das
    // zu erkennen; die ganze Seite gehoert nicht in eine Fehlermeldung.
    const auszug = roh.slice(0, KOERPER_AUSZUG).replace(/\s+/g, " ").trim();
    throw new AntwortUnlesbarError({
      status: response.status,
      statusText: response.statusText,
      koerperLeer: false,
      message: `Der Server antwortete mit ${zustand}, aber nicht mit JSON: „${auszug}${roh.length > KOERPER_AUSZUG ? " …" : ""}"`,
    });
  }
}

/**
 * Kam die Buchung womoeglich trotzdem durch? Ein Fehler BEIM LESEN der Antwort sagt nichts
 * darueber aus, ob der Server sie ausgefuehrt hat — genau das war `lwlrwd`. Ein fachlicher Fehler
 * (der Server hat geantwortet und abgelehnt) sagt es sehr wohl.
 */
export function istZustandUnbekannt(error: unknown): boolean {
  return error instanceof AntwortUnlesbarError;
}
