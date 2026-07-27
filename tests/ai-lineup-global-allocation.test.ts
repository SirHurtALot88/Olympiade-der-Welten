import { describe, expect, it } from "vitest";

import { buildAiLegacyLineupModifiers } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { buildAiLegacyLineupSuggestion, getMarginalRankPointSwing } from "@/lib/ai/ai-legacy-lineup-engine";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

// ===========================================================================================
// Globale, opportunistische Zuteilung (statt d1-zuerst) + Formkarten-Schutz starker Seiten.
// Diese Tests sichern die drei Kernbefunde ab:
//   (a) Ein Team mit Stärke in d2 verheizt seine Besten nicht mehr in d1 (D-P/Eiskunst-Fall).
//   (b) Der unterschiedliche Punktwert der Disziplinen (rank-to-points, Spieleranzahl)
//       fließt in die Zuteilung ein.
//   (c) Negativ-Formkarten landen nicht auf der stärksten Seite, solange kein echter Zwang
//       (Saisonende / Kartenstau) besteht.
// Alle drei Tests waren gegen den alten Code rot (verifiziert durch temporäres Zurückdrehen).
// ===========================================================================================

function createAllocationContext(): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "D-P",
    entries: [],
    disciplinePlayerCounts: {
      "gewichtheben": 2,
      "eiskunst": 2,
    },
    disciplineSidePlayerCounts: {
      "gewichtheben::d1": 2,
      "eiskunst::d2": 2,
    },
    activePlayers: [
      { id: "a1", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "star1", upkeep: 10 },
      { id: "a2", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "star2", upkeep: 10 },
      { id: "a3", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench1", upkeep: 10 },
      { id: "a4", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench2", upkeep: 10 },
    ],
    // Die Allrounder-Stars sind in d1 (Gewichtheben) sogar MINIMAL besser als in d2 —
    // genau der Köder, auf den die alte d1-zuerst-Logik hereinfiel.
    disciplineScores: [
      { playerId: "star1", disciplineId: "gewichtheben", score: 86 },
      { playerId: "star2", disciplineId: "gewichtheben", score: 85 },
      { playerId: "bench1", disciplineId: "gewichtheben", score: 60 },
      { playerId: "bench2", disciplineId: "gewichtheben", score: 58 },
      { playerId: "star1", disciplineId: "eiskunst", score: 84 },
      { playerId: "star2", disciplineId: "eiskunst", score: 83 },
      { playerId: "bench1", disciplineId: "eiskunst", score: 30 },
      { playerId: "bench2", disciplineId: "eiskunst", score: 28 },
    ],
    save: { id: "save-1", name: "Save 1", status: "active" },
    season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: "D-P", shortCode: "D-P", name: "Deep Pockets" },
    teamSeasonState: {
      id: "tss-1",
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "D-P",
      cash: 500,
      budget: 1000,
      rosterLimit: 6,
      playerOpt: 4,
    },
    teamIdentity: { pow: 60, spe: 60, men: 60, soc: 60 },
    rosterPlayers: [
      { id: "star1", name: "Star 1", coreStats: { pow: 70, spe: 70, men: 70, soc: 70 } },
      { id: "star2", name: "Star 2", coreStats: { pow: 68, spe: 68, men: 68, soc: 68 } },
      { id: "bench1", name: "Bench 1", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } },
      { id: "bench2", name: "Bench 2", coreStats: { pow: 38, spe: 38, men: 38, soc: 38 } },
    ],
    disciplines: [
      { id: "gewichtheben", name: "Gewichtheben", category: "power" },
      { id: "eiskunst", name: "Eiskunst", category: "speed" },
    ],
    disciplineWeights: [
      { disciplineId: "gewichtheben", attributeKey: "power", weightPct: 40 },
      { disciplineId: "eiskunst", attributeKey: "speed", weightPct: 40 },
    ],
    seasonDisciplineConfigs: [
      { disciplineId: "gewichtheben", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
      { disciplineId: "eiskunst", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
    ],
    // Ökonomie-Kontext: in d1 chancenlos (Rang 30, flache Punktkurve im Keller), in d2
    // Titelkandidat (Rang 2, steile Punktkurve an der Spitze).
    teamDisciplineRanks: {
      gewichtheben: { rank: 30, score: 120, sourceStatus: "mapped" },
      eiskunst: { rank: 2, score: 480, sourceStatus: "mapped" },
    },
    existingDraft: null,
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "D-P",
      d1DisciplineId: "gewichtheben",
      d2DisciplineId: "eiskunst",
    },
  } as unknown as LegacyLineupLoadedContext;
}

describe("global opportunistic lineup allocation", () => {
  // (a) Der D-P/Eiskunst-Fall: Rang 1-2 in d2, chancenlos in d1. Der alte Code füllte d1
  // ZUERST und schickte die Allrounder dorthin (86/85 > 84/83) — d2 bekam nur Reste.
  it("does not burn its best allrounders in a hopeless d1 when the team is a contender in d2", () => {
    const suggestion = buildAiLegacyLineupSuggestion(createAllocationContext());
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);
    const d2Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d2").map((entry) => entry.playerId);

    expect(d2Players).toContain("star1");
    expect(d2Players).toContain("star2");
    expect(d1Players).not.toContain("star1");
    expect(d1Players).not.toContain("star2");
    // Beide Seiten bleiben trotzdem voll besetzt (kein Slot wird geopfert).
    expect(d1Players).toHaveLength(2);
    expect(d2Players).toHaveLength(2);
  });

  // (b) Punktwert der Disziplin: bei GLEICHEM Rang ist die größere Disziplin (mehr Spieler,
  // größere Punktabstände in rank-to-points) wertvoller. Ein Star, der in der kleinen
  // Disziplin minimal besser wäre, gehört in die große. Der alte Code nahm ihn stur für d1,
  // weil d1 zuerst zugriff.
  it("weights the allocation by the real point value of the discipline (player count)", () => {
    const context = createAllocationContext();
    context.disciplinePlayerCounts = { "gewichtheben": 2, "eiskunst": 6 };
    context.disciplineSidePlayerCounts = { "gewichtheben::d1": 2, "eiskunst::d2": 6 };
    context.activePlayers = [
      ...context.activePlayers,
      { id: "a5", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench3", upkeep: 10 },
      { id: "a6", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench4", upkeep: 10 },
      { id: "a7", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench5", upkeep: 10 },
      { id: "a8", saveId: "save-1", seasonId: "season-1", teamId: "D-P", playerId: "bench6", upkeep: 10 },
    ] as typeof context.activePlayers;
    context.rosterPlayers = [
      ...context.rosterPlayers,
      { id: "bench3", name: "Bench 3", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } },
      { id: "bench4", name: "Bench 4", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } },
      { id: "bench5", name: "Bench 5", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } },
      { id: "bench6", name: "Bench 6", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } },
    ] as typeof context.rosterPlayers;
    // Star ist in der KLEINEN d1 minimal besser (80 > 78) — aber gleicher Rang beidseits,
    // also entscheidet allein der größere Punkthebel der 6-Spieler-Disziplin.
    context.disciplineScores = [
      { playerId: "star1", disciplineId: "gewichtheben", score: 80 },
      { playerId: "star1", disciplineId: "eiskunst", score: 78 },
      { playerId: "star2", disciplineId: "gewichtheben", score: 55 },
      { playerId: "star2", disciplineId: "eiskunst", score: 54 },
      { playerId: "bench1", disciplineId: "gewichtheben", score: 52 },
      { playerId: "bench1", disciplineId: "eiskunst", score: 51 },
      { playerId: "bench2", disciplineId: "gewichtheben", score: 50 },
      { playerId: "bench2", disciplineId: "eiskunst", score: 49 },
      { playerId: "bench3", disciplineId: "gewichtheben", score: 48 },
      { playerId: "bench3", disciplineId: "eiskunst", score: 47 },
      { playerId: "bench4", disciplineId: "gewichtheben", score: 46 },
      { playerId: "bench4", disciplineId: "eiskunst", score: 45 },
      { playerId: "bench5", disciplineId: "gewichtheben", score: 44 },
      { playerId: "bench5", disciplineId: "eiskunst", score: 43 },
      { playerId: "bench6", disciplineId: "gewichtheben", score: 42 },
      { playerId: "bench6", disciplineId: "eiskunst", score: 41 },
    ];
    context.teamDisciplineRanks = {
      gewichtheben: { rank: 8, score: 300, sourceStatus: "mapped" },
      eiskunst: { rank: 8, score: 300, sourceStatus: "mapped" },
    } as typeof context.teamDisciplineRanks;

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d2Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d2").map((entry) => entry.playerId);

    expect(d2Players).toContain("star1");
    expect(suggestion.entries.filter((entry) => entry.disciplineSide === "d1")).toHaveLength(2);
    expect(d2Players).toHaveLength(6);
  });

  it("keeps the allocation stable and full when no rank/point context exists (neutral weights)", () => {
    const context = createAllocationContext();
    delete (context as { teamDisciplineRanks?: unknown }).teamDisciplineRanks;

    const suggestion = buildAiLegacyLineupSuggestion(context);
    const d1Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d1").map((entry) => entry.playerId);
    const d2Players = suggestion.entries.filter((entry) => entry.disciplineSide === "d2").map((entry) => entry.playerId);

    // Ohne Rang-Kontext sind beide Seiten gleich gewichtet: die Score-Differenzen der
    // Bench-Spieler (60/58 vs 30/28) ziehen sie nach d1, die Stars decken d2 ab — die
    // GLOBALE Summe schlägt auch hier die alte d1-zuerst-Logik.
    expect(d1Players).toHaveLength(2);
    expect(d2Players).toHaveLength(2);
    expect(new Set([...d1Players, ...d2Players]).size).toBe(4);
    expect(d2Players).toContain("star1");
    expect(d2Players).toContain("star2");
  });

  it("is deterministic for the same context", () => {
    const first = buildAiLegacyLineupSuggestion(createAllocationContext());
    const second = buildAiLegacyLineupSuggestion(createAllocationContext());

    expect(first.entries).toEqual(second.entries);
  });
});

describe("getMarginalRankPointSwing defensive behaviour", () => {
  it("clamps player counts outside the 2..6 table rows instead of returning null", () => {
    // Tabelle hat nur Zeilen für 2–6 Spieler; 8 wird defensiv auf 6 geklemmt.
    expect(getMarginalRankPointSwing(8, 5)).toBe(getMarginalRankPointSwing(6, 5));
    expect(getMarginalRankPointSwing(1, 5)).toBe(getMarginalRankPointSwing(2, 5));
  });

  it("returns null for nonsensical player counts and a neutral average without a rank", () => {
    expect(getMarginalRankPointSwing(0, 5)).toBeNull();
    expect(getMarginalRankPointSwing(Number.NaN, 5)).toBeNull();
    expect(getMarginalRankPointSwing(4, null)).toBeGreaterThan(0);
  });

  it("values a rank step in a contested zone higher than in the hopeless basement", () => {
    const contested = getMarginalRankPointSwing(4, 6) ?? 0;
    const basement = getMarginalRankPointSwing(4, 30) ?? 0;

    expect(contested).toBeGreaterThan(basement);
  });
});

// ===========================================================================================
// (c) Negativ-Formkarten: Schutz der stärksten Seite, solange kein echter Zwang besteht.
// ===========================================================================================

function createModifierContext(
  formCards: NonNullable<LegacyLineupLoadedContext["formCards"]>,
): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-8",
    teamId: "A-A",
    entries: [],
    disciplinePlayerCounts: {},
    activePlayers: [],
    disciplineScores: [],
    rosterPlayers: [],
    formCards,
    matchday: { index: 8 },
    season: { currentMatchday: 8 },
    matchdayContract: {
      matchdayId: "matchday-8",
      matchdayLabel: "MD8",
      matchdayIndex: 8,
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
        disciplineId: "spurt",
        displayName: "Spurt",
        requiredPlayers: 2,
        requiredCaptains: 0,
        category: "speed",
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

function buildNegativeCards(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `negative-green-${index}`,
    playerId: `p-neg-${index}`,
    playerName: `Neg ${index}`,
    // Grün matcht weder power (rot) noch speed — der alte Code hätte sie also bedenkenlos
    // auf die starke Seite gekippt (kein Farb-Doppelmalus als Ausrede).
    color: "green" as const,
    value: -6,
    isUsed: false,
    usedByLineupId: null,
  }));
}

describe("AI form-card planning protects strong sides from negative dumps", () => {
  it("defers a scheduled negative dump instead of sabotaging a side the team wants to win", () => {
    // Spieltag 8/10: 5 Negativkarten, 6 verbleibende Primärslots -> Dump-Pflicht = 1,
    // aber KEIN echter Zwang (weder letzte 2 Spieltage noch Kartenstau >= Slots).
    // Beide Seiten sind stark (Rang 5/6, Scores >= 76): früher landete die Minuskarte
    // trotzdem auf einer der starken Seiten; jetzt wird der Dump verschoben.
    const context = createModifierContext(buildNegativeCards(5));
    context.teamDisciplineRanks = {
      tdm: { rank: 5, score: 460, sourceStatus: "mapped" },
      spurt: { rank: 6, score: 450, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 82 },
      { playerId: "p2", disciplineId: "spurt", score: 80 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
  });

  it("still burns negatives on strong sides when the season really runs out (echter Zwang)", () => {
    // Spieltag 10/10: letzte Chance, sonst verfallen die Karten -> Zwang schlägt Schutz.
    const context = createModifierContext(buildNegativeCards(2));
    context.matchdayId = "matchday-10";
    context.matchday = { index: 10 } as typeof context.matchday;
    context.season = { currentMatchday: 10 } as typeof context.season;
    context.matchdayContract = {
      ...context.matchdayContract!,
      matchdayIndex: 10,
    };
    context.teamDisciplineRanks = {
      tdm: { rank: 5, score: 460, sourceStatus: "mapped" },
      spurt: { rank: 6, score: 450, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 82 },
      { playerId: "p2", disciplineId: "spurt", score: 80 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    expect(modifiers.d1.primaryFormCardId).not.toBeNull();
    expect(modifiers.d2.primaryFormCardId).not.toBeNull();
  });

  it("keeps dumping negatives on genuinely weak sides without needing any Zwang", () => {
    const context = createModifierContext(buildNegativeCards(5));
    context.teamDisciplineRanks = {
      tdm: { rank: 29, score: 150, sourceStatus: "mapped" },
      spurt: { rank: 5, score: 460, sourceStatus: "mapped" },
    };
    context.disciplineScores = [
      { playerId: "p1", disciplineId: "tdm", score: 50 },
      { playerId: "p2", disciplineId: "spurt", score: 82 },
    ];

    const modifiers = buildAiLegacyLineupModifiers(context, [
      { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "a1" },
      { disciplineId: "spurt", disciplineSide: "d2", slotIndex: 0, playerId: "p2", activePlayerId: "a2" },
    ]);

    // Schwache Seite (d1) nimmt die Minuskarte, die starke Seite (d2) bleibt sauber.
    expect(modifiers.d1.primaryFormCardId).not.toBeNull();
    expect(modifiers.d2.primaryFormCardId).toBeNull();
  });
});
