/**
 * SAISON-RANG JE LIGA (21.11., Chris: Spieltagswertung „Undercover Agents 26. → 12.“ mit 0 Punkten,
 * Liga-Tabelle „Zero Heroes ▲25“ in einer 16er-Liga).
 *
 * Ursache: der Saisonstand (`standings[team].rank`) rankt seit dem Liga-Split ligalokal, mehrere
 * Anzeigen rechneten Vorher-Rang und Bewegung aber über alle 32 Teams — die Arena mischte beides
 * (Vorher über 32, Nachher je Liga). Jetzt zählt jeder Saison-Rang und jede Rangbewegung nur
 * innerhalb der eigenen Liga; ohne Liga-Split bleibt alles bit-identisch.
 */
import { describe, expect, it } from "vitest";

import { baueWertungsZeilen, type WertungsEingabe } from "@/app/foundation/discipline-stage/spieltagswertung-zeilen";
import type { GameState, StandingRecord } from "@/lib/data/olyDataTypes";
import { buildFieldRaceLedger, getFieldRaceRankMovement } from "@/lib/foundation/build-field-race-ledger";
import type { SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildStandingsMatchdayRankPair } from "@/lib/foundation/season-standings-matchday-rank-delta";
import { ligaVonAusSpielstand, rangJeLiga, teileNachLiga } from "@/lib/season/liga-raenge";

// 32 Teams, abwechselnd Liga 1 / Liga 2. Punkte so verteilt, dass ein Ranking über alle 32 Teams
// deutlich andere Plätze ergibt als eines je Liga (die Liga-2-Teams haben alle mehr Punkte).
const TEAMS = Array.from({ length: 32 }, (_, i) => ({
  teamId: `t${String(i + 1).padStart(2, "0")}`,
  teamName: `Team ${String(i + 1).padStart(2, "0")}`,
  league: i % 2 === 0 ? "liga1" : "liga2",
}));
const ligaVon = (teamId: string) => TEAMS.find((t) => t.teamId === teamId)!.league;

describe("liga-raenge: Gruppen und Ränge je Liga", () => {
  it("ohne Liga-Zuordnung eine Gruppe, mit Zuordnung je Liga in Eingabe-Reihenfolge", () => {
    expect(teileNachLiga(TEAMS, null)).toHaveLength(1);
    const gruppen = teileNachLiga(TEAMS, ligaVon);
    expect(gruppen.map((g) => g.length)).toEqual([16, 16]);
    expect(gruppen[0]!.every((t) => t.league === "liga1")).toBe(true);
  });

  it("rangJeLiga zählt je Liga ab 1", () => {
    const raenge = rangJeLiga(TEAMS, ligaVon, (gruppe) => new Map(gruppe.map((t, i) => [t.teamId, i + 1] as const)));
    expect(Math.max(...raenge.values())).toBe(16);
    expect([...raenge.entries()].filter(([, r]) => r === 1)).toHaveLength(2);
  });

  it("ligaVonAusSpielstand: null ohne Liga-Split", () => {
    expect(ligaVonAusSpielstand({ seasonState: { leagueByTeamId: {} } as GameState["seasonState"] })).toBeNull();
    expect(ligaVonAusSpielstand({ seasonState: { leagueByTeamId: { a: "liga2" } } as unknown as GameState["seasonState"] })!("a")).toBe("liga2");
  });
});

describe("buildStandingsMatchdayRankPair (Arena „vor → nach“, Saisonstand ±)", () => {
  // Vorher: Liga 2 deutlich vorn; nachher holt ein Liga-1-Team (t01) 0 Punkte, alle anderen +5.
  const standings: Record<string, StandingRecord> = Object.fromEntries(
    TEAMS.map((t, i) => {
      const vorher = (t.league === "liga2" ? 100 : 0) + (32 - i);
      const jetzt = t.teamId === "t01" ? vorher : vorher + 5;
      return [t.teamId, { points: jetzt, rank: null, matchdayBaselinePoints: vorher, matchdayBaselineId: "md-2" } as unknown as StandingRecord];
    }),
  );

  it("mit Liga: Vorher und Nachher je Liga (1..16), Bewegung höchstens 15", () => {
    const paare = buildStandingsMatchdayRankPair(TEAMS, standings);
    for (const team of TEAMS) {
      const paar = paare.get(team.teamId)!;
      expect(paar.previousRank).toBeGreaterThanOrEqual(1);
      expect(paar.previousRank).toBeLessThanOrEqual(16);
      expect(paar.currentRank).toBeLessThanOrEqual(16);
      expect(Math.abs(paar.delta)).toBeLessThanOrEqual(15);
    }
    // t01 war Liga-1-Erster und holt 0 Punkte, t03 und t05 ziehen mit +5 vorbei: 1 → 3.
    expect(paare.get("t01")).toEqual({ previousRank: 1, currentRank: 3, delta: -2 });
    // Über alle 32 gerechnet stünde t01 vorher auf 17 (hinter allen 16 Liga-2-Teams) — der gemeldete Sprung.
    const global = buildStandingsMatchdayRankPair(
      TEAMS.map(({ teamId, teamName }) => ({ teamId, teamName })),
      standings,
    );
    expect(global.get("t01")!.previousRank).toBe(17);
  });
});

describe("Feld-Rennen-Ledger (Saisonstand-Bewegung, Home, Form-Strip)", () => {
  function gameStateMitLiga(mitLiga: boolean): GameState {
    return {
      season: { id: "s1", matchdayIds: ["md-1", "md-2"] },
      seasonState: {
        leagueByTeamId: mitLiga ? Object.fromEntries(TEAMS.map((t) => [t.teamId, t.league])) : {},
        matchdayResults: ["md-1", "md-2"].map((matchdayId, i) => ({ id: `mr-${i}`, seasonId: "s1", matchdayId, status: "preview_applied" })),
      },
      teams: TEAMS.map((t) => ({ teamId: t.teamId, name: t.teamName })),
    } as unknown as GameState;
  }
  // Spieltag 1: Liga 2 holt viel, Liga 1 wenig. Spieltag 2: umgekehrt — über 32 gerechnet springen
  // die Liga-1-Teams um bis zu 16+ Plätze, je Liga bewegt sich fast nichts.
  const ledger = {
    pointEntries: [{}],
    tableGroupContributions: TEAMS.flatMap((t, i) => [
      { matchdayId: "md-1", teamId: t.teamId, points: (t.league === "liga2" ? 50 : 0) + (32 - i) },
      { matchdayId: "md-2", teamId: t.teamId, points: (t.league === "liga1" ? 100 : 0) + (32 - i) },
    ]),
  } as unknown as SeasonPointsLedger;

  it("mit Liga-Split: Gesamt- und Tagesrang 1..16, Bewegung höchstens 15", () => {
    const fr = buildFieldRaceLedger(gameStateMitLiga(true), "s1", ledger);
    for (const team of TEAMS) {
      const zeilen = fr.rowsByTeamId.get(team.teamId)!;
      for (const zeile of zeilen) {
        expect(zeile.cumulativeRank).toBeLessThanOrEqual(16);
        expect(zeile.tagesrang).toBeLessThanOrEqual(16);
      }
      expect(Math.abs(getFieldRaceRankMovement(fr, team.teamId)!)).toBeLessThanOrEqual(15);
    }
  });

  it("ohne Liga-Split unverändert über alle Teams (Rang bis 32)", () => {
    const fr = buildFieldRaceLedger(gameStateMitLiga(false), "s1", ledger);
    const raenge = TEAMS.map((t) => fr.rowsByTeamId.get(t.teamId)![0]!.cumulativeRank!);
    expect(Math.max(...raenge)).toBe(32);
    expect(Math.max(...TEAMS.map((t) => Math.abs(getFieldRaceRankMovement(fr, t.teamId)!)))).toBeGreaterThan(15);
  });
});

describe("Spieltagswertung: abgeleiteter Saison-Rang nach dem Spieltag je Liga", () => {
  it("fehlt der Engine-Rang, zählt der abgeleitete Nachher-Rang nur in der eigenen Liga", () => {
    const sechs = ["a", "b", "c", "d", "e", "f"];
    const eingabe: WertungsEingabe = {
      teamResults: sechs.map((teamId, i) => ({ teamId, d1DisciplineId: "x", d1Points: i, d2DisciplineId: "y", d2Points: 0, totalPoints: i })),
      // Liga 2 (d,e,f) hat viel mehr Punkte; projectedRank fehlt -> Ableitung aus Stand + Punkten.
      standings: sechs.map((teamId, i) => ({
        teamId,
        currentRank: (i % 3) + 1,
        projectedRank: null,
        currentPoints: i < 3 ? i : 100 + i,
        projectedPoints: null,
        pointsDelta: null,
      })),
      d1: { disciplineId: "x", displayName: "X" },
      d2: { disciplineId: "y", displayName: "Y" },
      d1Revealed: true,
      d2Revealed: true,
      teamMetaById: new Map(sechs.map((id) => [id, { code: id, name: id, logoUrl: null }])),
      ownTeamId: "a",
      leagueByTeam: new Map(sechs.map((id, i) => [id, i < 3 ? "liga1" : "liga2"] as const)),
    };
    const zeilen = baueWertungsZeilen(eingabe);
    const nach = (id: string) => zeilen.find((z) => z.teamId === id)!.nachRang;
    // Liga 1: c (2+2=4) vor b (1+1=2) vor a (0) -> 1, 2, 3 — nicht 4, 5, 6 hinter Liga 2.
    expect([nach("c"), nach("b"), nach("a")]).toEqual([1, 2, 3]);
    expect([nach("f"), nach("e"), nach("d")]).toEqual([1, 2, 3]);
    expect(zeilen.every((z) => z.bewegung == null || Math.abs(z.bewegung) <= 2)).toBe(true);
  });
});
