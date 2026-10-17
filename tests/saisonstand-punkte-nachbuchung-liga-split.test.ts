/**
 * LIGA-SPLIT: DIE NACHBUCHUNG VERGIBT RAENGE JE LIGA, NICHT GEMEINSAM UEBER BEIDE (16.10.).
 *
 * BEFUND aus dem vollen Saison-Smoke-Test fuer das 2-Liga-System (16+16 Teams, Battle Mode):
 * `zieheSaisonstandPunkteNach` liess `resolveProjectedRankWithTiePolicy` ueber ALLE Teams der
 * Saison auf einmal laufen, egal ob `leagueByTeamId` gesetzt ist -- jeder Battle-Save mit aktivem
 * Liga-Split bekam dadurch einen gemeinsamen Rang 1..32 statt getrennter Raenge 1..16 je Liga.
 *
 * FIXTURE: 32 Teams, 16 je Liga, Punkte INTERLEAVED zwischen den Ligen (L1-01 > L2-01 > L1-02 >
 * L2-02 > ...), damit die globale Reihenfolge eine ANDERE waere als die liga-lokale -- ein Test,
 * der die Ligen bloss in zwei zusammenhaengende Bloecke zerlegt haette, waere auch mit dem alten,
 * global durchnummerierenden Code zufaellig "richtig" ausgefallen (1..16 fuer Liga 1, 17..32 fuer
 * Liga 2 -- gaebe man die 17..32 bloss um 16 versetzt, saehe das lokal richtig aus). Interleaved
 * zwingt eine ECHTE liga-lokale Neusortierung.
 *
 * `buildSeasonPointsLedger` (lib/foundation/season-points-ledger.ts) schreibt `totalScore` einer
 * Disziplin-Ergebniszeile 1:1 als `totalPoints` des Teams, SOLANGE keine Spieler-Performance-Zeile
 * dazu existiert (siehe Fallback-Zweig dort: `performances.length > 0` dann `continue`, sonst
 * `summary.totalPoints = result.totalScore`). Das Fixture nutzt genau diesen Zweig -- keine
 * Spieler/Performances noetig, nur ein `DisciplineResultRecord` je Team.
 */
import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { zieheSaisonstandPunkteNach } from "@/lib/standings/saisonstand-punkte-nachbuchung";

const SEASON_ID = "season-1";
const MATCHDAY_ID = "matchday-1";
const RESULT_ID = "result-1";

function buildTeamsAndResults(leagueSplitActive: boolean) {
  const teams: GameState["teams"] = [];
  const disciplineResults: GameState["seasonState"]["disciplineResults"] = [];
  const leagueByTeamId: Record<string, "liga1" | "liga2"> = {};

  // Interleaved: L1-01 (200) > L2-01 (199) > L1-02 (198) > L2-02 (197) > ... > L1-16 (170) > L2-16 (169).
  for (let i = 0; i < 16; i += 1) {
    const l1Id = `L1-${String(i + 1).padStart(2, "0")}`;
    const l2Id = `L2-${String(i + 1).padStart(2, "0")}`;
    const l1Points = 200 - 2 * i;
    const l2Points = 199 - 2 * i;

    teams.push({ teamId: l1Id, name: `Liga1 Team ${i + 1}`, cash: 0 } as never);
    teams.push({ teamId: l2Id, name: `Liga2 Team ${i + 1}`, cash: 0 } as never);
    leagueByTeamId[l1Id] = "liga1";
    leagueByTeamId[l2Id] = "liga2";

    disciplineResults.push({
      id: `dr-${l1Id}`,
      matchdayResultId: RESULT_ID,
      teamId: l1Id,
      disciplineId: "mini-dm",
      disciplineSide: "d1",
      rank: i + 1,
      baseScore: l1Points,
      totalScore: l1Points,
      readinessStatus: "ready",
      warnings: [],
      createdAt: "2026-10-16T00:00:00.000Z",
    } as never);
    disciplineResults.push({
      id: `dr-${l2Id}`,
      matchdayResultId: RESULT_ID,
      teamId: l2Id,
      disciplineId: "mini-dm",
      disciplineSide: "d1",
      rank: i + 1,
      baseScore: l2Points,
      totalScore: l2Points,
      readinessStatus: "ready",
      warnings: [],
      createdAt: "2026-10-16T00:00:00.000Z",
    } as never);
  }

  const gameState = {
    season: { id: SEASON_ID, matchdayIds: [MATCHDAY_ID], currentMatchday: 1 },
    teams,
    disciplines: [],
    seasonState: {
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0, rank: null }])),
      matchdayResults: [
        {
          id: RESULT_ID,
          saveId: "save-liga-split-nachbuchung",
          seasonId: SEASON_ID,
          matchdayId: MATCHDAY_ID,
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: teams.length,
          teamsReady: teams.length,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "2026-10-16T00:00:00.000Z",
          updatedAt: "2026-10-16T00:00:00.000Z",
        },
      ],
      disciplineResults,
      playerDisciplinePerformances: [],
      ...(leagueSplitActive ? { leagueByTeamId } : {}),
    },
  } as unknown as GameState;

  return { gameState, leagueByTeamId };
}

describe("Saisonstand-Nachbuchung: Raenge je Liga getrennt (Battle Mode, 2x16)", () => {
  it("jede Liga bekommt ihre eigene 1..16-Nummerierung -- keine Ueberschneidung, keine Luecke", () => {
    const { gameState, leagueByTeamId } = buildTeamsAndResults(true);
    const ergebnis = zieheSaisonstandPunkteNach(gameState, SEASON_ID);

    expect(ergebnis.uebersprungen).toBeNull();

    const rangByTeamId = new Map(
      ergebnis.geaenderteTeams.map((aenderung) => [aenderung.teamId, aenderung.rangNachher]),
    );
    expect(rangByTeamId.size).toBe(32);

    const liga1Raenge = Object.keys(leagueByTeamId)
      .filter((teamId) => leagueByTeamId[teamId] === "liga1")
      .map((teamId) => rangByTeamId.get(teamId));
    const liga2Raenge = Object.keys(leagueByTeamId)
      .filter((teamId) => leagueByTeamId[teamId] === "liga2")
      .map((teamId) => rangByTeamId.get(teamId));

    // Jede Liga: exakt die Raenge 1..16, je genau einmal -- keine Luecke, kein Duplikat, keine
    // Ueberschneidung mit der anderen Liga (kein Rang > 16 in beiden Gruppen).
    expect([...liga1Raenge].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    expect([...liga2Raenge].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    expect(Math.max(...(liga1Raenge as number[]))).toBeLessThanOrEqual(16);
    expect(Math.max(...(liga2Raenge as number[]))).toBeLessThanOrEqual(16);
    expect(Math.min(...(liga1Raenge as number[]))).toBe(1);
    expect(Math.min(...(liga2Raenge as number[]))).toBe(1);

    // Kein globaler Rang 17..32 taucht irgendwo auf.
    const alleRaenge = [...rangByTeamId.values()];
    expect(alleRaenge.every((rang) => (rang ?? 0) <= 16)).toBe(true);
  });

  it("liga-lokale Reihenfolge, nicht die globale -- beweist die echte Neusortierung je Liga", () => {
    const { gameState } = buildTeamsAndResults(true);
    const ergebnis = zieheSaisonstandPunkteNach(gameState, SEASON_ID);
    const rangByTeamId = new Map(
      ergebnis.geaenderteTeams.map((aenderung) => [aenderung.teamId, aenderung.rangNachher]),
    );

    // Global waere L2-01 (199 Punkte) Rang 2 (hinter L1-01 mit 200) -- liga-lokal muss es Liga-2-
    // Rang 1 sein. Mit dem alten, global durchnummerierenden Code kaeme hier 2 heraus.
    expect(rangByTeamId.get("L2-01")).toBe(1);
    expect(rangByTeamId.get("L1-01")).toBe(1);

    // L1-02 (198 Punkte) waere global Rang 3 -- liga-lokal Liga-1-Rang 2.
    expect(rangByTeamId.get("L1-02")).toBe(2);
    expect(rangByTeamId.get("L2-02")).toBe(2);

    // Die schwaechsten Teams jeder Liga (L1-16/170, L2-16/169) muessen trotzdem Liga-Rang 16
    // bekommen, nicht Rang 31/32 wie im globalen Modell.
    expect(rangByTeamId.get("L1-16")).toBe(16);
    expect(rangByTeamId.get("L2-16")).toBe(16);
  });

  it("Punkte bleiben unveraendert durch den Fix -- nur die Rangvergabe aendert sich", () => {
    const { gameState } = buildTeamsAndResults(true);
    const ergebnis = zieheSaisonstandPunkteNach(gameState, SEASON_ID);
    const punkteByTeamId = new Map(
      ergebnis.geaenderteTeams.map((aenderung) => [aenderung.teamId, aenderung.punkteNachher]),
    );
    expect(punkteByTeamId.get("L1-01")).toBe(200);
    expect(punkteByTeamId.get("L2-01")).toBe(199);
    expect(punkteByTeamId.get("L1-16")).toBe(170);
    expect(punkteByTeamId.get("L2-16")).toBe(169);
  });
});

describe("Saisonstand-Nachbuchung: Manager-Mode / Legacy-Saves ohne Liga-Split bleiben unveraendert", () => {
  it("ohne `leagueByTeamId` bleibt die Rangvergabe global (bit-identisch zum bisherigen Verhalten)", () => {
    const { gameState } = buildTeamsAndResults(false);
    expect((gameState.seasonState as { leagueByTeamId?: unknown }).leagueByTeamId).toBeUndefined();

    const ergebnis = zieheSaisonstandPunkteNach(gameState, SEASON_ID);
    const rangByTeamId = new Map(
      ergebnis.geaenderteTeams.map((aenderung) => [aenderung.teamId, aenderung.rangNachher]),
    );

    // Ohne Split ist die Rangfolge wieder rein global: L1-01 (200) > L2-01 (199) > L1-02 (198) > ...
    // -- Raenge 1..32 am Stueck, keine 1..16-Wiederholung je Liga.
    expect(rangByTeamId.get("L1-01")).toBe(1);
    expect(rangByTeamId.get("L2-01")).toBe(2);
    expect(rangByTeamId.get("L1-02")).toBe(3);
    expect(rangByTeamId.get("L2-02")).toBe(4);
    expect(rangByTeamId.get("L1-16")).toBe(31);
    expect(rangByTeamId.get("L2-16")).toBe(32);

    const alleRaenge = [...rangByTeamId.values()].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(alleRaenge).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
  });
});

describe("Saisonstand-Nachbuchung: Team ohne Liga bei aktivem Split warnt (Opus-Review-Fund, PR #1271)", () => {
  /**
   * Die `unassigned`-Gruppe in `resolveProjectedRankScopedByLeague` rankt still ihre eigenen
   * Plaetze 1..k. Bei aktivem Split darf sie nicht vorkommen -- kommt sie doch vor (z.B. ein Team
   * ohne `leagueByTeamId`-Eintrag), entstehen doppelte Rang-1-Plaetze ohne Hinweis. Dieser Test
   * prueft nur, DASS gewarnt wird -- nicht, dass die Nummerierung dadurch "repariert" wuerde
   * (das ist explizit kein Ziel dieser kleinen Ergaenzung).
   */
  it("warnt mit `liga_split_team_ohne_liga:<teamId>`, wenn ein Team bei aktivem Split keiner Liga zugeordnet ist", () => {
    const { gameState } = buildTeamsAndResults(true);
    delete (gameState.seasonState as { leagueByTeamId?: Record<string, string> }).leagueByTeamId!["L1-01"];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      zieheSaisonstandPunkteNach(gameState, SEASON_ID);
      expect(warnSpy).toHaveBeenCalledWith("liga_split_team_ohne_liga:L1-01");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("warnt NICHT, wenn jedes Team bei aktivem Split einer Liga zugeordnet ist", () => {
    const { gameState } = buildTeamsAndResults(true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      zieheSaisonstandPunkteNach(gameState, SEASON_ID);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("warnt NICHT ohne aktiven Split (Manager-Mode) -- die `unassigned`-Pruefung greift nur bei `isLeagueSplitActive()`", () => {
    const { gameState } = buildTeamsAndResults(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      zieheSaisonstandPunkteNach(gameState, SEASON_ID);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
