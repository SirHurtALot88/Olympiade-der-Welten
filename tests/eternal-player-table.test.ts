/**
 * GEWUENSCHT: „es wäre cool dass hier quasi so ne ewige tabelle ALLER spieler aus dem team wären.
 * also alle spieler die das team je hatte mit allen PPs usw. Aber dass man auch wechseln kann auf
 * ALLE spieler und sehen kann wer ist all time best etc."
 *
 * Der Kern ist NICHT die Tabelle, sondern die Zuordnung der Punkte bei einem Verkauf: wer 38 PPs
 * fuer Team A holte und dann zu Team B ging, darf in der Team-A-Tabelle nicht mit seiner
 * GESAMTsumme stehen. Genau das ist die Frage, die der Spieler stellt („der hat fuer uns 38 PPs
 * geholt, bevor wir ihn verkauft haben").
 *
 * Geloest wird sie nicht durch eine neue Rechnung, sondern durch
 * `seasonPointsLedger.playerSummariesByPlayerId[].pointsByTeamId` — dort liegen die Punkte
 * bereits nach Team getrennt, weil jeder Auftritt eine `teamId` traegt.
 *
 * AM ECHTEN SPIELSTAND: 330 Spieler in der Liga-Sicht, 9 im Team des Spielers — und NULL
 * Abgaenge, weil alle 331 Transfers Kaeufe aus dem Pool sind (`fromTeamId: null`). Das ist kein
 * Fehler der Tabelle: Verkaufen war bis zum Saisonende-Fix gesperrt. Die Spalten fuer verkaufte
 * Spieler fuellen sich, sobald der erste Verkauf laeuft — deshalb pruefen die Tests hier genau
 * diesen Fall gegen ein gebautes Fixture.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildEternalPlayerTable } from "@/lib/foundation/eternal-player-table";

type Auftritt = { playerId: string; teamId: string; matchday: number; score: number };

function baueSpielstand(auftritte: Auftritt[], zusatz?: Partial<GameState>): GameState {
  const matchdays = [...new Set(auftritte.map((a) => a.matchday))].sort((a, b) => a - b);
  const spieler = [...new Set(auftritte.map((a) => a.playerId))];

  return {
    gamePhase: "season_active",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: matchdays.length, matchdayIds: matchdays.map((m) => `md-${m}`) },
    teams: [
      { teamId: "A", shortCode: "A-A", name: "Team A", cash: 10 },
      { teamId: "B", shortCode: "B-B", name: "Team B", cash: 10 },
    ],
    players: spieler.map((id) => ({ id, name: `Spieler ${id}` })),
    rosters: [],
    disciplines: [{ id: "d1", name: "Disziplin", category: "power" }],
    matchdayState: { matchdayId: `md-${matchdays[matchdays.length - 1]}`, status: "resolved" },
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
      disciplineResults: [
        ...new Map(
          auftritte.map((a) => [
            `mr-${a.matchday}::${a.teamId}`,
            {
              id: `dr-${a.matchday}-${a.teamId}`,
              matchdayResultId: `mr-${a.matchday}`,
              teamId: a.teamId,
              disciplineId: "d1",
              disciplineSide: "d1",
              rank: 3,
              baseScore: a.score,
              totalScore: a.score,
              formModifier: 0,
              readinessStatus: "ok",
              warnings: [],
            },
          ]),
        ).values(),
      ],
      playerDisciplinePerformances: auftritte.map((a, index) => ({
        id: `pdp-${index}`,
        matchdayResultId: `mr-${a.matchday}`,
        teamId: a.teamId,
        playerId: a.playerId,
        activePlayerId: a.playerId,
        disciplineId: "d1",
        disciplineSide: "d1",
        slotIndex: 0,
        baseValue: a.score,
        finalPlayerScore: a.score,
        mutatorScoreBonus: 0,
        mutatorPpsBonus: 0,
        scoreContribution: a.score,
        rankInTeam: 1,
        rankInDiscipline: 3,
        isTop10: false,
        isMvpCandidate: false,
      })),
      lineupDrafts: [],
    },
    transferHistory: [],
    ...zusatz,
  } as never;
}

/**
 * Der Fall, um den es geht: „wanderer" punktet erst fuer A, wird verkauft, punktet dann fuer B.
 * „treu" bleibt bei A.
 */
function mitVerkauf(): GameState {
  return baueSpielstand(
    [
      { playerId: "wanderer", teamId: "A", matchday: 1, score: 30 },
      { playerId: "wanderer", teamId: "A", matchday: 2, score: 8 },
      { playerId: "wanderer", teamId: "B", matchday: 3, score: 50 },
      { playerId: "treu", teamId: "A", matchday: 1, score: 12 },
    ],
    {
      rosters: [
        { id: "r1", teamId: "B", playerId: "wanderer", contractLength: 2 },
        { id: "r2", teamId: "A", playerId: "treu", contractLength: 2 },
      ],
      transferHistory: [
        {
          id: "t1",
          playerId: "wanderer",
          seasonId: "season-1",
          seasonLabel: "Season 1",
          transferType: "sell",
          fromTeamId: "A",
          toTeamId: "B",
          fee: 25,
          happenedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    } as never,
  );
}

const teamTabelle = (state: GameState, teamId: string) => buildEternalPlayerTable(state, { kind: "team", teamId });
const ligaTabelle = (state: GameState) => buildEternalPlayerTable(state, { kind: "league" });

describe("Ewige Tabelle: was ein Spieler UNS gebracht hat", () => {
  it("zaehlt nur die Punkte, die er FUER DIESES TEAM geholt hat", () => {
    // Der Kern der Meldung. „wanderer" hat 38 fuer A und 50 fuer B — in der A-Tabelle stehen 38.
    const zeile = teamTabelle(mitVerkauf(), "A").rows.find((row) => row.playerId === "wanderer");
    expect(zeile?.points).toBe(38);
    expect(zeile?.careerPoints).toBe(88);
  });

  it("dieselbe Rechnung aus der Sicht des kaufenden Teams", () => {
    const zeile = teamTabelle(mitVerkauf(), "B").rows.find((row) => row.playerId === "wanderer");
    expect(zeile?.points).toBe(50);
    expect(zeile?.careerPoints).toBe(88);
  });

  it("behaelt verkaufte Spieler in der Team-Tabelle — sie sind das Vereinsgedaechtnis", () => {
    const zeile = teamTabelle(mitVerkauf(), "A").rows.find((row) => row.playerId === "wanderer");
    expect(zeile).toBeTruthy();
    expect(zeile?.status).toBe("verkauft");
    expect(zeile?.verkauftAn).toBe("Team B");
  });

  it("erkennt, wer noch im Kader steht", () => {
    const zeile = teamTabelle(mitVerkauf(), "A").rows.find((row) => row.playerId === "treu");
    expect(zeile?.status).toBe("im_kader");
    expect(zeile?.verkauftAn).toBeNull();
  });

  it("nimmt auch Spieler auf, die nie fuer uns punkteten — sie WAREN trotzdem da", () => {
    // Sein Verkaufseintrag traegt `fromTeamId`; ohne die Transferhistorie fiele er ganz heraus.
    const state = baueSpielstand([{ playerId: "treu", teamId: "A", matchday: 1, score: 12 }], {
      rosters: [{ id: "r2", teamId: "A", playerId: "treu", contractLength: 2 }],
      transferHistory: [
        {
          id: "t9",
          playerId: "stumm",
          seasonId: "season-1",
          transferType: "sell",
          fromTeamId: "A",
          toTeamId: "B",
          fee: 1,
          happenedAt: "x",
        },
      ],
      players: [
        { id: "treu", name: "Spieler treu" },
        { id: "stumm", name: "Spieler stumm" },
      ],
    } as never);

    const zeile = teamTabelle(state, "A").rows.find((row) => row.playerId === "stumm");
    expect(zeile).toBeTruthy();
    expect(zeile?.points).toBe(0);
    expect(zeile?.status).toBe("verkauft");
  });

  it("sortiert nach Punkten — die Tabelle beantwortet 'wer war unser Bester'", () => {
    const rows = teamTabelle(mitVerkauf(), "A").rows;
    expect(rows[0]?.playerId).toBe("wanderer"); // 38 vor 12
    expect(rows.map((row) => row.points)).toEqual([...rows.map((row) => row.points)].sort((a, b) => b - a));
  });
});

describe("Ewige Tabelle: Liga-Sicht", () => {
  it("summiert ueber alle Teams — das ist die 'all time best'-Antwort", () => {
    const zeile = ligaTabelle(mitVerkauf()).rows.find((row) => row.playerId === "wanderer");
    expect(zeile?.points).toBe(88);
    expect(zeile?.teams).toEqual(expect.arrayContaining(["Team A", "Team B"]));
  });

  it("fuehrt jeden Spieler genau einmal, egal fuer wie viele Teams er spielte", () => {
    const rows = ligaTabelle(mitVerkauf()).rows;
    expect(rows.filter((row) => row.playerId === "wanderer")).toHaveLength(1);
  });

  it("sagt ehrlich, dass erst eine Saison drin ist", () => {
    const tabelle = ligaTabelle(mitVerkauf());
    expect(tabelle.onlyCurrentSeason).toBe(true);
    expect(tabelle.seasonCount).toBe(1);
    expect(tabelle.rows[0]?.zeitraum).toBe("S1");
  });
});

describe("Ewige Tabelle: Archiv und laufende Saison zusammen", () => {
  /**
   * Dieselbe Deduplizierungs-Regel wie in der Karriere-Map: sobald die laufende Saison als
   * Snapshot existiert, darf sie NICHT zusaetzlich aus den Live-Daten gezaehlt werden. Sonst
   * verdoppelten sich alle Punkte in dem Moment, in dem der Spieler die Saison abschliesst.
   */
  it("zaehlt eine Saison nicht doppelt, sobald sie archiviert ist", () => {
    const ohne = ligaTabelle(mitVerkauf()).rows.find((row) => row.playerId === "wanderer")!.points;

    const mit = mitVerkauf();
    mit.seasonState.seasonSnapshots = [
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        finalStandings: [],
        playerPerformances: [],
        playerDisciplinePerformances: mit.seasonState.playerDisciplinePerformances,
      },
    ] as never;

    expect(ligaTabelle(mit).rows.find((row) => row.playerId === "wanderer")?.points).toBe(ohne);
  });

  it("nennt den Zeitraum ueber mehrere Saisons", () => {
    const state = mitVerkauf();
    state.seasonState.seasonSnapshots = [
      {
        seasonId: "season-0",
        seasonName: "Season 0",
        finalStandings: [],
        playerPerformances: [],
        playerDisciplinePerformances: [
          {
            id: "alt-1",
            matchdayResultId: "alt-mr",
            teamId: "A",
            playerId: "wanderer",
            disciplineId: "d1",
            disciplineSide: "d1",
            scoreContribution: 10,
          },
        ],
      },
    ] as never;

    // season-0 ist archiviert, season-1 laeuft — beide zaehlen.
    const zeile = ligaTabelle(state).rows.find((row) => row.playerId === "wanderer");
    expect(zeile?.zeitraum).toBe("S0–S1");
    expect(zeile?.points).toBe(98); // 88 laufend + 10 aus dem Archiv
  });
});
