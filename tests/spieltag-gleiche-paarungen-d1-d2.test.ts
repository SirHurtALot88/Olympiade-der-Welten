/**
 * EIN SPIELTAG, EINE PAARUNG (21.11., Chris: „Die 2. Disziplin eines Spieltags findet mit anderen
 * Teams statt als die erste — bekannter Bug.“).
 *
 * Regel (docs/design/spielplan-raenge-fix-21-11.md Abschnitt 1):
 *  - Duell + Duell: beide Disziplinen gegen denselben Gegner (die Spieltags-Paarung aus `schedule`).
 *  - Pod + Duell: der Duell-Gegner steht in der Vierergruppe (Spieltagsmodell-Kopplung 11.11.).
 *  - Pod + Pod: BEIDE Disziplinen in denselben Vierergruppen. Leitdisziplin ist D1; vorher loste jede
 *    Pod-Disziplin mit ihrer eigenen Disziplin-ID im Seed — im Live-Save hatten an Spieltag 2
 *    (Battlefield + Mini-DM) 28 von 32 und an Spieltag 10 (Takeshi + Staffel) 32 von 32 Teams in D2
 *    eine andere Gruppe als in D1.
 * Kurz: die kleinere Gegnermenge eines Teams ist immer in der größeren enthalten.
 */
import { describe, expect, it } from "vitest";

import type { DisciplineResultRecord, GameState, MatchdayResultRecord } from "@/lib/data/olyDataTypes";
import { buildPodGroupsFromFixturePairs, getPodsForMatchday, getSpieltagsGegnerFuerTeam } from "@/lib/season/mini-dm-pod-schedule";
import { buildSeasonFixtureSchedule } from "@/lib/season/season-fixture-schedule";

const POD = ["battlefield", "mini-dm", "staffel", "takeshis-castle"] as const;
const DUELL = ["hockey", "basketball", "tennis", "eiskunstlauf"] as const;

type SlotPlan = { d1: string; d2: string; occ1?: 1 | 2; occ2?: 1 | 2 };

function buildSave(saveId: string, vorgabe: SlotPlan[]): GameState {
  // Mindestens eine volle Battle-Saison (20 Spieltage): ein kuerzerer gespeicherter Disziplin-Spielplan
  // gilt als unvollstaendig und wird neu gerechnet (getSeasonDisciplineSchedule) -- aufgefuellt wird mit
  // reinen Duell-Spieltagen.
  const plaene = [...vorgabe];
  while (plaene.length < 20) plaene.push({ d1: "hockey", d2: "basketball" });
  const liga1 = Array.from({ length: 16 }, (_, i) => `l1-${i + 1}`);
  const liga2 = Array.from({ length: 16 }, (_, i) => `l2-${i + 1}`);
  const leagueByTeamId: Record<string, "liga1" | "liga2"> = {};
  for (const id of liga1) leagueByTeamId[id] = "liga1";
  for (const id of liga2) leagueByTeamId[id] = "liga2";
  const matchdayIds = plaene.map((_, i) => `md-${i + 1}`);
  const { fixtures } = buildSeasonFixtureSchedule({ saveId, seasonId: "season-p", matchdayIds, leagueTeamIds: { liga1, liga2 } });
  const slot = (disciplineId: string, order: number, occurrence: 1 | 2) => ({
    disciplineId,
    displayName: disciplineId,
    order,
    playerCount: 4,
    category: "power",
    occurrenceInSeason: occurrence,
  });
  return {
    season: { id: "season-p", name: "Season P", year: 1, currentMatchday: 1, matchdayIds },
    seasonState: {
      seasonId: "season-p",
      schedule: fixtures,
      disciplineSchedule: plaene.map((plan, i) => ({
        seasonId: "season-p",
        matchdayId: matchdayIds[i],
        matchdayIndex: i + 1,
        matchdayLabel: `Spieltag ${i + 1}`,
        discipline1: slot(plan.d1, 1, plan.occ1 ?? 1),
        discipline2: slot(plan.d2, 2, plan.occ2 ?? 1),
        sourceStatus: "season_seed",
        sourceNote: null,
      })),
      leagueByTeamId,
      standings: {},
      matchdayResults: [],
      disciplineResults: [],
    },
    matchdayState: { matchdayId: matchdayIds[0], status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    disciplines: [...POD, ...DUELL].map((id) => ({ id, name: id, category: "power", weight: 1, playerCount: 4 })),
    teams: [...liga1, ...liga2].map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
  } as unknown as GameState;
}

/** Alle Kombinationen D1 × D2 (Pod/Duell), mit wechselnden Saison-Vorkommen. */
function allePlaene(): SlotPlan[] {
  const alle = [...POD, ...DUELL];
  const plaene: SlotPlan[] = [];
  for (const d1 of alle) {
    for (const d2 of alle) {
      if (d1 === d2) continue;
      plaene.push({ d1, d2, occ1: plaene.length % 3 === 0 ? 2 : 1, occ2: plaene.length % 2 === 0 ? 2 : 1 });
    }
  }
  return plaene;
}

describe("Beide Disziplinen eines Spieltags: dieselbe Paarung bzw. dieselbe Gruppe", () => {
  for (const saveId of ["save-x", "save-y"]) {
    it(`jede D1/D2-Kombination, jedes Team, jeder Spieltag (${saveId})`, () => {
      const plaene = allePlaene();
      const gs = buildSave(saveId, plaene);
      let gepruefteSpieltage = 0;
      plaene.forEach((plan, index) => {
        const matchdayId = `md-${index + 1}`;
        for (const team of gs.teams) {
          const [s1, s2] = getSpieltagsGegnerFuerTeam(gs, team.teamId, matchdayId, { saveId });
          expect(s1!.disciplineId).toBe(plan.d1);
          expect(s2!.disciplineId).toBe(plan.d2);
          const g1 = new Set(s1!.gegnerTeamIds);
          const g2 = new Set(s2!.gegnerTeamIds);
          expect(g1.size, `${team.teamId} @ ${matchdayId} D1`).toBeGreaterThan(0);
          expect(g2.size, `${team.teamId} @ ${matchdayId} D2`).toBeGreaterThan(0);
          const [klein, gross] = g1.size <= g2.size ? [g1, g2] : [g2, g1];
          for (const gegner of klein) {
            expect(gross.has(gegner), `${team.teamId} @ ${matchdayId} (${plan.d1}/${plan.d2}): ${gegner} fehlt in der anderen Disziplin`).toBe(true);
          }
          if (s1!.art === s2!.art) expect([...g2].sort()).toEqual([...g1].sort());
        }
        gepruefteSpieltage += 1;
      });
      expect(gepruefteSpieltage).toBe(56);
    });
  }

  it("Pod + Pod: dieselben Gruppen, aber disziplineigene Pod-IDs", () => {
    const gs = buildSave("save-pp", [{ d1: "battlefield", d2: "mini-dm" }, { d1: "takeshis-castle", d2: "staffel", occ1: 1, occ2: 2 }]);
    for (const [matchdayId, d1, d2] of [
      ["md-1", "battlefield", "mini-dm"],
      ["md-2", "takeshis-castle", "staffel"],
    ] as const) {
      const p1 = getPodsForMatchday(gs, matchdayId, d1, { saveId: "save-pp" });
      const p2 = getPodsForMatchday(gs, matchdayId, d2, { saveId: "save-pp" });
      expect(p1).toHaveLength(8);
      expect(p2.map((pod) => pod.teamIds)).toEqual(p1.map((pod) => pod.teamIds));
      expect(p1.every((pod) => pod.disciplineId === d1)).toBe(true);
      expect(p2.every((pod) => pod.disciplineId === d2)).toBe(true);
      expect(new Set([...p1, ...p2].map((pod) => pod.id)).size).toBe(16);
    }
  });

  it("ein Spieltag mit EINER Pod-Disziplin bleibt bit-identisch (Seed der Disziplin selbst)", () => {
    const gs = buildSave("save-e", [{ d1: "hockey", d2: "staffel" }]);
    const paare = gs.seasonState.schedule
      .filter((f) => f.matchdayId === "md-1" && f.leagueTier === "liga2")
      .map((f) => [f.homeTeamId, f.awayTeamId] as [string, string]);
    const erwartet = buildPodGroupsFromFixturePairs(paare, "save-e:season-p:staffel-pods-v1:liga2:spielplan-kopplung-v2", 1);
    const pods = getPodsForMatchday(gs, "md-1", "staffel", { saveId: "save-e" }).filter((pod) => pod.leagueTier === "liga2");
    expect(pods.map((pod) => pod.teamIds)).toEqual(erwartet);
  });

  it("D1 schon gewertet (alte, disziplineigene Gruppen), D2 offen: D2 spielt in den gebuchten D1-Gruppen", () => {
    const gs = buildSave("save-b", [{ d1: "battlefield", d2: "mini-dm" }]);
    // Eine bewusst andere Gruppe als jede, die die Losung ergibt: die gebuchte Zeile gewinnt.
    const gebucht = ["l1-1", "l1-2", "l1-3", "l1-4"] as const;
    gs.seasonState.matchdayResults = [
      { id: "mr-1", saveId: "save-b", seasonId: "season-p", matchdayId: "md-1", status: "preview_applied" } as MatchdayResultRecord,
    ];
    gs.seasonState.disciplineResults = gebucht.map(
      (teamId, index) =>
        ({
          matchdayResultId: "mr-1",
          teamId,
          disciplineId: "battlefield",
          disciplineSide: "d1",
          miniDmPod: { podId: "battlefield-pod:season-p:liga1:md-1:2", platz: (index + 1) as 1 | 2 | 3 | 4, teamIds: gebucht, wert: 5 },
        }) as unknown as DisciplineResultRecord,
    );
    const d2 = getPodsForMatchday(gs, "md-1", "mini-dm", { saveId: "save-b" });
    expect(d2).toEqual([
      expect.objectContaining({ id: "minidm-pod:season-p:liga1:md-1:2", disciplineId: "mini-dm", teamIds: [...gebucht], leagueTier: "liga1" }),
    ]);
  });
});
