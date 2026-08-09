/**
 * DIE BÜHNE MUSS DIE AUFGESTELLTEN SPIELER ZEIGEN, NICHT GESCHÄTZTE.
 *
 * GEMELDET VON CHRIS: „ich hab hier platz 28 … bin aber hier letzter? wieso sind die vikings vor
 * mir?" — die Arena zeigte für Stronghold Crusaders in der Staffel Tahra (+40,7) und Chad
 * Thunderjaw (+40,2), Rang 28 mit 80,9 Pkt. Gebucht war: Spineshard 29,3 und Myrth 9,9, Team-Rang
 * 31 mit 47,8. Tahra stand an dem Spieltag überhaupt nicht in der Aufstellung, Chad lief in
 * Takeshi's Castle. Nachgestellt „das ist auch bei anderen teams so! V-D ist 4. geworden obwohl
 * queen butterfly mit abstand am besten war".
 *
 * URSACHE: `DisciplineStageArena` nahm die Bahnen aus der Resolve-Vorschau und fiel still auf
 * `buildDisciplineStageModel` zurück, wenn die für die Disziplin nichts hergab. Das Modell liest
 * die Aufstellung nicht — es wählt pro Team selbst die stärksten Spieler. Genau deshalb standen
 * dort Tahra und Chad.
 *
 * Dieser Test hält beides fest: dass das Modell tatsächlich andere Spieler wählt (die Falle), und
 * dass der neue Weg über das gebuchte Ergebnis die aufgestellten liefert.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildDisciplineStageModel } from "@/lib/foundation/discipline-stage/discipline-stage-data";
import { buildDisciplineStageTeamsFromBookedResult } from "@/lib/foundation/discipline-stage/discipline-stage-from-booked-result";

const MATCHDAY_RESULT_ID = "md-result-1";

/**
 * Ein Spielstand nach dem Muster des gemeldeten Falls: das Team hat zwei SCHWACHE Spieler
 * aufgestellt und zwei STARKE auf der Bank — genau die Konstellation, in der das schätzende Modell
 * die falschen zeigt.
 */
function baueSpielstand(): GameState {
  const spieler = [
    { id: "p-spineshard", name: "Spineshard", disciplineRatings: { staffel: 30 } },
    { id: "p-myrth", name: "Myrth", disciplineRatings: { staffel: 10 } },
    { id: "p-tahra", name: "Tahra", disciplineRatings: { staffel: 52 } },
    { id: "p-chad", name: "Chad Thunderjaw", disciplineRatings: { staffel: 46 } },
  ];

  return {
    season: { id: "season-2", name: "Season 2", matchdayIds: ["season-2-matchday-4"], currentMatchday: 4 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "season-2-matchday-4", status: "resolved" },
    teams: [{ teamId: "S-C", name: "Stronghold Crusaders", shortCode: "S-C", cash: 30 }],
    players: spieler,
    rosters: spieler.map((p) => ({ teamId: "S-C", playerId: p.id, salary: 5 })),
    disciplines: [{ id: "staffel", name: "Staffel", playerCount: 2 }],
    seasonState: {
      schedule: [],
      matchdayResults: [{ id: MATCHDAY_RESULT_ID, seasonId: "season-2", matchdayId: "season-2-matchday-4" }],
      standingsApplyLogs: [],
      disciplineResults: [
        {
          id: "dr-1",
          matchdayResultId: MATCHDAY_RESULT_ID,
          teamId: "S-C",
          disciplineId: "staffel",
          disciplineSide: "d1",
          rank: 31,
          baseScore: 46.7,
          totalScore: 47.8,
        },
      ],
      playerDisciplinePerformances: [
        {
          matchdayResultId: MATCHDAY_RESULT_ID,
          teamId: "S-C",
          playerId: "p-myrth",
          disciplineId: "staffel",
          disciplineSide: "d1",
          slotIndex: 1,
          finalPlayerScore: 9.9,
        },
        {
          matchdayResultId: MATCHDAY_RESULT_ID,
          teamId: "S-C",
          playerId: "p-spineshard",
          disciplineId: "staffel",
          disciplineSide: "d1",
          slotIndex: 0,
          finalPlayerScore: 29.3,
        },
      ],
    },
  } as unknown as GameState;
}

const META = new Map([["S-C", { code: "S-C", name: "Stronghold Crusaders", logoUrl: null }]]);

describe("Arena zeigt die gebuchte Aufstellung", () => {
  it("liefert genau die aufgestellten Spieler, nicht die stärksten des Kaders", () => {
    const teams = buildDisciplineStageTeamsFromBookedResult(baueSpielstand(), "staffel", META, new Map());
    expect(teams).not.toBeNull();
    expect(teams).toHaveLength(1);

    const namen = teams![0].players.map((p) => p.name);
    expect(namen).toEqual(["Spineshard", "Myrth"]);
    // Die beiden Namen aus der Fehlanzeige dürfen NICHT auftauchen.
    expect(namen).not.toContain("Tahra");
    expect(namen).not.toContain("Chad Thunderjaw");
  });

  it("übernimmt Rang und Score aus dem gebuchten Ergebnis", () => {
    const teams = buildDisciplineStageTeamsFromBookedResult(baueSpielstand(), "staffel", META, new Map());
    expect(teams![0].rank).toBe(31);
    expect(teams![0].score).toBeCloseTo(47.8, 1);
    // Die Spieler-Scores sind die gebuchten, nicht geschätzte.
    expect(teams![0].players.map((p) => p.val)).toEqual([29.3, 9.9]);
  });

  /**
   * Die gebuchten Spieler-Scores tragen die Team-Effekte (Intensität, Team-Power, Team-PPs) NICHT
   * — die stecken nur im Team-Score. Ohne Abgleich meldete der Kopf 47,8 und die Bahnen darunter
   * 39,2. Genau so einen stillen Widerspruch soll diese Anzeige nicht mehr erzeugen.
   */
  it("die Bahnen summieren sich auf den Team-Score, der Rest steht beschriftet", () => {
    const team = buildDisciplineStageTeamsFromBookedResult(baueSpielstand(), "staffel", META, new Map())![0];
    const netto = team.players.reduce(
      (summe, spieler) => summe + spieler.val + spieler.mods.reduce((m, mod) => m + mod.sign * mod.amt, 0),
      0,
    );
    expect(netto).toBeCloseTo(team.score, 1);
    // 47,8 − (29,3 + 9,9) = 8,6, beschriftet auf dem letzten Slot.
    const teamMod = team.players.at(-1)!.mods.find((mod) => mod.k === "Team");
    expect(teamMod).toBeDefined();
    expect(teamMod!.amt).toBeCloseTo(8.6, 1);
  });

  it("sortiert die Bahnen nach Slot, nicht nach Leistung", () => {
    // Die Leistungen liegen absichtlich in umgekehrter Reihenfolge im Spielstand (Myrth zuerst).
    const teams = buildDisciplineStageTeamsFromBookedResult(baueSpielstand(), "staffel", META, new Map());
    expect(teams![0].players.map((p) => p.playerId)).toEqual(["p-spineshard", "p-myrth"]);
  });

  it("meldet null, wenn für die Disziplin nichts gebucht ist — statt etwas zu erfinden", () => {
    // „takeshis-castle" ist an diesem Spieltag noch nicht gewertet.
    expect(buildDisciplineStageTeamsFromBookedResult(baueSpielstand(), "takeshis-castle", META, new Map())).toBeNull();
  });

  /**
   * DIE FALLE, festgehalten. Das ist kein Fehler IN `buildDisciplineStageModel` — als Vorschau vor
   * dem Anpfiff soll es genau das tun. Der Fehler war, dieses Modell als ERGEBNIS zu zeigen. Solange
   * dieser Fall grün ist, ist bewiesen, dass die beiden Wege verschiedene Spieler liefern und der
   * Unterschied deshalb sichtbar bleiben muss.
   */
  it("das schätzende Modell wählt nachweislich ANDERE Spieler — deshalb darf es kein Ergebnis sein", () => {
    const gs = baueSpielstand();
    const modell = buildDisciplineStageModel(gs, "staffel", "S-C");
    const modellNamen = modell.teams.find((t) => t.teamId === "S-C")!.slots.map((s) => s.playerName);
    // Das Modell greift zu den stärksten Kaderspielern …
    expect(modellNamen).toContain("Tahra");
    expect(modellNamen).toContain("Chad Thunderjaw");

    // … die gebuchte Wahrheit sind aber die beiden anderen.
    const gebucht = buildDisciplineStageTeamsFromBookedResult(gs, "staffel", META, new Map());
    expect(gebucht![0].players.map((p) => p.name)).toEqual(["Spineshard", "Myrth"]);
  });

  it("markiert ein Team ohne eingereichte Aufstellung, statt es als 0-Punkte-Ergebnis zu zeigen", () => {
    const gs = baueSpielstand();
    (gs.seasonState as { playerDisciplinePerformances: unknown[] }).playerDisciplinePerformances = [];
    const teams = buildDisciplineStageTeamsFromBookedResult(gs, "staffel", META, new Map());
    expect(teams![0].missingLineup).toBe(true);
    expect(teams![0].players).toHaveLength(0);
  });
});
