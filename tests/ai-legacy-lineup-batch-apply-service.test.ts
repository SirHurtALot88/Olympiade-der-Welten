import { describe, expect, it } from "vitest";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

function createContext(
  formCards: NonNullable<LegacyLineupLoadedContext["formCards"]>,
  options: { d2Category?: string; d2DisciplineId?: string } = {},
): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    entries: [],
    disciplinePlayerCounts: {},
    activePlayers: [],
    disciplineScores: [],
    rosterPlayers: [],
    formCards,
    matchday: { index: 1 },
    season: { currentMatchday: 1 },
    matchdayContract: {
      matchdayId: "matchday-1",
      matchdayLabel: "MD1",
      matchdayIndex: 1,
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        requiredPlayers: 2,
        requiredCaptains: 0,
        category: "power",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d1",
      },
      discipline2: {
        disciplineId: options.d2DisciplineId ?? "spurt",
        displayName: "Spurt",
        requiredPlayers: 2,
        requiredCaptains: 0,
        category: options.d2Category ?? "speed",
        rankSource: null,
        rankSourceStatus: "mapped",
        sourceStatus: "season_seed",
        disciplineSide: "d2",
      },
      seasonCaptainSlots: 0,
      totalDisciplineSidesInSeason: 2,
    },
  } as unknown as LegacyLineupLoadedContext;
}

describe("AI legacy lineup form-card planning", () => {
  it("does not place a negative form card on a matching-color discipline", () => {
    const modifiers = buildAiLegacyLineupModifiers(
      createContext([
        {
          id: "negative-red",
          playerId: "p-red",
          playerName: "Red Player",
          color: "red",
          value: -8,
          isUsed: false,
          usedByLineupId: null,
        },
        {
          id: "negative-green",
          playerId: "p-green",
          playerName: "Green Player",
          color: "green",
          value: -8,
          isUsed: false,
          usedByLineupId: null,
        },
        {
          id: "positive-red",
          playerId: "p-red-positive",
          playerName: "Red Positive",
          color: "red",
          value: 8,
          isUsed: false,
          usedByLineupId: null,
        },
      ]),
    );

    expect(modifiers.d1.primaryFormCardId).not.toBe("negative-red");
    expect(modifiers.d1.primaryFormCardId).toBe("negative-green");
    expect(modifiers.d2.primaryFormCardId).not.toBe("negative-green");
  });

  it("skips negative form cards when every available negative card would double its malus", () => {
    const modifiers = buildAiLegacyLineupModifiers(
      createContext(
        [
          {
            id: "negative-red-a",
            playerId: "p-red-a",
            playerName: "Red Player A",
            color: "red",
            value: -8,
            isUsed: false,
            usedByLineupId: null,
          },
          {
            id: "negative-red-b",
            playerId: "p-red-b",
            playerName: "Red Player B",
            color: "red",
            value: -4,
            isUsed: false,
            usedByLineupId: null,
          },
        ],
        { d2Category: "power" },
      ),
    );

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
  });

  it("prioritizes team powers by discipline fit and active rivalry windows", () => {
    const context = createContext([], { d2Category: "power", d2DisciplineId: "mini-dm" });
    context.teamPowers = [
      {
        id: "generic-speed",
        label: "Generic Tempo Surge",
        description: "Generic speed power",
        category: "speed",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 8,
        positiveAttributeTags: ["speed", "dexterity"],
        negativeAttributeTag: "health",
        chargesTotal: 4,
        chargesUsed: 0,
        chargesRemaining: 4,
        selectedForSeason: true,
        isUsedUp: false,
      },
      {
        id: "redline",
        label: "Redline Protocol",
        description: "Rival pressure power",
        category: "flex",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 2,
        conditionalTrigger: "rival_top8_discipline",
        conditionalDescription: "+2 vs rival",
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 6,
        positiveAttributeTags: ["power", "torment"],
        negativeAttributeTag: "awareness",
        chargesTotal: 4,
        chargesUsed: 0,
        chargesRemaining: 4,
        selectedForSeason: true,
        isUsedUp: false,
      },
    ];
    context.teamPowerWindows = {
      "mini-dm": {
        disciplineId: "mini-dm",
        top8Rivals: [{ teamId: "T-G", teamCode: "T-G", teamName: "The Giants", rank: 3 }],
        rankSource: "active_roster_top6_sum_discipline_score",
      },
    };

    const modifiers = buildAiLegacyLineupModifiers(context);

    expect(modifiers.d2.teamPowerId).toBe("redline");
  });

  it("pushes large midseason discipline windows for competitive AI teams", () => {
    const context = createContext([]);
    context.matchday = { ...context.matchday, index: 5 };
    context.season = { ...context.season, currentMatchday: 5 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 5,
      totalDisciplineSidesInSeason: 20,
      discipline1: {
        ...context.matchdayContract!.discipline1,
        requiredPlayers: 6,
      },
    };
    context.disciplinePlayerCounts = {
      tdm: 6,
    };
    context.disciplineSidePlayerCounts = {
      "tdm::d1": 6,
    };
    context.teamDisciplineRanks = {
      tdm: {
        disciplineId: "tdm",
        teamId: "A-A",
        rank: 14,
        score: 420,
      },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 74 },
      { playerId: "p2", disciplineId: "tdm", score: 72 },
      { playerId: "p3", disciplineId: "tdm", score: 70 },
      { playerId: "p4", disciplineId: "tdm", score: 68 },
      { playerId: "p5", disciplineId: "tdm", score: 66 },
      { playerId: "p6", disciplineId: "tdm", score: 64 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "a2" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 2, playerId: "p3", activePlayerId: "a3" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 3, playerId: "p4", activePlayerId: "a4" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 4, playerId: "p5", activePlayerId: "a5" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 5, playerId: "p6", activePlayerId: "a6" },
    ]);

    expect(modifiers.d1.intensity).toBe("push");
  });

  it("still conserves early weak low-rank windows instead of pushing everything", () => {
    const context = createContext([]);
    context.matchday = { ...context.matchday, index: 1 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 1,
      totalDisciplineSidesInSeason: 20,
    };
    context.teamDisciplineRanks = {
      tdm: {
        disciplineId: "tdm",
        teamId: "A-A",
        rank: 28,
        score: 190,
      },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 63 },
      { playerId: "p2", disciplineId: "tdm", score: 60 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.intensity).toBe("conserve");
  });
});
