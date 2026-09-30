import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER,
  BATTLE_MUTATOR_ORGANISCH_ART,
} from "@/lib/battle/battle-mutator-organisch";
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSpielplanMutatorSummaries } from "@/lib/foundation/spielplan-mutator-summary";
import {
  buildMatchdayMutatorTraitsBySide,
  calculateMutatorModifierForSide,
  resolveMatchdayMutatorTraitsForDiscipline,
  toBattleArenaOrganicMutatorResult,
} from "@/lib/lineups/legacy-lineup-modifiers";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { ARENA_TEAM_POINTS, resolveMutatorTraitsFromSchedule } from "@/lib/resolve/battle-mode-arena-team-points";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";

/**
 * MUTATOR ORGANISCH IM BATTLE-MODUS (29.09., lib/battle/battle-mutator-organisch.ts,
 * docs/design/mutator-trait-organische-performance-konzept-29-09.md "Finale Umsetzung").
 *
 * Chris: "ja genau das soll das ersetzen" (die 0,3 PP), "vom Skillwert bzw jedem Attribut",
 * Manager-Modus "nein". Diese Datei sichert die Buchungsseite ab — die Simulationsseite (der
 * Attributbonus in der Engine) prueft tests/arena-headless-runner.test.ts mit echtem Chromium.
 *
 *   1. Die Konstante steht in Engine und TS gleich.
 *   2. Fuer eine Seite, die die Arena SIMULIERT (Battle-Save + Arena-Override fuer genau dieses
 *      Team), faellt der flache Nachschlag weg (0 Score, 0 PP), die Trefferzahl bleibt.
 *   3. Ueberall sonst bleibt alles beim alten +6/+0,3: Manager-Modus, eine nicht simulierte
 *      Battle-Disziplin am selben Spieltag, ein Team, dessen Arena-Lauf ausgefallen ist.
 */

const ENGINE = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");

describe("Konstante Engine <-> TS", () => {
  it("MUTATOR_ORGANISCH in battle-mode.engine.js entspricht lib/battle/battle-mutator-organisch.ts", () => {
    const treffer = ENGINE.match(/const MUTATOR_ORGANISCH=\{art:"(flach|prozent)", jeTreffer:([0-9.]+)\};/);
    expect(treffer, "MUTATOR_ORGANISCH-Zeile nicht gefunden").not.toBeNull();
    expect(treffer![1]).toBe(BATTLE_MUTATOR_ORGANISCH_ART);
    expect(Number(treffer![2])).toBe(BATTLE_MUTATOR_ATTRIBUT_BONUS_JE_TREFFER);
  });

  it("der alte eng-Weg (+tr.netto auf die Slot-Fokus-Attribute) ist aus baueEinheit entfernt", () => {
    const start = ENGINE.indexOf("function baueEinheit(");
    const ende = ENGINE.indexOf("function ", start + 20);
    const rumpf = ENGINE.slice(start, ende);
    expect(rumpf).not.toMatch(/engPunkte=\(slId\?slotAufschlag\(p,slId,d\):0\)\+tr\.netto/);
    expect(rumpf).toContain("eigMutator(p,d)");
  });
});

describe("toBattleArenaOrganicMutatorResult", () => {
  it("nullt Score-, PP- und Slot-Boni, behaelt die Trefferzahl", () => {
    const roh = calculateMutatorModifierForSide({
      modifiers: null,
      disciplineSide: "d1",
      entries: [{ playerId: "p1" }, { playerId: "p2" }],
      rosterPlayers: [
        { id: "p1", name: "p1", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 }, traitsPositive: ["Healthy"], traitsNegative: ["lazy"] },
        { id: "p2", name: "p2", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 }, traitsPositive: ["Cool"], traitsNegative: [] },
      ] as never,
      matchdayMutatorTraits: ["Healthy", "Lazy"],
    });
    expect(roh.playerMutatorHits).toEqual({ p1: 2 });
    expect(roh.playerMutatorBonuses).toEqual({ p1: 12 });
    expect(roh.playerMutatorPpsBonuses).toEqual({ p1: 0.6 });

    const organisch = toBattleArenaOrganicMutatorResult(roh);
    expect(organisch.playerMutatorHits).toEqual({ p1: 2 });
    expect(organisch.playerMutatorBonuses).toEqual({});
    expect(organisch.playerMutatorPpsBonuses).toEqual({});
    expect(organisch.mutatorModifier).toBe(0);
    expect(organisch.mutatorSlots.every((slot) => slot.scoreModifier === 0 && slot.playerPpsModifier === 0)).toBe(true);
    expect(organisch.mutatorSlots.map((slot) => slot.hitCount)).toEqual(roh.mutatorSlots.map((slot) => slot.hitCount));
  });
});

describe("resolveMatchdayMutatorTraitsForDiscipline", () => {
  it("liefert genau den Wurf der Seite, auf der die Disziplin steht", () => {
    const basis = { saveId: "s", seasonId: "season-1", matchdayId: "md-3", d1DisciplineId: "tennis", d2DisciplineId: "spurt" };
    const beide = buildMatchdayMutatorTraitsBySide(basis);
    expect(resolveMatchdayMutatorTraitsForDiscipline({ ...basis, disciplineId: "tennis" })).toEqual(beide.d1);
    expect(resolveMatchdayMutatorTraitsForDiscipline({ ...basis, disciplineId: "spurt" })).toEqual(beide.d2);
    expect(resolveMatchdayMutatorTraitsForDiscipline({ ...basis, disciplineId: "hockey" })).toBeNull();
  });

  it("der Spielplan-Rueckfall in runBattleModeArenaMatchday sieht denselben Wurf", () => {
    const gameState = {
      seasonState: {
        disciplineSchedule: [
          { seasonId: "season-1", matchdayId: "md-3", discipline1: { disciplineId: "tennis" }, discipline2: { disciplineId: "spurt" } },
        ],
      },
    } as unknown as GameState;
    const erwartet = buildMatchdayMutatorTraitsBySide({
      saveId: "s",
      seasonId: "season-1",
      matchdayId: "md-3",
      d1DisciplineId: "tennis",
      d2DisciplineId: "spurt",
    });
    expect(
      resolveMutatorTraitsFromSchedule({ gameState, saveId: "s", seasonId: "season-1", matchdayId: "md-3", disciplineId: "spurt" }),
    ).toEqual(erwartet.d2);
    expect(
      resolveMutatorTraitsFromSchedule({ gameState, saveId: "s", seasonId: "season-1", matchdayId: "md-3", disciplineId: "hockey" }),
    ).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------
// Resolve: Buchung je Seite. Basketball (D1) ist arena-aufgeloest, Battlefield (D2) nicht.
// ------------------------------------------------------------------------------------------

const ARENA_DISZIPLIN = "basketball";
const PPS_DISZIPLIN = "battlefield";
const WURF = buildMatchdayMutatorTraitsBySide({
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-1",
  d1DisciplineId: ARENA_DISZIPLIN,
  d2DisciplineId: PPS_DISZIPLIN,
});

function createContext(teamId: string, gameState: GameState): LegacyLineupLoadedContext {
  const d1Scores = [40, 30];
  const d2Scores = [35];
  const entries = [
    ...d1Scores.map((_, index) => ({
      disciplineId: ARENA_DISZIPLIN,
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: `${teamId}-d1-${index}`,
      activePlayerId: `active-${teamId}-d1-${index}`,
    })),
    ...d2Scores.map((_, index) => ({
      disciplineId: PPS_DISZIPLIN,
      disciplineSide: "d2" as const,
      slotIndex: index,
      playerId: `${teamId}-d2-${index}`,
      activePlayerId: `active-${teamId}-d2-${index}`,
    })),
  ];
  // Der jeweils ERSTE Spieler jeder Seite traegt den ersten gewuerfelten Trait dieser Seite.
  const traitsFor = (playerId: string) =>
    playerId.endsWith("-d1-0") ? [WURF.d1[0]] : playerId.endsWith("-d2-0") ? [WURF.d2[0]] : [];
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId,
    gameState,
    entries,
    disciplinePlayerCounts: { [ARENA_DISZIPLIN]: d1Scores.length, [PPS_DISZIPLIN]: d2Scores.length },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId,
      saveId: "save-1",
      seasonId: "season-1",
      teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...d1Scores.map((score, index) => ({ playerId: `${teamId}-d1-${index}`, disciplineId: ARENA_DISZIPLIN, score })),
      ...d2Scores.map((score, index) => ({ playerId: `${teamId}-d2-${index}`, disciplineId: PPS_DISZIPLIN, score })),
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: teamId, shortCode: teamId, name: teamId },
    teamSeasonState: { id: `tss-${teamId}`, saveId: "save-1", seasonId: "season-1", teamId, cash: 100, budget: 100, rosterLimit: 10, playerOpt: 10 },
    teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
      traitsPositive: traitsFor(entry.playerId),
      traitsNegative: [],
    })),
    disciplines: [
      { id: ARENA_DISZIPLIN, name: "Basketball", category: "tactics" },
      { id: PPS_DISZIPLIN, name: "Battlefield", category: "power" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: ARENA_DISZIPLIN, originalOrder: 1, displayOrder: 1, playerCount: d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: PPS_DISZIPLIN, originalOrder: 2, displayOrder: 2, playerCount: d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: `lineup-${teamId}`,
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId,
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
      teamId,
      d1DisciplineId: ARENA_DISZIPLIN,
      d2DisciplineId: PPS_DISZIPLIN,
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

const gameStateMit = (gameMode: "battle" | "manager") =>
  ({ scenarioMeta: { gameMode }, rosters: [], players: [], teams: [], seasonState: {} }) as unknown as GameState;

function vorschau(gameMode: "battle" | "manager", arenaTeams: string[]) {
  const gameState = gameStateMit(gameMode);
  const overrides = new Map(
    arenaTeams.map((teamId) => [teamId, { teamPoints: ARENA_TEAM_POINTS.win, arenaMatchSeed: `seed-${teamId}` }] as const),
  );
  return buildLegacyMatchdayResolvePreview([createContext("A-A", gameState), createContext("B-B", gameState)], {
    arenaTeamPointsByDisciplineId: arenaTeams.length ? new Map([[ARENA_DISZIPLIN, overrides]]) : null,
  });
}

function eintrag(preview: ReturnType<typeof vorschau>, disciplineId: string, playerId: string) {
  const player = preview.disciplinePreviews
    .find((discipline) => discipline.disciplineId === disciplineId)
    ?.topPlayers.find((entry) => entry.playerId === playerId);
  expect(player, `${playerId} fehlt in ${disciplineId}`).toBeDefined();
  return player!;
}

describe("Resolve: organischer Mutator ersetzt +6/+0,3 nur auf arena-simulierten Battle-Seiten", () => {
  it("Battle + Arena-Override: kein flacher Bonus, Trefferzahl bleibt (auch in der Seitenzeile)", () => {
    const preview = vorschau("battle", ["A-A", "B-B"]);
    const getroffen = eintrag(preview, ARENA_DISZIPLIN, "A-A-d1-0");
    expect(getroffen.mutatorHits).toBe(1);
    expect(getroffen.mutatorBonus ?? 0).toBe(0);
    expect(getroffen.mutatorPpsBonus ?? 0).toBe(0);

    const seite = preview.disciplinePreviews
      .find((discipline) => discipline.disciplineId === ARENA_DISZIPLIN)
      ?.teamResults.find((team) => team.teamId === "A-A");
    expect(seite?.mutatorModifier).toBe(0);
    expect(seite?.entries.find((entry) => entry.playerId === "A-A-d1-0")?.mutatorHits).toBe(1);
  });

  it("dieselbe Vorschau: die NICHT simulierte Battle-Disziplin behaelt +6/+0,3", () => {
    const preview = vorschau("battle", ["A-A", "B-B"]);
    const getroffen = eintrag(preview, PPS_DISZIPLIN, "A-A-d2-0");
    expect(getroffen.mutatorHits).toBe(1);
    expect(getroffen.mutatorBonus).toBe(6);
    expect(getroffen.mutatorPpsBonus).toBe(0.3);
  });

  it("Manager-Modus: unveraendert +6/+0,3, auch wenn (faelschlich) Arena-Maps mitkommen", () => {
    const preview = vorschau("manager", ["A-A", "B-B"]);
    const getroffen = eintrag(preview, ARENA_DISZIPLIN, "A-A-d1-0");
    expect(getroffen.mutatorBonus).toBe(6);
    expect(getroffen.mutatorPpsBonus).toBe(0.3);
    expect(getroffen.mutatorHits).toBe(1);
  });

  it("Battle, aber Arena-Lauf fuer dieses Team ausgefallen (kein Override): PPS-Rueckfall mit +6/+0,3", () => {
    const preview = vorschau("battle", ["B-B"]);
    const ohneSimulation = eintrag(preview, ARENA_DISZIPLIN, "A-A-d1-0");
    expect(ohneSimulation.mutatorBonus).toBe(6);
    expect(ohneSimulation.mutatorPpsBonus).toBe(0.3);
    const simuliert = eintrag(preview, ARENA_DISZIPLIN, "B-B-d1-0");
    expect(simuliert.mutatorBonus ?? 0).toBe(0);
    expect(simuliert.mutatorPpsBonus ?? 0).toBe(0);
    expect(simuliert.mutatorHits).toBe(1);
  });
});

describe("Spielplan-Zusammenfassung zaehlt Treffer ueber mutatorHits", () => {
  it("ein Arena-Treffer ohne flachen Bonus erscheint trotzdem in der Mutator-Spalte", () => {
    const [trait1] = buildMatchdayMutatorTraitsBySide({
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "md-1",
      d1DisciplineId: ARENA_DISZIPLIN,
      d2DisciplineId: PPS_DISZIPLIN,
    }).d1;
    const gameState = {
      season: { id: "season-1" },
      teams: [{ teamId: "t1", shortCode: "T1" }],
      players: [{ id: "p1", name: "Pia", traitsPositive: [trait1], traitsNegative: [] }],
      seasonState: {
        matchdayResults: [{ id: "r1", seasonId: "season-1", matchdayId: "md-1", status: "preview_applied" }],
        playerDisciplinePerformances: [
          {
            id: "perf-1",
            matchdayResultId: "r1",
            teamId: "t1",
            playerId: "p1",
            disciplineId: ARENA_DISZIPLIN,
            disciplineSide: "d1",
            mutatorScoreBonus: 0,
            mutatorPpsBonus: 0,
            mutatorHits: 1,
          },
        ],
      },
    } as unknown as GameState;
    const summaries = buildSpielplanMutatorSummaries({
      gameState,
      saveId: "save-1",
      scheduleRows: [{ matchdayId: "md-1", discipline1: { disciplineId: ARENA_DISZIPLIN }, discipline2: { disciplineId: PPS_DISZIPLIN } }],
    });
    const summary = [...summaries.values()].find((entry) => entry.disciplineId === ARENA_DISZIPLIN);
    expect(summary?.resolved).toBe(true);
    expect(summary?.slots[0].hitCount).toBe(1);
    expect(summary?.slots[0].hitPlayers.map((player) => player.playerId)).toEqual(["p1"]);
  });
});
