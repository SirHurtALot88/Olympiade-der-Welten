import { describe, expect, it } from "vitest";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupPreview, buildAiLegacyLineupSuggestion } from "@/lib/ai/ai-legacy-lineup-engine";
import { evaluateLegacyAiNeeds } from "@/lib/ai/ai-needs-engine";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";

function createContext(): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    disciplinePlayerCounts: {
      tdm: 2,
      "mini-dm": 2,
    },
    disciplineSidePlayerCounts: {
      "tdm::d1": 2,
      "mini-dm::d2": 2,
    },
    activePlayers: [
      { id: "a1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p1", upkeep: 10 },
      { id: "a2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p2", upkeep: 10 },
      { id: "a3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p3", upkeep: 10 },
      { id: "a4", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p4", upkeep: 10 },
      { id: "a5", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p5", upkeep: 10 },
    ],
    disciplineScores: [
      { playerId: "p1", disciplineId: "tdm", score: 90 },
      { playerId: "p2", disciplineId: "tdm", score: 88 },
      { playerId: "p3", disciplineId: "tdm", score: 40 },
      { playerId: "p4", disciplineId: "tdm", score: 30 },
      { playerId: "p5", disciplineId: "tdm", score: 20 },
      { playerId: "p1", disciplineId: "mini-dm", score: 60 },
      { playerId: "p2", disciplineId: "mini-dm", score: 65 },
      { playerId: "p3", disciplineId: "mini-dm", score: 89 },
      { playerId: "p4", disciplineId: "mini-dm", score: 87 },
      { playerId: "p5", disciplineId: "mini-dm", score: 10 },
    ],
    save: {
      id: "save-1",
      name: "Save 1",
      status: "active",
    },
    season: {
      id: "season-1",
      saveId: "save-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      status: "active",
    },
    matchday: {
      id: "matchday-1",
      seasonId: "season-1",
      index: 1,
      label: "Spieltag 1",
      status: "planning",
    },
    team: {
      id: "A-A",
      shortCode: "A-A",
      name: "Armageddon Aftermath",
    },
    teamSeasonState: {
      id: "tss-1",
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      cash: 500,
      budget: 1000,
      rosterLimit: 6,
      playerOpt: 5,
    },
    teamIdentity: {
      pow: 80,
      spe: 60,
      men: 50,
      soc: 40,
    },
    teamStrategyProfile: {
      teamId: "A-A",
      strategySummary: "Fallout-/Endzeit-Kader. Isoliert, skeptisch und ablehnend gegen fremde Vibes.",
      buyStyle: "Kauft nur harte Ueberlebensprofile mit Endzeit-Fit und mentaler Zaehigkeit.",
      sellStyle: "Verkauft offene Fehlfits ohne Shelter-Mentalitaet schnell.",
      contractStyle: "Kurze Probephasen, lange Deals nur fuer echte Survivors.",
      rosterStyle: "Zaeher Kern mit Misstrauen gegen Fremdkoerper.",
      preferredArchetypes: ["survivor"],
      avoidedArchetypes: ["soft celebrity"],
      preferredRaces: [],
      avoidedRaces: [],
      preferredClasses: [],
      avoidedClasses: [],
      hardNoGos: ["fragile diva"],
      notes: null,
      bias: {
        cashPriority: 6,
        valuePriority: 6,
        starPriority: 4,
        riskTolerance: 6,
        wageSensitivity: 7,
        sellForProfitAggression: 5,
        shortContractPreference: 7,
        longContractPreference: 3,
        loyaltyBias: 4,
        harmonyStrictness: 6,
        rosterDepthPreference: 7,
        eliteSmallRosterPreference: 4,
      },
    },
    rosterPlayers: [
      { id: "p1", name: "Player 1", coreStats: { pow: 80, spe: 20, men: 20, soc: 20 } },
      { id: "p2", name: "Player 2", coreStats: { pow: 75, spe: 30, men: 25, soc: 25 } },
      { id: "p3", name: "Player 3", coreStats: { pow: 20, spe: 70, men: 80, soc: 30 } },
      { id: "p4", name: "Player 4", coreStats: { pow: 15, spe: 75, men: 75, soc: 25 } },
      { id: "p5", name: "Player 5", coreStats: { pow: 10, spe: 10, men: 10, soc: 10 } },
    ],
    disciplines: [
      { id: "tdm", name: "TDM", category: "tactics" },
      { id: "mini-dm", name: "Mini DM", category: "tactics" },
    ],
    disciplineWeights: [
      { disciplineId: "tdm", attributeKey: "power", weightPct: 28 },
      { disciplineId: "tdm", attributeKey: "health", weightPct: 20 },
      { disciplineId: "tdm", attributeKey: "determination", weightPct: 6 },
      { disciplineId: "tdm", attributeKey: "spirit", weightPct: 12 },
      { disciplineId: "mini-dm", attributeKey: "torment", weightPct: 24 },
      { disciplineId: "mini-dm", attributeKey: "health", weightPct: 20 },
      { disciplineId: "mini-dm", attributeKey: "power", weightPct: 16 },
      { disciplineId: "mini-dm", attributeKey: "stamina", weightPct: 16 },
    ],
    seasonDisciplineConfigs: [
      { disciplineId: "tdm", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
      { disciplineId: "mini-dm", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
    ],
    teamStatus: {
      lineupFilledCount: 0,
      totalLineupSides: 20,
      captainUsedCount: 0,
      captainSlots: 3,
      displayLabel: "A-A · Lineup 0/20 · Captain 0/3",
    },
    captainRule: {
      seasonCaptainSlots: 3,
      perDisciplineSideMaxCaptains: 1,
      sourceStatus: "mapped_with_transform",
    },
    existingDraft: null,
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      d1DisciplineId: "tdm",
      d2DisciplineId: "mini-dm",
    },
  };
}

describe("legacy ai needs", () => {
  it("returns structured needs for team and matchday", () => {
    const result = evaluateLegacyAiNeeds(createContext());

    expect(result.teamId).toBe("A-A");
    expect(result.matchdayId).toBe("matchday-1");
    expect(result.d1NeedSummary.disciplineId).toBe("tdm");
    expect(result.d2NeedSummary.disciplineId).toBe("mini-dm");
    expect(["d1", "d2", "balanced"]).toContain(result.recommendedPriority);
  });
});

describe("legacy ai lineup suggestion", () => {
  it("matches playerCount for d1 and d2", () => {
    const suggestion = buildAiLegacyLineupSuggestion(createContext());
    const d1 = suggestion.entries.filter((entry) => entry.disciplineSide === "d1");
    const d2 = suggestion.entries.filter((entry) => entry.disciplineSide === "d2");

    expect(d1).toHaveLength(2);
    expect(d2).toHaveLength(2);
  });

  it("does not use any player twice", () => {
    const suggestion = buildAiLegacyLineupSuggestion(createContext());
    const playerIds = suggestion.entries.map((entry) => entry.playerId);

    expect(new Set(playerIds).size).toBe(playerIds.length);
  });

  it("uses only active players from the team", () => {
    const context = createContext();
    const suggestion = buildAiLegacyLineupSuggestion(context);
    const activeIds = new Set(context.activePlayers.map((player) => player.playerId));

    expect(suggestion.entries.every((entry) => activeIds.has(entry.playerId))).toBe(true);
  });

  it("does not persist per-team mutator traits in AI lineup modifiers anymore", () => {
    const context = createContext();
    context.rosterPlayers = [
      { id: "p1", name: "Player 1", traitsPositive: ["Cool", "Diligent"], traitsNegative: [], coreStats: { pow: 80, spe: 20, men: 20, soc: 20 } },
      { id: "p2", name: "Player 2", traitsPositive: ["Cool", "Diligent"], traitsNegative: [], coreStats: { pow: 75, spe: 30, men: 25, soc: 25 } },
      { id: "p3", name: "Player 3", traitsPositive: ["Ambitious"], traitsNegative: [], coreStats: { pow: 20, spe: 70, men: 80, soc: 30 } },
      { id: "p4", name: "Player 4", traitsPositive: ["Flexible"], traitsNegative: [], coreStats: { pow: 15, spe: 75, men: 75, soc: 25 } },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "a2" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "a3" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 3, playerId: "p4", activePlayerId: "a4" },
    ]);

    expect(modifiers.d1.mutatorTrait1).toBeNull();
    expect(modifiers.d1.mutatorTrait2).toBeNull();
  });

  it("prefers fresher players when fatigue and injury risk are elevated", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) => {
      if (score.disciplineId !== "tdm") return score;
      if (score.playerId === "p1") return { ...score, score: 91 };
      if (score.playerId === "p2") return { ...score, score: 90 };
      if (score.playerId === "p3") return { ...score, score: 55 };
      if (score.playerId === "p4") return { ...score, score: 52 };
      return score;
    });
    context.rosterPlayers = context.rosterPlayers.map((player) => ({
      ...player,
      fatigue: player.id === "p1" ? 92 : player.id === "p2" ? 88 : player.id === "p3" ? 18 : 15,
      injuryRiskPercent: player.id === "p1" ? 28 : player.id === "p2" ? 25 : 5,
    }));
    context.lineupStrategy = "rotate_depth";

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);

    expect(d1Players).toContain("p3");
    expect(d1Players).toContain("p4");
    expect(d1Players).not.toContain("p1");
    expect(d1Players).not.toContain("p2");
  });

  it("rests a fatigued star (7b) when the marginal opportunity cost over the bench is low", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) => {
      if (score.disciplineId !== "tdm") return score;
      if (score.playerId === "p1") return { ...score, score: 88 };
      if (score.playerId === "p2") return { ...score, score: 54 };
      if (score.playerId === "p3") return { ...score, score: 80 };
      if (score.playerId === "p4") return { ...score, score: 52 };
      if (score.playerId === "p5") return { ...score, score: 20 };
      return score;
    });
    // Only p1 is fatigued (>=70 floor); everyone else is fresh. p1's raw score still
    // ranks 2nd overall (ahead of p2/p4/p5), so the old flat health penalty alone would
    // still start them -- the opportunity-cost rotation should bench them here because the
    // best bench replacement (p2) is close enough that resting p1 is worth it.
    context.rosterPlayers = context.rosterPlayers.map((player) => ({
      ...player,
      fatigue: player.id === "p1" ? 70 : 0,
    }));

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);

    expect(d1Players).toContain("p3");
    expect(d1Players).toContain("p2");
    expect(d1Players).not.toContain("p1");
  });

  it("keeps a fatigued star (7b) in a decisive slot where no bench replacement comes close", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) => {
      if (score.disciplineId !== "tdm") return score;
      if (score.playerId === "p1") return { ...score, score: 90 };
      if (score.playerId === "p2") return { ...score, score: 20 };
      if (score.playerId === "p3") return { ...score, score: 80 };
      if (score.playerId === "p4") return { ...score, score: 15 };
      if (score.playerId === "p5") return { ...score, score: 10 };
      return score;
    });
    // Same fatigue level as above (p1 at 70), but now every bench alternative is far
    // weaker -- resting p1 would cost far more than the rest benefit, so they must play.
    context.rosterPlayers = context.rosterPlayers.map((player) => ({
      ...player,
      fatigue: player.id === "p1" ? 70 : 0,
    }));

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);

    expect(d1Players).toContain("p1");
    expect(d1Players).toContain("p3");
  });

  it("avoids injured roster players because they are not selectable active players", () => {
    const context = createContext();
    context.activePlayers = context.activePlayers.filter((player) => player.playerId !== "p1");
    context.rosterPlayers = context.rosterPlayers.map((player) =>
      player.id === "p1"
        ? {
            ...player,
            injuryStatus: "injured",
            injuryUntilMatchday: "matchday-2",
            availabilityBlocker: "player_injured_unavailable",
          }
        : player,
    );

    const suggestion = buildAiLegacyLineupSuggestion(context);

    expect(suggestion.entries.some((entry) => entry.playerId === "p1")).toBe(false);
  });

  it("uses the legacy score engine consistently", () => {
    const context = createContext();
    const suggestion = buildAiLegacyLineupSuggestion(context);

    const d1Score = scoreLegacyLineupDisciplineSide({
      disciplineId: "tdm",
      disciplineSide: "d1",
      entries: suggestion.entries,
      disciplineScores: context.disciplineScores,
    });
    const d2Score = scoreLegacyLineupDisciplineSide({
      disciplineId: "mini-dm",
      disciplineSide: "d2",
      entries: suggestion.entries,
      disciplineScores: context.disciplineScores,
    });

    expect(suggestion.scorePreview.totalScore).toBe(d1Score.totalScore + d2Score.totalScore);
  });

  it("uses team identity only as soft tie-breaker", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) =>
      score.disciplineId === "tdm" && (score.playerId === "p1" || score.playerId === "p2")
        ? { ...score, score: 90 }
        : score,
    );

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);

    expect(d1Players).toContain("p1");
    expect(d1Players).toContain("p2");
  });

  it("does not apply slot-v2, formcards, captain or tactics", () => {
    const suggestion = buildAiLegacyLineupSuggestion(createContext());

    expect(suggestion.scorePreview.missingScores).toEqual([]);
    expect(suggestion.debugReasoning.length).toBeGreaterThan(0);
    expect(suggestion.warnings.some((warning) => warning.toLowerCase().includes("captain"))).toBe(false);
  });

  it("builds a read-only ai preview with captain suggestions per side", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) =>
      score.playerId === "p1" && score.disciplineId === "tdm"
        ? { ...score, score: 98 }
        : score.playerId === "p3" && score.disciplineId === "mini-dm"
          ? { ...score, score: 97 }
          : score,
    );
    const preview = buildAiLegacyLineupPreview(context);
    const captainEntries = preview.entries.filter((entry) => entry.isCaptain);

    expect(preview.readOnly).toBe(true);
    expect(preview.source).toBe("sqlite");
    expect(preview.status).toBe("ready");
    expect(preview.teamCode).toBe("A-A");
    expect(preview.captainSlotsUsed).toBe(0);
    expect(preview.captainSlotsRemaining).toBe(2);
    expect(preview.d1.selectedPlayers).toBe(2);
    expect(preview.d2.selectedPlayers).toBe(2);
    expect(preview.d1.missingSlots).toBe(0);
    expect(preview.d2.missingSlots).toBe(0);
    expect([preview.d1.captainSelectionStatus, preview.d2.captainSelectionStatus]).toContain("selected");
    expect(preview.d1.selectedEntries).toHaveLength(2);
    expect(preview.d2.selectedEntries).toHaveLength(2);
    expect(captainEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps captain suggestions inside the selected team players without duplicates", () => {
    const context = createContext();
    const preview = buildAiLegacyLineupPreview(context);
    const activeIds = new Set(context.activePlayers.map((player) => player.playerId));
    const selectedIds = preview.entries.map((entry) => entry.playerId);

    expect(preview.entries.every((entry) => activeIds.has(entry.playerId))).toBe(true);
    expect(new Set(selectedIds).size).toBe(selectedIds.length);
    expect(preview.entries.filter((entry) => entry.isCaptain).every((entry) => selectedIds.includes(entry.playerId))).toBe(true);
  });

  it("surfaces fatigue hints from the mapped local source instead of faking clean values", () => {
    const context = createContext();
    context.fatigueByPlayerId = {
      p1: { count: 2, multiplier: 0.9 },
      p3: { count: 1, multiplier: 0.95 },
    };
    context.fatigueSourceStatus = "mapped";

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.d1.fatigueWarnings.some((warning) => warning.includes("Fatigue"))).toBe(true);
    expect(preview.scorePreview.fatigueStatus).toBe("mapped");
  });

  it("uses only the remaining captain slots for the current season draft", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.map((score) =>
      score.playerId === "p1" && score.disciplineId === "tdm"
        ? { ...score, score: 98 }
        : score.playerId === "p3" && score.disciplineId === "mini-dm"
          ? { ...score, score: 97 }
          : score,
    );
    context.teamStatus = {
      ...context.teamStatus!,
      captainUsedCount: 2,
    };

    const preview = buildAiLegacyLineupPreview(context);
    const captainEntries = preview.entries.filter((entry) => entry.isCaptain);

    expect(preview.captainSlotsUsed).toBe(2);
    expect(preview.captainSlotsRemaining).toBe(0);
    expect(captainEntries).toHaveLength(1);
    expect(preview.d1.captainSelectionStatus === "selected" || preview.d2.captainSelectionStatus === "selected").toBe(true);
    expect(preview.warnings.some((warning) => warning.includes("Captain gespart") || warning === "captain_limit_reached")).toBe(true);
  });

  it("uses a captain in midseason top-six windows for large disciplines", () => {
    const context = createContext();
    context.matchday = {
      ...context.matchday,
      index: 5,
      label: "Spieltag 5",
    };
    context.season = {
      ...context.season,
      currentMatchday: 5,
    };
    context.matchdayContract = {
      matchdayIndex: 5,
      matchdayId: "matchday-1",
      matchdayLabel: "Spieltag 5",
      totalDisciplineSidesInSeason: 20,
      seasonCaptainSlots: 3,
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        requiredPlayers: 5,
        requiredCaptains: 0,
        category: "power",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d1",
      },
      discipline2: {
        disciplineId: "mini-dm",
        displayName: "Mini DM",
        requiredPlayers: 2,
        requiredCaptains: 0,
        category: "speed",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d2",
      },
    };
    context.disciplinePlayerCounts = {
      ...context.disciplinePlayerCounts,
      tdm: 5,
    };
    context.disciplineSidePlayerCounts = {
      ...context.disciplineSidePlayerCounts,
      "tdm::d1": 5,
    };
    context.teamDisciplineRanks = {
      tdm: {
        disciplineId: "tdm",
        teamId: "A-A",
        rank: 5,
        score: 390,
      },
    };
    context.activePlayers = [
      ...context.activePlayers,
      { id: "a6", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p6", upkeep: 10 },
      { id: "a7", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "p7", upkeep: 10 },
    ];
    context.rosterPlayers = [
      ...context.rosterPlayers,
      { id: "p6", name: "Player 6", coreStats: { pow: 10, spe: 70, men: 70, soc: 20 } },
      { id: "p7", name: "Player 7", coreStats: { pow: 10, spe: 65, men: 65, soc: 20 } },
    ];
    context.disciplineScores = [
      ...context.disciplineScores.map((score) =>
        score.disciplineId === "tdm" && score.playerId === "p1"
          ? { ...score, score: 90 }
          : score.disciplineId === "tdm" && score.playerId === "p2"
            ? { ...score, score: 82 }
            : score.disciplineId === "tdm" && score.playerId === "p3"
              ? { ...score, score: 80 }
              : score.disciplineId === "tdm" && score.playerId === "p4"
                ? { ...score, score: 78 }
                : score.disciplineId === "tdm" && score.playerId === "p5"
                  ? { ...score, score: 76 }
                  : score,
      ),
      { playerId: "p6", disciplineId: "tdm", score: 30 },
      { playerId: "p7", disciplineId: "tdm", score: 25 },
      { playerId: "p6", disciplineId: "mini-dm", score: 75 },
      { playerId: "p7", disciplineId: "mini-dm", score: 73 },
    ];

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.d1.captainSelectionStatus).toBe("selected");
    expect(preview.entries.some((entry) => entry.disciplineId === "tdm" && entry.isCaptain)).toBe(true);
    expect(preview.warnings.some((warning) => warning.includes("große Diszi absichern"))).toBe(true);
  });

  it("skips captain suggestions entirely once the season captain limit is already reached", () => {
    const context = createContext();
    context.teamStatus = {
      ...context.teamStatus!,
      captainUsedCount: 3,
    };

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.entries.some((entry) => entry.isCaptain)).toBe(false);
    expect(preview.d1.captainSelectionStatus).toBe("skipped_limit_reached");
    expect(preview.d2.captainSelectionStatus).toBe("skipped_limit_reached");
    expect(preview.d1.captainName).toBeNull();
    expect(preview.d2.captainName).toBeNull();
    expect(preview.warnings).toContain("captain_limit_reached");
  });

  it("does not double-count captain sides that were already consumed earlier in the season", () => {
    const context = createContext();
    context.teamStatus = {
      ...context.teamStatus!,
      captainUsedCount: 3,
      captainUsedSides: ["tdm::d1", "mini-dm::d2", "speed-schach::d1"],
    };

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.entries.filter((entry) => entry.isCaptain)).toHaveLength(2);
    expect(preview.scorePreview.validationWarnings).not.toContain(
      expect.stringContaining("Season captain limit"),
    );
  });

  it("marks missing discipline scores as missing_scores instead of faking a ready preview", () => {
    const context = createContext();
    context.disciplineScores = context.disciplineScores.filter(
      (entry) =>
        !(
          entry.disciplineId === "mini-dm" &&
          (entry.playerId === "p3" || entry.playerId === "p4" || entry.playerId === "p5")
        ),
    );

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.status).toBe("missing_scores");
    expect(preview.d2.status).toBe("missing_scores");
    expect(preview.d2.warnings.some((warning) => warning.includes("Missing score"))).toBe(true);
  });

  it("marks too-small rosters as incomplete_roster", () => {
    const context = createContext();
    context.activePlayers = context.activePlayers.slice(0, 3);
    context.rosterPlayers = context.rosterPlayers.slice(0, 3);

    const preview = buildAiLegacyLineupPreview(context);

    expect(preview.status).toBe("incomplete_roster");
    expect(preview.d2.status).toBe("incomplete_roster");
    expect(preview.d2.missingSlots).toBeGreaterThan(0);
  });

  it("includes strategy profile context in the read-only explanation", () => {
    const preview = buildAiLegacyLineupPreview(createContext());

    expect(preview.explanation).toContain("Fallout-/Endzeit-Kader");
    expect(preview.debugReasoning.some((entry) => entry.includes("Strategy:"))).toBe(true);
  });

  it("ships concrete example strategy profiles for Zero Heroes, Cash Creators, Dire Legion and Wicked Wizards", () => {
    const gameState = createFreshSeasonOneGameState();

    const zeroHeroes = getTeamStrategyProfile(gameState, "Z-H");
    const cashCreators = getTeamStrategyProfile(gameState, "C-C");
    const direLegion = getTeamStrategyProfile(gameState, "D-L");
    const wickedWizards = getTeamStrategyProfile(gameState, "W-W");

    expect(zeroHeroes?.strategySummary).toContain("Underground");
    expect(zeroHeroes?.strategyVersion).toContain("+gm-v2");
    expect(zeroHeroes?.bias.riskTolerance).toBe(10);
    expect(cashCreators?.strategySummary).toContain("Bank der Olympiade");
    expect(cashCreators?.bias.cashPriority).toBe(10);
    expect(direLegion?.preferredRaces).toContain("human");
    expect(direLegion?.avoidedRaces).toContain("demon");
    expect(wickedWizards?.preferredArchetypes).toContain("mage");
    expect(wickedWizards?.strategySummary).toContain("Magier");
  });
});
