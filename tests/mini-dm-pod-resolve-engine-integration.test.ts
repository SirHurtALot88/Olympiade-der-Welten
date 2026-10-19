/**
 * MINI-DM-POD-RESOLVE, ECHTE INTEGRATION (19.10., Chris: "3 -> umbauen dass die 4er teams da drin
 * sind!!!"). Reproduziert Chris' Befund bewusst: der normale Spieltags-Spielplan paart die vier
 * Teams NICHT so, wie der Pod sie gruppiert (Fixtures A-C/B-D, Pod {A,B,C,D} als Einheit) -- genau
 * das Szenario, in dem die alte PPS-Duell-Bruecke ein falsches 2-Team-Ergebnis gegen den
 * Spielplan-Gegner gebucht haette (z. B. "0:2" bei 4 angekuendigten Teams).
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { MINI_DM_POD_TEAM_PUNKTE } from "@/lib/resolve/mini-dm-pod-resolve";

const MINI_DM = "mini-dm";

function createContext(input: { teamId: string; scores: number[]; gameState: GameState }): LegacyLineupLoadedContext {
  const entries = input.scores.map((_, index) => ({
    disciplineId: MINI_DM,
    disciplineSide: "d1" as const,
    slotIndex: index,
    playerId: `${input.teamId}-p${index}`,
    activePlayerId: `active-${input.teamId}-p${index}`,
  }));
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: { [MINI_DM]: input.scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: input.scores.map((score, index) => ({ playerId: `${input.teamId}-p${index}`, disciplineId: MINI_DM, score })),
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [{ id: MINI_DM, name: "Mini DM", category: "power" }],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: MINI_DM, originalOrder: 1, displayOrder: 1, playerCount: input.scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: { d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null }, d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null } },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: MINI_DM, d2DisciplineId: null },
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

/**
 * Der Spielplan-Spieltag paart A-C und B-D -- eine ANDERE Gruppierung als der Pod (der die vier als
 * EINE Vierergruppe sieht). Das ist bewusst: ein Pod ist aus einer eigenen, von
 * `buildSeasonFixtureSchedule()` unabhaengigen Permutation gebildet (s. Kopfkommentar an
 * mini-dm-pod-schedule.ts) -- Fixture-Paarung und Pod-Gruppierung fallen in der Praxis selten
 * zusammen. Die ALTE PPS-Duell-Bruecke haette hier A gegen C und B gegen D gewertet -- falsch,
 * weil die Spielplan-Ankuendigung alle vier als EINE Gruppe zeigt.
 */
const FIXTURES = [
  { id: "f1", homeTeamId: "A", awayTeamId: "C", matchdayId: "matchday-1", status: "scheduled", leagueTier: null },
  { id: "f2", homeTeamId: "B", awayTeamId: "D", matchdayId: "matchday-1", status: "scheduled", leagueTier: null },
];

function buildGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    rosters: [],
    players: [],
    teams: [
      { teamId: "A", name: "A", shortCode: "A" },
      { teamId: "B", name: "B", shortCode: "B" },
      { teamId: "C", name: "C", shortCode: "C" },
      { teamId: "D", name: "D", shortCode: "D" },
    ],
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    disciplines: [{ id: MINI_DM, name: "Mini DM", category: "power", weight: 1, playerCount: 1 }],
    seasonState: {
      schedule: FIXTURES,
      // KEIN `leagueByTeamId` -- Legacy-Pool aus ALLEN vier Teams (isLeagueSplitActive() === false),
      // s. `getMiniDmTeamPools()` in mini-dm-pod-schedule.ts.
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: MINI_DM, displayName: "Mini DM", order: 1, playerCount: 1, category: "power", occurrenceInSeason: 1 },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
    },
  } as unknown as GameState;
}

describe("Mini-DM-Pod-Resolve, echte Integration (legacy-matchday-resolve-engine.ts)", () => {
  it("bucht die vier Teams als EINEN Pod (2-1-0-0 nach Platz), NICHT als Zwei-Team-Duell gegen den Spielplan-Fixture-Gegner", () => {
    const gs = buildGameState();
    // Eignungs-Rangfolge (Summe je Team): A=190 > D=150 > C=90 > B=30 -- bewusst QUER zu den
    // Fixtures (A-C, B-D), damit ein falsch gebuchtes Zwei-Team-Duell (A gegen C, B gegen D) ein
    // ANDERES Ergebnis liefern wuerde als die korrekte Pod-Platzierung.
    const contexts = [
      createContext({ teamId: "A", scores: [100, 90], gameState: gs }),
      createContext({ teamId: "B", scores: [20, 10], gameState: gs }),
      createContext({ teamId: "C", scores: [50, 40], gameState: gs }),
      createContext({ teamId: "D", scores: [80, 70], gameState: gs }),
    ];

    const preview = buildLegacyMatchdayResolvePreview(contexts);
    const miniDmPreview = preview.disciplinePreviews.find((entry) => entry.disciplineId === MINI_DM);
    expect(miniDmPreview).toBeTruthy();

    const byTeam = new Map(miniDmPreview!.teamResults.map((result) => [result.teamId, result]));
    expect(byTeam.size).toBe(4);

    // Platzierung folgt der Eignung (dem PPS-Score), NICHT dem Fixture-Gegner.
    expect(byTeam.get("A")!.miniDmPod?.platz).toBe(1);
    expect(byTeam.get("D")!.miniDmPod?.platz).toBe(2);
    expect(byTeam.get("C")!.miniDmPod?.platz).toBe(3);
    expect(byTeam.get("B")!.miniDmPod?.platz).toBe(4);

    // 2-1-0-0 nach Platz (Chris 14.09.) -- NICHT 2/1/0 aus einem Zwei-Team-Duell.
    expect(byTeam.get("A")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[0]);
    expect(byTeam.get("D")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[1]);
    expect(byTeam.get("C")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[2]);
    expect(byTeam.get("B")!.teamPoints).toBe(MINI_DM_POD_TEAM_PUNKTE[3]);

    // Summe der Liga-Punkte EINES Pods ist IMMER 3 (2+1+0+0) -- Chris' Sonderregel, keine
    // 2/1/0-Duell-Oekonomie (Summe 2) wie bei jeder anderen Disziplin.
    const summeTeamPoints = [...byTeam.values()].reduce((sum, result) => sum + (result.teamPoints ?? 0), 0);
    expect(summeTeamPoints).toBe(3);

    for (const result of byTeam.values()) {
      expect(result.resolutionSource).toBe("mini_dm_pod");
      // KEIN einzelner Gegner -- das ist der Kern des Fixes (kein 2-Team-Duell mehr).
      expect(result.opponentTeamId).toBeNull();
      expect(result.miniDmPod).toBeTruthy();
      // Die Pod-Reihenfolge kommt aus einer eigenen, geseedeten Permutation (s. Kopfkommentar an
      // mini-dm-pod-schedule.ts) -- nicht alphabetisch, aber alle vier Teams sind drin.
      expect(new Set(result.miniDmPod!.teamIds)).toEqual(new Set(["A", "B", "C", "D"]));
      // 0..10, Ordnungsgarantie (berechneErgebnisNormiertNTeam).
      expect(result.miniDmPod!.wert).toBeGreaterThanOrEqual(0);
      expect(result.miniDmPod!.wert).toBeLessThanOrEqual(10);
    }
    // Zero-Sum-Tiebreaker (Verhaeltnis): Summe ueber den ganzen Pod ist exakt 0.
    const summeVerhaeltnis = [...byTeam.values()].reduce((sum, result) => sum + (result.verhaeltnis ?? 0), 0);
    expect(summeVerhaeltnis).toBe(0);

    // Ordnungsgarantie des Pod-Werts: Platz 1 >= Platz 2 >= Platz 3 >= Platz 4.
    const werteNachPlatz = [1, 2, 3, 4].map(
      (platz) => [...byTeam.values()].find((result) => result.miniDmPod?.platz === platz)!.miniDmPod!.wert,
    );
    expect(werteNachPlatz[0]!).toBeGreaterThanOrEqual(werteNachPlatz[1]!);
    expect(werteNachPlatz[1]!).toBeGreaterThanOrEqual(werteNachPlatz[2]!);
    expect(werteNachPlatz[2]!).toBeGreaterThanOrEqual(werteNachPlatz[3]!);
  });

  it("Spieler-PP folgt der eigenen Leistung, unabhaengig vom Pod-Platz des eigenen Teams (Chris 19.10., Impact-Rating-Philosophie)", () => {
    const gs = buildGameState();
    // Team B landet auf dem letzten Platz (Team-SUMME 61, niedrigster Pod-Score), hat aber den
    // staerksten EINZELSPIELER innerhalb seines eigenen, schwachen Teams (60 gegen 1) -- Chris'
    // Beispiel woertlich: "Ein guter Spieler im schlechten Verlierer-Team kann also trotzdem viele
    // Punkte sammeln!"
    const contexts = [
      createContext({ teamId: "A", scores: [100, 90], gameState: gs }), // Summe 190
      createContext({ teamId: "B", scores: [60, 1], gameState: gs }), // Summe 61 -- Pod-Letzter
      createContext({ teamId: "C", scores: [50, 40], gameState: gs }), // Summe 90
      createContext({ teamId: "D", scores: [80, 70], gameState: gs }), // Summe 150
    ];
    const preview = buildLegacyMatchdayResolvePreview(contexts);
    const miniDmPreview = preview.disciplinePreviews.find((entry) => entry.disciplineId === MINI_DM)!;
    const teamB = miniDmPreview.teamResults.find((result) => result.teamId === "B")!;
    expect(teamB.miniDmPod?.platz).toBe(4);
    expect(teamB.teamPoints).toBe(0);

    const topPlayerEntry = teamB.entries.find((entry) => entry.playerId === "B-p0")!;
    const weakPlayerEntry = teamB.entries.find((entry) => entry.playerId === "B-p1")!;
    expect(topPlayerEntry.finalPlayerScore).toBeGreaterThan(weakPlayerEntry.finalPlayerScore);
    // Der individuelle Score ist unveraendert durchgereicht -- die eigentliche PP-Zuteilung
    // (`ppAusSpielerScore()`) haengt NUR an diesem Wert, nicht am Pod-Platz, s.
    // `derivePlayerPointsForDuellGroup()` (season-points-ledger.ts) und die dedizierten Tests
    // fuer `ppAusSpielerScore` in battle-mode-pps-duell.test.ts.
  });
});
