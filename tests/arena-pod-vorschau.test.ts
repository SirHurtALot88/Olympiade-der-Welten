/**
 * ARENA-POD MIT VORSCHAU (17.11., Block 1). Chris: "in takeshi ... sind gerade auch nur 2 teams" /
 * "staffel sollte auch 4 teams haben genau wie battlefield". Der Host suchte den Pod nur am aktuellen
 * Spieltag; stand Takeshi/Staffel dort nicht an, zeigte die Arena ein Duell. `findeArenaPodMitVorschau`
 * nimmt dann den naechsten Spieltag, an dem die Disziplin als Pod gebucht wird -- und liefert dessen
 * matchdayId mit, damit Saat/k/Aufstellung zur Buchung jenes Spieltags passen.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { findeArenaPodMitVorschau } from "@/lib/foundation/battle-arena/arena-pod-vorschau";
import { getPodForTeam } from "@/lib/season/mini-dm-pod-schedule";

const SAVE_ID = "save-pod-vorschau";
const TEAMS = Array.from({ length: 16 }, (_, i) => `T${i + 1}`);

function slot(disciplineId: string, occurrenceInSeason: 1 | 2 = 1) {
  return { disciplineId, displayName: disciplineId, order: 1, playerCount: 4, legacyScorePlayerCount: 4, category: "speed", occurrenceInSeason };
}

/** Drei Spieltage: md1 Climbing+Battlefield, md2 Takeshi+Tennis, md3 Eiskunstlauf+Staffel. */
function state(): GameState {
  const tage = [
    ["md1", slot("climbing"), slot("battlefield")],
    ["md2", slot("takeshis-castle"), slot("tennis")],
    ["md3", slot("eiskunstlauf"), slot("staffel")],
  ] as const;
  return {
    scenarioMeta: { gameMode: "battle" },
    season: { id: "s1", name: "S1", year: 1, currentMatchday: 1, matchdayIds: ["md1", "md2", "md3"] },
    matchdayState: { matchdayId: "md1" },
    disciplines: [],
    rosters: [],
    players: [],
    teams: TEAMS.map((teamId) => ({ teamId, name: teamId, shortCode: teamId })),
    seasonState: {
      schedule: tage.flatMap(([matchdayId]) =>
        TEAMS.filter((_, i) => i % 2 === 0).map((teamId, i) => ({
          id: `${matchdayId}-f${i}`,
          homeTeamId: teamId,
          awayTeamId: TEAMS[TEAMS.indexOf(teamId) + 1]!,
          matchdayId,
          status: "scheduled",
          leagueTier: null,
        })),
      ),
      disciplineSchedule: tage.map(([matchdayId, d1, d2], i) => ({
        seasonId: "s1",
        matchdayId,
        matchdayIndex: i,
        matchdayLabel: `Spieltag ${i + 1}`,
        discipline1: d1,
        discipline2: d2,
        sourceStatus: "season_seed",
        sourceNote: null,
      })),
      matchdayResults: [],
      disciplineResults: [],
    },
  } as unknown as GameState;
}

describe("findeArenaPodMitVorschau", () => {
  it("heute: Battlefield an Spieltag 1 ist der Pod von heute", () => {
    const gs = state();
    const t = findeArenaPodMitVorschau(gs, "T1", "md1", "battlefield", { saveId: SAVE_ID });
    expect(t?.art).toBe("heute");
    expect(t?.matchdayId).toBe("md1");
    expect(t?.pod.teamIds).toHaveLength(4);
    expect(t?.pod).toEqual(getPodForTeam(gs, "T1", "md1", "battlefield", { saveId: SAVE_ID }));
  });

  it("vorschau: Takeshi/Staffel stehen heute nicht an -> der gebuchte Pod ihres naechsten Spieltags", () => {
    const gs = state();
    for (const [disciplineId, matchdayId, nummer] of [
      ["takeshis-castle", "md2", 2],
      ["staffel", "md3", 3],
    ] as const) {
      const t = findeArenaPodMitVorschau(gs, "T5", "md1", disciplineId, { saveId: SAVE_ID });
      expect(t?.art).toBe("vorschau");
      expect(t?.matchdayId).toBe(matchdayId);
      expect(t?.spieltagNummer).toBe(nummer);
      expect(t?.pod.teamIds).toContain("T5");
      expect(t?.pod.teamIds).toHaveLength(4);
      // Dieselbe Gruppe, die die Liga an jenem Spieltag bucht.
      expect(t?.pod).toEqual(getPodForTeam(gs, "T5", matchdayId, disciplineId, { saveId: SAVE_ID }));
    }
  });

  it("rueckblick: ist der letzte Spieltag einer Disziplin vorbei, der letzte davor", () => {
    const gs = state();
    const t = findeArenaPodMitVorschau(gs, "T2", "md3", "battlefield", { saveId: SAVE_ID });
    expect(t?.art).toBe("rueckblick");
    expect(t?.matchdayId).toBe("md1");
  });

  it("nurHeute (Spieltags-Ansicht): keine Vorschau, nur der Pod des aktuellen Spieltags", () => {
    const gs = state();
    expect(findeArenaPodMitVorschau(gs, "T1", "md1", "staffel", { saveId: SAVE_ID, nurHeute: true })).toBeNull();
    expect(findeArenaPodMitVorschau(gs, "T1", "md1", "battlefield", { saveId: SAVE_ID, nurHeute: true })?.art).toBe("heute");
  });

  it("keine Pod-Disziplin, kein Team, kein Spieltag -> null", () => {
    const gs = state();
    expect(findeArenaPodMitVorschau(gs, "T1", "md1", "tennis", { saveId: SAVE_ID })).toBeNull();
    expect(findeArenaPodMitVorschau(gs, null, "md1", "staffel", { saveId: SAVE_ID })).toBeNull();
    expect(findeArenaPodMitVorschau(gs, "T1", null, "staffel", { saveId: SAVE_ID })).toBeNull();
  });
});
