/**
 * SPIELTAGSMODELL-KOPPLUNG (11.11., Chris' Meldung zu "Gruppe D"): an einem Spieltag mit einer
 * Vierer-Pod-Disziplin (Battlefield, Mini-DM, Staffel, Takeshi's Castle) und einer Duell-Disziplin
 * muss der Duell-Gegner eines Teams aus seiner Vierergruppe kommen, und die beiden uebrigen
 * Gruppenmitglieder spielen das Duell gegeneinander.
 *
 * Vorher: Pods kamen aus einer eigenen, vom Spielplan unabhaengigen Permutation
 * (`mini-dm-pod-schedule.ts`), Duell-Gegner aus `seasonState.schedule` -- beides passte nur zufaellig.
 */
import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState, MatchdayResultRecord } from "@/lib/data/olyDataTypes";
import {
  buildPodGroupsFromFixturePairs,
  getPodsForMatchday,
  getSpieltagsGegnerFuerTeam,
} from "@/lib/season/mini-dm-pod-schedule";
import { buildSeasonFixtureSchedule, getOpponentOf } from "@/lib/season/season-fixture-schedule";

const POD_DISZIS = ["battlefield", "mini-dm", "staffel", "takeshis-castle"] as const;

function teamIds(prefix: string) {
  return Array.from({ length: 16 }, (_, index) => `${prefix}-${index + 1}`);
}

type SlotPlan = { d1: string; d2: string | null; occurrence?: 1 | 2 };

function buildSave(input: { saveId: string; matchdayCount: number; slots: (index: number) => SlotPlan }): GameState {
  const liga1 = teamIds("l1");
  const liga2 = teamIds("l2");
  const leagueByTeamId: Record<string, "liga1" | "liga2"> = {};
  for (const id of liga1) leagueByTeamId[id] = "liga1";
  for (const id of liga2) leagueByTeamId[id] = "liga2";
  const matchdayIds = Array.from({ length: input.matchdayCount }, (_, index) => `md-${index + 1}`);
  const { fixtures } = buildSeasonFixtureSchedule({
    saveId: input.saveId,
    seasonId: "season-k",
    matchdayIds,
    leagueTeamIds: { liga1, liga2 },
  });
  const slot = (disciplineId: string, order: number, occurrence: 1 | 2) => ({
    disciplineId,
    displayName: disciplineId,
    order,
    playerCount: 3,
    category: "power",
    occurrenceInSeason: occurrence,
  });
  const disciplineSchedule = matchdayIds.map((matchdayId, index) => {
    const plan = input.slots(index);
    return {
      seasonId: "season-k",
      matchdayId,
      matchdayIndex: index + 1,
      matchdayLabel: `Spieltag ${index + 1}`,
      discipline1: slot(plan.d1, 1, plan.occurrence ?? 1),
      discipline2: plan.d2 ? slot(plan.d2, 2, plan.occurrence ?? 1) : null,
      sourceStatus: "season_seed",
      sourceNote: null,
    };
  });
  return {
    season: { id: "season-k", name: "Season K", year: 1, currentMatchday: 1, matchdayIds },
    seasonState: {
      seasonId: "season-k",
      schedule: fixtures,
      disciplineSchedule,
      leagueByTeamId,
      standings: {},
      matchdayResults: [],
      disciplineResults: [],
    },
    matchdayState: { matchdayId: matchdayIds[0], status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    disciplines: [...POD_DISZIS, "hockey", "basketball"].map((id) => ({ id, name: id, category: "power", weight: 1, playerCount: 3 })),
    teams: [...liga1, ...liga2].map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
  } as unknown as GameState;
}

function assertKopplung(gameState: GameState, matchdayId: string, podDisciplineId: string, saveId: string) {
  const pods = getPodsForMatchday(gameState, matchdayId, podDisciplineId, { saveId });
  expect(pods).toHaveLength(8);
  for (const pod of pods) {
    for (const teamId of pod.teamIds) {
      const gruppenmitglieder = pod.teamIds.filter((id) => id !== teamId);
      const gegner = getOpponentOf(gameState, teamId, matchdayId);
      expect(gegner, `${teamId} @ ${matchdayId}: Duell-Gegner muss in der ${podDisciplineId}-Gruppe stehen`).not.toBeNull();
      expect(gruppenmitglieder).toContain(gegner);
      const uebrige = gruppenmitglieder.filter((id) => id !== gegner);
      expect(uebrige).toHaveLength(2);
      expect(getOpponentOf(gameState, uebrige[0]!, matchdayId)).toBe(uebrige[1]);
    }
  }
}

describe("Spieltagsmodell: Vierergruppe und Duell-Paarung desselben Spieltags sind gekoppelt", () => {
  for (const saveId of ["save-a", "save-b", "save-c"]) {
    it(`gilt an JEDEM Pod-Spieltag einer 20-Spieltage-Saison (${saveId}, alle vier Pod-Disziplinen)`, () => {
      const gameState = buildSave({
        saveId,
        matchdayCount: 20,
        slots: (index) => ({ d1: POD_DISZIS[index % 4]!, d2: index % 2 === 0 ? "hockey" : "basketball", occurrence: index < 10 ? 1 : 2 }),
      });
      for (let index = 0; index < 20; index += 1) {
        assertKopplung(gameState, `md-${index + 1}`, POD_DISZIS[index % 4]!, saveId);
      }
    });
  }

  it("gilt auch, wenn die Pod-Disziplin in D2 steht und die Duell-Disziplin in D1", () => {
    const gameState = buildSave({ saveId: "save-d2", matchdayCount: 10, slots: () => ({ d1: "hockey", d2: "battlefield" }) });
    for (let index = 0; index < 10; index += 1) {
      assertKopplung(gameState, `md-${index + 1}`, "battlefield", "save-d2");
    }
  });

  it("rotiert ueber die Saison: die Gruppen wechseln von Spieltag zu Spieltag", () => {
    const gameState = buildSave({ saveId: "save-rot", matchdayCount: 10, slots: () => ({ d1: "battlefield", d2: "hockey" }) });
    const gruppenJeSpieltag = Array.from({ length: 10 }, (_, index) =>
      new Set(getPodsForMatchday(gameState, `md-${index + 1}`, "battlefield", { saveId: "save-rot" }).map((pod) => [...pod.teamIds].sort().join(","))),
    );
    for (let index = 1; index < 10; index += 1) {
      const wiederholt = [...gruppenJeSpieltag[index]!].filter((key) => gruppenJeSpieltag[index - 1]!.has(key));
      expect(wiederholt, `md-${index + 1} wiederholt keine Gruppe von md-${index}`).toEqual([]);
    }
  });

  it("Vorkommen 2 auf demselben Paar-Satz (Hin-/Rueckrunde) teilt keine Gruppe mit Vorkommen 1", () => {
    const pairs: Array<[string, string]> = Array.from({ length: 8 }, (_, index) => [`t${2 * index}`, `t${2 * index + 1}`]);
    const keys = (pods: string[][]) => pods.map((pod) => [...pod].sort().join(","));
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      const v1 = new Set(keys(buildPodGroupsFromFixturePairs(pairs, seed, 1)));
      const v2 = keys(buildPodGroupsFromFixturePairs([...pairs].reverse(), seed, 2));
      expect(v2.filter((key) => v1.has(key))).toEqual([]);
      for (const pod of buildPodGroupsFromFixturePairs(pairs, seed, 2)) {
        // Jeder Pod besteht weiterhin aus genau zwei vollstaendigen Paaren.
        expect(pairs.filter(([a, b]) => pod.includes(a) && pod.includes(b))).toHaveLength(2);
      }
    }
  });

  it("ein bereits gewerteter Spieltag behaelt seine gebuchten Gruppen", () => {
    const gameState = buildSave({ saveId: "save-g", matchdayCount: 10, slots: () => ({ d1: "battlefield", d2: "hockey" }) });
    const gebuchteGruppe = ["l1-1", "l1-2", "l1-3", "l1-4"] as const;
    gameState.seasonState.matchdayResults = [
      { id: "mr-1", saveId: "save-g", seasonId: "season-k", matchdayId: "md-1", status: "preview_applied" } as MatchdayResultRecord,
    ];
    gameState.seasonState.disciplineResults = gebuchteGruppe.map(
      (teamId, index) =>
        ({
          matchdayResultId: "mr-1",
          teamId,
          disciplineId: "battlefield",
          miniDmPod: { podId: "battlefield-pod:season-k:liga1:md-1:0", platz: (index + 1) as 1 | 2 | 3 | 4, teamIds: gebuchteGruppe, wert: 5 },
        }) as unknown as DisciplineResultRecord,
    );
    const pods = getPodsForMatchday(gameState, "md-1", "battlefield", { saveId: "save-g" });
    expect(pods.map((pod) => pod.teamIds)).toEqual([[...gebuchteGruppe]]);
    expect(pods[0]!.leagueTier).toBe("liga1");
    // Ein verworfenes Ergebnis zaehlt nicht als Buchung.
    gameState.seasonState.matchdayResults[0]!.status = "superseded";
    expect(getPodsForMatchday(gameState, "md-1", "battlefield", { saveId: "save-g" })).toHaveLength(8);
  });
});

describe("getSpieltagsGegnerFuerTeam (Gegner des Spieltags je Disziplin, fuer die Einsatzliste)", () => {
  it("liefert je Slot die Vierergruppe bzw. den Duell-Gegner -- und der Duell-Gegner steht in der Gruppe", () => {
    const gameState = buildSave({ saveId: "save-e", matchdayCount: 10, slots: () => ({ d1: "battlefield", d2: "hockey" }) });
    const gegner = getSpieltagsGegnerFuerTeam(gameState, "l1-5", "md-3", { saveId: "save-e" });
    expect(gegner.map((slot) => [slot.disciplineSide, slot.art])).toEqual([
      ["d1", "pod"],
      ["d2", "duell"],
    ]);
    expect(gegner[0]!.gegnerTeamIds).toHaveLength(3);
    expect(gegner[0]!.gegnerTeamIds).not.toContain("l1-5");
    expect(gegner[1]!.gegnerTeamIds).toHaveLength(1);
    expect(gegner[0]!.gegnerTeamIds).toContain(gegner[1]!.gegnerTeamIds[0]);
  });

  it("liefert an einem reinen Duell-Spieltag zwei Duell-Slots mit demselben Gegner", () => {
    const gameState = buildSave({ saveId: "save-e2", matchdayCount: 10, slots: () => ({ d1: "hockey", d2: "basketball" }) });
    const gegner = getSpieltagsGegnerFuerTeam(gameState, "l2-7", "md-2", { saveId: "save-e2" });
    expect(gegner.map((slot) => slot.art)).toEqual(["duell", "duell"]);
    expect(gegner[0]!.gegnerTeamIds).toEqual(gegner[1]!.gegnerTeamIds);
    expect(gegner[0]!.gegnerTeamIds[0]).toBe(getOpponentOf(gameState, "l2-7", "md-2"));
  });
});
