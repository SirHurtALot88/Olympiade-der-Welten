/**
 * PRESET-TEAMS AUS DEM POOL AUFLOESEN — der eine Ort, an dem "welche Teams bekommt ein Preset?"
 * entschieden wird.
 *
 * GEMESSENER FEHLER (Battle-Modus, 30.08.), der diese Datei ausgeloest hat: die Presets trugen
 * ABSOLUTE Team-IDs (`CHRIS_ONLINE_4V4_TEAM_IDS = ["P-S","D-P","M-M","V-W"]`,
 * `FOUR_PLUS_FOUR_HOST_TEAM_IDS` dito), und wer sie einloeste, filterte sie stumpf gegen die
 * gueltigen Teams des Spielstands. Im Battle-Modus gibt es aber nur 16 Teams — `P-S` und `V-W`
 * sind darin nicht enthalten. Ergebnis, nachgemessen:
 *
 *   battle/solo_4      -> Chris bekam 2 Teams statt 4, GANZ OHNE Warnung
 *   battle/online_4v4  -> 2 gegen 4, also ein schiefes Spiel, nur mit einer Warnung
 *   battle/1v1 (Raum)  -> der Host bekam `FOUR_PLUS_FOUR_HOST_TEAM_IDS.slice(0,1)` = `P-S`,
 *                         also NULL Teams, und lief in "weise dir zuerst ein Team zu"
 *
 * Der Fehler ist immer derselbe: eine feste ID-Liste ist eine Antwort auf die Frage "welche 32
 * Teams gibt es", nicht auf die Frage "welche vier soll Chris fuehren". Diese Datei dreht das um:
 * ein Preset sagt WIE VIELE Teams es verspricht und WELCHE es bevorzugt — der Pool entscheidet,
 * was davon uebrig bleibt, und der Rest wird aufgefuellt. Ein Preset liefert damit seine
 * versprochene Anzahl aus JEDEM Pool, der gross genug ist; bleibt es trotzdem darunter, ist das
 * ein echter Fehler und kein Betriebszustand (siehe die Blocker in `new-game-setup-service.ts`).
 *
 * BEWUSST OHNE IMPORTE. Sowohl `lib/game/new-game-setup-service.ts` (Solo-Assistent,
 * `NEW_GAME_PRESETS`) als auch `lib/room/online-room-model.ts` (Raum-Presets,
 * `PRESET_OWNERSHIP_TABLE`) haengen daran; jeder Import hier waere ein Kandidat fuer einen Ring
 * zwischen den beiden Welten. Reine Zeichenketten-Logik, sonst nichts.
 */

/**
 * NACHFUELL-REIHENFOLGE: ALPHABETISCH NACH `teamId`.
 *
 * WARUM NICHT NACH STARTBUDGET (die naheliegende, "fairere" Regel, und ausdruecklich erwogen):
 * `online-room-model.ts` kennt an seinem Zuteilungs-Choke-Point ueberhaupt nur Team-IDs — keine
 * `Team`-Objekte, kein `budget`. Eine Budget-Reihenfolge waere dort nur ueber eine zweite,
 * mitgeschleppte Budget-Tabelle zu haben, und das ist genau die zweite Quelle, die spaeter
 * auseinanderlaeuft. Alphabetisch ist dieselbe stumpfe, nachvollziehbare Regel, mit der
 * `waehleBattleModeTeamIds` (lib/season/battle-mode-spielplan.ts) schon die 16 Battle-Teams
 * auswaehlt — eine Regel statt zweier.
 *
 * Wichtig ist an dieser Stelle ohnehin nicht "gerecht", sondern "immer gleich": die Auffuellung
 * greift nur, wenn die bevorzugten Teams im Pool fehlen, und der Spieler waehlt seine Teams im
 * Assistenten sowieso selbst. Deterministisch heisst hier: derselbe Pool ergibt dieselbe Zuteilung,
 * unabhaengig davon, in welcher Reihenfolge der Aufrufer den Pool hereinreicht (der Daten-Adapter
 * liefert die Battle-Teams z. B. in Quell-, nicht in Sortierreihenfolge) — sonst waeren die Tests
 * an eine Reihenfolge gebunden, die niemand zugesagt hat.
 */
function sortiereNachTeamId(teamIds: string[]): string[] {
  return [...teamIds].sort((links, rechts) => links.localeCompare(rechts));
}

export type PresetTeamAufloesung = {
  /** Die aufgeloeste Zuteilung — bevorzugte Teams zuerst, danach die Auffuellung. */
  teamIds: string[];
  /** Bevorzugte IDs, die es in diesem Pool nicht gibt (im Management-Modus immer leer). */
  fehlendeBevorzugte: string[];
  /** IDs, die NICHT aus der Wunschliste stammen, sondern nachgefuellt wurden. */
  nachgefuellt: string[];
};

/**
 * Loest die Teams eines Presets gegen einen konkreten Pool auf.
 *
 * - `bevorzugt` gewinnt und behaelt SEINE Reihenfolge. Damit bleibt der Management-Modus
 *   (Pool = alle 32) zeichengleich zu vorher: dort ist jede bevorzugte ID im Pool, es wird nie
 *   aufgefuellt, und heraus kommt exakt die alte, fest verdrahtete Liste.
 * - `bereitsVergeben` sind die Teams des jeweils ANDEREN Spielers. Sie werden weder aus der
 *   Wunschliste uebernommen noch nachgefuellt — Chris und Franky koennen sich so nie ueberschneiden,
 *   auch dann nicht, wenn der Pool knapp wird.
 * - Ist der Pool kleiner als `anzahl`, kommt zurueck, was da ist. Diese Funktion wirft NICHT: sie
 *   weiss nicht, ob ein zu kleiner Pool ein Fehler ist (16 Teams, 4+4 Spieler: kein Problem) oder
 *   nicht. Wer die Zusage "ein Preset liefert seine Anzahl" durchsetzen will, vergleicht
 *   `teamIds.length` mit `anzahl` — genau das tun die Blocker in `new-game-setup-service.ts`.
 */
export function loesePresetTeamsAusPool(input: {
  bevorzugt?: string[];
  anzahl: number;
  pool: Iterable<string>;
  bereitsVergeben?: Iterable<string>;
}): PresetTeamAufloesung {
  const pool = new Set(input.pool);
  const vergeben = new Set(input.bereitsVergeben ?? []);
  const bevorzugt = Array.from(new Set(input.bevorzugt ?? []));

  const fehlendeBevorzugte = bevorzugt.filter((teamId) => !pool.has(teamId));
  const uebernommen = bevorzugt.filter((teamId) => pool.has(teamId) && !vergeben.has(teamId)).slice(0, input.anzahl);

  const genommen = new Set([...uebernommen, ...vergeben]);
  const nachgefuellt = sortiereNachTeamId([...pool])
    .filter((teamId) => !genommen.has(teamId))
    .slice(0, Math.max(0, input.anzahl - uebernommen.length));

  return { teamIds: [...uebernommen, ...nachgefuellt], fehlendeBevorzugte, nachgefuellt };
}

/**
 * BEIDE SEITEN AUF EINMAL — und zwar in dieser Reihenfolge: erst die Wunschteams BEIDER Spieler,
 * dann die Auffuellung.
 *
 * GEMESSENER FEHLER BEIM ERSTEN VERSUCH (Test `raum-preset-zuteilungstabelle`, Pool
 * `["A-A","P-S","M-S"]`, Preset 4+4): zweimal `loesePresetTeamsAusPool` nacheinander, erst der
 * Host, dann der Gast, verhungerte den Gast vollstaendig. Der Host nahm sein Wunschteam `P-S` und
 * fuellte danach auf vier auf — dabei schluckte er `M-S`, das WUNSCHTEAM DES GASTES, und fuer den
 * Gast blieb nichts. Aus "der Pool reicht nicht fuer 4+4" wurde so "einer bekommt alles". Wer
 * zuerst aufgeloest wird, darf aber nicht darueber entscheiden, ob der andere ueberhaupt mitspielt.
 *
 * Zwei Durchgaenge statt einem loesen das: nach Durchgang 1 hat jede Seite ihre im Pool
 * vorhandenen Wunschteams sicher, Durchgang 2 verteilt nur noch, was danach uebrig ist — wieder
 * Host zuerst, denn irgendjemand muss bei ungerader Restmenge den Rest bekommen, und der Host ist
 * der, der den Raum/das Spiel anlegt.
 *
 * Ueberschneiden sich die Wunschlisten, gewinnt der Host — dieselbe Regel wie vorher
 * (`frankyTeamIds.filter((id) => !chrisTeamIds.includes(id))` in new-game-setup-service.ts).
 */
export function loesePresetTeamsFuerBeideSeiten(input: {
  pool: Iterable<string>;
  hostBevorzugt?: string[];
  hostAnzahl: number;
  gastBevorzugt?: string[];
  gastAnzahl: number;
}): { host: PresetTeamAufloesung; gast: PresetTeamAufloesung } {
  const pool = new Set(input.pool);
  const hostBevorzugt = Array.from(new Set(input.hostBevorzugt ?? []));
  const gastBevorzugt = Array.from(new Set(input.gastBevorzugt ?? []));

  const hostWunsch = hostBevorzugt.filter((teamId) => pool.has(teamId)).slice(0, input.hostAnzahl);
  const gastWunsch = gastBevorzugt
    .filter((teamId) => pool.has(teamId) && !hostWunsch.includes(teamId))
    .slice(0, input.gastAnzahl);

  const vergeben = new Set([...hostWunsch, ...gastWunsch]);
  const rest = sortiereNachTeamId([...pool]).filter((teamId) => !vergeben.has(teamId));

  const hostNachgefuellt = rest.splice(0, Math.max(0, input.hostAnzahl - hostWunsch.length));
  const gastNachgefuellt = rest.splice(0, Math.max(0, input.gastAnzahl - gastWunsch.length));

  return {
    host: {
      teamIds: [...hostWunsch, ...hostNachgefuellt],
      fehlendeBevorzugte: hostBevorzugt.filter((teamId) => !pool.has(teamId)),
      nachgefuellt: hostNachgefuellt,
    },
    gast: {
      teamIds: [...gastWunsch, ...gastNachgefuellt],
      fehlendeBevorzugte: gastBevorzugt.filter((teamId) => !pool.has(teamId)),
      nachgefuellt: gastNachgefuellt,
    },
  };
}
