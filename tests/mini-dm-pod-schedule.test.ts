/**
 * MINI-DM-VIERERGRUPPEN (mini-dm-spielplan-verankerung, 14.09.) — Abnahme fuer
 * lib/season/mini-dm-pod-schedule.ts.
 *
 * Deckt genau das ab, was die Umsetzungsrunde fordert:
 *   (a) ein Mini-DM-Spieltag liefert IMMER Pods aus genau 4 Teams (nie mehr, nie weniger).
 *   (b) das zweite Saison-Vorkommen wuerfelt neu -- andere Gruppierungen als das erste.
 *   (c) additiv: `Fixture`/`RoundPairing` bleiben unberuehrt (dieses Modul liest sie nicht,
 *       schreibt nichts in `seasonState.schedule`).
 *   (d) Determinismus, Nicht-Mini-DM-Spieltage, Legacy-32er-Pool ohne Liga-Split, bewusst
 *       ausgelassener Rest bei einer nicht durch 4 teilbaren Teamzahl.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildMiniDmPodGroups,
  getMiniDmPodForTeam,
  getMiniDmPodsForMatchday,
} from "@/lib/season/mini-dm-pod-schedule";

function buildLeagueTeamIds(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function buildGameStateWithLeagueSplit(input: {
  miniDmMatchdayId: string | null;
  miniDmOccurrence?: 1 | 2;
  otherMiniDmMatchdayId?: string | null;
  otherMiniDmOccurrence?: 1 | 2;
  liga1TeamIds?: string[];
  liga2TeamIds?: string[];
}): GameState {
  const liga1TeamIds = input.liga1TeamIds ?? buildLeagueTeamIds("liga1-team", 16);
  const liga2TeamIds = input.liga2TeamIds ?? buildLeagueTeamIds("liga2-team", 16);
  const leagueByTeamId: Record<string, "liga1" | "liga2"> = {};
  for (const teamId of liga1TeamIds) leagueByTeamId[teamId] = "liga1";
  for (const teamId of liga2TeamIds) leagueByTeamId[teamId] = "liga2";

  const entries = [];
  if (input.miniDmMatchdayId) {
    entries.push({
      seasonId: "season-x",
      matchdayId: input.miniDmMatchdayId,
      matchdayIndex: 1,
      matchdayLabel: "Spieltag 1",
      discipline1: {
        disciplineId: "mini-dm",
        displayName: "Mini DM",
        order: 1,
        playerCount: 1,
        category: "power",
        occurrenceInSeason: input.miniDmOccurrence ?? 1,
      },
      discipline2: null,
      sourceStatus: "season_seed",
      sourceNote: null,
    });
  }
  if (input.otherMiniDmMatchdayId) {
    entries.push({
      seasonId: "season-x",
      matchdayId: input.otherMiniDmMatchdayId,
      matchdayIndex: 2,
      matchdayLabel: "Spieltag 2",
      discipline1: {
        disciplineId: "mini-dm",
        displayName: "Mini DM",
        order: 1,
        playerCount: 1,
        category: "power",
        occurrenceInSeason: input.otherMiniDmOccurrence ?? 2,
      },
      discipline2: null,
      sourceStatus: "season_seed",
      sourceNote: null,
    });
  }
  // Ein Nicht-Mini-DM-Spieltag, damit "kein Mini-DM hier" auch tatsaechlich geprueft wird.
  entries.push({
    seasonId: "season-x",
    matchdayId: "matchday-ohne-minidm",
    matchdayIndex: 3,
    matchdayLabel: "Spieltag 3",
    discipline1: { disciplineId: "hockey", displayName: "Hockey", order: 2, playerCount: 5, category: "power" },
    discipline2: null,
    sourceStatus: "season_seed",
    sourceNote: null,
  });

  return {
    season: { id: "season-x", name: "Season X", year: 1, currentMatchday: 1, matchdayIds: entries.map((e) => e.matchdayId) },
    seasonState: {
      seasonId: "season-x",
      schedule: [],
      disciplineSchedule: entries,
      leagueByTeamId,
      standings: {},
    },
    matchdayState: { matchdayId: entries[0]?.matchdayId, status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    disciplines: [
      { id: "mini-dm", name: "Mini DM", category: "power", weight: 1, playerCount: 2 },
      { id: "hockey", name: "Hockey", category: "power", weight: 1, playerCount: 5 },
    ],
    teams: [...liga1TeamIds, ...liga2TeamIds].map((teamId) => ({ teamId, name: teamId, shortCode: teamId.slice(0, 3) })),
  } as unknown as GameState;
}

describe("buildMiniDmPodGroups (reine Funktion)", () => {
  it("teilt 16 Team-IDs restlos in vier Vierer-Pods", () => {
    const teamIds = buildLeagueTeamIds("t", 16);
    const pods = buildMiniDmPodGroups(teamIds, "seed-a");
    expect(pods).toHaveLength(4);
    for (const pod of pods) {
      expect(pod).toHaveLength(4);
    }
    const allTeamsInPods = pods.flat();
    expect(new Set(allTeamsInPods).size).toBe(16);
    expect([...allTeamsInPods].sort()).toEqual([...teamIds].sort());
  });

  it("ist deterministisch fuer denselben Seed", () => {
    const teamIds = buildLeagueTeamIds("t", 16);
    const first = buildMiniDmPodGroups(teamIds, "seed-stabil");
    const second = buildMiniDmPodGroups(teamIds, "seed-stabil");
    expect(second).toEqual(first);
  });

  it("liefert unterschiedliche Gruppierungen fuer unterschiedliche Seeds (Reshuffle-Mechanismus)", () => {
    const teamIds = buildLeagueTeamIds("t", 16);
    const occurrence1 = buildMiniDmPodGroups(teamIds, "occurrence-1");
    const occurrence2 = buildMiniDmPodGroups(teamIds, "occurrence-2");
    // "Anders" heisst hier: mindestens ein Pod aus Vorkommen 1 taucht NICHT identisch (als
    // Menge) in Vorkommen 2 wieder auf -- der Mechanismus wuerfelt neu, statt denselben Satz
    // Vierergruppen zu wiederholen (Chris' Entscheidung 2). Kein statistischer Beweis noetig,
    // nur dass der Mechanismus selbst reshuffelt.
    const setsOf = (pods: string[][]) => pods.map((pod) => [...pod].sort().join(","));
    const occurrence1Sets = new Set(setsOf(occurrence1));
    const occurrence2Sets = setsOf(occurrence2);
    const anyIdentical = occurrence2Sets.some((set) => occurrence1Sets.has(set));
    expect(anyIdentical, "mindestens ein Pod sollte sich zwischen den Seeds unterscheiden").toBe(false);
  });

  it("laesst einen nicht durch 4 teilbaren Rest bewusst aussen vor, ohne zu werfen", () => {
    const teamIds = buildLeagueTeamIds("t", 15);
    const pods = buildMiniDmPodGroups(teamIds, "seed-rest");
    // floor(15/2) = 7 Paare -> 3 volle Pods (Paare 0-1, 2-3, 4-5), Paar 6 bleibt ungenutzt.
    expect(pods).toHaveLength(3);
    for (const pod of pods) {
      expect(pod).toHaveLength(4);
    }
    expect(new Set(pods.flat()).size).toBe(12);
  });

  it("liefert nichts fuer weniger als 4 Team-IDs", () => {
    expect(buildMiniDmPodGroups(["a", "b", "c"], "seed")).toEqual([]);
  });
});

describe("getMiniDmPodsForMatchday", () => {
  it("(a) liefert an einem Mini-DM-Spieltag ausschliesslich Pods aus genau 4 Teams", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    const pods = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    // 16 Teams je Liga, 2 Ligen -> 4 Pods je Liga = 8 Pods insgesamt.
    expect(pods).toHaveLength(8);
    for (const pod of pods) {
      expect(pod.teamIds).toHaveLength(4);
      expect(new Set(pod.teamIds).size).toBe(4);
      expect(pod.matchdayId).toBe("matchday-minidm");
      expect(pod.seasonId).toBe("season-x");
    }
    // Jedes Team seiner Liga kommt in GENAU einem Pod vor -- keine Doppelbuchung, kein
    // verschwundenes Team.
    const allTeamIds = pods.flatMap((pod) => pod.teamIds);
    expect(new Set(allTeamIds).size).toBe(32);
  });

  it("gruppiert nur innerhalb derselben Liga (kein Pod mischt liga1 und liga2)", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    const pods = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    for (const pod of pods) {
      expect(new Set(pod.teamIds.map((teamId) => (teamId.startsWith("liga1") ? "liga1" : "liga2"))).size).toBe(1);
    }
  });

  it("liefert eine leere Liste an einem Spieltag ohne Mini-DM", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    expect(getMiniDmPodsForMatchday(gameState, "matchday-ohne-minidm")).toEqual([]);
  });

  it("liefert eine leere Liste fuer einen unbekannten Spieltag", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    expect(getMiniDmPodsForMatchday(gameState, "nie-gesehener-spieltag")).toEqual([]);
  });

  it("ist deterministisch bei wiederholtem Aufruf (dieselben Pods, kein Neuwuerfeln je Render)", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    const first = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    const second = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    expect(second.map((p) => p.teamIds)).toEqual(first.map((p) => p.teamIds));
  });

  it("(b) das zweite Saison-Vorkommen wuerfelt neu -- andere Gruppierung als das erste", () => {
    const gameState = buildGameStateWithLeagueSplit({
      miniDmMatchdayId: "matchday-vorkommen-1",
      miniDmOccurrence: 1,
      otherMiniDmMatchdayId: "matchday-vorkommen-2",
      otherMiniDmOccurrence: 2,
    });
    const occurrence1Pods = getMiniDmPodsForMatchday(gameState, "matchday-vorkommen-1");
    const occurrence2Pods = getMiniDmPodsForMatchday(gameState, "matchday-vorkommen-2");
    expect(occurrence1Pods).toHaveLength(8);
    expect(occurrence2Pods).toHaveLength(8);

    const setsOf = (pods: typeof occurrence1Pods) => new Set(pods.map((pod) => [...pod.teamIds].sort().join(",")));
    const occurrence1Sets = setsOf(occurrence1Pods);
    const occurrence2Sets = [...setsOf(occurrence2Pods)];
    const anyIdenticalGrouping = occurrence2Sets.some((set) => occurrence1Sets.has(set));
    expect(anyIdenticalGrouping, "Vorkommen 2 sollte NICHT dieselben Vierergruppen wie Vorkommen 1 reproduzieren").toBe(
      false,
    );
  });

  it("bildet im Legacy-32er-Modus (kein Liga-Split) einen einzigen Pool aus allen Teams", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    // Liga-Split deaktivieren: leeres leagueByTeamId.
    (gameState.seasonState as { leagueByTeamId?: Record<string, string> }).leagueByTeamId = {};
    const pods = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    expect(pods).toHaveLength(8); // 32 Teams / 4 = 8 Pods, EIN Pool statt zwei Liga-Pools.
    for (const pod of pods) {
      expect(pod.leagueTier).toBeNull();
    }
    expect(new Set(pods.flatMap((pod) => pod.teamIds)).size).toBe(32);
  });
});

describe("getMiniDmPodForTeam", () => {
  it("findet den Pod, der ein bestimmtes Team enthaelt", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    const allPods = getMiniDmPodsForMatchday(gameState, "matchday-minidm");
    const someTeamId = allPods[0]!.teamIds[0]!;
    const pod = getMiniDmPodForTeam(gameState, someTeamId, "matchday-minidm");
    expect(pod).not.toBeNull();
    expect(pod!.teamIds).toContain(someTeamId);
  });

  it("liefert null, wenn kein Pod existiert", () => {
    const gameState = buildGameStateWithLeagueSplit({ miniDmMatchdayId: "matchday-minidm" });
    expect(getMiniDmPodForTeam(gameState, "liga1-team-1", "matchday-ohne-minidm")).toBeNull();
    expect(getMiniDmPodForTeam(gameState, "team-nicht-im-save", "matchday-minidm")).toBeNull();
  });
});
