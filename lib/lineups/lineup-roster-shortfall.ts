/**
 * KADER KLEINER ALS DER SPIELTAG — und warum das in der Einsatzliste stehen muss.
 *
 * GEMELDET AUS DEM SPIEL (Franky, S1/Spieltag 4): "spieler können nichtmehr in disziplinen
 * eingesetzt werden."
 *
 * Nachgestellt am Save `new-game-1785412846578-h0z7cl`: das Team hat acht Spieler im Kader,
 * einer davon ist verletzt und zu Recht gesperrt — bleiben sieben. Spieltag 4 verlangt
 * Wettessen (6) + I Spy (4) = zehn verschiedene Spieler. Nach dem siebten Spieler ist der
 * Kader leer; jeder weitere Slot hat keinen einzigen Kandidaten mehr. Genau das sieht man:
 * "geht nicht mehr". An den Spieltagen 1 bis 3 verlangten die Disziplinen 7, 5 und 7 Plaetze —
 * da reichte der Kader noch, deshalb faellt es erst jetzt auf.
 *
 * Es ist KEIN Fehler, dass die drei Plaetze leer bleiben: `legacy-matchday-partial-lineup-rule`
 * erlaubt das ausdruecklich ("wenn alle Spieler eingesetzt sind die das team zur Verfuegung hat
 * ist es auch gruen"). Der Fehler ist, dass es niemand SAGT. Die Kandidatenliste antwortete mit
 * "Keine Kandidaten in dieser Gruppe" — derselbe Fehlertyp wie "blockiert" statt "Verletzt":
 * Die Regel griff richtig, nur wusste niemand warum.
 *
 * Zweitens hing an derselben Stelle ein echter Riegel: der Weg in die Arena verlangte NULL offene
 * Slots. Ein Kader, der die Slotzahl gar nicht erreichen kann, haette diese Null nie erreicht —
 * fuer so ein Team waere der Spieltag nach dem Speichern zu Ende gewesen. `isLineupArenaReady`
 * haelt sich deshalb an dieselbe Regel wie die Bereitschaftspruefung des Spieltags.
 *
 * Verwandte Stellen, die dieselbe Regel bereits kennen und deshalb NICHT angefasst wurden:
 * `lib/lineups/legacy-matchday-readiness.ts` (Status `partial_lineup_allowed`) und
 * `lib/foundation/matchday-lineup-readiness.ts#isTeamAllAvailablePlayersDeployedInLineup`.
 * Dieses Modul rechnet bewusst nur auf Zahlen — es ist der Formulierer fuer die Oberflaeche,
 * keine zweite Wahrheit ueber die Bereitschaft.
 */

export type LineupRosterShortfall = {
  /** Plaetze, die dieser Kader an diesem Spieltag ueberhaupt nicht besetzen kann. */
  unfillableSlots: number;
  /** Kaderspieler, die gerade gesperrt sind (verletzt) und deshalb nicht zaehlen. */
  unavailableCount: number;
  /** Jeder einsetzbare Spieler steht bereits — mehr ist an diesem Spieltag nicht moeglich. */
  allAvailableDeployed: boolean;
  /** Ueberschrift des Hinweises an der Einsatzliste. */
  headline: string;
  /** Die Zahlen dahinter: wie viele Plaetze, wie viele Spieler, wie viele bleiben leer. */
  detail: string;
  /** Was zu tun ist — und dass es erlaubt ist, so anzutreten. */
  hint: string;
};

/**
 * Beschreibt die Unterdeckung eines Kaders fuer genau diesen Spieltag.
 *
 * Gibt `null` zurueck, solange der Kader die Plaetze noch decken kann — dann gibt es nichts zu
 * erklaeren und der Hinweis bleibt weg. Ein Hinweis, der immer da steht, wird nicht gelesen.
 */
export function describeLineupRosterShortfall(input: {
  /** Plaetze beider Disziplinen dieses Spieltags zusammen. */
  requiredSlots: number;
  /** Spieler, die gesetzt werden koennen (ohne die gesperrten). */
  availablePlayerCount: number;
  /** Der ganze Kader, inklusive der gesperrten Spieler. */
  rosterPlayerCount: number;
  /** Wie viele verschiedene Spieler gerade in Slots stehen. */
  assignedPlayerCount: number;
}): LineupRosterShortfall | null {
  const requiredSlots = Math.max(0, Math.trunc(input.requiredSlots));
  const availablePlayerCount = Math.max(0, Math.trunc(input.availablePlayerCount));
  const rosterPlayerCount = Math.max(availablePlayerCount, Math.trunc(input.rosterPlayerCount));
  const assignedPlayerCount = Math.max(0, Math.trunc(input.assignedPlayerCount));

  if (requiredSlots <= 0 || availablePlayerCount >= requiredSlots) {
    return null;
  }

  const unfillableSlots = requiredSlots - availablePlayerCount;
  const unavailableCount = rosterPlayerCount - availablePlayerCount;
  const allAvailableDeployed = assignedPlayerCount >= availablePlayerCount;
  // Der Grund fuer die Luecke gehoert in denselben Satz wie die Luecke. Ohne ihn liest sich
  // "nur 7 Spieler" wie ein Anzeigefehler; mit ihm ist es eine Nachricht ueber den Kader.
  const unavailableSuffix =
    unavailableCount > 0
      ? unavailableCount === 1
        ? " (1 verletzt)"
        : ` (${unavailableCount} verletzt)`
      : "";

  return {
    unfillableSlots,
    unavailableCount,
    allAvailableDeployed,
    headline: allAvailableDeployed
      ? "Alle verfügbaren Spieler stehen"
      : "Kader zu klein für diesen Spieltag",
    detail: `${requiredSlots} Plätze, aber nur ${availablePlayerCount} einsetzbare Spieler${unavailableSuffix} — ${unfillableSlots} ${unfillableSlots === 1 ? "Platz bleibt" : "Plätze bleiben"} leer.`,
    hint: allAvailableDeployed
      ? "Mehr geht an diesem Spieltag nicht. Du kannst so speichern und in die Arena — die leeren Plätze bringen nur keine Punkte."
      : "Setz alle verfügbaren Spieler, dann kannst du speichern und in die Arena. Die leeren Plätze bringen keine Punkte; mehr Spieler holst du über den Transfermarkt.",
  };
}

/**
 * Darf dieses Team von der Einsatzliste in die Arena?
 *
 * Frueher stand hier `openSlots === 0`. Fuer einen Kader, der die Slotzahl des Spieltags gar
 * nicht erreichen kann, ist diese Null unerreichbar — der Knopf waere dauerhaft grau geblieben,
 * obwohl `buildLegacyMatchdayReadiness` dieselbe Aufstellung als `ready` fuehrt
 * (`partial_lineup_allowed`). Beide Seiten muessen dieselbe Regel benutzen, sonst sperrt die
 * Oberflaeche einen Spieltag, den die Rechnung laengst durchlaesst.
 */
export function isLineupArenaReady(input: {
  hasSavedDraft: boolean;
  hasBlockingIssues: boolean;
  openSlots: number;
  allAvailablePlayersDeployed: boolean;
}): boolean {
  if (!input.hasSavedDraft || input.hasBlockingIssues) {
    return false;
  }

  return input.openSlots === 0 || input.allAvailablePlayersDeployed;
}
