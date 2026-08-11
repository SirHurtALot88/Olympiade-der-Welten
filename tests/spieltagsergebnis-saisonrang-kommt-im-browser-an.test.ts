/**
 * GEMELDET: das Spieltags-Ergebnis zeigte fuer ALLE 32 Teams falsche Saison-Raenge
 * („Rang vorher", „nachher", „Δ") und eine falsche Summe der Saisonpunkte.
 *
 * BEFUND (Live-Abbild, Save `new-game-1785823388048-1hf25q`, Saison 2, Spieltag 10): der
 * Saison-Rang VOR dem Spieltag entsteht aus der Summe der Punkt-Eintraege ueber alle
 * bisherigen Spieltage. Im Browser hat der Ledger davon nur den aktiven Spieltag, weil
 * `compactFoundationInitialGameState` die `disciplineResults` auf ihn zusammenstreicht — die
 * Summe vorher war fuer jedes Team 0. Gemessen: Z-H Rang vorher 1 gegen 32, Summe 160,3 gegen
 * 20,7; 32 von 32 Zeilen abweichend.
 *
 * SEITHER: die Beschneidung von `disciplineResults` ist ersatzlos entfallen (245 KB Ersparnis am
 * Live-Save, Herleitung in `compactFoundationInitialGameState`). Der Ledger bekommt im Browser
 * jetzt alle Spieltage und rechnet aus eigener Kraft richtig; `foundationMatchdayPoints` faehrt
 * noch mit, verliert den Vorrang aber, sobald der Spielstand die Spieltage deckt — also immer.
 * Die Hausregel „lieber leer als geraten" bleibt trotzdem gepflegt, siehe den letzten Fall.
 *
 * DIESER TEST prueft WERTE, nicht Quelltext, und er faehrt den echten kompakten Payload
 * (`compactFoundationInitialGameState`) — genau den Weg, auf dem der Fehler entstand. Ein von
 * Hand nachgebauter „Browser-Zustand" haette die Beschneidung nie reproduziert.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

const MATCHDAY_IDS = ["matchday-1", "matchday-2", "matchday-3"] as const;

/**
 * Drei Teams, drei voll gewertete Spieltage. Team A fuehrt nach zwei Spieltagen deutlich und
 * bricht am dritten ein, Team C dreht auf — so bewegt sich der Saison-Rang zwischen „vorher"
 * und „nachher" wirklich, und ein auf 0 gesetzter Vorher-Stand kann nicht zufaellig richtig
 * herauskommen.
 */
function baueDreiSpieltage() {
  const gameState = createFreshSeasonOneGameState();
  const [teamA, teamB, teamC] = gameState.teams;
  const [playerA, playerB, playerC] = gameState.players;
  gameState.teams = [teamA!, teamB!, teamC!];
  gameState.rosters = [
    { id: "r-a", teamId: teamA!.teamId, playerId: playerA!.id, contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: gameState.season.id },
    { id: "r-b", teamId: teamB!.teamId, playerId: playerB!.id, contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: gameState.season.id },
    { id: "r-c", teamId: teamC!.teamId, playerId: playerC!.id, contractLength: 2, salary: 5, upkeep: 5, roleTag: "starter", joinedSeasonId: gameState.season.id },
  ];
  gameState.season.matchdayIds = [...MATCHDAY_IDS];
  // Aktiv ist der DRITTE Spieltag — nur dessen Disziplin-Ergebnisse ueberleben die Anfangsladung.
  gameState.matchdayState.matchdayId = "matchday-3";

  const resultRecord = (matchdayId: string, id: string) => ({
    id,
    saveId: "save-local",
    seasonId: gameState.season.id,
    matchdayId,
    status: "preview_applied" as const,
    sourceVersion: "test",
    teamsTotal: 3,
    teamsReady: 3,
    teamsUnderfilled: 0,
    teamsMissingLineup: 0,
    teamsInvalidLineup: 0,
    teamsMissingScoreCoverage: 0,
    warningsCount: 0,
    createdAt: "2026-06-06T12:00:00.000Z",
    updatedAt: "2026-06-06T12:00:00.000Z",
  });
  const disciplineRow = (input: { id: string; resultId: string; teamId: string; side: "d1" | "d2"; score: number; rank: number }) => ({
    id: input.id,
    matchdayResultId: input.resultId,
    teamId: input.teamId,
    disciplineId: input.side === "d1" ? "mini-dm" : "mini-dm-2",
    disciplineSide: input.side,
    rank: input.rank,
    baseScore: input.score,
    totalScore: input.score,
    readinessStatus: "ready" as const,
    warnings: [] as string[],
    createdAt: "2026-06-06T12:01:00.000Z",
  });
  const performanceRow = (input: { id: string; resultId: string; teamId: string; playerId: string; side: "d1" | "d2"; score: number; rank: number }) => ({
    id: input.id,
    matchdayResultId: input.resultId,
    teamId: input.teamId,
    playerId: input.playerId,
    activePlayerId: input.id,
    disciplineId: input.side === "d1" ? "mini-dm" : "mini-dm-2",
    disciplineSide: input.side,
    slotIndex: 0,
    baseValue: input.score,
    finalPlayerScore: input.score,
    scoreContribution: 1,
    rankInTeam: 1,
    rankInDiscipline: input.rank,
    isTop10: true,
    isMvpCandidate: input.rank === 1,
    storyWeight: 1,
    createdAt: "2026-06-06T12:05:00.000Z",
  });

  const teams = [
    { team: teamA!, player: playerA!, kuerzel: "a" },
    { team: teamB!, player: playerB!, kuerzel: "b" },
    { team: teamC!, player: playerC!, kuerzel: "c" },
  ];
  // Disziplin-Punktzahlen je Spieltag/Seite/Team (Reihenfolge A, B, C) — bewusst so gewaehlt,
  // dass Team A die Fuehrung am dritten Spieltag an Team C verliert. Die daraus gebuchten PP
  // rechnet der Ledger selbst aus (Rang -> Punkte), sie sind nicht diese Rohwerte.
  const plan: Record<string, Record<"d1" | "d2", [number, number, number]>> = {
    "matchday-1": { d1: [40, 25, 10], d2: [38, 24, 12] },
    "matchday-2": { d1: [42, 26, 11], d2: [36, 22, 13] },
    "matchday-3": { d1: [6, 27, 60], d2: [5, 26, 58] },
  };

  gameState.seasonState.matchdayResults = MATCHDAY_IDS.map((matchdayId, index) =>
    resultRecord(matchdayId, `result-${index + 1}`),
  );
  gameState.seasonState.disciplineResults = MATCHDAY_IDS.flatMap((matchdayId, index) =>
    (["d1", "d2"] as const).flatMap((side) => {
      const scores = plan[matchdayId]![side];
      const sortiert = [...scores].sort((left, right) => right - left);
      return teams.map((eintrag, teamIndex) =>
        disciplineRow({
          id: `d-${eintrag.kuerzel}-${index + 1}-${side}`,
          resultId: `result-${index + 1}`,
          teamId: eintrag.team.teamId,
          side,
          score: scores[teamIndex]!,
          rank: sortiert.indexOf(scores[teamIndex]!) + 1,
        }),
      );
    }),
  );
  gameState.seasonState.playerDisciplinePerformances = MATCHDAY_IDS.flatMap((matchdayId, index) =>
    (["d1", "d2"] as const).flatMap((side) => {
      const scores = plan[matchdayId]![side];
      const sortiert = [...scores].sort((left, right) => right - left);
      return teams.map((eintrag, teamIndex) =>
        performanceRow({
          id: `p-${eintrag.kuerzel}-${index + 1}-${side}`,
          resultId: `result-${index + 1}`,
          teamId: eintrag.team.teamId,
          playerId: eintrag.player.id,
          side,
          score: scores[teamIndex]!,
          rank: sortiert.indexOf(scores[teamIndex]!) + 1,
        }),
      );
    }),
  );

  return { gameState, teamA: teamA!, teamB: teamB!, teamC: teamC! };
}

function zeile(gameState: GameState, teamId: string) {
  const summary = buildMatchdaySummary(gameState, { matchdayId: "matchday-3" });
  const row = summary.teamRows.find((entry) => entry.teamId === teamId);
  expect(row, `Zeile fuer ${teamId}`).toBeTruthy();
  return {
    vorher: row!.seasonRankBeforeMatchday,
    nachher: row!.seasonRankAfterMatchday,
    delta: row!.rankDelta,
    summe: row!.cumulativePoints,
  };
}

describe("Spieltagsergebnis · Saison-Rang und Punktsumme ueberleben die Anfangsladung", () => {
  it("die Anfangsladung traegt alle Disziplin-Ergebnisse (sonst prueft der Test nichts)", () => {
    const { gameState } = baueDreiSpieltage();
    const kompakt = compactFoundationInitialGameState(gameState);

    // 3 Spieltage x 2 Seiten x 3 Teams = 18, und alle 18 fahren mit.
    //
    // FRUEHER STAND HIER `toHaveLength(6)`: nur der aktive Spieltag ueberlebte, der Ledger
    // meldete die Luecke als „skipped_matchdays_without_discipline_results:2" — und die
    // Ansicht zeigte trotzdem Zahlen (32 von 32 Zeilen falsch). Die Beschneidung ist
    // entfallen, also darf diese Luecke gar nicht mehr entstehen.
    expect(gameState.seasonState.disciplineResults).toHaveLength(18);
    expect(kompakt.seasonState.disciplineResults).toHaveLength(18);
    expect(new Set((kompakt.seasonState.disciplineResults ?? []).map((r) => r.matchdayResultId)).size).toBe(3);
    expect(buildMatchdaySummary(kompakt, { matchdayId: "matchday-3" }).warnings).not.toContain(
      "skipped_matchdays_without_discipline_results:2",
    );

    // Gegenprobe, dass der Payload trotzdem ein kompakter ist — der Berg bleibt weg.
    expect(kompakt.seasonState.persistedSeasonDerivations).toBeUndefined();
    expect(kompakt.seasonState.seasonSnapshots).toBeUndefined();
  });

  it("liefert im Browser dieselben Raenge und Summen wie auf dem vollen Spielstand", () => {
    const { gameState, teamA, teamB, teamC } = baueDreiSpieltage();
    const kompakt = compactFoundationInitialGameState(gameState);

    // Der wahre Verlauf: A fuehrt nach zwei Spieltagen und faellt am dritten auf Rang 2
    // zurueck, C klettert von 3 auf 1, B bleibt in der Mitte.
    expect(zeile(gameState, teamA.teamId)).toEqual({ vorher: 1, nachher: 2, delta: -1, summe: 98 });
    expect(zeile(gameState, teamB.teamId)).toEqual({ vorher: 2, nachher: 3, delta: -1, summe: 90.6 });
    expect(zeile(gameState, teamC.teamId)).toEqual({ vorher: 3, nachher: 1, delta: 2, summe: 101.2 });

    // UND GENAU DAS MUSS AUCH IM BROWSER STEHEN. Vor der Reparatur stand hier fuer jedes
    // Team ein aus 0 Vorher-Punkten geratener Rang.
    expect(zeile(kompakt, teamA.teamId)).toEqual(zeile(gameState, teamA.teamId));
    expect(zeile(kompakt, teamB.teamId)).toEqual(zeile(gameState, teamB.teamId));
    expect(zeile(kompakt, teamC.teamId)).toEqual(zeile(gameState, teamC.teamId));
  });

  it("zeigt auch fuer einen zurueckliegenden Spieltag denselben Stand wie der volle Save", () => {
    const { gameState, teamA, teamC } = baueDreiSpieltage();
    const kompakt = compactFoundationInitialGameState(gameState);

    const vollA = buildMatchdaySummary(gameState, { matchdayId: "matchday-2" }).teamRows.find(
      (row) => row.teamId === teamA.teamId,
    );
    const kompaktA = buildMatchdaySummary(kompakt, { matchdayId: "matchday-2" }).teamRows.find(
      (row) => row.teamId === teamA.teamId,
    );
    expect(vollA?.seasonRankAfterMatchday).toBe(1);
    expect(kompaktA?.seasonRankBeforeMatchday).toBe(vollA?.seasonRankBeforeMatchday);
    expect(kompaktA?.seasonRankAfterMatchday).toBe(vollA?.seasonRankAfterMatchday);
    expect(kompaktA?.cumulativePoints).toBe(vollA?.cumulativePoints);

    const vollC = buildMatchdaySummary(gameState, { matchdayId: "matchday-2" }).teamRows.find(
      (row) => row.teamId === teamC.teamId,
    );
    expect(vollC?.seasonRankAfterMatchday).toBe(3);
  });

  it("lieber leer als geraten: ohne Projektion und ohne Disziplin-Ergebnisse bleiben die Saison-Spalten leer", () => {
    // Die Hausregel aus `season-points-ledger`: ein sichtbar leeres Feld ist reparierbar,
    // eine falsche Zahl wird geglaubt. Ein alter Payload (oder eine gescheiterte Projektion)
    // darf deshalb keine Raenge mehr zeigen — vorher stand hier die erfundene Zahl.
    //
    // FRUEHER REICHTE DAFUER der kompakte Payload wie er ist: er beschnitt die
    // `disciplineResults` selbst auf den aktiven Spieltag. Das tut er nicht mehr, also wird
    // dieser Zustand hier von Hand hergestellt — und zwar bewusst, denn er ist nicht
    // ausgestorben: ein Browser-Tab, der noch einen aelteren Payload haelt, sieht genau das.
    // Die Regel muss ihn ueberleben.
    const { gameState, teamA } = baueDreiSpieltage();
    const kompakt = compactFoundationInitialGameState(gameState);
    const ohneProjektion: GameState = {
      ...kompakt,
      seasonState: {
        ...kompakt.seasonState,
        foundationMatchdayPoints: undefined,
        // Genau der alte Schnitt: nur die Zeilen des aktiven Spieltags (result-3).
        disciplineResults: (kompakt.seasonState.disciplineResults ?? []).filter(
          (row) => row.matchdayResultId === "result-3",
        ),
      },
    };
    expect(ohneProjektion.seasonState.disciplineResults).toHaveLength(6);

    const summary = buildMatchdaySummary(ohneProjektion, { matchdayId: "matchday-3" });
    expect(summary.warnings).toContain("missing_matchday_points:2");
    const row = summary.teamRows.find((entry) => entry.teamId === teamA.teamId);
    expect(row?.seasonRankBeforeMatchday).toBeNull();
    expect(row?.seasonRankAfterMatchday).toBeNull();
    expect(row?.rankDelta).toBeNull();
    expect(row?.cumulativePoints).toBeNull();
    // Die Tagesspalten des AKTIVEN Spieltags bleiben tragfaehig — sie stehen im Payload.
    expect(row?.matchdayPoints).not.toBeNull();
  });

  it("faehrt nie in den Spielstand zurueck (reine Anzeigefracht)", async () => {
    const { rehydrateGameStateAfterCompactPut } = await import("@/lib/persistence/foundation-initial-compact-state");
    const { gameState } = baueDreiSpieltage();
    const kompakt = compactFoundationInitialGameState(gameState);
    expect(kompakt.seasonState.foundationMatchdayPoints?.matchdays).toHaveLength(3);

    const zurueck = rehydrateGameStateAfterCompactPut(gameState, kompakt);
    expect(zurueck.seasonState.foundationMatchdayPoints).toBeUndefined();
  });
});
