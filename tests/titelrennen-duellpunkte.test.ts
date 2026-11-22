/**
 * Titelrennen, Aufstieg und Abstieg im Battle-Spielstand (Review 22.11., Befund 3.5): die Tabelle
 * führt Duellpunkte (Sieg 2, Remis 1, Niederlage 0), zwei Disziplinen je Spieltag, also höchstens
 * 4 Punkte je Spieltag. Die alte Obergrenze 39,6 machte jedes Team bis zum Schluss "im Rennen".
 */
import { describe, expect, it } from "vitest";

import {
  DUELL_MAX_POINTS_PER_MATCHDAY,
  MAX_POINTS_PER_MATCHDAY,
  buildTitleRace,
  maxPointsPerMatchdayFor,
} from "@/lib/season/title-race";

function liga(prefix: string, name: string, punkte: number[]) {
  return punkte.map((points, i) => ({ teamId: `${prefix}${i + 1}`, points, liga: name }));
}

describe("Titelrennen mit Duellpunkten", () => {
  it("Obergrenze je Spieltag: 4 im Battle-Modus, sonst die alte Faustzahl", () => {
    expect(DUELL_MAX_POINTS_PER_MATCHDAY).toBe(4);
    expect(maxPointsPerMatchdayFor(true)).toBe(4);
    expect(maxPointsPerMatchdayFor(false)).toBe(MAX_POINTS_PER_MATCHDAY);
  });

  it("letzter Spieltag: nur wer höchstens 4 Punkte zurückliegt, ist noch im Rennen", () => {
    const teams = [
      { teamId: "A", points: 50 },
      { teamId: "B", points: 46 },
      { teamId: "C", points: 45.5 },
      { teamId: "D", points: 20 },
    ];
    const race = buildTitleRace(teams, { maxPointsPerMatchday: DUELL_MAX_POINTS_PER_MATCHDAY });
    expect([...race.contenderIds].sort()).toEqual(["A", "B"]);
    // Mit der alten Obergrenze wären alle vier im Rennen gewesen.
    expect(buildTitleRace(teams).contenderIds.size).toBe(4);
  });

  it("mehrere offene Spieltage vergrößern den Spielraum", () => {
    const teams = [
      { teamId: "A", points: 50 },
      { teamId: "B", points: 40 },
    ];
    const opt = { maxPointsPerMatchday: 4 };
    expect(buildTitleRace(teams, { ...opt, remainingMatchdays: 2 }).contenderIds.has("B")).toBe(false);
    expect(buildTitleRace(teams, { ...opt, remainingMatchdays: 3 }).contenderIds.has("B")).toBe(true);
  });

  it("rechnet je Liga: der Führende von Liga 2 verfälscht die Lücken von Liga 1 nicht", () => {
    const race = buildTitleRace([...liga("a", "liga1", [40, 39, 20]), ...liga("b", "liga2", [60, 58, 10])], {
      maxPointsPerMatchday: 4,
    });
    expect(race.leagues.map((l) => l.liga)).toEqual(["liga1", "liga2"]);
    expect(race.leaderId).toBe("a1");
    expect([...race.contenderIds].sort()).toEqual(["a1", "a2"]);
    expect(race.gapByTeamId.get("b2")).toBe(2);
    expect(race.gapByTeamId.get("a3")).toBe(20);
    expect([...race.leagues[1].contenderIds].sort()).toEqual(["b1", "b2"]);
  });

  it("Titel rechnerisch entschieden, wenn nur der Führende übrig ist", () => {
    const race = buildTitleRace(
      [
        { teamId: "A", points: 50 },
        { teamId: "B", points: 45.5 },
      ],
      { maxPointsPerMatchday: 4 },
    );
    expect(race.leagues[0].titleDecided).toBe(true);
    expect(race.leagues[0].titleStatusByTeamId.get("A")).toBe("meister");
    expect(race.leagues[0].titleStatusByTeamId.get("B")).toBe("raus");
  });

  it("Gleichstand an der Spitze bleibt offen (Tie-Break unbekannt)", () => {
    const race = buildTitleRace(
      [
        { teamId: "A", points: 50 },
        { teamId: "B", points: 50 },
      ],
      { maxPointsPerMatchday: 4, remainingMatchdays: 0 },
    );
    expect(race.leagues[0].titleDecided).toBe(false);
  });

  it("Aufstieg in Liga 2: drei Plätze, sicher / im Rennen / raus", () => {
    const race = buildTitleRace(liga("b", "liga2", [60, 58, 56, 54, 30, 10]), {
      maxPointsPerMatchday: 4,
      remainingMatchdays: 1,
    });
    const p = race.leagues[0].promotion!;
    expect(p.get("b1")).toBe("sicher");
    // b2: b1, b3 und (mit Gleichstand) b4 können noch auf 58 oder mehr kommen -> offen.
    expect(p.get("b2")).toBe("im-rennen");
    expect(p.get("b3")).toBe("im-rennen");
    expect(p.get("b4")).toBe("im-rennen");
    expect(p.get("b5")).toBe("raus");
    expect(p.get("b6")).toBe("raus");
    expect(race.leagues[0].relegation).toBeNull();
  });

  it("Abstieg in Liga 1: abgestiegen / gefährdet / gerettet", () => {
    const race = buildTitleRace(liga("a", "liga1", [60, 58, 56, 54, 52, 40, 20, 12, 11, 10]), {
      maxPointsPerMatchday: 4,
      remainingMatchdays: 1,
    });
    const r = race.leagues[0].relegation!;
    expect(r.get("a1")).toBe("gerettet");
    expect(r.get("a6")).toBe("gerettet");
    expect(r.get("a7")).toBe("gerettet");
    expect(r.get("a8")).toBe("abgestiegen");
    expect(r.get("a10")).toBe("abgestiegen");
    expect(race.leagues[0].promotion).toBeNull();
  });

  it("enge Tabelle: alle gefährdet, solange viele Spieltage offen sind", () => {
    const race = buildTitleRace(liga("a", "liga1", [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]), {
      maxPointsPerMatchday: 4,
      remainingMatchdays: 10,
    });
    expect([...race.leagues[0].relegation!.values()].every((v) => v === "gefaehrdet")).toBe(true);
    expect(race.leagues[0].contenderIds.size).toBe(10);
  });

  it("ohne Liga-Zuordnung eine Tabelle ohne Auf-/Abstieg; Teams ohne Punkte fallen heraus", () => {
    const race = buildTitleRace(
      [
        { teamId: "A", points: 5 },
        { teamId: "B", points: null },
      ],
      { maxPointsPerMatchday: 4 },
    );
    expect(race.leagues).toHaveLength(1);
    expect(race.leagues[0].promotion).toBeNull();
    expect(race.leagues[0].relegation).toBeNull();
    expect(race.gapByTeamId.has("B")).toBe(false);
  });
});
