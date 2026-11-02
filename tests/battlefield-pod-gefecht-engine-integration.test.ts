/**
 * BATTLEFIELD-POD AUS DEM GEFECHT JE ORT, ECHTE ENGINE-INTEGRATION (02.11. abends,
 * docs/design/battlefield-pod-ffa-02-11.md Abschnitt 7). Dieselbe Bauart wie
 * tests/mini-dm-pod-resolve-engine-integration.test.ts:
 *
 *  - OHNE Gefecht-Rohdaten bucht `buildLegacyMatchdayResolvePreview()` den Battlefield-Pod wie bisher
 *    ueber den PPS-Pod (Platz nach Eignung, `miniDmPod.quelle` fehlt);
 *  - MIT `battlefieldPodRohdatenByPodId` bucht sie Platz 1-4 und 2-1-0-0 aus dem Gefecht
 *    (`quelle: "ffa"`), und die Spieler-PP kommen aus `arenaIndividualBoxscorePpsByDisciplineId`
 *    (gezeigt = gebucht), nicht aus dem PPS-Score;
 *  - Mini-DM-Rohdaten wirken nicht auf Battlefield.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import type { BattlefieldPodRohdaten } from "@/lib/resolve/mini-dm-pod-resolve";
import { getPodsForMatchday } from "@/lib/season/mini-dm-pod-schedule";

const BF = "battlefield";

function createContext(input: { teamId: string; scores: number[]; gameState: GameState }): LegacyLineupLoadedContext {
  const entries = input.scores.map((_, index) => ({
    disciplineId: BF,
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
    disciplinePlayerCounts: { [BF]: input.scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: input.scores.map((score, index) => ({ playerId: `${input.teamId}-p${index}`, disciplineId: BF, score })),
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [{ id: BF, name: "Battlefield", category: "power" }],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: BF, originalOrder: 1, displayOrder: 1, playerCount: input.scores.length, mutator1: null, mutator2: null },
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
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: BF, d2DisciplineId: null },
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
    disciplines: [{ id: BF, name: "Battlefield", category: "power", weight: 1, playerCount: 1 }],
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
          discipline1: { disciplineId: BF, displayName: "Battlefield", order: 1, playerCount: 1, category: "power", occurrenceInSeason: 1 },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
    },
  } as unknown as GameState;
}


function kontexte(gs: GameState) {
  return [
    createContext({ teamId: "A", scores: [100, 90], gameState: gs }),
    createContext({ teamId: "B", scores: [20, 10], gameState: gs }),
    createContext({ teamId: "C", scores: [50, 40], gameState: gs }),
    createContext({ teamId: "D", scores: [80, 70], gameState: gs }),
  ];
}

describe("Battlefield-Pod aus dem Gefecht je Ort, echte Engine-Integration", () => {
  it("ohne Gefecht: PPS-Pod wie bisher (Platz nach Eignung, keine quelle)", () => {
    const gs = buildGameState();
    const preview = buildLegacyMatchdayResolvePreview(kontexte(gs));
    const bf = preview.disciplinePreviews.find((entry) => entry.disciplineId === BF)!;
    const byTeam = new Map(bf.teamResults.map((r) => [r.teamId, r]));
    expect(byTeam.get("A")!.miniDmPod?.platz).toBe(1);
    expect(byTeam.get("B")!.miniDmPod?.platz).toBe(4);
    for (const r of byTeam.values()) {
      expect(r.resolutionSource).toBe("mini_dm_pod");
      expect(r.miniDmPod?.quelle).toBeUndefined();
    }
  });

  it("mit Gefecht: Platz und 2-1-0-0 aus dem Motor, Spieler-PP aus dem Motor-Boxscore", () => {
    const gs = buildGameState();
    const pod = getPodsForMatchday(gs, "matchday-1", BF, { saveId: "save-1" })[0]!;
    expect(new Set(pod.teamIds)).toEqual(new Set(["A", "B", "C", "D"]));
    // Das Gefecht laesst B (schwaechste Eignung) gewinnen -- die Buchung muss dem Motor folgen.
    const platz: Record<string, number> = { B: 1, C: 2, A: 3, D: 4 };
    const rohdaten: BattlefieldPodRohdaten = {
      podId: pod.id,
      teamIds: pod.teamIds,
      playerCount: 2,
      teams: pod.teamIds.map((teamId) => ({ teamId, eventPlatz: platz[teamId]!, punkte: [0, 120, 64, 16, 0][platz[teamId]!]!, lebend: 1, wertung: 10 })),
    };
    const motorPps = new Map([["B-p1", 7.25], ["A-p0", 1.5]]);
    const preview = buildLegacyMatchdayResolvePreview(kontexte(gs), {
      battlefieldPodRohdatenByPodId: new Map([[pod.id, rohdaten]]),
      arenaIndividualBoxscorePpsByDisciplineId: new Map([[BF, motorPps]]),
    });
    const bf = preview.disciplinePreviews.find((entry) => entry.disciplineId === BF)!;
    const byTeam = new Map(bf.teamResults.map((r) => [r.teamId, r]));
    expect(["B", "C", "A", "D"].map((t) => byTeam.get(t)!.miniDmPod?.platz)).toEqual([1, 2, 3, 4]);
    expect(["B", "C", "A", "D"].map((t) => byTeam.get(t)!.teamPoints)).toEqual([2, 1, 0, 0]);
    for (const r of byTeam.values()) expect(r.miniDmPod?.quelle).toBe("ffa");
    const b1 = byTeam.get("B")!.entries.find((e) => e.playerId === "B-p1")!;
    expect(b1.pointsAwarded).toBe(7.25);
    expect(b1.arenaBoxscoreImpactApplied).toBe(true);
    const gebucht = bf.topPlayers.find((p) => p.playerId === "A-p0")!;
    expect(gebucht.pointsAwarded).toBe(1.5);
  });

  it("Mini-DM-Rohdaten wirken nicht auf Battlefield", () => {
    const gs = buildGameState();
    const ohne = buildLegacyMatchdayResolvePreview(kontexte(gs));
    const mitMiniDm = buildLegacyMatchdayResolvePreview(kontexte(gs), { miniDmFfaPodRohdatenByDisciplineId: new Map([[BF, new Map()]]) });
    const platz = (p: typeof ohne) => p.disciplinePreviews.find((e) => e.disciplineId === BF)!.teamResults.map((r) => [r.teamId, r.miniDmPod?.platz]);
    expect(platz(mitMiniDm)).toEqual(platz(ohne));
  });
});
