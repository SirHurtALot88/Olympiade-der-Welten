/**
 * MINI-DM-FFA-SPIELTAG-ORCHESTRIERUNG (PR 5 des 6-PR-Opus-Plans 21.10., "Vorlauf-Verdrahtung").
 * Unit-Tests fuer `lib/resolve/mini-dm-ffa-matchday.ts` — KEIN echtes Chromium (injizierter
 * `runMiniDmFfaPodFixturesImpl`), KEIN voller Battle-Save (handgebautes, minimales `GameState`).
 *
 * Die Kernbehauptung dieser Datei: Teilnahme a(t,r) kommt aus der ECHTEN Aufstellung
 * (`lineupDrafts`), NICHT aus dem (gemockten) Motor-Boxscore — s. Kopfkommentar der Produktionsdatei.
 */
import { describe, expect, it } from "vitest";

import { runMiniDmFfaMatchday, resolveMiniDmFfaPlayerCountForMatchday } from "@/lib/resolve/mini-dm-ffa-matchday";
import { MINI_DM_FFA_ROLLEN6 } from "@/lib/resolve/mini-dm-pod-resolve";
import type { GameState, LineupDraft, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type { MiniDmFfaPodFixtureInput, MiniDmFfaPodFixtureResult } from "@/lib/battle/arena-headless-runner";
import type { MiniDmPod } from "@/lib/season/mini-dm-pod-schedule";

const SAVE_ID = "save-mdffa";
const SEASON_ID = "season-mdffa";
const MATCHDAY_ID = "matchday-1";
const TEAM_IDS: [string, string, string, string] = ["T1", "T2", "T3", "T4"];

function buildPlayer(id: string, teamId: string): Player {
  return {
    id,
    name: id,
    teamId,
    attributeSheetStats: {} as Player["attributeSheetStats"],
  } as unknown as Player;
}

function buildRoster(teamId: string, playerId: string): RosterEntry {
  return {
    id: `roster-${playerId}`,
    teamId,
    playerId,
    upkeep: 0,
    roleTag: "squad",
    joinedSeasonId: SEASON_ID,
  } as unknown as RosterEntry;
}

/** EIN Team mit EINEM gesetzten Spieler je Rolle 0..gesetzteRollen-1 -- die uebrigen Rollen
 *  (bis k) bleiben OHNE Lineup-Eintrag fuer dieses Team, s. Teilnahme-Pruefung. */
function buildTeamFixture(teamId: string, gesetzteRollen: number) {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  const entries: LineupDraft["entries"] = [];
  for (let slotIndex = 0; slotIndex < gesetzteRollen; slotIndex += 1) {
    const playerId = `${teamId}-p${slotIndex}`;
    players.push(buildPlayer(playerId, teamId));
    rosters.push(buildRoster(teamId, playerId));
    entries.push({ playerId, slotIndex, disciplineId: "mini-dm", disciplineSide: "d1", activePlayerId: null } as unknown as LineupDraft["entries"][number]);
  }
  return { players, rosters, entries };
}

/** Baut ein minimales `GameState`, dessen einziger Zweck die Mini-DM-FFA-Orchestrierung ist --
 *  EIN Pod (vier Teams), ein Spielplan-Slot mit `playerCount: k`, je Team `gesetzteRollenJeTeam[i]`
 *  explizit gesetzte Rollen (0..k, in Reihenfolge der Rollenliste). */
function buildGameState(k: number, gesetzteRollenJeTeam: [number, number, number, number]): GameState {
  const fixtures = TEAM_IDS.map((teamId, index) => buildTeamFixture(teamId, gesetzteRollenJeTeam[index]!));
  const lineupDrafts: LineupDraft[] = TEAM_IDS.map((teamId, index) => ({
    teamId,
    seasonId: SEASON_ID,
    matchdayId: MATCHDAY_ID,
    entries: fixtures[index]!.entries,
  }) as unknown as LineupDraft);

  return {
    players: fixtures.flatMap((fixture) => fixture.players),
    rosters: fixtures.flatMap((fixture) => fixture.rosters),
    teams: TEAM_IDS.map((teamId) => ({ teamId, teamCode: teamId })) as unknown as GameState["teams"],
    // Leer, bewusst: haelt `getSeasonDisciplineSchedule()` auf dem einfachen
    // "`disciplines.length === 0` -> gespeicherten Spielplan direkt zurueckgeben"-Pfad
    // (season-discipline-schedule.ts), statt in die KOMPLETTHEITS-/Neuaufbau-Logik zu laufen, die
    // fuer diesen Test unnoetig ist (dieser Test prueft die FFA-Orchestrierung, nicht den
    // Spielplan-Aufbau selbst).
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
          discipline1: { disciplineId: "mini-dm", displayName: "Mini-DM", order: 1, category: "team", playerCount: k, legacyScorePlayerCount: k },
          discipline2: null,
          sourceStatus: "generated",
          sourceNote: null,
        },
      ],
    } as unknown as GameState["seasonState"],
  } as unknown as GameState;
}

function buildPod(): MiniDmPod {
  return { id: "pod-1", seasonId: SEASON_ID, matchdayId: MATCHDAY_ID, leagueTier: null, occurrenceInSeason: 1, teamIds: TEAM_IDS };
}

/** Gemockter Motor-Lauf: jede Runde/jedes Team bekommt einen Boxscore-Eintrag, UNABHAENGIG davon,
 *  ob das Team fuer diese Rolle einen echten Lineup-Eintrag hat (genau der Reihum-Fallback-Fall,
 *  den die Orchestrierung NICHT als Teilnahme werten darf). `beitrag` ist `podSide*100 + runde`,
 *  leicht nachrechenbar in den Assertions. */
function buildFakeRunner(k: number) {
  return async (
    _gameState: unknown,
    pods: readonly MiniDmFfaPodFixtureInput[],
  ): Promise<Array<MiniDmFfaPodFixtureResult | null>> =>
    pods.map((pod) => ({
      podId: pod.podId,
      teamIds: pod.teamIds,
      teams: pod.teamIds.map((teamId, podSide) => ({ teamId, podSide, rundenPunkteSumme: 0, beitragSumme: 0, eventPlatz: podSide + 1, ligaPunkte: 0 })),
      boxscore: Array.from({ length: k }, (_v, rundenIndex) =>
        pod.teamIds.map((teamId, podSide) => ({
          slotId: MINI_DM_FFA_ROLLEN6[rundenIndex]!,
          name: `fallback-${podSide}-${rundenIndex}`,
          playerId: `${teamId}-p${rundenIndex}`,
          teamId,
          podSide,
          rundenPlatz: podSide + 1,
          rundenPunkte: 4 - podSide,
          beitrag: podSide * 100 + rundenIndex,
        })),
      ).flat(),
    }));
}

describe("resolveMiniDmFfaPlayerCountForMatchday", () => {
  it("liest playerCount aus dem Spielplan-Slot fuer Mini-DM", () => {
    const gameState = buildGameState(5, [5, 5, 5, 5]);
    expect(resolveMiniDmFfaPlayerCountForMatchday(gameState, MATCHDAY_ID)).toBe(5);
  });

  it("liefert null ohne Mini-DM-Slot an diesem Spieltag", () => {
    const gameState = buildGameState(4, [4, 4, 4, 4]);
    expect(resolveMiniDmFfaPlayerCountForMatchday(gameState, "irgendein-anderer-spieltag")).toBeNull();
  });
});

describe("runMiniDmFfaMatchday", () => {
  it("liefert null ohne Pods", async () => {
    const gameState = buildGameState(4, [4, 4, 4, 4]);
    const ergebnis = await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [],
      playerCount: 4,
      runMiniDmFfaPodFixturesImpl: buildFakeRunner(4),
    });
    expect(ergebnis).toBeNull();
  });

  it("liefert null bei ungueltigem k", async () => {
    const gameState = buildGameState(4, [4, 4, 4, 4]);
    const ergebnis = await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [buildPod()],
      playerCount: 1,
      runMiniDmFfaPodFixturesImpl: buildFakeRunner(4),
    });
    expect(ergebnis).toBeNull();
  });

  it("Teilnahme a(t,r) kommt aus der ECHTEN Aufstellung -- ein Reihum-Fallback im Motor-Boxscore zaehlt NICHT", async () => {
    // T1: alle 4 Rollen gesetzt. T2: nur Rollen 0/1 gesetzt (2/3 fehlen -- der Motor liefert fuer
    // sie trotzdem einen Boxscore-Eintrag, s. `buildFakeRunner`). T3/T4: ebenfalls voll gesetzt.
    const k = 4;
    const gameState = buildGameState(k, [4, 2, 4, 4]);
    const ergebnis = await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [buildPod()],
      playerCount: k,
      runMiniDmFfaPodFixturesImpl: buildFakeRunner(k),
    });
    expect(ergebnis).not.toBeNull();
    const rohdaten = ergebnis!.rohdatenByPodId.get("pod-1")!;
    expect(rohdaten.playerCount).toBe(k);
    expect(rohdaten.runden).toHaveLength(k);

    const t2 = (runde: number) => rohdaten.runden[runde]!.teams.find((t) => t.teamId === "T2")!;
    expect(t2(0).teilnahme).toBe(true);
    expect(t2(1).teilnahme).toBe(true);
    expect(t2(2).teilnahme).toBe(false);
    expect(t2(3).teilnahme).toBe(false);
    // Der Motor haette fuer Runde 2/3 (podSide 1 = T2) `beitrag: 100+2`/`100+3` geliefert -- die
    // Orchestrierung MUSS das auf 0 setzen, weil kein echter Lineup-Eintrag vorliegt.
    expect(t2(2).beitrag).toBe(0);
    expect(t2(3).beitrag).toBe(0);
    // Fuer die GESETZTEN Runden bleibt der Motor-Wert unveraendert durch.
    expect(t2(0).beitrag).toBe(100 + 0);
    expect(t2(1).beitrag).toBe(100 + 1);

    const t1 = (runde: number) => rohdaten.runden[runde]!.teams.find((t) => t.teamId === "T1")!;
    for (let r = 0; r < k; r += 1) {
      expect(t1(r).teilnahme).toBe(true);
      expect(t1(r).beitrag).toBe(0 * 100 + r); // podSide 0
    }
  });

  it("Spieler-PP nur fuer ECHT gesetzte Spieler, nicht fuer den Reihum-Fallback", async () => {
    const k = 4;
    const gameState = buildGameState(k, [4, 2, 4, 4]);
    const ergebnis = await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [buildPod()],
      playerCount: k,
      runMiniDmFfaPodFixturesImpl: buildFakeRunner(k),
    });
    expect(ergebnis).not.toBeNull();
    // T2s Spieler fuer Runde 0/1 (gesetzt) tragen eine PP, Runde 2/3 (Reihum-Fallback) NICHT.
    expect(ergebnis!.playerPpsByPlayerId.has("T2-p0")).toBe(true);
    expect(ergebnis!.playerPpsByPlayerId.has("T2-p1")).toBe(true);
    expect(ergebnis!.playerPpsByPlayerId.has("T2-p2")).toBe(false);
    expect(ergebnis!.playerPpsByPlayerId.has("T2-p3")).toBe(false);
    for (const pp of ergebnis!.playerPpsByPlayerId.values()) {
      expect(Number.isFinite(pp)).toBe(true);
      expect(pp).toBeGreaterThanOrEqual(0);
    }
  });

  it("ein Pod ohne Motor-Ergebnis (`null`) bleibt in `rohdatenByPodId` einfach aus -- kein Fehler", async () => {
    const k = 4;
    const gameState = buildGameState(k, [4, 4, 4, 4]);
    const nullRunner = async (): Promise<Array<MiniDmFfaPodFixtureResult | null>> => [null];
    const ergebnis = await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [buildPod()],
      playerCount: k,
      runMiniDmFfaPodFixturesImpl: nullRunner,
    });
    expect(ergebnis).not.toBeNull();
    expect(ergebnis!.rohdatenByPodId.size).toBe(0);
    expect(ergebnis!.warnings.some((w) => w.includes("pod-1"))).toBe(true);
  });

  it("reicht k als `optionen.k` an den Motor-Aufruf durch", async () => {
    const k = 6;
    const gameState = buildGameState(k, [6, 6, 6, 6]);
    let gesehenesK: number | undefined;
    const spion = async (
      _gameState: unknown,
      pods: readonly MiniDmFfaPodFixtureInput[],
      options: { k?: number } = {},
    ): Promise<Array<MiniDmFfaPodFixtureResult | null>> => {
      gesehenesK = options.k;
      return buildFakeRunner(k)(_gameState, pods);
    };
    await runMiniDmFfaMatchday({
      gameState,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      matchdayId: MATCHDAY_ID,
      pods: [buildPod()],
      playerCount: k,
      runMiniDmFfaPodFixturesImpl: spion,
    });
    expect(gesehenesK).toBe(k);
  });
});
