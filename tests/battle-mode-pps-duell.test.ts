import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ARENA_TEAM_POINTS } from "@/lib/resolve/battle-mode-arena-team-points";
import {
  DUELL_TEAM_PUNKTE,
  VERHAELTNIS_RUECKFALL_D,
  berechneDuellVerhaeltnis,
  berechnePpsDuellOverrides,
  berechneVerhaeltnisBetrag,
  istDuellWertung,
  resolveMargeReferenz,
} from "@/lib/resolve/battle-mode-pps-duell";
import { resolveProjectedRankWithTiePolicy, type StandingsTieBreakItem } from "@/lib/standings/standings-tiebreaker-policy";
import { summiereSaisonVerhaeltnis } from "@/lib/standings/standings-verhaeltnis";

/**
 * PPS-DUELL-BRUECKE + PUNKTEVERHAELTNIS (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md).
 *
 * Die zentrale Invariante (Projektaufsicht 16.10.): in einem Battle-Save gilt fuer JEDE
 * Disziplin-Zeile mit Fixture `teamPoints ∈ {0,1,2}`, und die Rangtabelle (`rank_to_points_*`) setzt
 * dort NIE Team-Punkte — auch nicht, wenn der Arena-Lauf einer arena-aufgeloesten Disziplin ausfiel.
 */

const D1 = "basketball"; // arena-aufgeloest(-faehig) — hier OHNE Override, also "Arena-Lauf ausgefallen"
const D2 = "battlefield"; // nicht arena-aufgeloest

function createContext(input: {
  teamId: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState: GameState;
}): LegacyLineupLoadedContext {
  const entries = [
    ...input.d1Scores.map((_, index) => ({
      disciplineId: D1,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((_, index) => ({
      disciplineId: D2,
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: { [D1]: input.d1Scores.length, [D2]: input.d2Scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({ playerId: `${input.teamId}-d1-${index}`, disciplineId: D1, score })),
      ...input.d2Scores.map((score, index) => ({ playerId: `${input.teamId}-d2-${index}`, disciplineId: D2, score })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [
      { id: D1, name: "Basketball", category: "tactics" },
      { id: D2, name: "Battlefield", category: "power" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: D1, originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: D2, originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: D1, d2DisciplineId: D2 },
    fatigueByPlayerId: null,
    fatigueSourceStatus: "missing_source",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

const FIXTURES = [
  { id: "f1", homeTeamId: "A", awayTeamId: "B", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga1" },
  { id: "f2", homeTeamId: "C", awayTeamId: "D", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga2" },
  // Ein Fixture eines ANDEREN Spieltags darf nichts beeinflussen.
  { id: "f3", homeTeamId: "A", awayTeamId: "C", matchdayId: "matchday-2", status: "scheduled", leagueTier: "liga1" },
];

function gameState(gameMode: "battle" | "manager", schedule: unknown[] = FIXTURES): GameState {
  return {
    scenarioMeta: { gameMode },
    rosters: [],
    players: [],
    teams: [],
    seasonState: { schedule },
  } as unknown as GameState;
}

function vierTeams(gs: GameState) {
  return [
    createContext({ teamId: "A", d1Scores: [40, 30], d2Scores: [20, 10], gameState: gs }),
    createContext({ teamId: "B", d1Scores: [10, 5], d2Scores: [25, 20], gameState: gs }),
    createContext({ teamId: "C", d1Scores: [50, 45], d2Scores: [5, 5], gameState: gs }),
    createContext({ teamId: "D", d1Scores: [50, 45], d2Scores: [30, 30], gameState: gs }),
  ];
}

describe("Formel D (Konzept 16.10. Abschnitt 3.3)", () => {
  it("reproduziert die Beispielrechnungen des Konzepts", () => {
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 15, m90: 47 })).toBe(3); // Basketball 87:72
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 52, m90: 47 })).toBe(10); // 77:25, Deckel
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 6, m90: 6 })).toBe(10); // Gewichtheben 6:0
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 2, m90: 6 })).toBe(3); // Gewichtheben 4:2
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 275, m90: 416 })).toBe(7); // I-Spy 1274:999
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 1, m90: 2 })).toBe(5); // Breaking 1:0
    expect(berechneVerhaeltnisBetrag({ outcome: "loss", marge: 1, m90: 5 })).toBe(2); // Tennis 3:2 (Betrag)
  });

  it("Remis = 0, Sieg nie 0 (kg-Tiebreak bei Duellgleichstand = knappster Sieg 1), ohne Referenz Rueckfall 5", () => {
    expect(berechneVerhaeltnisBetrag({ outcome: "draw", marge: 0, m90: 6 })).toBe(0);
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 0, m90: 6 })).toBe(1);
    expect(berechneVerhaeltnisBetrag({ outcome: "win", marge: 3, m90: null })).toBe(VERHAELTNIS_RUECKFALL_D);
    const ohneReferenz = berechneDuellVerhaeltnis({
      quelle: "arena",
      disciplineId: "gibt-es-nicht",
      playerCount: 3,
      seiten: [4, 2],
      outcome: "win",
    });
    expect(ohneReferenz).toMatchObject({ marge: 2, verhaeltnis: VERHAELTNIS_RUECKFALL_D, margeM90: null });
    expect(ohneReferenz.warnings).toContain("verhaeltnis_referenz_fehlt:arena:gibt-es-nicht");
  });

  it("die Duell-Punkte sind dieselben wie Chris' Arena-2/1/0", () => {
    expect(DUELL_TEAM_PUNKTE).toEqual(ARENA_TEAM_POINTS);
  });
});

describe("berechnePpsDuellOverrides", () => {
  it("Sieger 2 / Verlierer 0, Remis 1/1, ±D symmetrisch, Arena-Teams ausgeschlossen", () => {
    const overrides = berechnePpsDuellOverrides({
      fixtures: FIXTURES.filter((f) => f.matchdayId === "matchday-1") as never,
      scoreByTeamId: new Map([["A", 70], ["B", 15], ["C", 95], ["D", 95]]),
      disciplineId: D2,
      playerCount: 2,
    });
    expect(overrides.get("A")).toMatchObject({ teamPoints: 2, outcome: "win", opponentTeamId: "B", seiten: [70, 15], marge: 55 });
    expect(overrides.get("B")).toMatchObject({ teamPoints: 0, outcome: "loss", seiten: [15, 70], marge: 55 });
    expect(overrides.get("A")!.verhaeltnis).toBe(-overrides.get("B")!.verhaeltnis);
    expect(overrides.get("A")!.verhaeltnis).toBeGreaterThanOrEqual(1);
    expect(overrides.get("C")).toMatchObject({ teamPoints: 1, outcome: "draw", verhaeltnis: 0 });
    expect(overrides.get("D")).toMatchObject({ teamPoints: 1, outcome: "draw", verhaeltnis: 0 });

    const mitArena = berechnePpsDuellOverrides({
      fixtures: FIXTURES as never,
      scoreByTeamId: new Map([["A", 70], ["B", 15]]),
      disciplineId: D2,
      playerCount: 2,
      ausgeschlosseneTeamIds: new Set(["A"]),
    });
    expect(mitArena.size).toBe(0);
  });
});

describe("INVARIANTE: Battle-Save, jede Zeile mit Fixture zahlt 0/1/2 — nie die Rangtabelle", () => {
  it("arena-faehige Disziplin OHNE Arena-Ergebnis (Lauf ausgefallen) und Nicht-Arena-Disziplin laufen beide als PPS-Duell", () => {
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")));
    expect(preview.disciplinePreviews).toHaveLength(2);
    for (const disziplin of preview.disciplinePreviews) {
      for (const team of disziplin.teamResults) {
        expect([0, 1, 2]).toContain(team.teamPoints);
        expect(team.resolutionSource).toBe("pps_duell");
        expect(team.pointSource).toBe("battle_mode_pps_duell_win_draw_loss");
        expect(team.pointSource.startsWith("rank_to_points")).toBe(false);
        expect(typeof team.verhaeltnis).toBe("number");
        expect(typeof team.marge).toBe("number");
        expect(team.duellSeiten).toHaveLength(2);
        // Kein flacher Mutator-PP-Nachschlag neben 2/1/0 (toBattleDuellMutatorResult).
        for (const entry of team.entries) expect(entry.mutatorPpsBonus ?? 0).toBe(0);
      }
      const punkte = (id: string) => disziplin.teamResults.find((t) => t.teamId === id)!;
      // Je Fixture zusammen genau 2 Punkte und Verhaeltnis-Summe 0.
      for (const [h, g] of [["A", "B"], ["C", "D"]]) {
        expect((punkte(h).teamPoints ?? 0) + (punkte(g).teamPoints ?? 0)).toBe(2);
        expect((punkte(h).verhaeltnis ?? 0) + (punkte(g).verhaeltnis ?? 0)).toBe(0);
        expect(punkte(h).opponentTeamId).toBe(g);
      }
    }
    const basketball = preview.disciplinePreviews.find((d) => d.disciplineId === D1)!;
    // A (70) schlaegt B (15); C und D gleich -> Remis.
    expect(basketball.teamResults.find((t) => t.teamId === "A")?.teamPoints).toBe(2);
    expect(basketball.teamResults.find((t) => t.teamId === "B")?.teamPoints).toBe(0);
    expect(basketball.teamResults.find((t) => t.teamId === "C")?.teamPoints).toBe(1);
    // Spielertabelle: Team-Summe aus Teamsicht = Summe der Duell-Punkte.
    for (const team of preview.teamResults) {
      expect([0, 1, 2, 3, 4]).toContain(team.totalPoints);
    }
  });

  it("ein echtes Arena-Ergebnis sticht die Bruecke; der Gegner im selben Fixture bleibt beim Arena-Wert", () => {
    const arena = new Map([
      ["A", { teamPoints: 0, arenaMatchSeed: "s", opponentTeamId: "B", seiten: [3, 5] as const, outcome: "loss" as const }],
      ["B", { teamPoints: 2, arenaMatchSeed: "s", opponentTeamId: "A", seiten: [5, 3] as const, outcome: "win" as const }],
    ]);
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle")), {
      arenaTeamPointsByDisciplineId: new Map([[D1, arena]]),
    });
    const basketball = preview.disciplinePreviews.find((d) => d.disciplineId === D1)!;
    const a = basketball.teamResults.find((t) => t.teamId === "A")!;
    const b = basketball.teamResults.find((t) => t.teamId === "B")!;
    const c = basketball.teamResults.find((t) => t.teamId === "C")!;
    expect(a).toMatchObject({ resolutionSource: "arena", teamPoints: 0, marge: 2, duellSeiten: [3, 5] });
    expect(b).toMatchObject({ resolutionSource: "arena", teamPoints: 2, marge: 2 });
    expect((a.verhaeltnis ?? 0) + (b.verhaeltnis ?? 0)).toBe(0);
    expect(b.verhaeltnis).toBeGreaterThanOrEqual(1);
    // Das andere Fixture desselben Spieltags hat kein Arena-Ergebnis -> Bruecke.
    expect(c.resolutionSource).toBe("pps_duell");
  });

  it("Battle-Save OHNE Fixture fuer ein Team: KEINE Rangtabellen-Punkte, sondern null + Warnung", () => {
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("battle", [])));
    for (const disziplin of preview.disciplinePreviews) {
      for (const team of disziplin.teamResults) {
        expect(team.teamPoints).toBeNull();
        expect(team.pointSource).toBe("battle_mode_ohne_duell");
        expect(team.warnings).toContain(`battle_mode_ohne_duell:${disziplin.disciplineId}`);
      }
    }
  });

  it("Manager-Save mit demselben Spielplan bleibt beim Rangpfad und bekommt KEINE neuen Schluessel", () => {
    const preview = buildLegacyMatchdayResolvePreview(vierTeams(gameState("manager")));
    for (const disziplin of preview.disciplinePreviews) {
      for (const team of disziplin.teamResults) {
        expect(team.resolutionSource).toBe("pps");
        expect(team.pointSource.startsWith("rank_to_points")).toBe(true);
        for (const schluessel of ["marge", "verhaeltnis", "margeM90", "duellSeiten"]) {
          expect(Object.prototype.hasOwnProperty.call(team, schluessel)).toBe(false);
        }
      }
    }
  });
});

describe("istDuellWertung (Tabelle/Ledger)", () => {
  it("arena und pps_duell mit Punkten buchen fest, pps nie", () => {
    expect(istDuellWertung({ resolutionSource: "arena", teamPoints: 2 })).toBe(true);
    expect(istDuellWertung({ resolutionSource: "pps_duell", teamPoints: 0 })).toBe(true);
    expect(istDuellWertung({ resolutionSource: "pps_duell", teamPoints: null })).toBe(false);
    expect(istDuellWertung({ resolutionSource: "pps", teamPoints: 19.9 })).toBe(false);
    expect(istDuellWertung({})).toBe(false);
  });
});

describe("Verhaeltnis als Tiebreaker (standings-tiebreaker-policy)", () => {
  const item = (teamId: string, projectedPoints: number, totalScore: number, verhaeltnis?: number | null): StandingsTieBreakItem => ({
    teamId,
    teamName: teamId,
    totalScore,
    projectedPoints,
    currentRank: null,
    currentPoints: null,
    matchdayRank: null,
    cash: null,
    ...(verhaeltnis === undefined ? {} : { verhaeltnis }),
  });

  it("Punkte zuerst, dann Verhaeltnis, erst dann totalScore", () => {
    const rang = resolveProjectedRankWithTiePolicy(
      [item("X", 10, 999, 3), item("Y", 10, 1, 17), item("Z", 12, 0, -40)],
      "block_on_tie",
    );
    expect(rang.get("Z")).toBe(1);
    expect(rang.get("Y")).toBe(2); // hoeheres Verhaeltnis schlaegt hoeheren totalScore
    expect(rang.get("X")).toBe(3);
  });

  it("ohne Verhaeltnis (Manager-Save) unveraendert nach totalScore", () => {
    const rang = resolveProjectedRankWithTiePolicy([item("X", 10, 999), item("Y", 10, 1)], "block_on_tie");
    expect(rang.get("X")).toBe(1);
    expect(rang.get("Y")).toBe(2);
  });

  it("summiereSaisonVerhaeltnis summiert nur gewertete Spieltage der Saison, null ohne Verhaeltnis-Zeilen", () => {
    const zeile = (id: string, matchdayResultId: string, teamId: string, verhaeltnis?: number) =>
      ({ id, matchdayResultId, teamId, ...(verhaeltnis === undefined ? {} : { verhaeltnis }) }) as unknown as DisciplineResultRecord;
    const gs = {
      seasonState: {
        matchdayResults: [
          { id: "m1", seasonId: "s1", status: "preview_applied" },
          { id: "m2", seasonId: "s1", status: "draft" },
          { id: "m3", seasonId: "s0", status: "preview_applied" },
        ],
        disciplineResults: [zeile("1", "m1", "A", 4), zeile("2", "m1", "A", -2), zeile("3", "m2", "A", 7), zeile("4", "m3", "A", 9)],
      },
    } as unknown as GameState;
    expect(summiereSaisonVerhaeltnis(gs, "s1")?.get("A")).toBe(2);
    expect(summiereSaisonVerhaeltnis(gs, "s1", { zusaetzlicheMatchdayResultId: "m2" })?.get("A")).toBe(9);
    const ohne = { seasonState: { matchdayResults: [{ id: "m1", seasonId: "s1", status: "preview_applied" }], disciplineResults: [zeile("1", "m1", "A")] } } as unknown as GameState;
    expect(summiereSaisonVerhaeltnis(ohne, "s1")).toBeNull();
  });
});

describe("Referenz-Datei", () => {
  it("jede gezogene PPS-Referenz hat ein positives M90 je Feldgroesse 2..6", () => {
    for (const disziplin of ["football", "i-spy", "battlefield", "tdm", "mini-dm"]) {
      for (const n of [2, 3, 4, 5, 6]) {
        const referenz = resolveMargeReferenz("pps", disziplin, n);
        expect(referenz, `${disziplin} n=${n}`).not.toBeNull();
        expect(referenz!.m90).toBeGreaterThan(0);
        expect(referenz!.feldgroesseGenutzt).toBe(n);
      }
    }
  });
});
