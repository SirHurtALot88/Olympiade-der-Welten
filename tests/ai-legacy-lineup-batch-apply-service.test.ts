import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { __setTeamPowersEnabledForTests } from "@/lib/lineups/team-powers";
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
      totalDisciplineSidesInSeason: 20,
    },
  } as unknown as LegacyLineupLoadedContext;
}

// Team-Powers sind im Spiel abgeschaltet (TEAM_POWERS_ENABLED). Die beiden
// Power-Faelle dieser Suite pruefen die Auswahl-Mechanik selbst und schalten sie
// dafuer gezielt ein — dieselbe Loesung wie in den team-powers-Suiten, damit die
// Abdeckung erhalten bleibt, bis das System zurueckkehrt.
beforeAll(() => __setTeamPowersEnabledForTests(true));
afterAll(() => __setTeamPowersEnabledForTests(false));

describe("AI legacy lineup form-card planning", () => {
  it("does not place a negative form card on a matching-color discipline when the side is competitive", () => {
    const context = createContext([
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
    ]);
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 10, score: 420 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 11, score: 410 },
    };
    context.disciplineScores = [
      { playerId: "p-red", disciplineId: "tdm", score: 78 },
      { playerId: "p-green", disciplineId: "spurt", score: 77 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-red", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p-green", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBe("positive-red");
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
    expect(modifiers.d2.secondaryFormCardId).toBeNull();
  });

  it("dumps matching-color negative form cards on weak discipline sides", () => {
    const context = createContext(
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
        {
          id: "positive-red",
          playerId: "p-red-positive",
          playerName: "Red Positive",
          color: "red",
          value: 8,
          isUsed: false,
          usedByLineupId: null,
        },
      ],
      { d2Category: "power" },
    );
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 29, score: 180 },
    };
    context.disciplineScores = [
      { playerId: "p-red-a", disciplineId: "tdm", score: 62 },
      { playerId: "p-red-b", disciplineId: "tdm", score: 60 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-red-a", activePlayerId: "a1" },
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "p-red-b", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBe("negative-red-a");
    expect(modifiers.d1.primaryFormCardId).not.toBe("positive-red");
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.secondaryFormCardId).toBeNull();
  });

  it("skips negative form cards when every available negative card would double its malus on a neutral side", () => {
    const context = createContext(
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
    );
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 14, score: 360 },
      "mini-dm": { disciplineId: "mini-dm", teamId: "A-A", rank: 15, score: 350 },
    };
    context.matchdayContract = {
      ...context.matchdayContract!,
      discipline2: {
        ...context.matchdayContract!.discipline2,
        disciplineId: "mini-dm",
        category: "power",
      },
    };
    context.disciplineScores = [
      { playerId: "p-red-a", disciplineId: "tdm", score: 72 },
      { playerId: "p-red-b", disciplineId: "mini-dm", score: 71 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-red-a", activePlayerId: "a1" },
      { disciplineId: "mini-dm", disciplineSide: "d2", slotIndex: 0, playerId: "p-red-b", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.secondaryFormCardId).toBeNull();
  });

  it("skips all form-card slots when only non-matching positives are available on competitive sides", () => {
    const context = createContext([
      {
        id: "positive-blue",
        playerId: "p-blue",
        playerName: "Blue Player",
        color: "blue",
        value: 8,
        isUsed: false,
        usedByLineupId: null,
      },
      {
        id: "positive-yellow",
        playerId: "p-yellow",
        playerName: "Yellow Player",
        color: "yellow",
        value: 8,
        isUsed: false,
        usedByLineupId: null,
      },
    ]);
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 10, score: 420 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 11, score: 410 },
    };
    context.disciplineScores = [
      { playerId: "p-blue", disciplineId: "tdm", score: 78 },
      { playerId: "p-yellow", disciplineId: "spurt", score: 77 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-blue", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p-yellow", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
    expect(modifiers.d2.secondaryFormCardId).toBeNull();
  });

  it("burns remaining negative cards on strong sides near season end", () => {
    const context = createContext([
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
    ]);
    context.matchday = { index: 10 };
    context.season = { currentMatchday: 10 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 10,
      totalDisciplineSidesInSeason: 20,
    };
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 10, score: 420 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 11, score: 410 },
    };
    context.disciplineScores = [
      { playerId: "p-red-a", disciplineId: "tdm", score: 78 },
      { playerId: "p-red-b", disciplineId: "spurt", score: 77 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-red-a", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p-red-b", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBe("negative-red-a");
    expect(modifiers.d2.primaryFormCardId).toBe("negative-red-b");
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
    expect(modifiers.d2.secondaryFormCardId).toBeNull();
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
        isPassive: false,
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
        isPassive: false,
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
    expect(modifiers.d1.teamPowerId).toBeNull();
  });

  it("does not burn two team powers on an early matchday without rivalry pressure", () => {
    const context = createContext([], { d2Category: "speed", d2DisciplineId: "spurt" });
    context.teamPowers = [
      {
        id: "power-4",
        label: "Signature Power",
        description: "4 charges",
        category: "power",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 8,
        positiveAttributeTags: ["power", "health"],
        negativeAttributeTag: "speed",
        chargesTotal: 4,
        chargesUsed: 0,
        chargesRemaining: 4,
        selectedForSeason: true,
        isUsedUp: false,
        isPassive: false,
      },
      {
        id: "power-3",
        label: "Secondary Power",
        description: "3 charges",
        category: "speed",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 6,
        positiveAttributeTags: ["speed", "dexterity"],
        negativeAttributeTag: "health",
        chargesTotal: 3,
        chargesUsed: 0,
        chargesRemaining: 3,
        selectedForSeason: true,
        isUsedUp: false,
        isPassive: false,
      },
      {
        id: "power-2",
        label: "Reserve Power",
        description: "2 charges",
        category: "mental",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 5,
        positiveAttributeTags: ["intelligence", "awareness"],
        negativeAttributeTag: "torment",
        chargesTotal: 2,
        chargesUsed: 0,
        chargesRemaining: 2,
        selectedForSeason: true,
        isUsedUp: false,
        isPassive: false,
      },
    ];
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 14, score: 360 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 15, score: 350 },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 72 },
      { playerId: "p2", disciplineId: "spurt", score: 71 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    const selected = [modifiers.d1.teamPowerId, modifiers.d2.teamPowerId].filter(Boolean);
    expect(selected.length).toBeLessThanOrEqual(1);
  });

  it("uses the 4-charge signature power on a strong matching discipline side", () => {
    const context = createContext([], { d2Category: "speed", d2DisciplineId: "spurt" });
    context.matchday = { index: 5 };
    context.season = { currentMatchday: 5 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 5,
      totalDisciplineSidesInSeason: 20,
    };
    context.teamPowers = [
      {
        id: "teampower:season-1:A-A:identity:1",
        label: "Signature Power",
        description: "4 charges",
        category: "power",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 8,
        positiveAttributeTags: ["power", "health"],
        negativeAttributeTag: "speed",
        chargesTotal: 4,
        chargesUsed: 0,
        chargesRemaining: 4,
        selectedForSeason: true,
        isUsedUp: false,
        isPassive: false,
      },
      {
        id: "teampower:season-1:A-A:identity:3",
        label: "Reserve Power",
        description: "2 charges",
        category: "mental",
        effectType: "self_boost",
        targetMode: "self",
        targetLimit: 0,
        conditionalBonusPct: 0,
        conditionalTrigger: null,
        conditionalDescription: null,
        source: "team_identity",
        sourceFacilityId: null,
        modifier: 5,
        positiveAttributeTags: ["intelligence", "awareness"],
        negativeAttributeTag: "torment",
        chargesTotal: 2,
        chargesUsed: 0,
        chargesRemaining: 2,
        selectedForSeason: true,
        isUsedUp: false,
        isPassive: false,
      },
    ];
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 8, score: 430 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 22, score: 300 },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 80 },
      { playerId: "p2", disciplineId: "spurt", score: 64 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.teamPowerId).toBe("teampower:season-1:A-A:identity:1");
    expect(modifiers.d2.teamPowerId).toBeNull();
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

  it("burns color-matched negatives as forced dump on the last matchday even when they would double the malus", () => {
    // Same all-red negatives, all-power disciplines — but now it is the last matchday.
    // negativeUrgency kicks in (2 cards > 2 remaining primary slots), so both sides
    // get a forced dump including the color-matched ones.
    const context = createContext(
      [
        { id: "neg-red-a", playerId: "p-a", playerName: "A", color: "red", value: -8, isUsed: false, usedByLineupId: null },
        { id: "neg-red-b", playerId: "p-b", playerName: "B", color: "red", value: -4, isUsed: false, usedByLineupId: null },
      ],
      { d2Category: "power", d2DisciplineId: "mini-dm" },
    );
    context.matchday = { index: 10 };
    context.season = { currentMatchday: 10 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 10,
      discipline2: { ...context.matchdayContract!.discipline2, disciplineId: "mini-dm", category: "power" },
      totalDisciplineSidesInSeason: 20,
    };
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 14, score: 360 },
      "mini-dm": { disciplineId: "mini-dm", teamId: "A-A", rank: 15, score: 350 },
    };
    context.disciplineScores = [
      { playerId: "p-a", disciplineId: "tdm", score: 72 },
      { playerId: "p-b", disciplineId: "mini-dm", score: 71 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p-a", activePlayerId: "a1" },
      { disciplineId: "mini-dm", disciplineSide: "d2", slotIndex: 0, playerId: "p-b", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).not.toBeNull();
    expect(modifiers.d2.primaryFormCardId).not.toBeNull();
    expect(new Set([modifiers.d1.primaryFormCardId, modifiers.d2.primaryFormCardId])).toEqual(
      new Set(["neg-red-a", "neg-red-b"]),
    );
  });

  it("falls back to any-color positive when the pool has only non-matching positives and urgency is high", () => {
    // Blue/yellow positive cards on a power(red)/speed(green) season.
    // Last matchday (MD 10) with 3 positives remaining → positiveUrgency = 3 > 1*2=2 → true.
    const positives = [
      { id: "pos-blue-a", playerId: "p1", playerName: "P1", color: "blue" as const, value: 8, isUsed: false, usedByLineupId: null },
      { id: "pos-blue-b", playerId: "p2", playerName: "P2", color: "blue" as const, value: 4, isUsed: false, usedByLineupId: null },
      { id: "pos-yellow-a", playerId: "p3", playerName: "P3", color: "yellow" as const, value: 8, isUsed: false, usedByLineupId: null },
    ];
    const context = createContext(positives);
    context.matchday = { index: 10 };
    context.season = { currentMatchday: 10 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 10,
      totalDisciplineSidesInSeason: 20,
    };
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 8, score: 450 },
      spurt: { disciplineId: "spurt", teamId: "A-A", rank: 9, score: 440 },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 82 },
      { playerId: "p2", disciplineId: "spurt", score: 81 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    // Both strong sides should receive a positive even though none match the discipline color.
    expect(modifiers.d1.primaryFormCardId).not.toBeNull();
    expect(modifiers.d2.primaryFormCardId).not.toBeNull();
    const usedIds = new Set([modifiers.d1.primaryFormCardId, modifiers.d2.primaryFormCardId]);
    for (const id of usedIds) {
      expect(positives.map((p) => p.id)).toContain(id);
    }
  });

  it("assigns positives to neutral sides via secondary slot when urgency is high", () => {
    // 5 positives (all blue), 2 remaining matchdays → positiveUrgency = 5 > 2*2=4 → true.
    // Both sides are neutral (rank ~15, score ~73). Secondary slot should activate on neutral sides.
    const positives = [
      { id: "pos-blue-a", playerId: "p1", playerName: "P1", color: "blue" as const, value: 8, isUsed: false, usedByLineupId: null },
      { id: "pos-blue-b", playerId: "p2", playerName: "P2", color: "blue" as const, value: 4, isUsed: false, usedByLineupId: null },
      { id: "pos-blue-c", playerId: "p3", playerName: "P3", color: "blue" as const, value: 2, isUsed: false, usedByLineupId: null },
      { id: "pos-blue-d", playerId: "p4", playerName: "P4", color: "blue" as const, value: 8, isUsed: false, usedByLineupId: null },
      { id: "pos-blue-e", playerId: "p5", playerName: "P5", color: "blue" as const, value: 4, isUsed: false, usedByLineupId: null },
    ];
    const context = createContext(positives, { d2Category: "mental", d2DisciplineId: "puzzle" });
    context.matchday = { index: 9 };
    context.season = { currentMatchday: 9 };
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 9,
      discipline1: { ...context.matchdayContract!.discipline1, category: "mental" },
      discipline2: { ...context.matchdayContract!.discipline2, disciplineId: "puzzle", category: "mental" },
      totalDisciplineSidesInSeason: 20,
    };
    context.teamDisciplineRanks = {
      tdm: { disciplineId: "tdm", teamId: "A-A", rank: 15, score: 360 },
      puzzle: { disciplineId: "puzzle", teamId: "A-A", rank: 15, score: 350 },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 73 },
      { playerId: "p2", disciplineId: "puzzle", score: 72 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "puzzle", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    // Both neutral sides should use positives (primary at least, secondary if budget allows).
    const usedCount = [
      modifiers.d1.primaryFormCardId,
      modifiers.d2.primaryFormCardId,
      modifiers.d1.secondaryFormCardId,
      modifiers.d2.secondaryFormCardId,
    ].filter(Boolean).length;
    expect(usedCount).toBeGreaterThanOrEqual(2);
  });

  // --- Formkarten-Haushalt: Disziplingröße & Saisonplan ------------------------------------
  // Der Punktwert eines Einsatzes ist Kartenwert × (Farbtreffer ? 2 : 1) × Spielerzahl —
  // dieselbe Karte ist in einer 6er-Disziplin doppelt so viel wert wie in einer 3er.

  function scheduleEntry(
    matchdayIndex: number,
    d1: { playerCount: number; category: string },
    d2: { playerCount: number; category: string },
  ) {
    return {
      seasonId: "season-1",
      matchdayId: `matchday-${matchdayIndex}`,
      matchdayIndex,
      matchdayLabel: `MD${matchdayIndex}`,
      discipline1: { disciplineId: `disc-${matchdayIndex}-1`, displayName: "D1", order: 1, playerCount: d1.playerCount, category: d1.category },
      discipline2: { disciplineId: `disc-${matchdayIndex}-2`, displayName: "D2", order: 2, playerCount: d2.playerCount, category: d2.category },
      sourceStatus: "season_seed",
      sourceNote: null,
    } as NonNullable<LegacyLineupLoadedContext["seasonDisciplineSchedule"]>[number];
  }

  it("reserves a big color-matched card in a small discipline when a big color-matched slot comes soon", () => {
    const context = createContext([
      { id: "positive-red-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
    ]);
    // d1: 3er-Power-Disziplin (rot), Seite ist stark — aber am MD3 wartet eine 6er-Power-Disziplin:
    // dort bringt dieselbe Karte die doppelten Teampunkte, also wird sie aufgespart.
    context.matchdayContract = {
      ...context.matchdayContract!,
      discipline1: { ...context.matchdayContract!.discipline1!, requiredPlayers: 3 },
    };
    context.seasonDisciplineSchedule = [
      scheduleEntry(1, { playerCount: 3, category: "power" }, { playerCount: 2, category: "speed" }),
      scheduleEntry(2, { playerCount: 2, category: "speed" }, { playerCount: 3, category: "mental" }),
      scheduleEntry(3, { playerCount: 6, category: "power" }, { playerCount: 2, category: "speed" }),
    ];
    context.teamDisciplineRanks = {
      tdm: { rank: 5, score: 500, sourceStatus: "mapped" },
      spurt: { rank: 20, score: 300, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 80 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d1.secondaryFormCardId).toBeNull();
  });

  it("plays the big color-matched card when no better slot remains in the season plan", () => {
    const context = createContext([
      { id: "positive-red-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
    ]);
    // Gleiche Lage wie oben, aber der Restplan hat nur kleine, farbfremde Disziplinen:
    // ein besserer Slot kommt nicht mehr — die Karte fällt JETZT.
    context.matchdayContract = {
      ...context.matchdayContract!,
      discipline1: { ...context.matchdayContract!.discipline1!, requiredPlayers: 3 },
    };
    context.seasonDisciplineSchedule = [
      scheduleEntry(1, { playerCount: 3, category: "power" }, { playerCount: 2, category: "speed" }),
      scheduleEntry(2, { playerCount: 2, category: "speed" }, { playerCount: 3, category: "mental" }),
      scheduleEntry(3, { playerCount: 3, category: "speed" }, { playerCount: 2, category: "mental" }),
    ];
    context.teamDisciplineRanks = {
      tdm: { rank: 5, score: 500, sourceStatus: "mapped" },
      spurt: { rank: 20, score: 300, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 80 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBe("positive-red-8");
  });

  it("skips the second big card when the side already dominates the discipline", () => {
    // Chris' W-L-Fall: 2×8er farbverdoppelt in einer Disziplin, die das Team ohnehin anführt —
    // eine Karte reicht, die zweite fehlt später in der Saison.
    const buildDominanceContext = (rank: number) => {
      const context = createContext([
        { id: "positive-red-8", playerId: "p1", playerName: "P1", color: "red", value: 8, isUsed: false, usedByLineupId: null },
        { id: "positive-red-7", playerId: "p2", playerName: "P2", color: "red", value: 7, isUsed: false, usedByLineupId: null },
        { id: "positive-blue-2a", playerId: "p3", playerName: "P3", color: "blue", value: 2, isUsed: false, usedByLineupId: null },
        { id: "positive-blue-2b", playerId: "p4", playerName: "P4", color: "blue", value: 2, isUsed: false, usedByLineupId: null },
        { id: "positive-blue-2c", playerId: "p5", playerName: "P5", color: "blue", value: 2, isUsed: false, usedByLineupId: null },
        { id: "positive-blue-2d", playerId: "p6", playerName: "P6", color: "blue", value: 2, isUsed: false, usedByLineupId: null },
        // Bereits verbrauchte Positivkarten halten den Ausgaben-Pace im Soll (kein Zwangs-Spend).
        { id: "used-a", playerId: "p7", playerName: "P7", color: "green", value: 3, isUsed: true, usedByLineupId: "lineup-x" },
        { id: "used-b", playerId: "p8", playerName: "P8", color: "green", value: 3, isUsed: true, usedByLineupId: "lineup-x" },
        { id: "used-c", playerId: "p9", playerName: "P9", color: "green", value: 3, isUsed: true, usedByLineupId: "lineup-x" },
      ]);
      context.matchday = { index: 6 } as typeof context.matchday;
      context.season = { currentMatchday: 6 } as typeof context.season;
      context.matchdayContract = {
        ...context.matchdayContract!,
        matchdayIndex: 6,
        discipline1: { ...context.matchdayContract!.discipline1!, requiredPlayers: 6 },
      };
      context.seasonDisciplineSchedule = [
        scheduleEntry(6, { playerCount: 6, category: "power" }, { playerCount: 2, category: "speed" }),
        scheduleEntry(7, { playerCount: 2, category: "speed" }, { playerCount: 3, category: "mental" }),
        scheduleEntry(8, { playerCount: 3, category: "mental" }, { playerCount: 2, category: "speed" }),
        scheduleEntry(9, { playerCount: 2, category: "speed" }, { playerCount: 2, category: "mental" }),
        scheduleEntry(10, { playerCount: 3, category: "mental" }, { playerCount: 2, category: "speed" }),
      ];
      context.teamDisciplineRanks = {
        tdm: { rank, score: 700, sourceStatus: "mapped" },
        spurt: { rank: 20, score: 300, sourceStatus: "mapped" },
      };
      context.disciplineScores = [
        { playerId: "p1", disciplineId: "tdm", score: 84 },
      ];
      return context;
    };

    const dominantModifiers = buildAiLegacyLineupModifiers(buildDominanceContext(1), [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
    ]);
    expect(dominantModifiers.d1.primaryFormCardId).toBe("positive-red-8");
    expect(dominantModifiers.d1.secondaryFormCardId).toBeNull();

    // Ohne klare Dominanz (Rang 5) ist die Doppel-Investition in der großen Disziplin legitim.
    const contestedModifiers = buildAiLegacyLineupModifiers(buildDominanceContext(5), [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
    ]);
    expect(contestedModifiers.d1.primaryFormCardId).toBe("positive-red-8");
    expect(contestedModifiers.d1.secondaryFormCardId).toBe("positive-red-7");
  });

  it("dumps a negative card into the smaller of two weak disciplines", () => {
    const context = createContext(
      [
        { id: "negative-green-8", playerId: "p1", playerName: "P1", color: "green", value: -8, isUsed: false, usedByLineupId: null },
      ],
      { d2Category: "mental", d2DisciplineId: "puzzle" },
    );
    // d1 (tdm) ist eine 6er-, d2 (puzzle) eine 2er-Disziplin — beide Seiten schwach:
    // der Malus wirkt × Spielerzahl, also gehört die Minuskarte in die kleine Disziplin.
    context.matchdayContract = {
      ...context.matchdayContract!,
      discipline1: { ...context.matchdayContract!.discipline1!, requiredPlayers: 6 },
      discipline2: { ...context.matchdayContract!.discipline2!, disciplineId: "puzzle", category: "mental", requiredPlayers: 2 },
    };
    context.teamDisciplineRanks = {
      tdm: { rank: 29, score: 150, sourceStatus: "mapped" },
      puzzle: { rank: 30, score: 140, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 60 },
      { playerId: "p2", disciplineId: "puzzle", score: 58 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "puzzle", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    expect(modifiers.d2.primaryFormCardId).toBe("negative-green-8");
    expect(modifiers.d1.primaryFormCardId).toBeNull();
  });
});
