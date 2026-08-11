/**
 * GEMELDET (Nachmessung am Live-Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10):
 * das Rekordbuch zeigte in JEDEM seiner sieben Eintraege den falschen Halter und den falschen
 * Wert, und zwei der erweiterten Meilensteine einen zu kleinen Fortschritt.
 *
 * BEFUND: es fehlten keine Daten. Beide Rechnungen laufen im Browser auf dem kompakten Payload,
 * und der beschneidet `disciplineResults` auf den aktiven Spieltag
 * (`compactFoundationInitialGameState`). Ueber sie faellt zusaetzlich der Punkte-Ledger auf einen
 * Spieltag zurueck — er bucht bewusst keinen Spieltag ohne Disziplin-Ergebnisse. Gemessen voll
 * gegen kompakt: 164,6 Sir Quacksalot -> 112,7 Lyraeth Vael, 606,9 Lost Kingdom -> 413,7 Nunchuck
 * Ninjas, „Breit aufgestellt" 2 von 4 Bereichen -> 0 von 4, „Lauf" 2 von 3 -> 0 von 3.
 *
 * SEITHER: die Beschneidung von `disciplineResults` ist ersatzlos entfallen — am Live-Save trug
 * sie 245 KB zur Ersparnis bei und war damit den Preis nicht wert (Herleitung samt Messung steht
 * in `compactFoundationInitialGameState`). Der Browser hat die Zeilen jetzt selbst, also rechnet
 * er aus EIGENER KRAFT richtig. Die Projektionen `foundationRecordBook`/`foundationDisciplineTally`
 * sind daraufhin ERSATZLOS ENTFERNT; dieser Test haelt fest, dass der Eigenbau auf dem kompakten
 * Payload dieselben Zahlen liefert wie auf dem vollen Spielstand — er ist damit die Gegenprobe zur
 * Entfernung.
 *
 * DIESER TEST PRUEFT WERTE, KEINE QUELLTEXT-ZEILEN, und er laeuft wirklich durch den kompakten
 * Payload: derselbe Spielstand einmal voll und einmal durch `compactFoundationInitialGameState`
 * gedreht. Die erwarteten Zahlen stehen ausserdem ausgeschrieben da — ein Test, der nur „beide
 * Seiten sind gleich" prueft, winkt „beide gleich falsch" durch.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueRecordBook } from "@/lib/foundation/league-record-book";
import { buildExtendedLeagueAchievements } from "@/lib/foundation/league-achievements-extended";
import {
  compactFoundationInitialGameState,
  rehydrateGameStateAfterCompactPut,
} from "@/lib/persistence/foundation-initial-compact-state";

type Eingabe = {
  matchday: number;
  teamId: string;
  playerId: string;
  disciplineId: "d1" | "d2";
  score: number;
  rank: number;
  isTop10?: boolean;
  formModifier?: number;
};

/**
 * Drei Spieltage, aktiv ist der DRITTE — die Marken liegen bewusst auf Spieltag 1 und 2, also
 * genau dort, wo der kompakte Payload nichts mehr sieht.
 */
const EINGABEN: Eingabe[] = [
  { matchday: 1, teamId: "A", playerId: "p1", disciplineId: "d1", score: 200, rank: 1, isTop10: true },
  { matchday: 1, teamId: "B", playerId: "p2", disciplineId: "d1", score: 100, rank: 2, formModifier: 90 },
  { matchday: 2, teamId: "A", playerId: "p1", disciplineId: "d2", score: 150, rank: 1, isTop10: true },
  { matchday: 2, teamId: "B", playerId: "p2", disciplineId: "d2", score: 140, rank: 2 },
  { matchday: 3, teamId: "A", playerId: "p3", disciplineId: "d1", score: 50, rank: 6, isTop10: true, formModifier: 20 },
  { matchday: 3, teamId: "B", playerId: "p2", disciplineId: "d1", score: 20, rank: 7 },
];

function spielstand(eingaben: Eingabe[]): GameState {
  const matchdays = [...new Set(eingaben.map((e) => e.matchday))].sort((a, b) => a - b);
  const spieler = [...new Set(eingaben.map((e) => e.playerId))];
  const teamIds = [...new Set(eingaben.map((e) => e.teamId))];
  const letzter = matchdays[matchdays.length - 1];

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: matchdays.length,
      matchdayIds: matchdays.map((m) => `md-${m}`),
    },
    teams: teamIds.map((teamId) => ({
      teamId,
      shortCode: teamId,
      name: `Team ${teamId}`,
      cash: 10,
      humanControlled: teamId === "A",
    })),
    players: spieler.map((id) => ({ id, name: `Spieler ${id}` })),
    rosters: eingaben.map((e, index) => ({
      id: `r${index}`,
      teamId: e.teamId,
      playerId: e.playerId,
      contractLength: 2,
      joinedSeasonId: "season-1",
    })),
    disciplines: [
      { id: "d1", name: "Kraft", category: "power" },
      { id: "d2", name: "Tempo", category: "speed" },
    ],
    matchdayState: { matchdayId: `md-${letzter}`, status: "resolved" },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots: [],
      matchdayResults: matchdays.map((m) => ({
        id: `mr-${m}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: `md-${m}`,
        status: "preview_applied",
      })),
      disciplineResults: eingaben.map((e) => ({
        id: `dr-${e.matchday}-${e.teamId}-${e.disciplineId}`,
        matchdayResultId: `mr-${e.matchday}`,
        teamId: e.teamId,
        disciplineId: e.disciplineId,
        disciplineSide: "d1",
        rank: e.rank,
        baseScore: e.score,
        totalScore: e.score,
        formModifier: e.formModifier ?? 0,
        readinessStatus: "ok",
        warnings: [],
      })),
      playerDisciplinePerformances: eingaben.map((e, index) => ({
        id: `pdp-${index}`,
        matchdayResultId: `mr-${e.matchday}`,
        teamId: e.teamId,
        playerId: e.playerId,
        activePlayerId: e.playerId,
        disciplineId: e.disciplineId,
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: e.score,
        finalPlayerScore: e.score,
        mutatorScoreBonus: 0,
        mutatorPpsBonus: 0,
        scoreContribution: e.score,
        rankInTeam: 1,
        rankInDiscipline: e.rank,
        isTop10: e.isTop10 ?? false,
        isMvpCandidate: false,
      })),
      lineupDrafts: [],
    },
    transferHistory: [],
    logs: [],
  } as never;
}

/** (id -> Wert · Halter) — genau das, was in der Karte steht. */
function alsPaare(buch: { spieltagsSuperlative: unknown[]; serien: unknown[] }) {
  const alle = [...buch.spieltagsSuperlative, ...buch.serien] as Array<{
    id: string;
    displayValue: string;
    halter: string;
  }>;
  return Object.fromEntries(alle.map((eintrag) => [eintrag.id, `${eintrag.displayValue} · ${eintrag.halter}`]));
}

const meilenstein = (state: GameState, teamId: string, id: string) =>
  buildExtendedLeagueAchievements(state, teamId).find((eintrag) => eintrag.id === id) ?? null;

const voll = spielstand(EINGABEN);
const kompakt = compactFoundationInitialGameState(voll);

describe("Rekordbuch und Meilensteine kommen im Browser an", () => {
  it("der kompakte Payload traegt die Disziplin-Ergebnisse ALLER Spieltage", () => {
    // Ohne diese Vorbedingung misst der Rest des Tests nichts: die Marken liegen bewusst auf
    // Spieltag 1 und 2, und der Browser muss sie sehen koennen.
    //
    // FRUEHER STAND HIER `toHaveLength(2)` und „genau ein Spieltag" — der Payload war auf den
    // aktiven Spieltag beschnitten. Genau daraus entstand der gemeldete Fehler: alle sieben
    // Eintraege zeigten Halter und Wert eines einzigen Spieltags, waehrend die Ueberschrift
    // „aus 10 gespielten Spieltagen" sie beglaubigte.
    expect(voll.seasonState.disciplineResults).toHaveLength(6);
    expect(kompakt.seasonState.disciplineResults).toHaveLength(6);
    expect(new Set((kompakt.seasonState.disciplineResults ?? []).map((r) => r.matchdayResultId)).size).toBe(3);
    // `matchdayResults` fahren ebenfalls voll mit — daher stimmt „aus N Spieltagen" und deckt
    // sich jetzt mit dem, woraus die Werte wirklich entstehen.
    expect(kompakt.seasonState.matchdayResults).toHaveLength(3);
    // Gegenprobe, dass ueberhaupt noch beschnitten wird — sonst pruefte diese Suite den
    // kompakten Payload nur noch dem Namen nach.
    expect(kompakt.seasonState.persistedSeasonDerivations).toBeUndefined();
    expect(kompakt.seasonState.seasonSnapshots).toBeUndefined();
  });

  it("das Rekordbuch zeigt im Browser dieselben Werte wie auf dem Server", () => {
    const server = buildLeagueRecordBook(voll);
    const browser = buildLeagueRecordBook(kompakt);

    expect(alsPaare(server)).toEqual({
      "best-single-performance": "200,0 · Spieler p1",
      "best-player-matchday": "200,0 PPs · Spieler p1",
      "best-team-discipline": "200,0 · Team A",
      "closest-discipline-win": "10,00 · Team A",
      "best-form-boost": "+90,0 · Team B",
      "longest-team-win-streak": "2 Spieltage · Team A",
      "longest-player-top10-streak": "2 Spieltage · Spieler p1",
    });
    expect(alsPaare(browser)).toEqual(alsPaare(server));
    expect(browser.matchdaysPlayed).toBe(3);
  });

  it("der Browser-Stand rechnet ohne jede Projektion aus eigener Kraft richtig", () => {
    /**
     * FRUEHER HIESS DIESER FALL „ohne Projektion rechnet derselbe Browser-Stand nachweislich
     * falsch" und hielt genau das fest: der Eigenbau auf dem beschnittenen Payload lieferte
     * „50,0 · Spieler p3" statt „200,0 · Spieler p1", „50,0 · Team A" statt „200,0 · Team A"
     * und „+20,0 · Team A" statt „+90,0 · Team B" — also drei plausible falsche Zahlen, keine
     * leeren Felder. Dafuer wurde `foundationRecordBook` gebaut.
     *
     * Die Praemisse ist weg: `disciplineResults` fahren vollstaendig mit, und die Projektion
     * ist entfernt. Was hier steht, ist deshalb die Gegenprobe zur Entfernung: der kompakte
     * Payload traegt KEIN `foundationRecordBook` mehr und kommt trotzdem auf die Serverwerte.
     */
    expect((kompakt.seasonState as Record<string, unknown>).foundationRecordBook).toBeUndefined();
    expect((kompakt.seasonState as Record<string, unknown>).foundationDisciplineTally).toBeUndefined();

    const ohneProjektion = buildLeagueRecordBook(kompakt);
    expect(alsPaare(ohneProjektion)["best-single-performance"]).toBe("200,0 · Spieler p1");
    expect(alsPaare(ohneProjektion)["best-team-discipline"]).toBe("200,0 · Team A");
    expect(alsPaare(ohneProjektion)["best-form-boost"]).toBe("+90,0 · Team B");
    expect(ohneProjektion.matchdaysPlayed).toBe(3);
    // Und deckungsgleich mit dem vollen Spielstand, Eintrag fuer Eintrag.
    expect(alsPaare(ohneProjektion)).toEqual(alsPaare(buildLeagueRecordBook(voll)));
  });

  it("die erweiterten Meilensteine messen im Browser ueber alle Spieltage", () => {
    expect(meilenstein(voll, "A", "disciplines-first-win")?.reached).toBe(true);
    expect(meilenstein(voll, "A", "disciplines-all-areas")?.progressLabel).toBe("2 von 4 Bereichen");
    expect(meilenstein(voll, "A", "streaks-run")?.progressLabel).toBe("Längste Serie: 2 von 3");

    // Derselbe Satz Zahlen auf dem kompakten Payload — vorher: „Noch kein Disziplinsieg",
    // „0 von 4 Bereichen", „Längste Serie: 0 von 3".
    expect(meilenstein(kompakt, "A", "disciplines-first-win")?.reached).toBe(true);
    expect(meilenstein(kompakt, "A", "disciplines-first-win")?.detail).toBe("2× gewonnen");
    expect(meilenstein(kompakt, "A", "disciplines-all-areas")?.progressLabel).toBe("2 von 4 Bereichen");
    expect(meilenstein(kompakt, "A", "streaks-run")?.progressLabel).toBe("Längste Serie: 2 von 3");

    /**
     * Alle Meilensteine, die aus `disciplineResults` entstehen, Eintrag fuer Eintrag gleich.
     *
     * `squad-award-forge` bleibt bewusst aussen vor: der haengt an `buildLeagueSeasonAwards`,
     * einer eigenen Rechnung auf demselben beschnittenen Payload — ein Nachbarbefund derselben
     * Bauart, aber nicht der hier reparierte Weg. Ihn hier mitzupruefen wuerde diesen Test an
     * einen fremden Fehler binden.
     */
    const disziplinNah = (state: GameState) =>
      buildExtendedLeagueAchievements(state, "A").filter(
        (eintrag) => eintrag.group === "disciplines" || eintrag.group === "streaks",
      );
    expect(disziplinNah(kompakt)).toEqual(disziplinNah(voll));
  });

  it("ein alter Browser-Tab kann die entfernten Projektionen nicht in den Spielstand schreiben", () => {
    /**
     * Wer die alte Auslieferung noch im Speicher hat, schickt die Felder beim naechsten
     * Speichern zurueck. Sie duerfen im Spielstand nicht landen — dort waeren sie eine zweite,
     * nie wieder aufgefrischte Wahrheit.
     */
    const altesTab = {
      ...kompakt,
      seasonState: {
        ...kompakt.seasonState,
        foundationRecordBook: { seasonId: "s1", spieltagsSuperlative: [], serien: [], matchdaysPlayed: 99 },
        foundationDisciplineTally: { seasonId: "s1", matchdaysPlayed: 99, byTeamId: {} },
        foundationMatchdayPoints: { seasonId: "s1", matchdays: [] },
        foundationPpAreaFormBonus: { seasonId: "s1", matchdays: [] },
        foundationFormCardBonus: { seasonId: "s1", byTeamId: {}, unusedCardIds: [] },
      },
    } as unknown as GameState;

    const zurueck = rehydrateGameStateAfterCompactPut(voll, altesTab).seasonState as Record<string, unknown>;
    expect(zurueck.foundationRecordBook).toBeUndefined();
    expect(zurueck.foundationDisciplineTally).toBeUndefined();
    expect(zurueck.foundationMatchdayPoints).toBeUndefined();
    expect(zurueck.foundationPpAreaFormBonus).toBeUndefined();
    expect(zurueck.foundationFormCardBonus).toBeUndefined();
  });
});
