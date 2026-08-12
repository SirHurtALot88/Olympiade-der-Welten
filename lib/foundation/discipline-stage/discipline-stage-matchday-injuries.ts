/**
 * VERLETZUNGEN IN DER SPIELTAGS-WERTUNG — die Marke zeigt das EREIGNIS.
 *
 * GEWUENSCHT VON CHRIS: „es waere gut wenn man in der score tabelle vllt noch sehen kann wenn ein
 * team einen verletzten spieler hat! das waere gut"
 *
 * DIE ENTSCHEIDUNG, die der Plan offenliess: Die Marke sagt „AN DIESEM SPIELTAG hat es dieses Team
 * erwischt", nicht „dieses Team hat gerade jemanden im Lazarett". Die Spieltags-Wertung ist eine
 * Wertung DIESES Spieltags; eine Marke, die den heutigen Kaderzustand an eine sechs Spieltage
 * alte Zeile haengt, erklaert an ihr gar nichts. Der Kaderzustand steht deshalb im Tooltip, nicht
 * in der Marke.
 *
 * WAS „AN DIESEM SPIELTAG" GENAU HEISST — zwei Buchungen, beide aus derselben Quelle:
 *   1. ZUGEZOGEN: der Verletzungswurf dieses Spieltags ging schief (`injuryEvents` mit
 *      `result === "injured"` und diesem `matchdayId`). Der Spieler ist an diesem Spieltag
 *      angetreten — der Wurf trifft nur eingesetzte Spieler — und faellt danach aus.
 *   2. AUSGEFALLEN: eine Verletzung vom VORIGEN Spieltag sperrt ihn fuer diesen. Das steht
 *      ebenfalls in der Buchung, im Feld `unavailableUntil` (gesetzt auf den naechsten Spieltag,
 *      siehe `fatigue-injury-service`) — es ist nicht geraten, sondern abgelesen.
 * Beides zusammen ist die ehrliche Antwort auf „warum war dieses Team an diesem Spieltag
 * schwaecher?".
 *
 * KEINE DRITTE RECHENSTELLE FUER „IST VERLETZT":
 *   - Ob ein Ereignis eine Verletzung ist, entscheidet `injuryEventToPlayerHistoryRecord`
 *     (`lib/foundation/player-injury-history.ts`) — dieselbe Funktion, aus der auch die
 *     Verletzungshistorie der Spielerkarte entsteht. Sie gibt `null` fuer alles, was nicht
 *     `result === "injured"` ist.
 *   - Wie viele Spieler ein Team GERADE verletzt hat, sagt `countTeamInjuredPlayers`
 *     (`lib/fatigue/fatigue-injury-service.ts`) — die Zahl, die auch der Kader zeigt.
 * Die gebuchten Leistungszeilen taugen dafuer NICHT: `injuryApplied`/`injuryAdjustedValue` stehen
 * nur in der Resolve-Vorschau. Nachgemessen am Live-Abbild (Save `new-game-1785823388048-1hf25q`):
 * 0 von 2534 gebuchten `playerDisciplinePerformances` tragen `injuryApplied`.
 *
 * DATENLAGE, gemessen: `seasonState.injuryEvents` faehrt vollstaendig in den Browser (5032
 * Eintraege, auch im kompakten Payload; davon 44 mit `result === "injured"`).
 */
import type { GameState, InjuryEventRecord } from "@/lib/data/olyDataTypes";
import { countTeamInjuredPlayers } from "@/lib/fatigue/fatigue-injury-service";
import { injuryEventToPlayerHistoryRecord } from "@/lib/foundation/player-injury-history";

export type SpieltagsVerletzterSpieler = {
  playerId: string;
  playerName: string;
  /** Wie viele Spieltage der Ausfall dauert (aus der Buchung, nicht geschaetzt). */
  matchdaysMissed: number;
};

export type SpieltagsVerletzungsMarke = {
  teamId: string;
  /** An DIESEM Spieltag zugezogen. */
  zugezogen: SpieltagsVerletzterSpieler[];
  /** An diesem Spieltag wegen einer frueheren Verletzung gesperrt (`unavailableUntil`). */
  ausgefallen: SpieltagsVerletzterSpieler[];
  /**
   * Zaehlwert der Marke: betroffene SPIELER (zugezogen + ausgefallen, jeder einmal).
   * EINHEIT: Spieler — keine Punkte, kein Score. Die Anzeige muss das mitsagen; in diesem Panel
   * stehen in den Nachbarspalten PUNKTE und SCORE, und eine nackte Zahl daneben wird gelesen wie
   * die, die daneben steht.
   */
  betroffeneSpieler: number;
  /** Kaderzustand HEUTE — gehoert in den Tooltip, nicht in die Marke. */
  aktuellVerletztImKader: number;
};

/**
 * Die Verletzungsbuchungen EINES Spieltags, je Team.
 *
 * Enthaelt nur Teams mit mindestens einer Buchung — ein Team ohne Buchung bekommt keinen Eintrag
 * und damit keine Marke.
 */
export function buildMatchdayInjuryMarks(
  gameState: GameState,
  scope: { seasonId: string; matchdayId: string },
): Map<string, SpieltagsVerletzungsMarke> {
  const namensregister = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));
  const marken = new Map<string, SpieltagsVerletzungsMarke>();

  const hole = (teamId: string): SpieltagsVerletzungsMarke => {
    const vorhanden = marken.get(teamId);
    if (vorhanden) return vorhanden;
    const neu: SpieltagsVerletzungsMarke = {
      teamId,
      zugezogen: [],
      ausgefallen: [],
      betroffeneSpieler: 0,
      aktuellVerletztImKader: countTeamInjuredPlayers(gameState, teamId),
    };
    marken.set(teamId, neu);
    return neu;
  };

  const alsSpieler = (event: InjuryEventRecord): SpieltagsVerletzterSpieler | null => {
    // Die eine Rechenstelle fuer „ist das eine Verletzung?" — sie gibt `null` fuer jeden anderen
    // Ausgang des Wurfs (im Abbild sind 4988 von 5032 Wuerfen `healthy`).
    const buchung = injuryEventToPlayerHistoryRecord(event, gameState);
    if (!buchung) return null;
    return {
      playerId: event.playerId,
      playerName: namensregister.get(event.playerId) ?? event.playerId,
      matchdaysMissed: buchung.matchdaysMissed,
    };
  };

  for (const event of gameState.seasonState?.injuryEvents ?? []) {
    if (event.seasonId !== scope.seasonId) continue;

    if (event.matchdayId === scope.matchdayId) {
      const spieler = alsSpieler(event);
      if (spieler) hole(event.teamId).zugezogen.push(spieler);
      continue;
    }

    if (event.unavailableUntil === scope.matchdayId) {
      const spieler = alsSpieler(event);
      if (spieler) hole(event.teamId).ausgefallen.push(spieler);
    }
  }

  for (const marke of marken.values()) {
    // Ein Spieler, der sich an diesem Spieltag verletzt UND aus einer frueheren Verletzung noch
    // gesperrt war, zaehlt einmal — sonst behauptet die Marke mehr Betroffene als es gibt.
    const ids = new Set([...marke.zugezogen, ...marke.ausgefallen].map((spieler) => spieler.playerId));
    marke.betroffeneSpieler = ids.size;
    marke.zugezogen.sort((links, rechts) => links.playerName.localeCompare(rechts.playerName, "de"));
    marke.ausgefallen.sort((links, rechts) => links.playerName.localeCompare(rechts.playerName, "de"));
  }

  return marken;
}

/**
 * Der Tooltip-Text der Marke — als eigene Funktion, damit er MIT WERTEN pruefbar ist und nicht
 * nur im JSX steht.
 *
 * Er nennt die Einheit ausdruecklich („Spieler"), weil die Marke in einer Tabelle sitzt, deren
 * Nachbarspalten Punkte und Score tragen.
 */
export function beschreibeSpieltagsVerletzungsMarke(marke: SpieltagsVerletzungsMarke): string {
  const teile: string[] = [];
  if (marke.zugezogen.length > 0) {
    teile.push(
      `An diesem Spieltag verletzt: ${marke.zugezogen
        .map((spieler) => `${spieler.playerName} (fällt ${spieler.matchdaysMissed} Spieltag${spieler.matchdaysMissed === 1 ? "" : "e"} aus)`)
        .join(", ")}`,
    );
  }
  if (marke.ausgefallen.length > 0) {
    teile.push(
      `An diesem Spieltag verletzt ausgefallen: ${marke.ausgefallen.map((spieler) => spieler.playerName).join(", ")}`,
    );
  }
  teile.push(`Im Kader aktuell verletzt: ${marke.aktuellVerletztImKader} Spieler`);
  return teile.join(" · ");
}
