/**
 * GEMELDET: „der rekorde tab ist noch tot da passiert fast gar nichts, keine interessanten
 * infos" — und der Reiter „Legendäre Spieler" war ebenfalls leer.
 *
 * BEFUND: Nicht die Daten fehlten, sondern ein Argument. `buildPlayerLeagueCareerStatsMap` fuehrt
 * Archiv und laufende Saison seit jeher zusammen — sie nimmt `currentSeasonLedger` entgegen und
 * dedupliziert ueber `seasonId`. `buildLeagueRecordsHallOfFame` rief sie OHNE diese Option auf,
 * sah also nur Snapshots. In Saison 1 gibt es keine. Am echten Spielstand gemessen:
 *
 *                          vorher    nachher
 *   legendaryPlayers          0         25
 *   careerPpsLeader        null    Gronn · 26,1 PPs · 10 Einsaetze
 *   careerMvpLeader        null    Grok'Na · 2 MVP
 *   recordTransferFee      null    Jasper Kane · 70,63
 *
 * Zwei von vier Reitern waren damit waehrend der GESAMTEN ersten Saison tot — genau der Zeit,
 * in der man das Spiel kennenlernt.
 *
 * Der zweite Teil betrifft die Transfer-Rekorde: sie lasen `snapshot.transferSnapshots`, eine
 * zweite Liste derselben Transfers, die erst mit dem ersten Archiv entsteht. Jetzt kommt der
 * Rekord aus `gameState.transferHistory` — save-weit und ab dem ersten Transfer gefuellt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueRecordsHallOfFame } from "@/lib/foundation/league-records-hall-of-fame";

/**
 * Ein Spielstand mitten in Saison 1: gespielte Spieltage, keine Archive. Genau die Lage, in der
 * der Reiter leer war.
 */
function saison1(): GameState {
  const matchdayIds = ["md-1", "md-2"];
  return {
    gamePhase: "season_active",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 2, matchdayIds },
    teams: [
      { teamId: "T1", shortCode: "T-1", name: "Team Eins", cash: 10 },
      { teamId: "T2", shortCode: "T-2", name: "Team Zwei", cash: 10 },
    ],
    players: [
      { id: "p1", name: "Anna Ausdauer" },
      { id: "p2", name: "Bodo Bogen" },
    ],
    rosters: [
      { id: "r1", teamId: "T1", playerId: "p1", contractLength: 2 },
      { id: "r2", teamId: "T2", playerId: "p2", contractLength: 2 },
    ],
    disciplines: [{ id: "d1", name: "Bogen", category: "spe" }],
    matchdayState: { matchdayId: "md-2", status: "resolved" },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      seasonSnapshots: [],
      matchdayResults: matchdayIds.map((matchdayId) => ({
        id: `mr-${matchdayId}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId,
        // Der Ledger zaehlt nur gebuchte Spieltage (`preview_applied`) — ein bloss aufgeloester
        // Spieltag ohne Buchung traegt noch keine Punkte.
        status: "preview_applied",
      })),
      // Der Ledger braucht zu jeder Auftritts-Gruppe das Team-Ergebnis: er verteilt die
      // Team-Punkte auf die beteiligten Spieler. Ohne diese Zeilen bliebe jede Punktzahl leer.
      disciplineResults: [
        disziplin("dr-1", "mr-md-1", "T1", 1, 12),
        disziplin("dr-2", "mr-md-2", "T1", 2, 10),
        disziplin("dr-3", "mr-md-1", "T2", 5, 8),
      ],
      playerDisciplinePerformances: [
        // Anna: zwei Auftritte, einer davon MVP-Kandidat.
        perf("pdp-1", "mr-md-1", "T1", "p1", { score: 12, contribution: 6, rank: 1, top10: true, mvp: true }),
        perf("pdp-2", "mr-md-2", "T1", "p1", { score: 10, contribution: 5, rank: 2, top10: true, mvp: false }),
        // Bodo: ein Auftritt.
        perf("pdp-3", "mr-md-1", "T2", "p2", { score: 8, contribution: 4, rank: 5, top10: false, mvp: false }),
      ],
      lineupDrafts: [],
    },
    transferHistory: [
      {
        id: "t1",
        playerId: "p2",
        seasonId: "season-1",
        seasonLabel: "Season 1",
        transferType: "buy",
        fromTeamId: "T1",
        toTeamId: "T2",
        fee: 42.5,
        happenedAt: "2026-08-01T00:00:00.000Z",
      },
      // Ein auslaufender Vertrag ist KEIN Abloese-Rekord — er stuende sonst mit 0 in der Liste.
      {
        id: "t2",
        playerId: "p1",
        seasonId: "season-1",
        seasonLabel: "Season 1",
        transferType: "contract_exit",
        fromTeamId: "T2",
        toTeamId: null,
        fee: 999,
        happenedAt: "2026-08-01T00:00:00.000Z",
      },
    ],
  } as never;
}

function disziplin(id: string, matchdayResultId: string, teamId: string, rank: number, totalScore: number) {
  return {
    id,
    matchdayResultId,
    teamId,
    disciplineId: "d1",
    disciplineSide: "d1",
    rank,
    baseScore: totalScore,
    totalScore,
    formModifier: 0,
    readinessStatus: "ok",
    warnings: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function perf(
  id: string,
  matchdayResultId: string,
  teamId: string,
  playerId: string,
  input: { score: number; contribution: number; rank: number; top10: boolean; mvp: boolean },
) {
  return {
    id,
    matchdayResultId,
    teamId,
    playerId,
    activePlayerId: playerId,
    disciplineId: "d1",
    disciplineSide: "d1",
    slotIndex: 0,
    baseValue: input.score,
    finalPlayerScore: input.score,
    mutatorScoreBonus: 0,
    mutatorPpsBonus: 0,
    scoreContribution: input.contribution,
    rankInTeam: 1,
    rankInDiscipline: input.rank,
    isTop10: input.top10,
    isMvpCandidate: input.mvp,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("Rekorde & Legenden leben ab Saison 1", () => {
  it("kennt Karriere-Spieler, obwohl noch nichts archiviert ist", () => {
    const hof = buildLeagueRecordsHallOfFame(saison1());

    expect(hof.hasHistory).toBe(false); // ehrlich: es gibt wirklich kein Archiv
    expect(hof.legendaryPlayers.length).toBeGreaterThan(0); // trotzdem nicht leer
    expect(hof.careerPpsLeader).not.toBeNull();
    expect(hof.careerAppearancesLeader).not.toBeNull();
  });

  it("nennt Namen und Team, nicht Spieler-IDs", () => {
    // Die Identitaet kam bisher NUR aus Snapshots — in Saison 1 stuenden sonst rohe IDs da.
    const hof = buildLeagueRecordsHallOfFame(saison1());
    expect(hof.careerPpsLeader?.playerName).toBe("Anna Ausdauer");
    expect(hof.careerPpsLeader?.teamName).toBe("Team Eins");
    expect(hof.careerPpsLeader?.playerId).not.toBe(hof.careerPpsLeader?.playerName);
  });

  it("zaehlt MVP-Auftritte der laufenden Saison", () => {
    const hof = buildLeagueRecordsHallOfFame(saison1());
    expect(hof.careerMvpLeader?.playerName).toBe("Anna Ausdauer");
    expect(hof.careerMvpLeader?.mvpTotal).toBe(1);
  });

  it("liest den Abloese-Rekord aus transferHistory statt aus den Snapshots", () => {
    const hof = buildLeagueRecordsHallOfFame(saison1());
    expect(hof.recordTransferFee?.amount).toBe(42.5);
    expect(hof.recordTransferFee?.playerName).toBe("Bodo Bogen");
    expect(hof.recordTransferFee?.fromTeamName).toBe("Team Eins");
    expect(hof.recordTransferFee?.toTeamName).toBe("Team Zwei");
  });

  it("haelt auslaufende Verträge aus dem Abloese-Rekord heraus", () => {
    // Der `contract_exit` im Fixture traegt absichtlich die hoechste Zahl (999). Wuerde er
    // mitzaehlen, stuende ein Vertragsende als teuerster Transfer der Liga im Rekordbuch.
    expect(buildLeagueRecordsHallOfFame(saison1()).recordTransferFee?.amount).toBe(42.5);
  });

  it("liest die Snapshot-Transferliste nicht mehr — eine Quelle je Groesse", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/foundation/league-records-hall-of-fame.ts"), "utf8");
    expect(quelle).toContain("gameState.transferHistory");
    expect(quelle).not.toContain("snapshot.transferSnapshots");
  });

  it("reicht die laufende Saison wirklich durch — sonst waere alles oben Zufall", () => {
    const quelle = readFileSync(join(process.cwd(), "lib/foundation/league-records-hall-of-fame.ts"), "utf8");
    expect(quelle).toContain("buildPlayerLeagueCareerStatsMap(gameState, { currentSeasonLedger })");
  });

  /**
   * Der Grund, warum der Durchreich-Fix ueberhaupt gefahrlos ist: sobald die Saison als Snapshot
   * existiert, zaehlt die Karriere-Map sie NICHT mehr aus den Live-Daten mit. Ohne diese
   * Deduplizierung stuende jede archivierte Saison doppelt in jeder Karriere-Summe.
   */
  it("zaehlt eine Saison nicht doppelt, sobald sie archiviert ist", () => {
    const state = saison1();
    const ohneArchiv = buildLeagueRecordsHallOfFame(state).careerPpsLeader?.totalPps ?? 0;
    expect(ohneArchiv).toBeGreaterThan(0);

    const mitArchiv = saison1();
    mitArchiv.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        finalStandings: [
          {
            teamId: "T1",
            teamCode: "T-1",
            teamName: "Team Eins",
            rank: 1,
            disciplinePointsByArea: { pow: 0, spe: 12, men: 0, soc: 0 },
          },
        ],
        playerPerformances: [
          { playerId: "p1", playerName: "Anna Ausdauer", teamName: "Team Eins", appearances: 2, totalPoints: ohneArchiv, mvpCount: 1 },
        ],
      },
    ] as never;

    expect(buildLeagueRecordsHallOfFame(mitArchiv).careerPpsLeader?.totalPps).toBe(ohneArchiv);
  });
});
