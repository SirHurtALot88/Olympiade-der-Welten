import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { ARENA_TEAM_POINTS, runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";

/**
 * ECHTER END-ZU-END-NACHWEIS FUER PR 7 (docs/design/battle-mode-spielmodus-plan.md, Abschnitt
 * 3.3c/3.4/5.1) — MIT einem echten Chromium-Lauf, nicht gemockt: vier reale Arena-Duelle
 * (`runBattleModeArenaMatchday`, derselbe Playwright-Runner aus PR6) speisen ihr Ergebnis in die
 * ECHTE Resolve-Pipeline (`buildLegacyMatchdayResolvePreview`) ein und die dort ankommenden
 * Team-Punkte werden gegen das 2/1/0-Modell geprueft — inklusive sichtbarem `resolutionSource`
 * und `arenaMatchSeed`, und der Kontrolle, dass die zweite (Nicht-Arena-)Disziplin desselben
 * Spieltags weiterhin ueber `getRankToPointsValue()` laeuft (Konsistenz-Nachweis aus dem Auftrag).
 *
 * Ein echter Playwright-Browser-Klick durch die komplette Next.js-UI ("Spieltag simulieren"-
 * Button) haette eine laufende App-Instanz samt Persistenz/Auth in dieser Umgebung gebraucht;
 * dieser Test deckt stattdessen exakt den Pfad ab, den `arena-matchday-resolve-service.ts` im
 * echten Betrieb faehrt: `runBattleModeArenaMatchday()` -> `buildLegacyMatchdayResolvePreview()`
 * mit den daraus gebauten Overrides -- derselbe Code, nur ohne den HTTP-/Hintergrundlauf-Umweg.
 *
 * Testing-Lektion aus PR6 (full-test-suite faehrt OHNE Chromium): `describe.skipIf`, exakt das
 * Verfuegbarkeits-Muster aus tests/arena-headless-runner.test.ts.
 */

const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const LAUF_TIMEOUT_MS = 90_000;

function chromiumVerfuegbar(): boolean {
  if (existsSync(CHROMIUM_PFAD)) return true;
  const cache = join(homedir(), ".cache", "ms-playwright");
  try {
    return readdirSync(cache).some((eintrag) => eintrag.startsWith("chromium"));
  } catch {
    return false;
  }
}

const CHROMIUM_VERFUEGBAR = chromiumVerfuegbar();

function baueKader(teamId: string, spielerPrefix: string, anzahl = 10): { players: Player[]; rosters: RosterEntry[] } {
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const playerId = `${spielerPrefix}-${i}`;
    players.push({
      id: playerId,
      name: `${spielerPrefix} Spieler ${i}`,
      rating: 50,
      marketValue: 100_000,
      salaryDemand: 10_000,
      className: "Warrior",
      race: "Human",
      alignment: "neutral",
      gender: "diverse",
      subclasses: ["Warrior"],
      traitsPositive: ["Loyal"],
      traitsNegative: [],
      disciplineRatings: { basketball: 30 + i * 5, tdm: 20 + i, spurt: 20 + i },
      attributeSheetStats: {
        power: 40 + i,
        health: 50 + i,
        stamina: 45 + i,
        intelligence: 30 + i,
        awareness: 35 + i,
        determination: 40 + i,
        speed: 55 + i,
        dexterity: 50 + i,
        charisma: 20 + i,
        will: 30 + i,
        spirit: 25 + i,
        torment: 10 + i,
      },
      preferredDisciplineIds: ["basketball"],
    } as unknown as Player);
    rosters.push({ id: `roster-${playerId}`, teamId, playerId, contractLength: 3 } as unknown as RosterEntry);
  }
  return { players, rosters };
}

function baueBattleModeGameState(): GameState {
  const teamDefs = [
    { teamId: "liga1-a", prefix: "Liga1A" },
    { teamId: "liga1-b", prefix: "Liga1B" },
    { teamId: "liga2-a", prefix: "Liga2A" },
    { teamId: "liga2-b", prefix: "Liga2B" },
  ];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  for (const team of teamDefs) {
    const kader = baueKader(team.teamId, team.prefix);
    players.push(...kader.players);
    rosters.push(...kader.rosters);
  }

  return {
    scenarioMeta: { gameMode: "battle" },
    players,
    rosters,
    teams: teamDefs.map((team) => ({ teamId: team.teamId, name: team.prefix })),
    season: { id: "season-1" },
    disciplines: [
      { id: "basketball", name: "Basketball", category: "tactics" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    seasonState: {
      leagueByTeamId: {
        "liga1-a": "liga1",
        "liga1-b": "liga1",
        "liga2-a": "liga2",
        "liga2-b": "liga2",
      },
      schedule: [
        { id: "f-liga1", homeTeamId: "liga1-a", awayTeamId: "liga1-b", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga1" },
        { id: "f-liga2", homeTeamId: "liga2-a", awayTeamId: "liga2-b", matchdayId: "matchday-1", status: "scheduled", leagueTier: "liga2" },
      ],
    },
  } as unknown as GameState;
}

function createContext(input: {
  teamId: string;
  teamName: string;
  d1Scores: number[];
  d2Scores: number[];
  gameState: GameState;
}): LegacyLineupLoadedContext {
  const entries = [
    ...input.d1Scores.map((score, index) => ({
      disciplineId: "basketball",
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d1-${index}`,
      activePlayerId: `active-${input.teamId}-d1-${index}`,
    })),
    ...input.d2Scores.map((score, index) => ({
      disciplineId: "fechten",
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${input.teamId}-d2-${index}`,
      activePlayerId: `active-${input.teamId}-d2-${index}`,
    })),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    gameState: input.gameState,
    entries,
    disciplinePlayerCounts: { basketball: input.d1Scores.length, fechten: input.d2Scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId ?? `missing-${entry.playerId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({ playerId: `${input.teamId}-d1-${index}`, disciplineId: "basketball", score })),
      ...input.d2Scores.map((score, index) => ({ playerId: `${input.teamId}-d2-${index}`, disciplineId: "fechten", score })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: input.teamId, shortCode: input.teamId, name: input.teamName },
    teamSeasonState: {
      id: `tss-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      cash: 100,
      budget: 100,
      rosterLimit: 10,
      playerOpt: 10,
    },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({ id: entry.playerId, name: entry.playerId, coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } })),
    disciplines: [
      { id: "basketball", name: "Basketball", category: "tactics" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "basketball", originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${input.teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      status: "draft",
      entries,
      modifiers: {
        d1: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
        d2: { primaryFormCardId: null, secondaryFormCardId: null, mutatorTrait1: null, mutatorTrait2: null },
      },
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    },
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId: "basketball",
      d2DisciplineId: "fechten",
    },
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

describe.skipIf(!CHROMIUM_VERFUEGBAR)("Battle Mode PR7: echter Arena-Lauf -> Resolve-Pipeline", () => {
  it(
    "ein echtes Arena-Ergebnis kommt an, traegt resolutionSource:arena + sichtbaren Seed, und Fechten (PPS) bleibt konsistent ueber getRankToPointsValue",
    async () => {
      const gameState = baueBattleModeGameState();

      const { overridesByTeamId, warnings } = await runBattleModeArenaMatchday({
        gameState,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "matchday-1",
      });

      expect(warnings).toHaveLength(0);
      expect(overridesByTeamId.size).toBe(4);
      for (const teamId of ["liga1-a", "liga1-b", "liga2-a", "liga2-b"]) {
        const override = overridesByTeamId.get(teamId);
        expect(override).toBeDefined();
        expect([ARENA_TEAM_POINTS.win, ARENA_TEAM_POINTS.draw, ARENA_TEAM_POINTS.loss]).toContain(override?.teamPoints);
        expect(override?.arenaMatchSeed).toMatch(/^save-1:season-1:matchday-1:arena:/);
      }
      // Jedes Liga-Duell ergibt zusammen exakt 2 Punkte (Sieg+Niederlage) oder 1+1 (Unentschieden) --
      // nie 0+0 oder 2+2. Das ist der eigentliche Beweis, dass das 2/1/0-Modell greift.
      expect((overridesByTeamId.get("liga1-a")?.teamPoints ?? 0) + (overridesByTeamId.get("liga1-b")?.teamPoints ?? 0)).toBe(2);
      expect((overridesByTeamId.get("liga2-a")?.teamPoints ?? 0) + (overridesByTeamId.get("liga2-b")?.teamPoints ?? 0)).toBe(2);

      const preview = buildLegacyMatchdayResolvePreview(
        [
          createContext({ teamId: "liga1-a", teamName: "Liga1A", d1Scores: [10, 5], d2Scores: [40, 39], gameState }),
          createContext({ teamId: "liga1-b", teamName: "Liga1B", d1Scores: [50, 40], d2Scores: [35, 34], gameState }),
          createContext({ teamId: "liga2-a", teamName: "Liga2A", d1Scores: [30, 20], d2Scores: [20, 19], gameState }),
          createContext({ teamId: "liga2-b", teamName: "Liga2B", d1Scores: [15, 10], d2Scores: [45, 44], gameState }),
        ],
        { arenaTeamPointsByTeamId: overridesByTeamId },
      );

      const basketball = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "basketball");
      expect(basketball).toBeDefined();
      for (const team of basketball?.teamResults ?? []) {
        expect(team.resolutionSource).toBe("arena");
        expect(team.arenaMatchSeed).toMatch(/^save-1:season-1:matchday-1:arena:/);
        expect(team.teamPoints).toBe(overridesByTeamId.get(team.teamId)?.teamPoints);
      }

      // Fechten (D2, keine Arena-Disziplin) bleibt exakt beim bestehenden, gerankten PPS-Pfad --
      // "konsistent mit einer Nicht-Arena-Disziplin desselben Spieltags" aus dem Auftrag.
      const fechten = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "fechten");
      expect(fechten).toBeDefined();
      for (const team of fechten?.teamResults ?? []) {
        expect(team.resolutionSource).toBe("pps");
        expect(team.pointSource).toBe("rank_to_points_final_score_share");
        expect(team.arenaMatchSeed ?? null).toBeNull();
      }
    },
    LAUF_TIMEOUT_MS,
  );
});
