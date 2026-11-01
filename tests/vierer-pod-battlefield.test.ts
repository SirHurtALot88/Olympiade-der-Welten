/**
 * VIERER-POD-VERALLGEMEINERUNG + BATTLEFIELD ALS PPS-POD (01.11., Chris' Freigabe "eine 4er-Diszi je
 * Bereich pow/spe/men/soc"). Deckt ab:
 *   (a) Mini-DMs Pod-Seed und Pod-IDs sind BYTE-IDENTISCH zum Stand vor der Verallgemeinerung
 *       (bestehende Saves kuendigen dieselben Gruppen an, FFA-Vorlauf-Seeds bleiben gueltig).
 *   (b) Battlefield bekommt EIGENE, frisch geloste Gruppen (Seed traegt die Disziplin-ID) -- auch
 *       am selben Spieltag/Vorkommen wie Mini-DM (Chris' Entscheidung 2).
 *   (c) Nicht-Pod-Disziplinen bekommen nie Pods.
 *   (d) Resolve: Battlefield wird als Vierergruppe mit 2-1-0-0 gewertet, nicht als Zweier-Duell
 *       gegen den Fixture-Gegner; Spieler-PP bleibt rein leistungsbasiert.
 *   (e) Spieltags-Uebersicht: zwei Pod-Disziplinen am selben Spieltag (Chris: erlaubt) bekommen je
 *       Disziplin die richtige Pod-ID je Team.
 *   (f) Arena-Host-Hinweis nennt Battlefield als 4-Team-Gruppe statt PPS-Duell.
 */
import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildArenaHostSpielquelleHinweise } from "@/lib/foundation/battle-arena/arena-host-spielquelle-hinweis";
import { buildSpieltagsUebersicht, resolveSpielquelleLabel } from "@/lib/foundation/season-matchday-fixtures-overview";
import { ppAusSpielerScore, resolveSpielerPpReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { MINI_DM_POD_TEAM_PUNKTE } from "@/lib/resolve/mini-dm-pod-resolve";
import {
  buildMiniDmPodGroups,
  getMiniDmPodsForMatchday,
  getPodDisciplineSlotsForMatchday,
  getPodForTeam,
  getPodsForMatchday,
} from "@/lib/season/mini-dm-pod-schedule";
import { isViererPodDiscipline, VIERER_POD_DISCIPLINE_IDS } from "@/lib/season/season-discipline-schedule";

const SAVE_ID = "save-pod-test";
const TEAMS16 = Array.from({ length: 16 }, (_, index) => `T${index + 1}`);

function slot(disciplineId: string, displayName: string, occurrenceInSeason: 1 | 2 = 1) {
  return { disciplineId, displayName, order: 1, playerCount: 3, legacyScorePlayerCount: 3, category: "social", occurrenceInSeason };
}

/** Legacy-Pool (kein Liga-Split) aus 16 Teams, ein Spieltag mit den uebergebenen Slots. */
function buildScheduleState(d1: ReturnType<typeof slot> | null, d2: ReturnType<typeof slot> | null): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    season: { id: "s1", name: "S1", year: 1, currentMatchday: 1, matchdayIds: ["md1"] },
    disciplines: [],
    rosters: [],
    players: [],
    teams: TEAMS16.map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
    seasonState: {
      schedule: TEAMS16.filter((_, i) => i % 2 === 0).map((teamId, i) => ({
        id: `f${i}`,
        homeTeamId: teamId,
        awayTeamId: TEAMS16[TEAMS16.indexOf(teamId) + 1]!,
        matchdayId: "md1",
        status: "scheduled",
        leagueTier: null,
      })),
      disciplineSchedule: [
        { seasonId: "s1", matchdayId: "md1", matchdayIndex: 0, matchdayLabel: "Spieltag 1", discipline1: d1, discipline2: d2, sourceStatus: "season_seed", sourceNote: null },
      ],
      matchdayResults: [],
      disciplineResults: [],
    },
  } as unknown as GameState;
}

const gruppenSchluessel = (gruppen: readonly (readonly string[])[]) => gruppen.map((teamIds) => [...teamIds].sort().join(",")).sort();

describe("Vierer-Pod-Disziplinen: Konfiguration", () => {
  it("genau Mini-DM und Battlefield -- Staffel/Takeshi bewusst noch nicht", () => {
    expect([...VIERER_POD_DISCIPLINE_IDS].sort()).toEqual(["battlefield", "mini-dm"]);
    expect(isViererPodDiscipline("battlefield")).toBe(true);
    expect(isViererPodDiscipline("mini-dm")).toBe(true);
    expect(isViererPodDiscipline("staffel")).toBe(false);
    expect(isViererPodDiscipline("takeshis-castle")).toBe(false);
    expect(isViererPodDiscipline(null)).toBe(false);
  });
});

describe("getPodsForMatchday (verallgemeinerte Gruppenbildung)", () => {
  it("(a) Mini-DM: Seed und Pod-IDs byte-identisch zum Stand vor der Verallgemeinerung", () => {
    const gs = buildScheduleState(slot("mini-dm", "Mini DM", 1), null);
    const pods = getMiniDmPodsForMatchday(gs, "md1", { saveId: SAVE_ID });
    // Der alte, unveraenderte Seed-String (mini-dm-pod-schedule.ts vor 01.11.).
    const erwartet = buildMiniDmPodGroups(TEAMS16, `${SAVE_ID}:s1:mini-dm-pods-v1:legacy-pool:occurrence-1`);
    expect(pods.map((pod) => pod.teamIds)).toEqual(erwartet);
    expect(pods.map((pod) => pod.id)).toEqual([0, 1, 2, 3].map((i) => `minidm-pod:s1:legacy-pool:md1:${i}`));
    expect(pods.every((pod) => pod.disciplineId === "mini-dm")).toBe(true);
    expect(getPodsForMatchday(gs, "md1", "mini-dm", { saveId: SAVE_ID })).toEqual(pods);
  });

  it("(b) Battlefield: eigene Pods (vier Vierer, alle 16 Teams), eigene ID, Disziplin-ID im Seed", () => {
    const gs = buildScheduleState(slot("battlefield", "Battlefield", 1), null);
    const pods = getPodsForMatchday(gs, "md1", "battlefield", { saveId: SAVE_ID });
    expect(pods).toHaveLength(4);
    expect(new Set(pods.flatMap((pod) => pod.teamIds)).size).toBe(16);
    expect(pods.every((pod) => pod.teamIds.length === 4 && pod.disciplineId === "battlefield")).toBe(true);
    expect(pods.map((pod) => pod.id)).toEqual([0, 1, 2, 3].map((i) => `battlefield-pod:s1:legacy-pool:md1:${i}`));
    const erwartet = buildMiniDmPodGroups(TEAMS16, `${SAVE_ID}:s1:battlefield-pods-v1:legacy-pool:occurrence-1`);
    expect(pods.map((pod) => pod.teamIds)).toEqual(erwartet);
    // Mini-DM-Wrapper sieht an diesem Spieltag nichts -- Battlefield ist nicht Mini-DM.
    expect(getMiniDmPodsForMatchday(gs, "md1", { saveId: SAVE_ID })).toEqual([]);
  });

  it("(b) Mini-DM und Battlefield am SELBEN Spieltag und Vorkommen: verschiedene Gruppen (frisch gelost je Disziplin)", () => {
    const gs = buildScheduleState(slot("mini-dm", "Mini DM", 1), slot("battlefield", "Battlefield", 1));
    const miniDm = getPodsForMatchday(gs, "md1", "mini-dm", { saveId: SAVE_ID });
    const battlefield = getPodsForMatchday(gs, "md1", "battlefield", { saveId: SAVE_ID });
    expect(miniDm).toHaveLength(4);
    expect(battlefield).toHaveLength(4);
    expect(gruppenSchluessel(miniDm.map((pod) => pod.teamIds))).not.toEqual(gruppenSchluessel(battlefield.map((pod) => pod.teamIds)));
    expect(new Set([...miniDm, ...battlefield].map((pod) => pod.id)).size).toBe(8);
    expect(getPodDisciplineSlotsForMatchday(gs, "md1", { saveId: SAVE_ID })).toEqual([
      { disciplineId: "mini-dm", displayName: "Mini DM", disciplineSide: "d1" },
      { disciplineId: "battlefield", displayName: "Battlefield", disciplineSide: "d2" },
    ]);
    // Das Team steckt in beiden Disziplinen in je einem Pod.
    expect(getPodForTeam(gs, "T1", "md1", "mini-dm", { saveId: SAVE_ID })?.disciplineId).toBe("mini-dm");
    expect(getPodForTeam(gs, "T1", "md1", "battlefield", { saveId: SAVE_ID })?.disciplineId).toBe("battlefield");
  });

  it("(b) Battlefield: zweites Saison-Vorkommen wuerfelt neu", () => {
    const erstes = getPodsForMatchday(buildScheduleState(slot("battlefield", "Battlefield", 1), null), "md1", "battlefield", { saveId: SAVE_ID });
    const zweites = getPodsForMatchday(buildScheduleState(slot("battlefield", "Battlefield", 2), null), "md1", "battlefield", { saveId: SAVE_ID });
    expect(gruppenSchluessel(erstes.map((pod) => pod.teamIds))).not.toEqual(gruppenSchluessel(zweites.map((pod) => pod.teamIds)));
  });

  it("(c) Nicht-Pod-Disziplin oder Disziplin nicht am Spieltag: keine Pods", () => {
    const gs = buildScheduleState(slot("staffel", "Staffel", 1), slot("battlefield", "Battlefield", 1));
    expect(getPodsForMatchday(gs, "md1", "staffel", { saveId: SAVE_ID })).toEqual([]);
    expect(getPodsForMatchday(gs, "md1", "mini-dm", { saveId: SAVE_ID })).toEqual([]);
    expect(getPodDisciplineSlotsForMatchday(gs, "md1", { saveId: SAVE_ID }).map((s) => s.disciplineId)).toEqual(["battlefield"]);
  });
});

// ---------------------------------------------------------------------------------------------
// (d) Resolve-Integration, nach dem Muster von tests/mini-dm-pod-resolve-engine-integration.test.ts
// ---------------------------------------------------------------------------------------------
const BATTLEFIELD = "battlefield";

function createContext(input: { teamId: string; scores: number[]; gameState: GameState }): LegacyLineupLoadedContext {
  const entries = input.scores.map((_, index) => ({
    disciplineId: BATTLEFIELD,
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
    disciplinePlayerCounts: { [BATTLEFIELD]: input.scores.length },
    activePlayers: entries.map((entry) => ({ id: entry.activePlayerId, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, playerId: entry.playerId })),
    disciplineScores: input.scores.map((score, index) => ({ playerId: `${input.teamId}-p${index}`, disciplineId: BATTLEFIELD, score })),
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamId },
    teamSeasonState: { id: `tss-${input.teamId}`, saveId: "save-1", seasonId: "season-1", teamId: input.teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [{ id: BATTLEFIELD, name: "Battlefield", category: "social" }],
    disciplineWeights: [],
    seasonDisciplineConfigs: [{ disciplineId: BATTLEFIELD, originalOrder: 1, displayOrder: 1, playerCount: input.scores.length, mutator1: null, mutator2: null }],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: { d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null }, d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null } },
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    },
    contextMeta: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1", teamId: input.teamId, d1DisciplineId: BATTLEFIELD, d2DisciplineId: null },
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

/** Fixtures A-C / B-D -- bewusst QUER zur Pod-Gruppe {A,B,C,D}, wie im Mini-DM-Integrationstest. */
function buildResolveGameState(): GameState {
  return {
    scenarioMeta: { gameMode: "battle" },
    rosters: [],
    players: [],
    teams: ["A", "B", "C", "D"].map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    disciplines: [{ id: BATTLEFIELD, name: "Battlefield", category: "social", weight: 1, playerCount: 2 }],
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
          discipline1: { disciplineId: BATTLEFIELD, displayName: "Battlefield", order: 1, playerCount: 2, category: "social", occurrenceInSeason: 1 },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
    },
  } as unknown as GameState;
}

describe("(d) Battlefield-Resolve als Vierergruppe (legacy-matchday-resolve-engine.ts)", () => {
  it("bucht die vier Teams als EINEN Pod mit 2-1-0-0 nach PPS-Score, nicht als Duell gegen den Fixture-Gegner", () => {
    const gs = buildResolveGameState();
    const contexts = [
      createContext({ teamId: "A", scores: [100, 90], gameState: gs }), // 190
      createContext({ teamId: "B", scores: [20, 10], gameState: gs }), // 30
      createContext({ teamId: "C", scores: [50, 40], gameState: gs }), // 90
      createContext({ teamId: "D", scores: [80, 70], gameState: gs }), // 150
    ];
    const preview = buildLegacyMatchdayResolvePreview(contexts);
    const bf = preview.disciplinePreviews.find((entry) => entry.disciplineId === BATTLEFIELD)!;
    const byTeam = new Map(bf.teamResults.map((result) => [result.teamId, result]));
    expect(byTeam.size).toBe(4);

    expect([...["A", "D", "C", "B"]].map((t) => byTeam.get(t)!.miniDmPod?.platz)).toEqual([1, 2, 3, 4]);
    expect([...["A", "D", "C", "B"]].map((t) => byTeam.get(t)!.teamPoints)).toEqual([...MINI_DM_POD_TEAM_PUNKTE]);
    expect([...byTeam.values()].reduce((s, r) => s + (r.teamPoints ?? 0), 0)).toBe(3);
    expect([...byTeam.values()].reduce((s, r) => s + (r.verhaeltnis ?? 0), 0)).toBe(0);
    for (const result of byTeam.values()) {
      expect(result.resolutionSource).toBe("mini_dm_pod");
      expect(result.pointSource).toBe("battle_mode_mini_dm_pod_platz");
      expect(result.opponentTeamId).toBeNull();
      expect(result.miniDmPod!.podId.startsWith("battlefield-pod:")).toBe(true);
      expect(new Set(result.miniDmPod!.teamIds)).toEqual(new Set(["A", "B", "C", "D"]));
      // Kein FFA-Pfad fuer Battlefield -- reiner PPS-Pod.
      expect(result.miniDmPod!.quelle).toBeUndefined();
      expect(result.warnings.some((w) => w.startsWith("battle_mode_ohne_duell"))).toBe(false);
    }

    // Spieler-PP rein leistungsbasiert (dieselbe Kurve wie PPS-Duell, Battlefield-Referenz).
    const referenz = resolveSpielerPpReferenz(BATTLEFIELD, 2);
    for (const result of bf.teamResults) {
      for (const entry of result.entries) {
        expect(entry.pointsAwarded).toBe(ppAusSpielerScore(entry.finalPlayerScore ?? 0, referenz));
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// (e) Spieltags-Uebersicht mit zwei Pod-Disziplinen am selben Spieltag
// ---------------------------------------------------------------------------------------------
describe("(e) buildSpieltagsUebersicht: Mini-DM UND Battlefield am selben Spieltag", () => {
  it("baut je Disziplin eigene Pods, und jede Paarungszeile verweist je Disziplin auf den richtigen Pod", () => {
    const gs = buildScheduleState(slot("mini-dm", "Mini DM", 1), slot("battlefield", "Battlefield", 1));
    const uebersicht = buildSpieltagsUebersicht(gs, "md1", { saveId: SAVE_ID })!;
    expect(uebersicht.miniDmPods).toHaveLength(8);
    expect(uebersicht.miniDmPods.filter((pod) => pod.disciplineId === "mini-dm")).toHaveLength(4);
    expect(uebersicht.miniDmPods.filter((pod) => pod.disciplineId === "battlefield")).toHaveLength(4);

    const podById = new Map(uebersicht.miniDmPods.map((pod) => [pod.podId, pod]));
    for (const paarung of uebersicht.paarungen) {
      for (const disziplin of paarung.disziplinen) {
        for (const [podId, teamId] of [
          [disziplin.miniDmPodIdHeim, paarung.homeTeamId],
          [disziplin.miniDmPodIdGast, paarung.awayTeamId],
        ] as const) {
          expect(podId).not.toBeNull();
          const pod = podById.get(podId!)!;
          expect(pod.disciplineId).toBe(disziplin.disciplineId);
          expect(pod.mitglieder.some((m) => m.teamId === teamId)).toBe(true);
        }
      }
    }
  });

  it("gewertete Battlefield-Pod-Zeilen: disziplinneutrale Quellen-Beschriftung", () => {
    expect(resolveSpielquelleLabel({ gespielt: true, resolutionSource: "mini_dm_pod", arenaAusfall: null })).toBe("4-Team-Pod");
  });

  it("gewertet: Battlefield-Gruppen kommen aus den gebuchten Zeilen", () => {
    const gs = buildScheduleState(slot("battlefield", "Battlefield", 1), null);
    const pods = getPodsForMatchday(gs, "md1", "battlefield", { saveId: SAVE_ID });
    gs.seasonState.matchdayResults = [{ id: "mr-md1", matchdayId: "md1" }] as never;
    gs.seasonState.disciplineResults = pods.flatMap((pod) =>
      pod.teamIds.map(
        (teamId, index) =>
          ({
            id: `r-${teamId}`,
            matchdayResultId: "mr-md1",
            teamId,
            disciplineId: "battlefield",
            disciplineSide: "d1",
            teamPoints: [2, 1, 0, 0][index]!,
            resolutionSource: "mini_dm_pod",
            miniDmPod: { podId: pod.id, platz: (index + 1) as 1 | 2 | 3 | 4, teamIds: pod.teamIds, wert: 8 - 2 * index },
          }) as unknown as DisciplineResultRecord,
      ),
    );
    const uebersicht = buildSpieltagsUebersicht(gs, "md1")!;
    expect(uebersicht.miniDmPods).toHaveLength(4);
    for (const pod of uebersicht.miniDmPods) {
      expect(pod.disciplineId).toBe("battlefield");
      expect(pod.gespielt).toBe(true);
      expect(pod.mitglieder.map((m) => m.teamPoints)).toEqual([2, 1, 0, 0]);
    }
  });
});

describe("(f) Arena-Host-Hinweis", () => {
  it("Battlefield: 'als 4-Team-Gruppe (Pod) gewertet' statt 'per PPS-Duell'", () => {
    const gs = {
      scenarioMeta: { gameMode: "battle" },
      matchdayState: { matchdayId: "md1" },
      seasonState: {
        disciplineSchedule: [
          {
            seasonId: "s1",
            matchdayId: "md1",
            matchdayIndex: 0,
            discipline1: { disciplineId: "battlefield", displayName: "Battlefield", order: 1, playerCount: 2, category: "social" },
            discipline2: { disciplineId: "hockey", displayName: "Hockey", order: 2, playerCount: 2, category: "power" },
          },
        ],
        matchdayResults: [],
        disciplineResults: [],
      },
    } as unknown as GameState;
    const hinweise = buildArenaHostSpielquelleHinweise(gs, "A");
    expect(hinweise.find((h) => h.disciplineId === "battlefield")!.text).toBe("wird in dieser Saison als 4-Team-Gruppe (Pod) gewertet, nicht per Arena");
    expect(hinweise.find((h) => h.disciplineId === "hockey")!.text).toBe("wird in dieser Saison per PPS-Duell gewertet, nicht per Arena");
  });
});
