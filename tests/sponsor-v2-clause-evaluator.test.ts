/**
 * P3 — der Klausel-Evaluator gegen echte Feldnamen.
 *
 * Der Test baut einen minimalen GameState mit genau den Feldern, aus denen die Klauseln lesen.
 * Sein Zweck ist NICHT, Arithmetik zu pruefen (die ist trivial), sondern die Verdrahtung: greift
 * jede Klausel auf ein Feld zu, das es wirklich gibt, und faellt sie auf die richtige Seite der
 * gemessenen Schwelle? Ein Tippfehler im Feldnamen wuerde sonst still zu "keine Daten" fuehren —
 * und weil "keine Daten" bewusst als ERFUELLT gewertet wird, waere er unsichtbar.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  SPONSOR_V2_EVALUABLE_CLAUSES, sponsorV2EvaluateClause, sponsorV2StrengthClassOf,
  sponsorV2ThresholdFor,
} from "@/lib/sponsor/sponsor-v2-clause-evaluator";

const SEASON = "season-2";
const TEAM = "T-1";

function makeState(over: Partial<Record<string, unknown>> = {}): GameState {
  const players = [
    { id: "p1", marketValue: 60, subclasses: ["a", "b"], trainingClass: "Kraft",
      classHistory: [{ seasonId: SEASON, className: "B", reason: "organic_progression", createdAt: "" }] },
    { id: "p2", marketValue: 50, subclasses: ["b", "c"], trainingClass: "Kraft", classHistory: [] },
    { id: "p3", marketValue: 40, subclasses: ["d"], trainingClass: "Technik",
      classHistory: [{ seasonId: SEASON, className: "A", reason: "seed", createdAt: "" }] },
  ];
  const base = {
    players,
    rosters: players.map((p) => ({ teamId: TEAM, playerId: p.id })),
    teams: [{ teamId: TEAM }],
    transferHistory: [
      { seasonId: SEASON, fromTeamId: TEAM, toTeamId: "T-2" },
      { seasonId: SEASON, fromTeamId: "T-3", toTeamId: TEAM },
      { seasonId: "season-1", fromTeamId: TEAM, toTeamId: "T-9" },
    ],
    playerMoraleState: [
      { teamId: TEAM, playerId: "p1", morale: 60 },
      { teamId: TEAM, playerId: "p2", morale: 40 },
      { teamId: "T-2", playerId: "px", morale: 99 },
    ],
    seasonState: {
      seasonSnapshots: [{
        seasonId: "season-1",
        finalStandings: [{ teamId: TEAM, rank: 5, marketValueTotalEnd: 100 }],
      }],
      facilityEvents: [
        { seasonId: SEASON, teamId: TEAM, facilityId: "trainingsplatz", previousLevel: 1, nextLevel: 2 },
        { seasonId: SEASON, teamId: TEAM, facilityId: "arena_upgrade", previousLevel: 2, nextLevel: 2 },
        { seasonId: "season-1", teamId: TEAM, facilityId: "fan_shop", previousLevel: 1, nextLevel: 2 },
      ],
      injuryEvents: [
        { seasonId: SEASON, teamId: TEAM, result: "injured" },
        { seasonId: SEASON, teamId: TEAM, result: "healthy" },
        { seasonId: SEASON, teamId: "T-2", result: "injured" },
      ],
      loans: [],
      loanOriginationLogs: [],
    },
    ...over,
  };
  return base as unknown as GameState;
}

const evaluate = (clauseName: string, expectedRank = 16, gs: GameState = makeState()) =>
  sponsorV2EvaluateClause({ gameState: gs, teamId: TEAM, seasonId: SEASON, clauseName, expectedRank });

describe("sponsor v2 — Klausel-Evaluator", () => {
  it("der Pool enthaelt nur Klauseln, die dieser Evaluator wirklich auswerten kann", () => {
    expect(SPONSOR_V2_EVALUABLE_CLAUSES.length).toBeGreaterThanOrEqual(8);
    for (const clause of SPONSOR_V2_EVALUABLE_CLAUSES) {
      const res = evaluate(clause.name);
      expect(res.threshold, `${clause.name} hat keine Schwelle`).not.toBeNull();
      // Der eigentliche Punkt: kein Eintrag des Pools darf mangels Daten geschenkt werden.
      // Ausnahme Wertaufbau — der braucht eine Vorsaison und die gibt es in Saison 1 nicht.
      if (clause.name !== "Wertaufbau") {
        expect(res.assumedMet, `${clause.name} liest ins Leere — Feldname pruefen`).toBe(false);
      }
    }
  });

  it("Talentschmiede zaehlt nur echte Aufstiege dieser Saison, nicht die Seed-Eintraege", () => {
    const res = evaluate("Talentschmiede");
    expect(res.metric).toBe(1); // p1 organic_progression; p3 ist "seed" und zaehlt nicht
    expect(res.met).toBe(true); // Schwelle >= 1
  });

  it("Kaderruhe zaehlt Zu- UND Abgaenge, aber nur die dieser Saison", () => {
    const res = evaluate("Kaderruhe");
    expect(res.metric).toBe(2);
    expect(res.met).toBe(true); // Schwelle <= 8
  });

  it("Ausbau zaehlt jedes Gebaeude, aber nur echte Stufenaufstiege", () => {
    // Der Eintrag mit previousLevel === nextLevel ist ein Upkeep-Event, kein Ausbau; der aus
    // season-1 gehoert nicht zu dieser Saison.
    expect(evaluate("Ausbau").metric).toBe(1);
    expect(evaluate("Ausbau").met).toBe(true);
  });

  it("Prophylaxe zaehlt nur result 'injured' des eigenen Teams", () => {
    const res = evaluate("Prophylaxe");
    expect(res.metric).toBe(1);
    expect(res.met).toBe(true); // Schwelle <= 6
  });

  it("Schuldenfrei liest BEIDE Kreditquellen — Ledger und State", () => {
    expect(evaluate("Schuldenfrei").metric).toBe(0);
    const withLoanInState = makeState({
      seasonState: { ...(makeState().seasonState as object), loans: [{ originatedSeasonId: SEASON, borrowerTeamId: TEAM }], loanOriginationLogs: [] },
    });
    const res = evaluate("Schuldenfrei", 16, withLoanInState);
    // Der Origination-Ledger ist leer, der Kredit steht nur im State. Wer nur den Ledger liest,
    // misst faelschlich 0 — genau der Fehler, den die Messung im Save aufgedeckt hat.
    expect(res.metric).toBe(1);
    expect(res.met).toBe(false);
  });

  it("Moral mittelt nur ueber das eigene Team", () => {
    const res = evaluate("Moral");
    expect(res.metric).toBeCloseTo(50, 6); // (60 + 40) / 2, das fremde Team mit 99 zaehlt nicht
    expect(res.met).toBe(true); // Schwelle >= 48.06
  });

  it("Vielseitigkeit und Fokusschule lesen Kaderzustand", () => {
    expect(evaluate("Vielseitigkeit").metric).toBe(4); // a,b,c,d
    expect(evaluate("Fokusschule").metric).toBe(2); // zwei Spieler auf "Kraft"
  });

  it("Wertaufbau misst gegen die Vorsaison und ist in Saison 1 nicht auswertbar", () => {
    const res = evaluate("Wertaufbau");
    expect(res.metric).toBeCloseTo(50, 6); // 150 jetzt gegen 100 in season-1
    expect(res.met).toBe(true);
    const season1 = sponsorV2EvaluateClause({
      gameState: makeState(), teamId: TEAM, seasonId: "season-1", clauseName: "Wertaufbau", expectedRank: 16,
    });
    expect(season1.metric).toBeNull();
    expect(season1.assumedMet).toBe(true);
  });

  it("KEINE DATEN heisst ERFUELLT und wird als Annahme markiert", () => {
    // Ein leerer State darf niemals einen Malus ausloesen, den der Spieler nicht abwenden konnte.
    const empty = { players: [], rosters: [], teams: [], transferHistory: [], seasonState: {} } as unknown as GameState;
    const res = sponsorV2EvaluateClause({
      gameState: empty, teamId: TEAM, seasonId: SEASON, clauseName: "Moral", expectedRank: 16,
    });
    expect(res.met).toBe(true);
    expect(res.assumedMet).toBe(true);
  });

  it("unbekannte Klauseln fallen sauber auf 'erfuellt, angenommen' zurueck", () => {
    const res = evaluate("Kapitänstreue");
    expect(res.met).toBe(true);
    expect(res.assumedMet).toBe(true);
  });

  it("klassenrelative Schwellen: die Spitze darf mehr Gehalt zahlen als der Keller", () => {
    expect(sponsorV2StrengthClassOf(5)).toBe(0);
    expect(sponsorV2StrengthClassOf(16)).toBe(1);
    expect(sponsorV2StrengthClassOf(30)).toBe(2);
    const stark = sponsorV2ThresholdFor("Gehaltseffizienz", 5)!;
    const schwach = sponsorV2ThresholdFor("Gehaltseffizienz", 30)!;
    expect(stark).toBeGreaterThan(schwach);
    // Vielseitigkeit umgekehrt: von einem starken Kader wird mehr Breite verlangt.
    expect(sponsorV2ThresholdFor("Vielseitigkeit", 5)!).toBeGreaterThan(sponsorV2ThresholdFor("Vielseitigkeit", 30)!);
    // Klauseln ohne Klassenabhaengigkeit liefern ueberall dieselbe Schwelle.
    expect(sponsorV2ThresholdFor("Prophylaxe", 2)).toBe(sponsorV2ThresholdFor("Prophylaxe", 31));
  });
});
