import { describe, expect, it } from "vitest";

import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildDisciplineStageTeamsFromPreview } from "@/lib/foundation/discipline-stage/discipline-stage-from-preview";

// Reproduktion des Staffel-Bugs "5 Etappen angekuendigt, alle Teams nach der 3.
// fertig": ein Draft kann mehr Eintraege je Disziplin-Seite tragen, als der
// Spieltag erlaubt (requiredPlayers, z. B. stale Draft nach playerCount-Aenderung
// im Season-Schedule). Frueher wertete die Engine ALLE Eintraege — das verzerrte
// den Team-Score (5 statt 3 Spieler) und blies die Arena-Etappenzahl auf
// (slotCount = max Eintraege je Team), waehrend regulaere 3er-Teams nach Etappe 3
// standen. Jetzt werten nur die ersten requiredPlayers Slots (slotIndex-Ordnung).

function buildEntries(teamId: string, disciplineId: string, side: "d1" | "d2", count: number) {
  return Array.from({ length: count }, (_, slotIndex) => ({
    disciplineId,
    disciplineSide: side,
    slotIndex,
    playerId: `${teamId}-${side}-${slotIndex}`,
    activePlayerId: `active-${teamId}-${side}-${slotIndex}`,
  }));
}

function createContext(input: {
  teamId: string;
  teamName: string;
  d1EntryCount: number;
  d1RequiredPlayers: number;
  d1Scores: number[];
  d2Scores: number[];
}): LegacyLineupLoadedContext {
  const entries = [
    ...buildEntries(input.teamId, "staffel", "d1", input.d1EntryCount),
    ...buildEntries(input.teamId, "fechten", "d2", input.d2Scores.length),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    entries,
    disciplinePlayerCounts: {
      staffel: input.d1RequiredPlayers,
      fechten: input.d2Scores.length,
    },
    activePlayers: entries.map((entry) => ({
      id: entry.activePlayerId ?? `missing-${entry.playerId}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: input.teamId,
      playerId: entry.playerId,
    })),
    disciplineScores: [
      ...input.d1Scores.map((score, index) => ({
        playerId: `${input.teamId}-d1-${index}`,
        disciplineId: "staffel",
        score,
      })),
      ...input.d2Scores.map((score, index) => ({
        playerId: `${input.teamId}-d2-${index}`,
        disciplineId: "fechten",
        score,
      })),
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
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: "staffel", name: "Staffel", category: "speed" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "staffel", originalOrder: 1, displayOrder: 1, playerCount: input.d1RequiredPlayers, mutator1: null, mutator2: null },
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
      d1DisciplineId: "staffel",
      d2DisciplineId: "fechten",
    },
    fatigueByPlayerId: {},
    fatigueSourceStatus: "mapped",
    injuryByPlayerId: null,
    injurySourceStatus: "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    mutatorSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    teamPowerSource: { selectionStatus: "ready", effectStatus: "ready", sourceLabel: "test", warnings: [] },
    formCards: [],
  } as unknown as LegacyLineupLoadedContext;
}

describe("surplus lineup entries cap (score engine)", () => {
  const entries = buildEntries("A-A", "staffel", "d1", 5);
  const disciplineScores = [80, 75, 70, 65, 60].map((score, index) => ({
    playerId: `A-A-d1-${index}`,
    disciplineId: "staffel",
    score,
  }));

  it("scores only the first requiredPlayers slots when a draft has surplus entries", () => {
    // ZENTRALER Rot-Nachweis: alter Code wertete alle 5 Eintraege (baseScore 350,
    // entries.length 5) — jetzt zaehlen nur die ersten 3 Slots (slotIndex-Ordnung).
    const result = scoreLegacyLineupDisciplineSide({
      disciplineId: "staffel",
      disciplineSide: "d1",
      matchdayId: "matchday-1",
      entries,
      disciplineScores,
      activePlayers: [],
      rosterPlayers: [],
      requiredPlayers: 3,
      fatigueByPlayerId: null,
      fatigueSourceStatus: "missing_source",
    });

    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((entry) => entry.playerId)).toEqual(["A-A-d1-0", "A-A-d1-1", "A-A-d1-2"]);
    expect(result.baseScore).toBe(225); // 80 + 75 + 70, NICHT 350
    expect(result.selectedPlayers).toBe(3);
    expect(result.isComplete).toBe(true);
    expect(result.validationWarnings.some((warning) => warning.includes("surplus entries are ignored"))).toBe(true);
  });

  it("keeps all entries when requiredPlayers is unknown or matches", () => {
    const unbounded = scoreLegacyLineupDisciplineSide({
      disciplineId: "staffel",
      disciplineSide: "d1",
      matchdayId: "matchday-1",
      entries,
      disciplineScores,
      activePlayers: [],
      rosterPlayers: [],
      requiredPlayers: null,
      fatigueByPlayerId: null,
      fatigueSourceStatus: "missing_source",
    });
    expect(unbounded.entries).toHaveLength(5);
    expect(unbounded.baseScore).toBe(350);

    const exact = scoreLegacyLineupDisciplineSide({
      disciplineId: "staffel",
      disciplineSide: "d1",
      matchdayId: "matchday-1",
      entries,
      disciplineScores,
      activePlayers: [],
      rosterPlayers: [],
      requiredPlayers: 5,
      fatigueByPlayerId: null,
      fatigueSourceStatus: "missing_source",
    });
    expect(exact.entries).toHaveLength(5);
    expect(exact.validationWarnings.some((warning) => warning.includes("surplus"))).toBe(false);
  });
});

describe("surplus lineup entries cap (resolve preview → arena stage count)", () => {
  it("stage slot count follows requiredPlayers, not a stale 5-entry draft", () => {
    // Team A: stale Draft mit 5 staffel-Eintraegen, Spieltag erlaubt 3.
    // Team B: regulaerer 3er-Draft. Frueher: slotCount = max(5, 3) = 5 Etappen,
    // aber nach Etappe 3 bewegte sich kein regulaeres Team mehr.
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({
        teamId: "A-A",
        teamName: "Alpha",
        d1EntryCount: 5,
        d1RequiredPlayers: 3,
        d1Scores: [80, 75, 70, 65, 60],
        d2Scores: [40, 35],
      }),
      createContext({
        teamId: "B-B",
        teamName: "Beta",
        d1EntryCount: 3,
        d1RequiredPlayers: 3,
        d1Scores: [50, 45, 40],
        d2Scores: [30, 25],
      }),
    ]);

    const staffelPreview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "staffel");
    expect(staffelPreview).toBeTruthy();
    expect(staffelPreview!.teamResults.map((team) => team.entries.length)).toEqual([3, 3]);

    // Arena-Mapping: slotCount = max players je Team — muss jetzt 3 sein (vorher 5).
    const stageTeams = buildDisciplineStageTeamsFromPreview(staffelPreview!, new Map(), new Map());
    const slotCount = stageTeams.reduce((max, team) => Math.max(max, team.players.length), 0);
    expect(slotCount).toBe(3);

    // Score-Fairness: das stale Team wertet 3 Spieler (80+75+70), nicht 5.
    const alpha = staffelPreview!.teamResults.find((team) => team.teamId === "A-A");
    expect(alpha?.baseScore).toBe(225);
  });
});
