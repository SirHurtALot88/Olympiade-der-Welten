/**
 * VERLETZTE SPIELER IN DER SPIELTAGS-WERTUNG SICHTBAR MACHEN.
 *
 * GEWÜNSCHT VON CHRIS: „es wäre gut wenn man in der score tabelle vllt noch sehen kann wenn ein
 * team einen verletzten spieler hat! das wäre gut"
 *
 * DIE ENTSCHEIDUNG: die Marke zeigt das EREIGNIS dieses Spieltags („hier hat es dieses Team
 * erwischt"), nicht den heutigen Kaderzustand. In einer Spieltags-Wertung ist das die Aussage, die
 * etwas erklärt; der Kaderzustand steht im Tooltip.
 *
 * GEGEN DIE ROHDATEN GEPRÜFT, nicht gegen die eigene Ableitung: die Fälle unten spannen die
 * `injuryEvents` direkt auf und vergleichen die Marken mit dem, was in ihnen steht.
 *
 * KEINE DRITTE RECHENSTELLE: „ist das eine Verletzung?" beantwortet
 * `injuryEventToPlayerHistoryRecord`, „wie viele sind gerade verletzt?" `countTeamInjuredPlayers`.
 * Die gebuchten Leistungszeilen taugen nicht — nachgemessen am Live-Abbild tragen 0 von 2534
 * `playerDisciplinePerformances` ein `injuryApplied`.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  beschreibeSpieltagsVerletzungsMarke,
  buildMatchdayInjuryMarks,
} from "@/lib/foundation/discipline-stage/discipline-stage-matchday-injuries";

const SEASON = "season-2";
const MD = "season-2-matchday-10";
const MD_DAVOR = "season-2-matchday-9";

type WurfEingabe = {
  teamId: string;
  playerId: string;
  matchdayId: string;
  result: "healthy" | "injured";
  seasonId?: string;
  unavailableUntil?: string | null;
};

function wurf(input: WurfEingabe) {
  return {
    eventId: `injury__${input.seasonId ?? SEASON}__${input.matchdayId}__${input.teamId}__${input.playerId}`,
    seasonId: input.seasonId ?? SEASON,
    matchdayId: input.matchdayId,
    teamId: input.teamId,
    playerId: input.playerId,
    fatigueBefore: 40,
    riskPercent: 5,
    roll: 1,
    result: input.result,
    unavailableForMatchdays: 1,
    unavailableUntil: input.result === "injured" ? (input.unavailableUntil ?? null) : null,
    normalRecovery: 20,
    injuryRecovery: input.result === "injured" ? 10 : null,
    fatigueAfterRecovery: null,
    source: "fatigue_injury_risk_v1",
    timestamp: "2026-08-09T06:34:23.355Z",
  };
}

function buildGameState(input: {
  events: ReturnType<typeof wurf>[];
  availability?: Array<{ teamId: string; playerId: string; injuryStatus: string }>;
}): GameState {
  return {
    season: { id: SEASON, name: "S2", year: 2, matchdayIds: [MD_DAVOR, MD] },
    matchdayState: { matchdayId: MD, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "N-W", name: "Nordwind", shortCode: "N-W" },
      { teamId: "A-A", name: "Alpha", shortCode: "A-A" },
      { teamId: "B-B", name: "Beta", shortCode: "B-B" },
    ],
    rosters: [],
    players: [
      { id: "p-1", name: "Ilvathra" },
      { id: "p-2", name: "Bunnyblade" },
      { id: "p-3", name: "Shadowsong" },
    ],
    disciplines: [],
    seasonState: {
      injuryEvents: input.events,
      playerAvailabilityState: input.availability ?? [],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      lineupDrafts: [],
    },
  } as unknown as GameState;
}

describe("Die Marke erscheint für genau die Teams mit einer Verletzungsbuchung", () => {
  it("ein Team mit Verletzung an DIESEM Spieltag bekommt eine Marke, die anderen nicht", () => {
    const events = [
      wurf({ teamId: "N-W", playerId: "p-1", matchdayId: MD, result: "injured" }),
      // Dasselbe Team, aber gesund gewürfelt — keine Buchung.
      wurf({ teamId: "N-W", playerId: "p-2", matchdayId: MD, result: "healthy" }),
      // Anderes Team, aber ein anderer Spieltag.
      wurf({ teamId: "A-A", playerId: "p-3", matchdayId: MD_DAVOR, result: "injured" }),
      wurf({ teamId: "B-B", playerId: "p-2", matchdayId: MD, result: "healthy" }),
    ];
    const marken = buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD });

    // Gegen die Rohdaten: genau die Teams mit `result === "injured"` an diesem Spieltag.
    const ausRohdaten = new Set(
      events.filter((e) => e.result === "injured" && e.matchdayId === MD).map((e) => e.teamId),
    );
    expect(new Set([...marken.keys()])).toEqual(ausRohdaten);
    expect(marken.get("N-W")?.betroffeneSpieler).toBe(1);
    expect(marken.get("N-W")?.zugezogen.map((s) => s.playerName)).toEqual(["Ilvathra"]);
    expect(marken.has("B-B")).toBe(false);
  });

  it("kein Wurf mit `injured` = keine einzige Marke (auch nicht mit vielen gesunden Würfen)", () => {
    const events = Array.from({ length: 50 }, (_, index) =>
      wurf({ teamId: "A-A", playerId: `p-${index}`, matchdayId: MD, result: "healthy" }),
    );
    expect(buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).size).toBe(0);
  });

  it("eine Verletzung aus einer ANDEREN Saison zählt nicht mit", () => {
    const events = [
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD, result: "injured", seasonId: "season-1" }),
    ];
    expect(buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).size).toBe(0);
  });

  it("mehrere Verletzte eines Teams zählen als Spieler, nicht als Würfe", () => {
    const events = [
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD, result: "injured" }),
      wurf({ teamId: "A-A", playerId: "p-2", matchdayId: MD, result: "injured" }),
      wurf({ teamId: "A-A", playerId: "p-3", matchdayId: MD, result: "healthy" }),
    ];
    const marke = buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).get("A-A");
    expect(marke?.betroffeneSpieler).toBe(2);
    expect(marke?.zugezogen.map((s) => s.playerName)).toEqual(["Bunnyblade", "Ilvathra"]);
  });
});

describe("Auch der Ausfall an diesem Spieltag ist eine Buchung — abgelesen, nicht geraten", () => {
  it("`unavailableUntil` auf diesen Spieltag heisst: hier hat er gefehlt", () => {
    const events = [
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: MD }),
    ];
    const marke = buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).get("A-A");
    expect(marke?.zugezogen).toEqual([]);
    expect(marke?.ausgefallen.map((s) => s.playerName)).toEqual(["Ilvathra"]);
    expect(marke?.betroffeneSpieler).toBe(1);
  });

  it("derselbe Spieler zweimal betroffen zählt EINMAL", () => {
    const events = [
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: MD }),
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD, result: "injured" }),
    ];
    const marke = buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).get("A-A");
    expect(marke?.zugezogen).toHaveLength(1);
    expect(marke?.ausgefallen).toHaveLength(1);
    expect(marke?.betroffeneSpieler).toBe(1);
  });

  it("ein Ausfall, der auf einen ANDEREN Spieltag zeigt, erzeugt hier keine Marke", () => {
    const events = [
      wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: "season-2-matchday-11" }),
    ];
    expect(buildMatchdayInjuryMarks(buildGameState({ events }), { seasonId: SEASON, matchdayId: MD }).size).toBe(0);
  });
});

describe("Der Kaderzustand steht im Tooltip, nicht in der Marke", () => {
  it("die Zahl der Marke ist das Ereignis, die des Tooltips der heutige Kader", () => {
    const gameState = buildGameState({
      events: [wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD, result: "injured" })],
      availability: [
        { teamId: "A-A", playerId: "p-1", injuryStatus: "injured" },
        { teamId: "A-A", playerId: "p-2", injuryStatus: "injured" },
        { teamId: "A-A", playerId: "p-3", injuryStatus: "healthy" },
        { teamId: "B-B", playerId: "p-9", injuryStatus: "injured" },
      ],
    });
    const marke = buildMatchdayInjuryMarks(gameState, { seasonId: SEASON, matchdayId: MD }).get("A-A")!;
    expect(marke.betroffeneSpieler).toBe(1);
    expect(marke.aktuellVerletztImKader).toBe(2);
  });

  it("der Tooltip nennt die Einheit — in dieser Tabelle stehen daneben Punkte und Score", () => {
    const gameState = buildGameState({
      events: [
        wurf({ teamId: "A-A", playerId: "p-1", matchdayId: MD, result: "injured" }),
        wurf({ teamId: "A-A", playerId: "p-2", matchdayId: MD_DAVOR, result: "injured", unavailableUntil: MD }),
      ],
      availability: [{ teamId: "A-A", playerId: "p-1", injuryStatus: "injured" }],
    });
    const text = beschreibeSpieltagsVerletzungsMarke(
      buildMatchdayInjuryMarks(gameState, { seasonId: SEASON, matchdayId: MD }).get("A-A")!,
    );
    expect(text).toContain("An diesem Spieltag verletzt: Ilvathra (fällt 1 Spieltag aus)");
    expect(text).toContain("An diesem Spieltag verletzt ausgefallen: Bunnyblade");
    expect(text).toContain("Im Kader aktuell verletzt: 1 Spieler");
    // Keine nackte Zahl ohne Größe — das war gestern schon ein Befund in diesem Panel.
    expect(text).not.toMatch(/:\s*\d+\s*·/);
  });
});
