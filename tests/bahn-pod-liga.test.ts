/**
 * BAHN-POD IN DER LIGA (02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6): Takeshi's Castle
 * und Staffel sind Vierer-Pod-Disziplinen, gebucht wird das ECHTE Vier-Team-Rennen. Deckt ab:
 *   (a) Konfiguration: vier Pod-Disziplinen, nur Takeshi/Staffel mit Bahn-Motor.
 *   (b) Buchungsformel `berechneBahnPodOverride()`: Platz aus dem Rennen (nicht aus dem PPS-Score),
 *       2-1-0-0, Gleichstand ueber PPS-Score, Staffel nach Zielzeit, kaputte Rohdaten -> null.
 *   (c) Resolve-Engine: Rennen hat Vorrang vor PPS-Pod UND vor einem Arena-Duell, kein
 *       `arenaAusfall` an Rennzeilen, Spieler-PP aus dem Rennen; ohne Rohdaten PPS-Pod + sichtbarer
 *       Ausfall-Marker.
 *   (d) Spieltag `runBahnPodMatchday()` mit gefaelschtem Runner: Saat je Pod, k und Spieltag werden
 *       durchgereicht, ein kaputtes Pod-Ergebnis faellt einzeln heraus, Spieler-PP aus dem Boxscore.
 *   (e) Vorlauf `teileBahnPodDisziplinenAb()`: an Pod-Tagen Rennen statt Duell, ohne Pods Duell,
 *       Notschalter aus -> weder noch.
 *   (f) Ledger vertraut den Boxscore-PP einer Rennzeile (`quelle: "bahn"`).
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { BahnPodFixtureResult, runBahnPodFixtures } from "@/lib/battle/arena-headless-runner";
import { buildBahnPodMatchSeed } from "@/lib/battle/arena-seed";
import { teileBahnPodDisziplinenAb } from "@/lib/battle/arena-vorlauf-service";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import {
  BAHN_POD_DISCIPLINE_IDS,
  berechneBahnPodOverride,
  berechneBahnPodOverrides,
  ppAusBahnPodWert,
  resolveBahnPodSpielerPpReferenz,
  type BahnPodRohdaten,
} from "@/lib/resolve/bahn-pod-resolve";
import { runBahnPodMatchday } from "@/lib/resolve/bahn-pod-matchday";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { MINI_DM_POD_TEAM_PUNKTE, type MiniDmPodOverride } from "@/lib/resolve/mini-dm-pod-resolve";
import { getPodsForMatchday, type MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";
import { isViererPodDiscipline, VIERER_POD_DISCIPLINE_IDS } from "@/lib/season/season-discipline-schedule";

describe("(a) Konfiguration", () => {
  it("Takeshi's Castle und Staffel sind Vierer-Pod-Disziplinen, nur sie mit Bahn-Motor", () => {
    expect([...VIERER_POD_DISCIPLINE_IDS].sort()).toEqual(["battlefield", "mini-dm", "staffel", "takeshis-castle"]);
    expect(isViererPodDiscipline("staffel")).toBe(true);
    expect(isViererPodDiscipline("takeshis-castle")).toBe(true);
    expect(isViererPodDiscipline("spurt")).toBe(false);
    expect([...BAHN_POD_DISCIPLINE_IDS].sort()).toEqual(["staffel", "takeshis-castle"]);
  });
});

// ---------------------------------------------------------------------------------------------
// (b) Buchungsformel
// ---------------------------------------------------------------------------------------------
const POD: MiniDmPod = {
  id: "staffel-pod:s1:legacy-pool:md1:0",
  disciplineId: "staffel",
  seasonId: "s1",
  matchdayId: "md1",
  leagueTier: null,
  occurrenceInSeason: 1,
  teamIds: ["A", "B", "C", "D"],
};
// PPS-Reihenfolge A > D > C > B -- das Rennen widerspricht absichtlich.
const PPS = new Map([
  ["A", 190],
  ["B", 30],
  ["C", 90],
  ["D", 150],
]);

function rohdaten(disciplineId: string, teams: BahnPodRohdaten["teams"], podId = POD.id): BahnPodRohdaten {
  return { podId, disciplineId, teamIds: POD.teamIds, playerCount: 3, teams };
}

const nachPlatz = (overrides: Map<string, MiniDmPodOverride>) =>
  [...overrides.values()].sort((a, b) => a.platz - b.platz).map((o) => o.teamId);

describe("(b) berechneBahnPodOverride", () => {
  it("Staffel: Platz und 2-1-0-0 aus dem Zieleinlauf, nicht aus dem PPS-Score", () => {
    const overrides = berechneBahnPodOverride({
      pod: { ...POD },
      rohdaten: rohdaten("staffel", [
        { teamId: "A", eventPlatz: 3, teamWert: 10.9 },
        { teamId: "B", eventPlatz: 1, teamWert: 10.1 },
        { teamId: "C", eventPlatz: 4, teamWert: 11.4 },
        { teamId: "D", eventPlatz: 2, teamWert: 10.5 },
      ]),
      ppsScoreByTeamId: PPS,
      disciplineId: "staffel",
      playerCount: 3,
    })!;
    expect(nachPlatz(overrides)).toEqual(["B", "D", "A", "C"]);
    expect(["B", "D", "A", "C"].map((t) => overrides.get(t)!.teamPoints)).toEqual([...MINI_DM_POD_TEAM_PUNKTE]);
    const werte = ["B", "D", "A", "C"].map((t) => overrides.get(t)!.wert);
    // Ordnungsgarantie: verschiedene Liga-Punkte -> streng fallender 0-10-Wert.
    expect(werte[0]!).toBeGreaterThan(werte[1]!);
    expect(werte[1]!).toBeGreaterThan(werte[2]!);
    expect(werte[2]!).toBeGreaterThanOrEqual(werte[3]!);
    expect([...overrides.values()].reduce((s, o) => s + o.verhaeltnis, 0)).toBe(0);
    for (const o of overrides.values()) {
      expect(o.quelle).toBe("bahn");
      expect(o.podId).toBe(POD.id);
    }
    expect(overrides.get("B")!.teamWert).toBe(10.1);
    // Marge zum naechstbesseren Platz in Sekunden Zielzeit.
    expect(overrides.get("D")!.margeZumNaechstbesserenPlatz).toBeCloseTo(0.4, 6);
  });

  it("Takeshi: Burgpunkte; geteilter Motor-Platz wird ueber den PPS-Score strikt aufgeloest", () => {
    const overrides = berechneBahnPodOverride({
      pod: { ...POD, id: "takeshis-castle-pod:s1:legacy-pool:md1:0", disciplineId: "takeshis-castle" },
      rohdaten: rohdaten(
        "takeshis-castle",
        [
          { teamId: "A", eventPlatz: 2, teamWert: 40 },
          { teamId: "B", eventPlatz: 2, teamWert: 40 },
          { teamId: "C", eventPlatz: 1, teamWert: 55.5 },
          { teamId: "D", eventPlatz: 4, teamWert: 12 },
        ],
        "takeshis-castle-pod:s1:legacy-pool:md1:0",
      ),
      ppsScoreByTeamId: PPS,
      disciplineId: "takeshis-castle",
      playerCount: 3,
    })!;
    // A und B gleichauf (Platz 2): A hat den hoeheren PPS-Score -> Platz 2, B Platz 3.
    expect(nachPlatz(overrides)).toEqual(["C", "A", "B", "D"]);
    expect(overrides.get("A")!.teamPoints).toBe(1);
    expect(overrides.get("B")!.teamPoints).toBe(0);
    // Verschiedene Liga-Punkte trotz gleichem Teamwert: `mindestLuecke` haelt die Werte auseinander.
    expect(overrides.get("A")!.wert).toBeGreaterThan(overrides.get("B")!.wert);
  });

  it("kaputte Rohdaten oder fehlender PPS-Score -> null (Pod faellt auf den PPS-Pod zurueck)", () => {
    const basis = { pod: { ...POD }, ppsScoreByTeamId: PPS, disciplineId: "staffel", playerCount: 3 };
    const gut = [
      { teamId: "A", eventPlatz: 1, teamWert: 10 },
      { teamId: "B", eventPlatz: 2, teamWert: 11 },
      { teamId: "C", eventPlatz: 3, teamWert: 12 },
      { teamId: "D", eventPlatz: 4, teamWert: 13 },
    ];
    expect(berechneBahnPodOverride({ ...basis, rohdaten: rohdaten("staffel", gut.slice(0, 3)) })).toBeNull();
    expect(berechneBahnPodOverride({ ...basis, rohdaten: rohdaten("staffel", [...gut.slice(0, 3), { teamId: "X", eventPlatz: 4, teamWert: 13 }]) })).toBeNull();
    expect(berechneBahnPodOverride({ ...basis, rohdaten: rohdaten("staffel", [...gut.slice(0, 3), { teamId: "D", eventPlatz: 5, teamWert: 13 }]) })).toBeNull();
    expect(berechneBahnPodOverride({ ...basis, ppsScoreByTeamId: new Map([["A", 1]]), rohdaten: rohdaten("staffel", gut) })).toBeNull();
    expect(berechneBahnPodOverride({ ...basis, rohdaten: rohdaten("staffel", gut) })).not.toBeNull();
  });

  it("Staffel-Team ohne Zieleinlauf liegt hinten und traegt eine Warnung", () => {
    const overrides = berechneBahnPodOverride({
      pod: { ...POD },
      rohdaten: rohdaten("staffel", [
        { teamId: "A", eventPlatz: 1, teamWert: 10 },
        { teamId: "B", eventPlatz: 4, teamWert: null },
        { teamId: "C", eventPlatz: 2, teamWert: 11 },
        { teamId: "D", eventPlatz: 3, teamWert: 12 },
      ]),
      ppsScoreByTeamId: PPS,
      disciplineId: "staffel",
      playerCount: 3,
    })!;
    expect(overrides.get("B")!.platz).toBe(4);
    expect(overrides.get("B")!.warnings).toContain("bahn_pod_ohne_zieleinlauf");
  });

  it("berechneBahnPodOverrides: nur Pods mit Rohdaten derselben Disziplin", () => {
    const zweiterPod: MiniDmPod = { ...POD, id: "staffel-pod:s1:legacy-pool:md1:1", teamIds: ["E", "F", "G", "H"] };
    const map = berechneBahnPodOverrides({
      pods: [POD, zweiterPod],
      rohdatenByPodId: new Map([
        [
          POD.id,
          rohdaten("staffel", [
            { teamId: "A", eventPlatz: 1, teamWert: 10 },
            { teamId: "B", eventPlatz: 2, teamWert: 11 },
            { teamId: "C", eventPlatz: 3, teamWert: 12 },
            { teamId: "D", eventPlatz: 4, teamWert: 13 },
          ]),
        ],
      ]),
      ppsScoreByTeamId: new Map([...PPS, ["E", 1], ["F", 2], ["G", 3], ["H", 4]]),
      disciplineId: "staffel",
      playerCount: 3,
    });
    expect([...map.keys()].sort()).toEqual(["A", "B", "C", "D"]);
    expect(berechneBahnPodOverrides({ pods: [POD], rohdatenByPodId: new Map(), ppsScoreByTeamId: PPS, disciplineId: "battlefield", playerCount: 3 }).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// (c) Resolve-Engine
// ---------------------------------------------------------------------------------------------
const STAFFEL = "staffel";

function createContext(input: { teamId: string; scores: number[]; gameState: GameState }): LegacyLineupLoadedContext {
  const entries = input.scores.map((_, index) => ({
    disciplineId: STAFFEL,
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
    disciplinePlayerCounts: { [STAFFEL]: input.scores.length },
    activePlayers: entries.map((entry) => ({ id: entry.activePlayerId, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, playerId: entry.playerId })),
    disciplineScores: input.scores.map((score, index) => ({ playerId: `${input.teamId}-p${index}`, disciplineId: STAFFEL, score })),
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [{ id: STAFFEL, name: "Staffel", category: "speed" }],
    disciplineWeights: [],
    seasonDisciplineConfigs: [{ disciplineId: STAFFEL, originalOrder: 1, displayOrder: 1, playerCount: input.scores.length, mutator1: null, mutator2: null }],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: { d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null }, d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null } },
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: STAFFEL, d2DisciplineId: null },
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

/** Fixtures A-C / B-D -- bewusst QUER zur Pod-Gruppe {A,B,C,D}. */
function buildResolveGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    rosters: [],
    players: [],
    teams: ["A", "B", "C", "D"].map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    disciplines: [{ id: STAFFEL, name: "Staffel", category: "speed", weight: 1, playerCount: 2 }],
    seasonState: {
      schedule: [
        { id: "f1", homeTeamId: "A", awayTeamId: "C", matchdayId: "matchday-1", status: "scheduled", leagueTier: null },
        { id: "f2", homeTeamId: "B", awayTeamId: "D", matchdayId: "matchday-1", status: "scheduled", leagueTier: null },
      ],
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: STAFFEL, displayName: "Staffel", order: 1, playerCount: 2, category: "speed", occurrenceInSeason: 1 },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
    },
  } as unknown as GameState;
}

function resolveContexts(gs: GameState) {
  return [
    createContext({ teamId: "A", scores: [100, 90], gameState: gs }), // 190
    createContext({ teamId: "B", scores: [20, 10], gameState: gs }), // 30
    createContext({ teamId: "C", scores: [50, 40], gameState: gs }), // 90
    createContext({ teamId: "D", scores: [80, 70], gameState: gs }), // 150
  ];
}

describe("(c) Resolve-Engine bucht das Rennen", () => {
  it("Rennen hat Vorrang vor PPS-Pod und vor einem Arena-Duell; kein arenaAusfall; Spieler-PP aus dem Rennen", () => {
    const gs = buildResolveGameState();
    const [pod] = getPodsForMatchday(gs, "matchday-1", STAFFEL, { saveId: "save-1" });
    expect(pod).toBeDefined();
    // Rennen: B gewinnt, C Zweiter, D Dritter, A Letzter -- genau GEGEN die PPS-Reihenfolge.
    const roh: BahnPodRohdaten = {
      podId: pod!.id,
      disciplineId: STAFFEL,
      teamIds: pod!.teamIds,
      playerCount: 2,
      teams: [
        { teamId: "B", eventPlatz: 1, teamWert: 9.8 },
        { teamId: "C", eventPlatz: 2, teamWert: 10.1 },
        { teamId: "D", eventPlatz: 3, teamWert: 10.6 },
        { teamId: "A", eventPlatz: 4, teamWert: 11.2 },
      ],
    };
    const ppByPlayer = new Map(["A", "B", "C", "D"].flatMap((t) => [[`${t}-p0`, 4.4], [`${t}-p1`, 1.1]] as const));
    const preview = buildLegacyMatchdayResolvePreview(resolveContexts(gs), {
      bahnPodRohdatenByDisciplineId: new Map([[STAFFEL, new Map([[pod!.id, roh]])]]),
      arenaIndividualBoxscorePpsByDisciplineId: new Map([[STAFFEL, ppByPlayer]]),
      // Ein (veralteter) Duell-Override fuer A darf den Pod NICHT schlagen.
      arenaTeamPointsByDisciplineId: new Map([
        [STAFFEL, new Map([["A", { teamPoints: 2, arenaMatchSeed: "x", opponentTeamId: "C", seiten: [1, 0] as [number, number], outcome: "win" as const }]])],
      ]),
    });
    const staffel = preview.disciplinePreviews.find((entry) => entry.disciplineId === STAFFEL)!;
    const byTeam = new Map(staffel.teamResults.map((result) => [result.teamId, result]));
    expect(["B", "C", "D", "A"].map((t) => byTeam.get(t)!.miniDmPod?.platz)).toEqual([1, 2, 3, 4]);
    expect(["B", "C", "D", "A"].map((t) => byTeam.get(t)!.teamPoints)).toEqual([...MINI_DM_POD_TEAM_PUNKTE]);
    for (const result of byTeam.values()) {
      expect(result.resolutionSource).toBe("mini_dm_pod");
      expect(result.miniDmPod!.quelle).toBe("bahn");
      expect(result.arenaAusfall ?? null).toBeNull();
      expect(result.warnings.some((w) => w.startsWith("arena_ausgefallen"))).toBe(false);
      for (const entry of result.entries) {
        expect(entry.pointsAwarded).toBe(entry.slotIndex === 0 ? 4.4 : 1.1);
        expect(entry.arenaBoxscoreImpactApplied).toBe(true);
      }
    }
    expect(byTeam.get("B")!.miniDmPod!.teamWert).toBe(9.8);
    // Persistierte Spieler-Zeilen (topPlayers) ziehen dieselben Rennen-PP.
    for (const player of staffel.topPlayers) {
      expect(player.pointsAwarded).toBe(player.slotIndex === 0 ? 4.4 : 1.1);
    }
  });

  it("ohne Rohdaten: PPS-Pod (2-1-0-0 nach PPS-Score) und sichtbarer Marker, dass das Rennen nicht lief", () => {
    const gs = buildResolveGameState();
    const preview = buildLegacyMatchdayResolvePreview(resolveContexts(gs));
    const staffel = preview.disciplinePreviews.find((entry) => entry.disciplineId === STAFFEL)!;
    const byTeam = new Map(staffel.teamResults.map((result) => [result.teamId, result]));
    expect(["A", "D", "C", "B"].map((t) => byTeam.get(t)!.teamPoints)).toEqual([...MINI_DM_POD_TEAM_PUNKTE]);
    for (const result of byTeam.values()) {
      expect(result.resolutionSource).toBe("mini_dm_pod");
      expect(result.miniDmPod!.quelle).toBeUndefined();
      expect(result.arenaAusfall?.grund).toBe("nicht_ausgefuehrt");
    }
  });
});

// ---------------------------------------------------------------------------------------------
// (d) Spieltag mit gefaelschtem Runner
// ---------------------------------------------------------------------------------------------
describe("(d) runBahnPodMatchday", () => {
  it("reicht Saat/k/Spieltag durch, verwirft ein kaputtes Pod-Ergebnis einzeln, PP aus dem Boxscore", async () => {
    const gs = buildResolveGameState();
    const podA: MiniDmPod = { ...POD, id: "takeshis-castle-pod:s1:legacy-pool:md1:0", disciplineId: "takeshis-castle" };
    const podB: MiniDmPod = { ...podA, id: "takeshis-castle-pod:s1:legacy-pool:md1:1", teamIds: ["E", "F", "G", "H"] };
    const aufrufe: Array<{ disciplineId: string; seeds: Array<string | number>; options: unknown }> = [];
    const ergebnis = (pod: MiniDmPod, kaputt: boolean): BahnPodFixtureResult => ({
      podId: pod.id,
      disciplineId: "takeshis-castle",
      teamIds: pod.teamIds,
      teams: pod.teamIds.map((teamId, i) => ({ teamId, podSide: i, eventPlatz: i + 1, ligaPunkte: [2, 1, 0, 0][i]!, wert: 40 - i * 5, zielzeit: null })),
      boxscore: pod.teamIds
        .filter((_, i) => !(kaputt && i === 3))
        .map((teamId, i) => ({ name: `${teamId}-l`, playerId: `${teamId}-p0`, teamId, podSide: i, wert: 20 - i })),
    });
    const fake = (async (_gs, disciplineId, pods, options) => {
      aufrufe.push({ disciplineId, seeds: pods.map((p) => p.seed), options });
      return [ergebnis(podA, false), ergebnis(podB, true)];
    }) as typeof runBahnPodFixtures;
    const r = (await runBahnPodMatchday({
      gameState: gs,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      disciplineId: "takeshis-castle",
      pods: [podA, podB],
      playerCount: 4,
      mutatorTraits: ["Diva"],
      runBahnPodFixturesImpl: fake,
    }))!;
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]!.seeds).toEqual([podA, podB].map((pod) =>
      buildBahnPodMatchSeed({ saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", disciplineId: "takeshis-castle", podId: pod.id }),
    ));
    expect(aufrufe[0]!.options).toMatchObject({ k: 4, matchdayId: "matchday-1", mutatoren: ["Diva"] });
    expect([...r.rohdatenByPodId.keys()]).toEqual([podA.id]);
    expect(r.rohdatenByPodId.get(podA.id)!.teams.map((t) => [t.teamId, t.eventPlatz, t.teamWert])).toEqual([
      ["A", 1, 40],
      ["B", 2, 35],
      ["C", 3, 30],
      ["D", 4, 25],
    ]);
    expect(r.warnings.some((w) => w.startsWith(`bahn_pod_team_ohne_laeufer:${podB.id}`))).toBe(true);
    const referenz = resolveBahnPodSpielerPpReferenz("takeshis-castle", 4);
    expect(r.playerPpsByPlayerId.get("A-p0")).toBe(ppAusBahnPodWert(20, referenz));
    expect(r.playerPpsByPlayerId.has("E-p0")).toBe(false);
  });

  it("keine Bahn-Disziplin oder keine Pods -> null", async () => {
    const gs = buildResolveGameState();
    expect(await runBahnPodMatchday({ gameState: gs, saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", disciplineId: "spurt" })).toBeNull();
    expect(await runBahnPodMatchday({ gameState: gs, saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", disciplineId: "staffel", pods: [] })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// (e) Vorlauf-Aufteilung
// ---------------------------------------------------------------------------------------------
describe("(e) teileBahnPodDisziplinenAb", () => {
  it("Pod-Tag: Staffel als Rennen statt Duell; andere Arena-Disziplinen bleiben Duell; Notschalter aus -> weder noch", () => {
    const gs = buildResolveGameState();
    const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1" };
    expect(teileBahnPodDisziplinenAb(gs, scope, ["staffel", "fechten"], true)).toEqual({ arenaDisciplineIds: ["fechten"], bahnPodDisciplineIds: ["staffel"] });
    expect(teileBahnPodDisziplinenAb(gs, scope, ["staffel", "fechten"], false)).toEqual({ arenaDisciplineIds: ["fechten"], bahnPodDisciplineIds: [] });
  });

  it("ohne Pods (Disziplin steht nicht am Spieltag / Liga nicht durch 4 teilbar): weiter Duell", () => {
    const gs = buildResolveGameState();
    gs.teams = gs.teams.slice(0, 3);
    const scope = { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1" };
    expect(teileBahnPodDisziplinenAb(gs, scope, ["staffel"], true)).toEqual({ arenaDisciplineIds: ["staffel"], bahnPodDisciplineIds: [] });
  });
});

// ---------------------------------------------------------------------------------------------
// (f) Ledger
// ---------------------------------------------------------------------------------------------
describe("(f) Ledger", () => {
  it("`quelle: \"bahn\"` vertraut performance.scoreContribution wie eine Arena-Zeile", () => {
    const gameState = createFreshSeasonOneGameState();
    const [teamA, teamB, teamC, teamD] = gameState.teams;
    const [playerA] = gameState.players;
    const podTeamIds = [teamA!.teamId, teamB!.teamId, teamC!.teamId, teamD!.teamId] as const;
    gameState.seasonState.matchdayResults = [
      {
        id: "result-bahn-1",
        saveId: "save-local",
        seasonId: gameState.season.id,
        matchdayId: "matchday-1",
        status: "preview_applied",
        sourceVersion: "test",
        teamsTotal: 4,
        teamsReady: 4,
        teamsUnderfilled: 0,
        teamsMissingLineup: 0,
        teamsInvalidLineup: 0,
        teamsMissingScoreCoverage: 0,
        warningsCount: 0,
        createdAt: "2026-11-02T12:00:00.000Z",
        updatedAt: "2026-11-02T12:00:00.000Z",
      },
    ];
    gameState.seasonState.disciplineResults = [
      {
        id: "discipline-bahn-a",
        matchdayResultId: "result-bahn-1",
        teamId: teamA!.teamId,
        disciplineId: "staffel",
        disciplineSide: "d1" as const,
        rank: 1,
        baseScore: 10,
        totalScore: 10,
        readinessStatus: "ready" as const,
        warnings: [],
        createdAt: "2026-11-02T12:01:00.000Z",
        resolutionSource: "mini_dm_pod" as const,
        pointSource: "battle_mode_mini_dm_pod_platz",
        teamPoints: 2,
        miniDmPod: { podId: "staffel-pod-test", platz: 1 as const, teamIds: podTeamIds, wert: 8, quelle: "bahn" as const, teamWert: 9.8 },
      },
    ];
    gameState.seasonState.playerDisciplinePerformances = [
      {
        id: "perf-bahn-a",
        matchdayResultId: "result-bahn-1",
        teamId: teamA!.teamId,
        playerId: playerA!.id,
        activePlayerId: playerA!.id,
        disciplineId: "staffel",
        disciplineSide: "d1" as const,
        slotIndex: 0,
        baseValue: 99,
        finalPlayerScore: 99,
        scoreContribution: 3.3,
        rankInTeam: 1,
        rankInDiscipline: 1,
        isTop10: true,
        isMvpCandidate: false,
        storyWeight: 1,
        createdAt: "2026-11-02T12:02:00.000Z",
      },
    ];
    const ledger = buildSeasonPointsLedger(gameState);
    const entry = ledger.pointEntries.find((e) => e.performanceId === "perf-bahn-a");
    expect(entry?.pointSource).toBe("battle_mode_bahn_pod_player_score");
    expect(entry?.basePoints).toBeCloseTo(3.3, 6);
  });
});

// ---------------------------------------------------------------------------------------------
// (g) Arena-Host-Hinweis
// ---------------------------------------------------------------------------------------------
describe("(g) Arena-Host-Hinweis", () => {
  function hinweisStand(quelle: "bahn" | undefined, mitAusfall: boolean): GameState {
    return {
      scenarioMeta: { gameMode: "battle" },
      matchdayState: { matchdayId: "md1" },
      seasonState: {
        disciplineSchedule: [
          {
            seasonId: "s1",
            matchdayId: "md1",
            matchdayIndex: 0,
            discipline1: { disciplineId: "staffel", displayName: "Staffel", order: 1, playerCount: 3, category: "speed" },
            discipline2: null,
          },
        ],
        matchdayResults: [{ id: "mr-md1", matchdayId: "md1" }],
        disciplineResults: [
          {
            id: "r-A",
            matchdayResultId: "mr-md1",
            teamId: "A",
            disciplineId: "staffel",
            disciplineSide: "d1",
            teamPoints: 2,
            resolutionSource: "mini_dm_pod",
            miniDmPod: { podId: "p", platz: 1, teamIds: ["A", "B", "C", "D"], wert: 8, ...(quelle ? { quelle } : {}) },
            ...(mitAusfall ? { arenaAusfall: { grund: "timeout", zeitpunkt: "x", versuch: 2 } } : {}),
          },
        ],
      },
    } as unknown as GameState;
  }
  it("Rennen gebucht: kein Hinweis; PPS-Pod-Rueckfall: Hinweis mit Grund", async () => {
    const { buildArenaHostSpielquelleHinweise } = await import("@/lib/foundation/battle-arena/arena-host-spielquelle-hinweis");
    expect(buildArenaHostSpielquelleHinweise(hinweisStand("bahn", false), "A")).toEqual([]);
    const rueckfall = buildArenaHostSpielquelleHinweise(hinweisStand(undefined, true), "A");
    expect(rueckfall).toHaveLength(1);
    expect(rueckfall[0]!.text).toContain("Rennen fiel aus");
    expect(rueckfall[0]!.text).toContain("4-Team-Gruppe per Eignungs-Score");
  });
});
