/**
 * WAS DIE SAMMEL-ABGABE ABGIBT — eigener Entwurf zuerst, KI-Vorschlag nur als Lueckenfueller.
 *
 * GEMELDET VON CHRIS: „ist im singleplayer auch integriert dass man mehrere teams am stueck
 * aufstellen kann und nur einmal das lineup abgeben bzw speichern muss?"
 *
 * Die Sammel-Abgabe gab es (Aufgabe #43), sie nahm aber fuer JEDES offene Team den KI-Vorschlag.
 * Solange ein Teamwechsel den Entwurf wegwarf, war das auch die einzige Moeglichkeit — es gab
 * schlicht keine eigenen Entwuerfe, die man haette abgeben koennen. Seit die Entwuerfe den Wechsel
 * ueberleben (`lib/lineups/entwurf-gedaechtnis.ts`) gibt es sie, und dann ist der KI-Vorschlag die
 * falsche Wahl: er wuerde eigene Arbeit ueberschreiben.
 *
 * DIE REGEL: wo ein eigener Entwurf liegt, geht der eigene Entwurf. Nur wo keiner liegt, kommt der
 * Vorschlag. Nie umgekehrt, und nie stillschweigend — der Knopf nennt die Mischung.
 *
 * Ein unvollstaendiger eigener Entwurf wird trotzdem abgegeben und nicht heimlich durch den
 * Vorschlag ersetzt: die Route lehnt ihn dann mit ihrem Grund ab, und die Zusammenfassung nennt
 * Team und Grund (`fasseSammelAbgabeZusammen`). Eigene Arbeit gegen einen KI-Vorschlag zu
 * tauschen, ohne dass es jemand merkt, waere das Schlechtere.
 */

export type SammelAbgabeMischung = {
  /** Teams, fuer die ein eigener Entwurf vorliegt — in der Reihenfolge der offenen Teams. */
  eigene: string[];
  /** Teams ohne eigenen Entwurf; fuer sie wird der KI-Vorschlag geholt. */
  kiVorschlag: string[];
  /** Die Beschriftung des Knopfes. Sie nennt die Mischung, nicht nur eine Zahl. */
  knopfText: string;
  /** Der laengere Satz fuer den Titel des Knopfes. */
  erklaerung: string;
};

function eigenerTeil(anzahl: number): string {
  return anzahl === 1 ? "1 eigene Aufstellung" : `${anzahl} eigene Aufstellungen`;
}

function kiTeil(anzahl: number): string {
  return anzahl === 1 ? "1 KI-Vorschlag" : `${anzahl} KI-Vorschläge`;
}

export function mischeSammelAbgabe(input: {
  offeneTeamIds: readonly string[];
  hatEigenenEntwurf: (teamId: string) => boolean;
}): SammelAbgabeMischung {
  const eigene: string[] = [];
  const kiVorschlag: string[] = [];
  for (const teamId of input.offeneTeamIds) {
    (input.hatEigenenEntwurf(teamId) ? eigene : kiVorschlag).push(teamId);
  }

  if (eigene.length === 0 && kiVorschlag.length === 0) {
    return {
      eigene,
      kiVorschlag,
      knopfText: "Alle Aufstellungen stehen",
      erklaerung: "Alle deine Teams stehen bereits.",
    };
  }

  if (kiVorschlag.length === 0) {
    return {
      eigene,
      kiVorschlag,
      knopfText: `${eigenerTeil(eigene.length)} abgeben`,
      erklaerung:
        `Gibt ${eigenerTeil(eigene.length)} in EINEM Zug ab — genau das, was du selbst gesetzt hast. ` +
        "Kein KI-Vorschlag ist dabei.",
    };
  }

  if (eigene.length === 0) {
    return {
      eigene,
      kiVorschlag,
      knopfText: `${kiVorschlag.length} offene mit KI-Vorschlag abgeben`,
      erklaerung:
        `Holt für ${kiVorschlag.length} offene Teams den KI-Vorschlag und gibt sie in EINEM Zug ab. ` +
        "Für keines dieser Teams liegt ein eigener Entwurf vor.",
    };
  }

  return {
    eigene,
    kiVorschlag,
    knopfText: `${eigenerTeil(eigene.length)} + ${kiTeil(kiVorschlag.length)} abgeben`,
    erklaerung:
      `Gibt ${eigenerTeil(eigene.length)} ab (deine eigene Auswahl) und holt für die übrigen ` +
      `${kiVorschlag.length} Teams den KI-Vorschlag. Alles in EINEM Zug.`,
  };
}

/**
 * Ein Entwurf zaehlt als „eigener", sobald er MINDESTENS EINEN Slot besetzt.
 *
 * Die Schwelle liegt bewusst bei eins und nicht bei „vollstaendig": wer drei von sechs Slots
 * gesetzt hat, hat eine Meinung — die darf ein Vorschlag nicht ueberschreiben. Was daraus wird,
 * entscheidet die Route, und ihr Grund steht danach in der Zusammenfassung.
 */
export function istEigenerEntwurf(entries: ReadonlyArray<{ activePlayerId: string | null }>): boolean {
  return entries.some((entry) => Boolean(entry.activePlayerId));
}
