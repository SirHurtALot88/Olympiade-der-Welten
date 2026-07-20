import { describe, expect, it } from "vitest";

import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { buildMatchdayMutatorTraitsBySide } from "@/lib/lineups/legacy-lineup-modifiers";
import { buildLegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-engine";
import { buildLegacyMatchdayResolvePreviewPayload } from "@/lib/foundation/legacy-matchday-resolve-preview-service";

function createContext(input: {
  teamId: string;
  teamName: string;
  d1Scores: number[];
  d2Scores: number[];
  withLineup?: boolean;
  fatigueByPlayerId?: Record<string, { count: number; multiplier: number }> | null;
  fatigueSourceStatus?: "mapped" | "missing_source";
  injuryByPlayerId?: Record<string, { injuredThisMatchday: boolean; multiplier: number }> | null;
  injurySourceStatus?: "mapped" | "not_applied";
}): LegacyLineupLoadedContext {
  const withLineup = input.withLineup ?? true;
  const entries = withLineup
    ? [
        ...input.d1Scores.map((score, index) => ({
          disciplineId: "mini-dm",
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
      ]
    : [];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: input.teamId,
    entries,
    disciplinePlayerCounts: {
      "mini-dm": input.d1Scores.length,
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
        disciplineId: "mini-dm",
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
      { id: "mini-dm", name: "Mini DM", category: "tactics" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "mini-dm", originalOrder: 1, displayOrder: 1, playerCount: input.d1Scores.length, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: input.d2Scores.length, mutator1: null, mutator2: null },
    ],
    existingDraft: withLineup
      ? {
          lineupId: `lineup-${input.teamId}`,
          saveId: "save-1",
          seasonId: "season-1",
          matchdayId: "matchday-1",
          teamId: input.teamId,
          status: "draft",
          entries,
          modifiers: {
            d1: {
              primaryFormCardId: null,
              secondaryFormCardId: null,
              mutatorTrait1: null,
              mutatorTrait2: null,
            },
            d2: {
              primaryFormCardId: null,
              secondaryFormCardId: null,
              mutatorTrait1: null,
              mutatorTrait2: null,
            },
          },
          createdAt: "2026-06-03T00:00:00.000Z",
          updatedAt: "2026-06-03T00:00:00.000Z",
        }
      : null,
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: input.teamId,
      d1DisciplineId: "mini-dm",
      d2DisciplineId: "fechten",
    },
    fatigueByPlayerId: input.fatigueByPlayerId ?? null,
    fatigueSourceStatus: input.fatigueSourceStatus ?? "missing_source",
    injuryByPlayerId: input.injuryByPlayerId ?? null,
    injurySourceStatus: input.injurySourceStatus ?? "not_applied",
    contextLoadMode: "sqlite_local",
    formCardSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    mutatorSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    teamPowerSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "test",
      warnings: [],
    },
    formCards: [],
  };
}

describe("legacy matchday resolve preview", () => {
  it("marks complete lineups as ready", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({
        teamId: "A-A",
        teamName: "Alpha",
        d1Scores: [10, 30],
        d2Scores: [40],
        fatigueByPlayerId: {},
        fatigueSourceStatus: "mapped",
      }),
    ]);

    expect(preview.status).toBe("ready");
    expect(preview.teamResults[0]?.status).toBe("ready");
    expect(preview.teamResults[0]?.d1Status).toBe("ready");
    expect(preview.teamResults[0]?.d2Status).toBe("ready");
  });

  it("sorts top players by score", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [20, 15], d2Scores: [35] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    expect(d1Preview?.topPlayers.slice(0, 3).map((player) => player.finalPlayerScore)).toEqual([30, 20, 15]);
  });

  it("maps discipline rank points from the real table and distributes them by base share", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [30, 10], d2Scores: [40, 39, 38, 37, 36] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [20, 5], d2Scores: [35, 34, 33, 32, 31] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const alpha = d1Preview?.teamResults.find((team) => team.teamId === "A-A");
    const beta = d1Preview?.teamResults.find((team) => team.teamId === "B-B");
    const alphaTop = d1Preview?.topPlayers.find((player) => player.playerId === "A-A-d1-0");
    const alphaSecond = d1Preview?.topPlayers.find((player) => player.playerId === "A-A-d1-1");

    expect(alpha?.teamPoints).toBe(6.6);
    expect(beta?.teamPoints).toBe(6.2);
    expect(alphaTop?.pointsAwarded).toBe(4.95);
    expect(alphaSecond?.pointsAwarded).toBe(1.65);
  });

  it("uses final preview contribution for top players and team discipline scores", () => {
    const captainContext = createContext({
      teamId: "A-A",
      teamName: "Alpha",
      d1Scores: [20, 30],
      d2Scores: [10],
      fatigueByPlayerId: {
        "A-A-d1-0": { count: 1, multiplier: 0.95 },
        "A-A-d1-1": { count: 1, multiplier: 0.9 },
        "A-A-d2-0": { count: 0, multiplier: 1 },
      },
      fatigueSourceStatus: "mapped",
    });
    if (captainContext.existingDraft) {
      captainContext.existingDraft.entries[1]!.isCaptain = true;
    }

    const preview = buildLegacyMatchdayResolvePreview([
      captainContext,
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [25, 10], d2Scores: [12] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    expect(d1Preview?.teamResults[0]?.fatigueModifier).toBe(-4);
    expect(d1Preview?.teamResults[0]?.finalPreviewScore).toBe(59.5);
    expect(d1Preview?.topPlayers[0]?.finalPlayerScore).toBe(40.5);
    expect(d1Preview?.topPlayers[0]?.captainBonus).toBe(13.5);
  });

  it("applies same-day injury malus on top of fatigue during resolve scoring", () => {
    const baselineContext = createContext({
      teamId: "A-A",
      teamName: "Alpha",
      d1Scores: [100],
      d2Scores: [],
      fatigueByPlayerId: {
        "A-A-d1-0": { count: 80, multiplier: 0.75 },
      },
      fatigueSourceStatus: "mapped",
      injurySourceStatus: "not_applied",
    });
    const injuredContext = createContext({
      teamId: "A-A",
      teamName: "Alpha",
      d1Scores: [100],
      d2Scores: [],
      fatigueByPlayerId: {
        "A-A-d1-0": { count: 80, multiplier: 0.75 },
      },
      fatigueSourceStatus: "mapped",
      injuryByPlayerId: {
        "A-A-d1-0": { injuredThisMatchday: true, multiplier: 0.75 },
      },
      injurySourceStatus: "mapped",
    });

    const baselinePreview = buildLegacyMatchdayResolvePreview([baselineContext]);
    const injuredPreview = buildLegacyMatchdayResolvePreview([injuredContext]);
    const baselineD1 = baselinePreview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const injuredD1 = injuredPreview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");

    expect(baselineD1?.teamResults[0]?.finalPreviewScore).toBe(75);
    expect(injuredD1?.teamResults[0]?.finalPreviewScore).toBe(56.3);
  });

  it("computes rankInTeam correctly", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const topTeamPlayer = d1Preview?.topPlayers.find((player) => player.playerId === "A-A-d1-1");
    expect(topTeamPlayer?.rankInTeam).toBe(1);
  });

  it("computes rankInDiscipline correctly", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [20, 15], d2Scores: [35] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const second = d1Preview?.topPlayers.find((player) => player.playerId === "B-B-d1-0");
    expect(second?.rankInDiscipline).toBe(2);
  });

  it("creates highlight candidates without inventing facts", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [20, 15], d2Scores: [35] }),
    ]);

    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    expect(d1Preview?.highlightCandidates.map((candidate) => candidate.highlightType)).toContain("best_player_discipline");
    expect(d1Preview?.highlightCandidates.map((candidate) => candidate.highlightType)).toContain("strongest_team_score");
  });

  it("reports missing lineups as warnings and highlight candidates", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40] }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [20, 15], d2Scores: [35], withLineup: false }),
    ]);

    expect(preview.missingLineups).toHaveLength(1);
    expect(preview.status).toBe("missing_lineups");
    expect(preview.teamResults.find((team) => team.teamId === "B-B")?.status).toBe("missing_lineups");
    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    expect(d1Preview?.highlightCandidates.map((candidate) => candidate.highlightType)).toContain("missing_lineup_warning");
  });

  it("marks prisma-like preview without fatigue source as missing_sources", () => {
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({
        teamId: "A-A",
        teamName: "Alpha",
        d1Scores: [10, 30],
        d2Scores: [40],
        fatigueSourceStatus: "missing_source",
      }),
    ]);

    expect(preview.status).toBe("missing_sources");
    expect(preview.teamResults[0]?.status).toBe("missing_sources");
    expect(preview.teamResults[0]?.d1Status).toBe("missing_sources");
  });

  it("marks incomplete lineups clearly", () => {
    const context = createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [30, 20], d2Scores: [10, 9, 8] });
    context.disciplinePlayerCounts = { "mini-dm": 2, fechten: 5 };
    const preview = buildLegacyMatchdayResolvePreview([context]);

    expect(preview.status).toBe("incomplete_lineups");
    expect(preview.incompleteLineups).toHaveLength(1);
    expect(preview.teamResults[0]?.d2Status).toBe("incomplete_lineups");
  });

  it("integrates form and mutator effects into final resolve score and keeps player points reconciled", () => {
    const alpha = createContext({
      teamId: "A-A",
      teamName: "Alpha",
      d1Scores: [20, 20],
      d2Scores: [10],
      fatigueByPlayerId: {},
      fatigueSourceStatus: "mapped",
    });
    const beta = createContext({
      teamId: "B-B",
      teamName: "Beta",
      d1Scores: [23, 22],
      d2Scores: [10],
      fatigueByPlayerId: {},
      fatigueSourceStatus: "mapped",
    });

    alpha.formCards = [
      {
        id: "form-1",
        playerId: "A-A-d1-0",
        playerName: "A-A-d1-0",
        color: "red",
        value: 4,
        isUsed: false,
        usedByLineupId: null,
      },
      {
        id: "form-2",
        playerId: "A-A-d1-1",
        playerName: "A-A-d1-1",
        color: "blue",
        value: 2,
        isUsed: false,
        usedByLineupId: null,
      },
    ];
    const matchdayMutators = buildMatchdayMutatorTraitsBySide({
      saveId: alpha.saveId,
      seasonId: alpha.seasonId,
      matchdayId: alpha.matchdayId,
      d1DisciplineId: alpha.contextMeta.d1DisciplineId,
      d2DisciplineId: alpha.contextMeta.d2DisciplineId,
    }).d1;
    alpha.rosterPlayers[0] = {
      ...alpha.rosterPlayers[0]!,
      traitsPositive: matchdayMutators,
      traitsNegative: [],
    };
    if (alpha.existingDraft) {
      alpha.existingDraft.modifiers.d1.primaryFormCardId = "form-1";
      alpha.existingDraft.modifiers.d1.secondaryFormCardId = "form-2";
    }

    const preview = buildLegacyMatchdayResolvePreview([alpha, beta]);
    const d1Preview = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const alphaTeam = d1Preview?.teamResults.find((team) => team.teamId === "A-A");
    const betaTeam = d1Preview?.teamResults.find((team) => team.teamId === "B-B");
    const alphaPlayer = d1Preview?.topPlayers.find((player) => player.playerId === "A-A-d1-0");
    const alphaEntryPoints =
      alphaTeam?.entries.reduce((sum, entry) => sum + (entry.pointsAwarded ?? 0), 0) ?? null;

    // Form ist jetzt PRO SPIELER (flacher Kartenwert + ±4-Jitter). Nominal = 12
    // (= 6/Spieler × 2 Spieler); die tatsächliche Team-Form-Summe wackelt bewusst
    // im Band nominal ± 4×Spieleranzahl. Der Rest (Mutator, Ranks, Team-PP) fix.
    expect(alphaTeam?.formModifier).toBeGreaterThanOrEqual(12 - 8);
    expect(alphaTeam?.formModifier).toBeLessThanOrEqual(12 + 8);
    expect(alphaTeam?.mutatorModifier).toBe(12);
    // finalPreviewScore = Basis (64 inkl. Nominalform 12) − Nominalform + tatsächliche Form.
    expect(alphaTeam?.finalPreviewScore).toBeCloseTo(64 - 12 + (alphaTeam?.formModifier ?? 0), 1);
    expect(betaTeam?.finalPreviewScore).toBe(45); // Beta hat keine Formkarten → unverändert
    expect(alphaTeam?.rank).toBe(1);
    expect(betaTeam?.rank).toBe(2);
    expect(alphaTeam?.teamPoints).toBe(6.6);
    expect(betaTeam?.teamPoints).toBe(6.2);
    expect(alphaPlayer?.mutatorBonus).toBe(12);
    expect(alphaPlayer?.mutatorPpsBonus).toBe(0.3);
    // finalPlayerScore enthält jetzt den Pro-Spieler-Form-Anteil (war 32 OHNE Form,
    // jetzt 32 + Formanteil ≈ 6 ± 4).
    expect(alphaPlayer?.finalPlayerScore).toBeGreaterThan(32);
    expect(alphaPlayer?.finalPlayerScore).toBeLessThanOrEqual(32 + 10);
    // Reconciliation bleibt exakt: Σ verteilte Spieler-PP == Team-PP.
    expect(alphaEntryPoints).toBe(alphaTeam?.teamPoints);
  });

  it("assigns team-entry pointsAwarded to the correct player when slot order != score order", () => {
    // Slot 0 schwächer (10) als Slot 1 (30): distributedPoints ist score-absteigend
    // sortiert, rankedTeam.entries in Slot-Reihenfolge. Ein Index-Zip würde die PP
    // vertauschen (der 10er-Spieler bekäme den 30er-Anteil). Kein Fatigue/Form →
    // finalPlayerScore == base, deterministisch.
    const preview = buildLegacyMatchdayResolvePreview([
      createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [10, 30], d2Scores: [40], fatigueByPlayerId: {}, fatigueSourceStatus: "mapped" }),
      createContext({ teamId: "B-B", teamName: "Beta", d1Scores: [5, 6], d2Scores: [35], fatigueByPlayerId: {}, fatigueSourceStatus: "mapped" }),
    ]);
    const d1 = preview.disciplinePreviews.find((discipline) => discipline.disciplineId === "mini-dm");
    const alpha = d1?.teamResults.find((team) => team.teamId === "A-A");
    const weak = alpha?.entries.find((entry) => entry.playerId === "A-A-d1-0"); // Score 10
    const strong = alpha?.entries.find((entry) => entry.playerId === "A-A-d1-1"); // Score 30
    // Der stärkere Spieler MUSS in der Team-Entries-Ansicht mehr PP haben.
    expect(strong?.pointsAwarded ?? 0).toBeGreaterThan(weak?.pointsAwarded ?? 0);
    // Und die pro Spieler zugeordneten PP stimmen mit dem topPlayers-Pfad überein.
    const strongTop = d1?.topPlayers.find((player) => player.playerId === "A-A-d1-1");
    expect(strong?.pointsAwarded).toBe(strongTop?.pointsAwarded);
  });

  it("marks missing discipline scores clearly", () => {
    const context = createContext({ teamId: "A-A", teamName: "Alpha", d1Scores: [30, 20], d2Scores: [10] });
    context.disciplineScores = context.disciplineScores.filter((entry) => !(entry.playerId === "A-A-d1-1" && entry.disciplineId === "mini-dm"));
    const preview = buildLegacyMatchdayResolvePreview([context]);

    expect(preview.status).toBe("missing_scores");
    expect(preview.teamResults[0]?.d1Status).toBe("missing_scores");
    expect(preview.teamResults[0]?.missingScores.length).toBeGreaterThan(0);
  });
});

describe("legacy matchday resolve preview payload", () => {
  it("does not expose failed context load errors as user-facing warnings", () => {
    const context = createContext({
      teamId: "A-A",
      teamName: "Alpha",
      d1Scores: [10, 30],
      d2Scores: [40],
    });

    const payload = buildLegacyMatchdayResolvePreviewPayload({
      source: "sqlite",
      params: { saveId: "save-1", seasonId: "season-1", matchdayId: "matchday-1" },
      contextResults: [
        { ok: true, context, warnings: ["context-warning"] },
        { ok: false, errors: ["team-load-failed"], warnings: [] },
      ],
    });

    expect(payload).not.toBeNull();
    expect(payload?.warnings).toContain("context-warning");
    expect(payload?.warnings).not.toContain("team-load-failed");
  });
});
