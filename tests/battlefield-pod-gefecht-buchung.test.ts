/**
 * BATTLEFIELD-POD AUS DEM GEFECHT JE ORT BUCHEN (02.11. abends, docs/design/battlefield-pod-ffa-02-11.md
 * Abschnitt 7). Reine Unit-Tests ohne Chromium:
 *
 * 1. `berechneBattlefieldPodOverride()` (mini-dm-pod-resolve.ts): Platz kommt aus dem Motor, 2-1-0-0,
 *    `quelle: "ffa"`, 0-10-Wertung streng nach Platz, Verhaeltnis summiert auf 0; kaputte Rohdaten oder
 *    ein fehlender PPS-Score liefern `null` (Rueckfall auf den PPS-Pod).
 * 2. `berechneMiniDmPodOverrides({ battlefieldRohdatenByPodId })`: Motor-Vorrang je Pod, ohne Rohdaten
 *    byte-identisch zum PPS-Pod.
 * 3. `runBattlefieldPodMatchday()` (battlefield-pod-matchday.ts) mit gemocktem Motor: Rohdaten je Pod,
 *    Spieler-PP nur fuer aufgestellte Spieler, Pod ohne Aufstellung eines Teams faellt zurueck,
 *    kaputter Boxscore verwirft den Pod.
 */
import { describe, expect, it } from "vitest";

import {
  berechneBattlefieldPodOverride,
  berechneMiniDmPodOverrides,
  resolveBattlefieldPodMargeReferenz,
  resolveBattlefieldPodSpielerPpReferenz,
  type BattlefieldPodRohdaten,
} from "@/lib/resolve/mini-dm-pod-resolve";
import { runBattlefieldPodMatchday, pruefeBattlefieldMotorErgebnis } from "@/lib/resolve/battlefield-pod-matchday";
import type { BattlefieldPodFixtureInput, BattlefieldPodFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { GameState, LineupDraft, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";

const SAVE_ID = "save-bf";
const SEASON_ID = "season-bf";
const MATCHDAY_ID = "matchday-1";
const TEAM_IDS: [string, string, string, string] = ["T1", "T2", "T3", "T4"];

function buildPod(id = "pod-1"): MiniDmPod {
  return { id, disciplineId: "battlefield", seasonId: SEASON_ID, matchdayId: MATCHDAY_ID, leagueTier: null, occurrenceInSeason: 1, teamIds: TEAM_IDS };
}

function rohdaten(platz: [number, number, number, number], punkte: [number, number, number, number]): BattlefieldPodRohdaten {
  return {
    podId: "pod-1",
    teamIds: TEAM_IDS,
    playerCount: 4,
    teams: TEAM_IDS.map((teamId, i) => ({ teamId, eventPlatz: platz[i]!, punkte: punkte[i]!, lebend: 2, wertung: 100 - i })),
  };
}

const PPS = new Map(TEAM_IDS.map((teamId, i) => [teamId, 50 + i] as const));

describe("berechneBattlefieldPodOverride", () => {
  it("bucht die Motor-Platzierung mit 2-1-0-0 und quelle ffa", () => {
    // T3 gewinnt, T1 Zweiter, T4 Dritter, T2 Letzter -- bewusst NICHT nach PPS-Score.
    const o = berechneBattlefieldPodOverride({
      pod: buildPod(),
      rohdaten: rohdaten([2, 4, 1, 3], [72, 0, 112, 8]),
      ppsScoreByTeamId: PPS,
      disciplineId: "battlefield",
      playerCount: 4,
    })!;
    expect(o).not.toBeNull();
    expect(o.get("T3")!.platz).toBe(1);
    expect(o.get("T1")!.platz).toBe(2);
    expect(o.get("T4")!.platz).toBe(3);
    expect(o.get("T2")!.platz).toBe(4);
    expect(["T3", "T1", "T4", "T2"].map((t) => o.get(t)!.teamPoints)).toEqual([2, 1, 0, 0]);
    for (const eintrag of o.values()) expect(eintrag.quelle).toBe("ffa");
    const werte = ["T3", "T1", "T4", "T2"].map((t) => o.get(t)!.wert);
    for (let i = 1; i < werte.length; i += 1) expect(werte[i - 1]!).toBeGreaterThanOrEqual(werte[i]!);
    // Platz 1/2/3 haben verschiedene Ligapunkte -> streng getrennte 0-10-Werte.
    expect(werte[0]!).toBeGreaterThan(werte[1]!);
    expect(werte[1]!).toBeGreaterThan(werte[2]!);
    expect([...o.values()].reduce((s, e) => s + e.verhaeltnis, 0)).toBe(0);
    expect(o.get("T1")!.margeZumNaechstbesserenPlatz).toBe(40);
  });

  it("das letzte stehende Team mit weniger Punkten bleibt Erster (Ordnung kommt aus dem Motor)", () => {
    const o = berechneBattlefieldPodOverride({
      pod: buildPod(),
      rohdaten: rohdaten([1, 2, 3, 4], [16, 64, 8, 0]),
      ppsScoreByTeamId: PPS,
      disciplineId: "battlefield",
      playerCount: 4,
    })!;
    expect(o.get("T1")!.platz).toBe(1);
    expect(o.get("T1")!.teamPoints).toBe(2);
    expect(o.get("T1")!.wert).toBeGreaterThan(o.get("T2")!.wert);
  });

  it("ein exakter Motor-Gleichstand wird ueber die Wertung aufgeloest und markiert", () => {
    const o = berechneBattlefieldPodOverride({
      pod: buildPod(),
      rohdaten: rohdaten([1, 2, 2, 4], [80, 40, 40, 0]),
      ppsScoreByTeamId: PPS,
      disciplineId: "battlefield",
      playerCount: 4,
    })!;
    // T2 (Wertung 99) vor T3 (98).
    expect(o.get("T2")!.platz).toBe(2);
    expect(o.get("T3")!.platz).toBe(3);
    expect(o.get("T3")!.warnings).toContain("battlefield_pod_motor_gleichstand_aufgeloest");
  });

  it("kaputte Rohdaten oder ein fehlender PPS-Score liefern null", () => {
    const basis = { pod: buildPod(), ppsScoreByTeamId: PPS, disciplineId: "battlefield", playerCount: 4 };
    expect(berechneBattlefieldPodOverride({ ...basis, rohdaten: { ...rohdaten([1, 2, 3, 4], [1, 1, 1, 1]), teams: rohdaten([1, 2, 3, 4], [1, 1, 1, 1]).teams.slice(0, 3) } })).toBeNull();
    expect(berechneBattlefieldPodOverride({ ...basis, rohdaten: rohdaten([1, 2, 3, 5], [1, 1, 1, 1]) })).toBeNull();
    expect(berechneBattlefieldPodOverride({ ...basis, rohdaten: { ...rohdaten([1, 2, 3, 4], [1, 1, 1, 1]), podId: "anderer-pod" } })).toBeNull();
    expect(
      berechneBattlefieldPodOverride({ ...basis, rohdaten: rohdaten([1, 2, 3, 4], [1, 1, 1, 1]), ppsScoreByTeamId: new Map([["T1", 1]]) }),
    ).toBeNull();
  });

  it("die gezogene Referenz ist vorhanden (M90 und Spieler-Perzentile je k)", () => {
    for (const k of [2, 3, 4, 5, 6]) {
      expect(resolveBattlefieldPodMargeReferenz(k)!.m90).toBeGreaterThan(0);
      const s = resolveBattlefieldPodSpielerPpReferenz(k)!;
      expect(s.p995).toBeGreaterThan(s.p50);
    }
  });
});

describe("berechneMiniDmPodOverrides mit Battlefield-Rohdaten", () => {
  it("Motor-Vorrang je Pod, ohne Rohdaten exakt der PPS-Pod", () => {
    const ohne = berechneMiniDmPodOverrides({ pods: [buildPod()], scoreByTeamId: PPS, disciplineId: "battlefield", playerCount: 4 });
    const mitLeer = berechneMiniDmPodOverrides({
      pods: [buildPod()],
      scoreByTeamId: PPS,
      disciplineId: "battlefield",
      playerCount: 4,
      battlefieldRohdatenByPodId: new Map(),
    });
    expect(mitLeer).toEqual(ohne);
    expect([...ohne.values()].every((e) => e.quelle === undefined)).toBe(true);
    // PPS-Pod ordnet nach Score: T4 (53) vorn.
    expect(ohne.get("T4")!.platz).toBe(1);

    const mit = berechneMiniDmPodOverrides({
      pods: [buildPod()],
      scoreByTeamId: PPS,
      disciplineId: "battlefield",
      playerCount: 4,
      battlefieldRohdatenByPodId: new Map([["pod-1", rohdaten([1, 2, 3, 4], [100, 50, 20, 0])]]),
    });
    expect(mit.get("T1")!.platz).toBe(1);
    expect(mit.get("T1")!.quelle).toBe("ffa");
  });
});

// --- runBattlefieldPodMatchday mit gemocktem Motor ---------------------------------------

function buildGameState(k: number, gesetztJeTeam: [number, number, number, number]): GameState {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const lineupDrafts: LineupDraft[] = [];
  TEAM_IDS.forEach((teamId, t) => {
    const entries: LineupDraft["entries"] = [];
    for (let i = 0; i < 6; i += 1) {
      const playerId = `${teamId}-p${i}`;
      players.push({ id: playerId, name: playerId, teamId, attributeSheetStats: {} } as unknown as Player);
      rosters.push({ id: `r-${playerId}`, teamId, playerId, upkeep: 0, roleTag: "squad", joinedSeasonId: SEASON_ID } as unknown as RosterEntry);
      if (i < gesetztJeTeam[t]!) {
        entries.push({ playerId, slotIndex: i, disciplineId: "battlefield", disciplineSide: "d1", activePlayerId: null } as unknown as LineupDraft["entries"][number]);
      }
    }
    lineupDrafts.push({ teamId, seasonId: SEASON_ID, matchdayId: MATCHDAY_ID, entries } as unknown as LineupDraft);
  });
  return {
    players,
    rosters,
    teams: TEAM_IDS.map((teamId) => ({ teamId, teamCode: teamId })) as unknown as GameState["teams"],
    disciplines: [] as GameState["disciplines"],
    season: { id: SEASON_ID, currentMatchday: 1 } as GameState["season"],
    matchdayState: { matchdayId: MATCHDAY_ID } as GameState["matchdayState"],
    seasonState: {
      lineupDrafts,
      disciplineSchedule: [
        {
          seasonId: SEASON_ID,
          matchdayId: MATCHDAY_ID,
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: "battlefield", displayName: "Battlefield", order: 1, category: "team", playerCount: k },
          discipline2: null,
          sourceStatus: "generated",
          sourceNote: null,
        },
      ],
    } as unknown as GameState["seasonState"],
  } as unknown as GameState;
}

/** Motor-Ersatz: je Team k Kaempfer `T?-p0..k-1` (die ersten k des Kaders), Platz = Seite+1. */
function fakeRunner(k: number, kaputt = false) {
  return async (_g: unknown, pods: readonly BattlefieldPodFixtureInput[]): Promise<Array<BattlefieldPodFixtureResult | null>> =>
    pods.map((pod) => ({
      podId: pod.podId,
      teamIds: pod.teamIds,
      ende: "zeit",
      teams: pod.teamIds.map((teamId, podSide) => ({
        teamId,
        podSide,
        eventPlatz: podSide + 1,
        punkte: 100 - podSide * 30,
        lebend: 2,
        wertung: 400 - podSide,
        ligaPunkte: [2, 1, 0, 0][podSide]!,
      })),
      boxscore: pod.teamIds.flatMap((teamId, podSide) =>
        Array.from({ length: kaputt && podSide === 3 ? 0 : k }, (_v, i) => ({
          name: `${teamId}-p${i}`,
          playerId: `${teamId}-p${i}`,
          teamId,
          podSide,
          slotId: null,
          eig: 60,
          anteil: 100 / (4 * k),
          wertung: 100 + 10 * i,
          ko: 0,
          down: false,
        })),
      ),
    }));
}

describe("runBattlefieldPodMatchday", () => {
  const basis = { saveId: SAVE_ID, seasonId: SEASON_ID, matchdayId: MATCHDAY_ID, pods: [buildPod()] };

  it("uebersetzt das Gefecht in Rohdaten je Pod und vergibt PP nur an aufgestellte Spieler", async () => {
    const gameState = buildGameState(3, [3, 2, 3, 3]);
    const erg = (await runBattlefieldPodMatchday({ ...basis, gameState, runBattlefieldPodFixturesImpl: fakeRunner(3) }))!;
    expect(erg.warnings).toEqual([]);
    const r = erg.rohdatenByPodId.get("pod-1")!;
    expect(r.playerCount).toBe(3);
    expect(r.teams.map((t) => t.eventPlatz)).toEqual([1, 2, 3, 4]);
    // T2 hat nur zwei gesetzt: der dritte Motor-Kaempfer bekommt keine PP.
    expect(erg.playerPpsByPlayerId.has("T2-p2")).toBe(false);
    expect(erg.playerPpsByPlayerId.has("T2-p1")).toBe(true);
    expect(erg.playerPpsByPlayerId.size).toBe(11);
    // Hoehere Wertung -> mehr PP (dieselbe Impact-Kurve wie Arena/PPS-Duell).
    expect(erg.playerPpsByPlayerId.get("T1-p2")!).toBeGreaterThan(erg.playerPpsByPlayerId.get("T1-p0")!);
  });

  it("ein Team ganz ohne Battlefield-Aufstellung: Pod faellt mit Warnung zurueck", async () => {
    const gameState = buildGameState(3, [3, 3, 0, 3]);
    const erg = (await runBattlefieldPodMatchday({ ...basis, gameState, runBattlefieldPodFixturesImpl: fakeRunner(3) }))!;
    expect(erg.rohdatenByPodId.size).toBe(0);
    expect(erg.warnings[0]).toContain("battlefield_pod_team_ohne_aufstellung:pod-1:T3");
  });

  it("ein unvollstaendiger Boxscore verwirft den Pod", async () => {
    const gameState = buildGameState(3, [3, 3, 3, 3]);
    const erg = (await runBattlefieldPodMatchday({ ...basis, gameState, runBattlefieldPodFixturesImpl: fakeRunner(3, true) }))!;
    expect(erg.rohdatenByPodId.size).toBe(0);
    expect(erg.warnings[0]).toContain("battlefield_pod_kopfzahl:pod-1:T4");
  });

  it("null ohne Pods oder ohne gueltiges k; k und Mutatoren gehen an den Motor", async () => {
    const gameState = buildGameState(3, [3, 3, 3, 3]);
    expect(await runBattlefieldPodMatchday({ ...basis, gameState, pods: [], runBattlefieldPodFixturesImpl: fakeRunner(3) })).toBeNull();
    expect(await runBattlefieldPodMatchday({ ...basis, gameState, playerCount: 9, runBattlefieldPodFixturesImpl: fakeRunner(3) })).toBeNull();
    let gesehen: unknown = null;
    await runBattlefieldPodMatchday({
      ...basis,
      gameState,
      mutatorTraits: ["Diligent"],
      runBattlefieldPodFixturesImpl: async (g, pods, optionen) => {
        gesehen = optionen;
        return fakeRunner(3)(g, pods);
      },
    });
    expect(gesehen).toMatchObject({ k: 3, mutatoren: ["Diligent"], matchdayId: MATCHDAY_ID });
  });

  it("pruefeBattlefieldMotorErgebnis erkennt fremde Teams und ungueltige Plaetze", async () => {
    const [gut] = await fakeRunner(2)(null, [{ podId: "pod-1", teamIds: TEAM_IDS, seed: 1 }]);
    expect(pruefeBattlefieldMotorErgebnis(buildPod(), 2, gut!)).toBeNull();
    const fremd = { ...gut!, teams: gut!.teams.map((t, i) => (i === 0 ? { ...t, teamId: "X" } : t)) };
    expect(pruefeBattlefieldMotorErgebnis(buildPod(), 2, fremd)).toContain("battlefield_pod_fremdes_team");
    const platz = { ...gut!, teams: gut!.teams.map((t, i) => (i === 0 ? { ...t, eventPlatz: 0 } : t)) };
    expect(pruefeBattlefieldMotorErgebnis(buildPod(), 2, platz)).toContain("battlefield_pod_platz_ungueltig");
  });
});
