import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, Player, TeamFacilityCollection } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { createPlayerBaselineFromPlayer } from "@/lib/players/player-baseline-service";
import { computeSeasonEndContractTick } from "@/lib/contracts/contract-renewal-service";

vi.mock("@/lib/season/prize-money-preview", () => ({
  buildPrizeMoneyPreview: vi.fn(async () => ({
    items: [
      {
        teamId: "human-1",
        teamCode: "H-U",
        teamName: "Human Team",
        rank: 1,
        points: 10,
        currentCash: 100,
        prizeMoney: 20,
        seasonCash: 5,
        projectedCash: 120,
        status: "ready",
        warnings: [],
      },
      {
        teamId: "ai-1",
        teamCode: "A-I",
        teamName: "AI Team",
        rank: 2,
        points: 8,
        currentCash: 80,
        prizeMoney: 10,
        seasonCash: 3,
        projectedCash: 90,
        status: "ready",
        warnings: [],
      },
    ],
    blockedRules: [],
    globalWarnings: [],
    flowPolicy: "season_end_only",
    summary: {
      totalTeams: 2,
      calculableTeams: 2,
      prizeRowsCount: 32,
      blockedItemsCount: 0,
      currentFactor: 1,
      futureSeasonCount: 0,
      totalPrizeMoney: 30,
    },
    source: {
      mode: "sqlite",
      standings: "local_save",
      prizeTable: "normalized_sheet",
      placementTable: "sheet",
      seasonFactors: "sheet",
    },
    seasonFactors: [],
    scenarioWindow: { betterBy: 10, worseBy: 10 },
    scope: { saveId: "save-1", seasonId: "season-1" },
  })),
}));

vi.mock("@/lib/ai/ai-market-plan-preview-service", () => ({
  buildAiMarketPlanPreview: vi.fn(async () => ({
    readOnly: true,
    source: "sqlite",
    scope: { saveId: "save-1", seasonId: "season-1", teamId: null, teamScope: "ai" },
    totalTeams: 2,
    aiTeams: 1,
    skippedManual: 1,
    skippedPassive: 0,
    skippedDisabled: 0,
    holdTeams: 0,
    buyOnlyTeams: 0,
    sellOnlyTeams: 0,
    sellThenBuyTeams: 1,
    warningTeams: 0,
    blockedTeams: 0,
    summary: { aiTeams: 1, ready: 1, hold: 0, buyOnly: 0, sellOnly: 0, sellThenBuy: 1, warning: 0, blocked: 0 },
    teams: [
      {
        teamId: "ai-1",
        teamCode: "A-I",
        teamName: "AI Team",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        aiSellPreviewEnabled: true,
        status: "sell_then_buy",
        strategySummary: "sell then buy",
        currentState: { cash: 80, rosterCount: 1, playerMin: 1, playerOpt: 2, salaryTotal: 4, marketValueTotal: 20 },
        sellPlan: { candidates: [{ activePlayerId: "r-ai", playerId: "p-ai", playerName: "AI Player", expectedSellValue: 10, salary: 4 }], totalExpectedSellValue: 10, salaryFreed: 4, expectedSellValue: 10, rosterAfterSell: 0, warnings: [] },
        buyPlan: { candidates: [{ playerId: "fa-1", playerName: "Free Agent", price: 8, salary: 2 }], plannedSpend: 8, plannedSalaryAdded: 2, rosterAfterBuy: 1, warnings: [] },
        projectedState: { cashAfterPlan: 82, rosterAfterPlan: 1, salaryAfterPlan: 2, marketValueAfterPlan: 18 },
        planSteps: [],
        reasons: [],
        warnings: [],
        blockingReasons: [],
      },
    ],
  })),
}));

const {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
  PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN,
  applyPreSeasonNextSeasonSetup,
  buildPreSeasonWorkflowPreview,
} = await import("@/lib/season/preseason-workflow-service");

function facilities(entries: TeamFacilityCollection["facilities"]): TeamFacilityCollection {
  return { facilities: entries };
}

function createPlayer(partial: Partial<Player> = {}): Player {
  return {
    id: partial.id ?? "p-human",
    name: partial.name ?? "Human Player",
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 10,
    salaryDemand: partial.salaryDemand ?? 1,
    className: partial.className ?? "Berserker",
    race: partial.race ?? "Human",
    alignment: partial.alignment ?? "N",
    gender: partial.gender ?? "x",
    subclasses: partial.subclasses ?? [],
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats:
      partial.attributeSheetStats ?? {
        power: 30,
        health: 30,
        stamina: 30,
        intelligence: 30,
        awareness: 30,
        determination: 30,
        speed: 30,
        dexterity: 30,
        charisma: 30,
        will: 30,
        spirit: 30,
        torment: 30,
      },
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    disciplineRatings: partial.disciplineRatings ?? { tdm: 30 },
    disciplineTierCounts: partial.disciplineTierCounts ?? { above20: 1, above40: 0, above60: 0, above80: 0 },
    flavorEn: partial.flavorEn ?? "",
    flavorDe: partial.flavorDe ?? "",
    fatigue: partial.fatigue ?? 0,
    form: partial.form ?? 0,
    potential: partial.potential ?? 0,
    currentXP: partial.currentXP,
    spentXP: partial.spentXP,
    lifetimeXP: partial.lifetimeXP,
    trainingMode: partial.trainingMode,
    displayMarketValue: partial.displayMarketValue,
    displaySalary: partial.displaySalary,
  };
}

function gameState(): GameState {
  const players = [createPlayer(), createPlayer({ id: "p-ai", name: "AI Player", className: "Mage" })];
  return {
    gamePhase: "season_review",
    season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 10, matchdayIds: ["md-1", "md-2"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [{ id: "fixture-season-1-1", homeTeamId: "human-1", awayTeamId: "ai-1", matchdayId: "md-1", status: "resolved" }],
      standings: { "human-1": { points: 10, rank: 1 }, "ai-1": { points: 8, rank: 2 } },
      teamControlSettings: {
        "human-1": { teamId: "human-1", controlMode: "manual", aiLineupPreviewEnabled: false, aiLineupAutoApplyEnabled: false, aiTransferPreviewEnabled: false, aiTransferAutoApplyEnabled: false, aiSellPreviewEnabled: false, aiSellAutoApplyEnabled: false },
        "ai-1": { teamId: "ai-1", controlMode: "ai", aiLineupPreviewEnabled: true, aiLineupAutoApplyEnabled: true, aiTransferPreviewEnabled: true, aiTransferAutoApplyEnabled: true, aiSellPreviewEnabled: true, aiSellAutoApplyEnabled: true },
      },
      teamFacilities: {
        "human-1": facilities({ training_center: { level: 1, enabled: true }, fan_shop: { level: 1, enabled: true } }),
      },
      formCards: [{ cardId: "form-1", seasonId: "season-1", teamId: "human-1", playerId: "p-human", type: "buff", value: 1 } as never],
      lineupDrafts: [{ lineupId: "lineup-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", teamId: "human-1", status: "submitted", entries: [], createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" }],
      standingsApplyLogs: [
        { id: "standings-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", action: "apply", payload: { idempotencyKey: "s1", totalTeams: 2, appliedTeams: 2, tieGroupsCount: 0, previewWarningsCount: 0 }, createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "standings-2", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2", action: "apply", payload: { idempotencyKey: "s2", totalTeams: 2, appliedTeams: 2, tieGroupsCount: 0, previewWarningsCount: 0 }, createdAt: "2026-06-11T00:00:00.000Z" },
      ],
      cashPrizeApplyLogs: [
        { id: "cash-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", action: "apply", payload: { idempotencyKey: "c1", totalTeams: 2, appliedTeams: 2, totalPrizeMoney: 10 }, createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "cash-2", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2", action: "apply", payload: { idempotencyKey: "c2", totalTeams: 2, appliedTeams: 2, totalPrizeMoney: 10 }, createdAt: "2026-06-11T00:00:00.000Z" },
      ],
      matchdayResults: [
        { id: "result-1", saveId: "save-1", seasonId: "season-1", matchdayId: "md-1", status: "preview_applied", sourceVersion: "test", teamsTotal: 2, teamsReady: 2, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" },
        { id: "result-2", saveId: "save-1", seasonId: "season-1", matchdayId: "md-2", status: "preview_applied", sourceVersion: "test", teamsTotal: 2, teamsReady: 2, teamsUnderfilled: 0, teamsMissingLineup: 0, teamsInvalidLineup: 0, teamsMissingScoreCoverage: 0, warningsCount: 0, createdAt: "2026-06-11T00:00:00.000Z", updatedAt: "2026-06-11T00:00:00.000Z" },
      ],
      disciplineResults: [
        { id: "discipline-1", matchdayResultId: "result-1", teamId: "human-1", disciplineId: "tdm", disciplineSide: "d1", rank: 1, baseScore: 20, totalScore: 24, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "discipline-2", matchdayResultId: "result-2", teamId: "ai-1", disciplineId: "tdm", disciplineSide: "d1", rank: 2, baseScore: 18, totalScore: 20, readinessStatus: "ready", warnings: [], createdAt: "2026-06-11T00:00:00.000Z" },
      ],
      playerDisciplinePerformances: [
        { id: "perf-1", matchdayResultId: "result-1", teamId: "human-1", playerId: "p-human", activePlayerId: "r-human", disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, baseValue: 30, finalPlayerScore: 40, scoreContribution: 12, rankInTeam: 1, rankInDiscipline: 1, isTop10: true, isMvpCandidate: true, storyWeight: null, createdAt: "2026-06-11T00:00:00.000Z" },
        { id: "perf-2", matchdayResultId: "result-2", teamId: "ai-1", playerId: "p-ai", activePlayerId: "r-ai", disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, baseValue: 30, finalPlayerScore: 35, scoreContribution: 10, rankInTeam: 1, rankInDiscipline: 2, isTop10: true, isMvpCandidate: false, storyWeight: null, createdAt: "2026-06-11T00:00:00.000Z" },
      ],
    },
    matchdayState: { matchdayId: "md-2", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: ["fixture-season-1-1"] },
    teams: [
      { teamId: "human-1", shortCode: "H-U", name: "Human Team", budget: 100, cash: 100, identityId: "human", humanControlled: true, rosterLimit: 12 },
      { teamId: "ai-1", shortCode: "A-I", name: "AI Team", budget: 100, cash: 80, identityId: "ai", humanControlled: false, rosterLimit: 12 },
    ],
    teamIdentities: [],
    players,
    playerBaselines: players.map((player) =>
      createPlayerBaselineFromPlayer(player, {
        source: "seed",
        createdAt: "2026-06-11T00:00:00.000Z",
      }),
    ),
    disciplines: [
      { id: "tdm", name: "TDM", category: "power", weight: 1, playerCount: 2 },
      { id: "fechten", name: "Fechten", category: "speed", weight: 1, playerCount: 2 },
      { id: "schach", name: "Schach", category: "mental", weight: 1, playerCount: 2 },
      { id: "showcase", name: "Showcase", category: "social", weight: 1, playerCount: 2 },
    ],
    rosters: [
      // Mehrjahresverträge (LZ 3), damit die generischen Saisonübergangs-Tests die Setup-Mechanik
      // prüfen und nicht versehentlich am Vertragsablauf hängen. Die Season-End-Vertragsalterung
      // dekrementiert diese im Übergang auf LZ 2 (siehe Zusatz-Assertions unten). Vertragsablauf
      // (LZ 1 -> ausgelaufen) wird gezielt im dedizierten Aging-Test abgedeckt.
      { id: "r-human", teamId: "human-1", playerId: "p-human", salary: 1, upkeep: 1, contractLength: 3, roleTag: "starter", joinedSeasonId: "season-1" },
      { id: "r-ai", teamId: "ai-1", playerId: "p-ai", salary: 4, upkeep: 4, contractLength: 3, roleTag: "bench", joinedSeasonId: "season-1" },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "test",
      teamSource: "test",
      generatedAt: "2026-06-11T00:00:00.000Z",
      processedMappingRows: 0,
      importedPlayerCount: 2,
      matchedRosterCount: 2,
      teamCount: 2,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function save(): PersistedSaveGame {
  return {
    saveId: "save-1",
    name: "Test Save",
    status: "active",
    createdAt: "2026-06-11T00:00:00.000Z",
    updatedAt: "2026-06-11T00:00:00.000Z",
    gameState: gameState(),
  };
}

function persistenceMock(sourceSave: PersistedSaveGame) {
  const saveSingleplayerState = vi.fn((saveId: string, nextGameState: GameState) => ({ ...sourceSave, saveId, gameState: nextGameState }));
  return {
    persistence: {
      bootstrapSingleplayerSave: vi.fn(() => ({ save: sourceSave, createdFromSeed: false })),
      getActiveSave: vi.fn(() => sourceSave),
      getSaveById: vi.fn(() => sourceSave),
      saveSingleplayerState,
    } as unknown as PersistenceService,
    saveSingleplayerState,
  };
}

describe("pre-season workflow service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows season review, prize finance, facilities, xp, sell, renewal, buy, setup in order", async () => {
    const sourceSave = save();
    const { persistence } = persistenceMock(sourceSave);

    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    expect(preview.steps.map((step) => step.stepId)).toEqual([
      "season_review",
      "season_rewards",
      "facilities",
      "player_development",
      "preseason_management",
      "transfer_window_session",
      "contract_renewal",
      "sponsor_choice",
      "next_season_setup",
      "next_season_ready",
    ]);
    const rewards = preview.steps.find((step) => step.stepId === "season_rewards")!;
    const facilities = preview.steps.find((step) => step.stepId === "facilities")!;

    expect(rewards.summary.cashBefore).toBe(180);
    expect(rewards.summary.prizeMoney).toBe(30);
    expect(rewards.summary.rankChangePrize).not.toBeUndefined();
    expect(rewards.summary.sponsor).toBe(8);
    expect(rewards.summary.cashAfterRewards).toBe(210);
    expect(rewards.summary.prizeApplied).toBe(true);
    expect(rewards.warnings).toContain("already_applied");
    expect(facilities.summary.facilityUpkeep).toBeGreaterThan(0);
    expect(facilities.summary.facilityIncome).toBeGreaterThan(0);
    expect(facilities.summary.salaryTotal).toBe(5);
  });

  it("shows player development as a productive season-flow step with XP preview rows", async () => {
    const sourceSave = save();
    const { persistence } = persistenceMock(sourceSave);

    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const development = preview.steps.find((step) => step.stepId === "player_development")!;

    expect(development.productive).toBe(true);
    expect(development.status).toBe("ready");
    expect(development.summary.players).toBe(2);
  });

  it("separates human, ai and passive teams and keeps human transfers manual", async () => {
    const sourceSave = save();
    const { persistence } = persistenceMock(sourceSave);

    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const transferWindow = preview.steps.find((step) => step.stepId === "transfer_window_session")!;

    expect(preview.controlSummary.manualTeams).toBe(1);
    expect(preview.controlSummary.aiTeams).toBe(1);
    expect(transferWindow.warnings).toContain("human_teams_no_auto_transfer");
    expect(transferWindow.summary.usesSellThenBuyCycles).toBe(true);
  });

  it("blocks next season setup without confirm token", async () => {
    const sourceSave = save();
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);

    const result = await applyPreSeasonNextSeasonSetup(sourceSave, null, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("confirm_token_required");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("activates the next season with a fresh schedule, fresh form cards, and reset lineups/results", async () => {
    const sourceSave = save();
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const token = preview.steps.find((step) => step.stepId === "next_season_setup")?.confirmToken;

    const result = await applyPreSeasonNextSeasonSetup(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];

    expect(result.applied).toBe(true);
    expect(result.auditLogId).toEqual(expect.stringContaining("preseason-workflow"));
    if (!savedState) throw new Error("Expected next season setup to persist state.");
    expect(savedState.gamePhase).toBe("season_active");
    expect(savedState.season.id).toBe("season-2");
    expect(savedState.season.name).toBe("Season 2");
    expect(savedState.season.currentMatchday).toBe(1);
    expect(savedState.season.matchdayIds.every((matchdayId) => matchdayId.startsWith("season-2-matchday-"))).toBe(true);
    expect(savedState.seasonState.disciplineSchedule?.map((entry) => entry.matchdayId)).toEqual(savedState.season.matchdayIds);
    expect(savedState.seasonState.schedule.map((fixture) => fixture.matchdayId)).toEqual(savedState.season.matchdayIds);
    expect(savedState.matchdayState.matchdayId).toBe(savedState.season.matchdayIds[0]);
    expect(savedState.matchdayState.status).toBe("planning");
    expect(savedState.seasonState.lineupDrafts).toEqual([]);
    expect(savedState.seasonState.formCards?.length).toBeGreaterThan(0);
    expect(savedState.seasonState.formCards?.every((card) => card.seasonId === "season-2")).toBe(true);
    expect(savedState.seasonState.formCards?.some((card) => card.seasonId === "season-1")).toBe(false);
    expect(savedState.seasonState.matchdayResults).toEqual([]);
    expect(savedState.seasonState.disciplineResults).toEqual([]);
    expect(savedState.seasonState.playerDisciplinePerformances).toEqual([]);
    expect(savedState.seasonState.cashPrizeApplyLogs?.filter((log) => log.seasonId === "season-1")).toHaveLength(2);
    expect(savedState.seasonState.seasonSnapshots).toHaveLength(1);
    expect(savedState.seasonState.seasonSnapshots?.[0]?.seasonId).toBe("season-1");
    expect(savedState.seasonState.seasonSnapshots?.[0]?.finalStandings).toHaveLength(2);
    expect(savedState.seasonState.seasonSnapshots?.[0]?.playerPerformances).toHaveLength(2);
    expect(savedState.playerProgressionEvents?.filter((event) => event.seasonId === "season-1").length).toBeGreaterThan(0);
    expect(savedState.seasonState.standings["human-1"]?.points).toBe(0);
    expect(savedState.rosters.length).toBe(2);
    expect(savedState.transferHistory.length).toBe(0);
    // Season-End-Vertragsalterung ist im echten Übergang gelaufen: LZ 3 -> 2 (genau ein Tick), und
    // der Übergangs-AuditLog vermerkt den angewandten Tick.
    expect(savedState.rosters.find((entry) => entry.id === "r-human")?.contractLength).toBe(2);
    expect(savedState.rosters.find((entry) => entry.id === "r-ai")?.contractLength).toBe(2);
    expect(
      savedState.seasonState.preSeasonWorkflowLogs?.[0]?.warnings.some((warning) =>
        warning.startsWith("season_end_contract_tick_applied"),
      ),
    ).toBe(true);
    expect(savedState.seasonState.preSeasonWorkflowLogs?.[0]?.status).toBe("applied");
    expect(savedState.seasonState.preSeasonWorkflowLogs?.[0]?.affectedEntities).toContain("seasonState.disciplineSchedule");
    expect(savedState.seasonState.preSeasonWorkflowLogs?.[0]?.affectedEntities).toContain("playerProgressionEvents");
    expect(savedState.seasonState.preSeasonWorkflowLogs?.[0]?.warnings).toContain("season_mutator_state_reset_lineup_modifiers_cleared");
  });

  it("ages contracts exactly once per interactive transition: -1 decrement + salary schedule advance + expiry, idempotent, and ticks again next season", () => {
    const sourceSave = save();
    // Mehrjahresvertrag (LZ 3) mit explizitem Gehaltsplan auf dem MENSCHEN-Team: muss im echten
    // Übergang um genau 1 dekrementieren und der Gehaltsplan muss um ein Jahr vorrücken (Menschen-
    // Teams altern ebenso). Zusätzlich ein auslaufender (LZ 1) Vertrag: muss ausgelaufen sein.
    const multi = createPlayer({ id: "p-multi", name: "Longterm", marketValue: 30, salaryDemand: 10 });
    const expiring = createPlayer({ id: "p-exp", name: "Expiring", marketValue: 8, salaryDemand: 3 });
    sourceSave.gameState.players.push(multi, expiring);
    sourceSave.gameState.playerBaselines = [
      ...(sourceSave.gameState.playerBaselines ?? []),
      createPlayerBaselineFromPlayer(multi, { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
      createPlayerBaselineFromPlayer(expiring, { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
    ];
    sourceSave.gameState.rosters = [
      ...sourceSave.gameState.rosters,
      {
        id: "r-multi",
        teamId: "human-1",
        playerId: "p-multi",
        salary: 10,
        upkeep: 10,
        contractLength: 3,
        contractStatus: "active",
        roleTag: "starter",
        joinedSeasonId: "season-1",
        yearlySalarySchedule: [
          { yearIndex: 0, seasonOffset: 0, label: "Season 1", salary: 10 },
          { yearIndex: 1, seasonOffset: 1, label: "Season 2", salary: 8 },
          { yearIndex: 2, seasonOffset: 2, label: "Season 3", salary: 6 },
        ],
      },
      {
        id: "r-exp",
        teamId: "human-1",
        playerId: "p-exp",
        salary: 3,
        upkeep: 3,
        contractLength: 1,
        contractStatus: "expiring",
        roleTag: "bench",
        joinedSeasonId: "season-1",
      },
    ];

    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;
    const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
    const saved = saveSingleplayerState.mock.calls.at(-1)?.[1];

    expect(result.applied).toBe(true);
    if (!saved) throw new Error("Expected interactive transition to persist state.");

    // Mehrjahresvertrag: genau ein Tick (LZ 3 -> 2) und Gehaltsplan vorgerückt (Jahr 1 konsumiert).
    const multiAfter = saved.rosters.find((entry) => entry.id === "r-multi");
    expect(multiAfter?.contractLength).toBe(2);
    expect(multiAfter?.contractStatus).toBe("active");
    expect(multiAfter?.yearlySalarySchedule?.length).toBe(2);
    expect(multiAfter?.yearlySalarySchedule?.[0]?.salary).toBe(8);
    expect(multiAfter?.salary).toBe(8);

    // Auslaufender Vertrag (Menschen-Team): ausgelaufen (LZ 0) und wartet als renewal_pending auf die
    // menschliche Entscheidung — bleibt im Kader, KI-Entscheidungen greifen hier NICHT.
    const expAfter = saved.rosters.find((entry) => entry.id === "r-exp");
    expect(expAfter?.contractLength).toBe(0);
    expect(expAfter?.contractStatus).toBe("renewal_pending");

    // Der Übergang hat den Idempotenz-Marker der auslaufenden Saison persistiert.
    const season1TickMarker = saved.seasonState.preSeasonWorkflowLogs?.find(
      (log) => log.stepId === "season_end_contract_tick" && log.fromSeasonId === "season-1",
    );
    expect(season1TickMarker?.status).toBe("applied");

    // Idempotenz: ein erneuter Tick auf denselben (season-1-)Übergang ist ein No-Op — KEIN Doppel-Tick.
    const firstTick = computeSeasonEndContractTick(sourceSave);
    const doubleTick = computeSeasonEndContractTick({ ...sourceSave, gameState: firstTick.gameState });
    expect(firstTick.applied).toBe(true);
    expect(doubleTick.applied).toBe(false);
    expect(doubleTick.alreadyApplied).toBe(true);
    // Unverändert gegenüber dem ersten Tick (LZ bleibt 2, nicht 1).
    expect(doubleTick.gameState.rosters.find((entry) => entry.id === "r-multi")?.contractLength).toBe(2);

    // Zweiter Saisonübergang tickt ERNEUT (nicht steckengeblieben): der Marker ist je fromSeasonId,
    // die neue Saison (season-2) hat noch keinen Marker. LZ 2 -> 1.
    expect(saved.season.id).toBe("season-2");
    const nextSeasonSave: PersistedSaveGame = { ...sourceSave, gameState: saved };
    const secondTick = computeSeasonEndContractTick(nextSeasonSave);
    expect(secondTick.applied).toBe(true);
    expect(secondTick.alreadyApplied).toBe(false);
    expect(secondTick.gameState.rosters.find((entry) => entry.id === "r-multi")?.contractLength).toBe(1);
  });

  it("adds the appoint_captain step to the follow-up season flow after training, before sponsor", async () => {
    const sourceSave = save();
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const token = preview.steps.find((step) => step.stepId === "next_season_setup")?.confirmToken;

    await applyPreSeasonNextSeasonSetup(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];
    if (!savedState) throw new Error("Expected next season setup to persist state.");

    const stepIds = savedState.seasonState.newGameFlow?.steps?.map((step) => step.stepId) ?? [];
    expect(stepIds).toContain("appoint_captain");
    expect(stepIds.indexOf("appoint_captain")).toBeGreaterThan(stepIds.indexOf("training_facilities"));
    expect(stepIds.indexOf("appoint_captain")).toBeLessThan(stepIds.indexOf("choose_sponsor"));
  });

  it("carries the season captain into the next season when the player is still on the roster", async () => {
    const sourceSave = save();
    sourceSave.gameState.teamCaptains = [
      {
        seasonId: "season-1",
        teamId: "human-1",
        playerId: "p-human",
        playerName: "Human Player",
        leadershipScore: 42,
        style: "leader",
        effects: { moraleBuffer: 3, rivalryPressureReductionPct: 10, teamPowerModifierPct: 4, conflictSoftenChancePct: 14 },
        traitSignals: [],
        source: "manual_assignment",
      },
    ];
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const token = preview.steps.find((step) => step.stepId === "next_season_setup")?.confirmToken;

    await applyPreSeasonNextSeasonSetup(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];
    if (!savedState) throw new Error("Expected next season setup to persist state.");

    const carried = savedState.teamCaptains?.find((entry) => entry.seasonId === "season-2" && entry.teamId === "human-1");
    expect(carried?.playerId).toBe("p-human");
    expect(carried?.source).toBe("carried_over");
    // Alt-Record der abgelaufenen Saison bleibt für die Absetzungs-Historie erhalten.
    expect(savedState.teamCaptains?.some((entry) => entry.seasonId === "season-1")).toBe(true);
  });

  it("does not carry the captain forward when the player left the roster", async () => {
    const sourceSave = save();
    sourceSave.gameState.teamCaptains = [
      {
        seasonId: "season-1",
        teamId: "human-1",
        playerId: "p-gone",
        playerName: "Gone Player",
        leadershipScore: 42,
        style: "leader",
        effects: { moraleBuffer: 3, rivalryPressureReductionPct: 10, teamPowerModifierPct: 4, conflictSoftenChancePct: 14 },
        traitSignals: [],
        source: "manual_assignment",
      },
    ];
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const token = preview.steps.find((step) => step.stepId === "next_season_setup")?.confirmToken;

    await applyPreSeasonNextSeasonSetup(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];
    if (!savedState) throw new Error("Expected next season setup to persist state.");

    expect(savedState.teamCaptains?.some((entry) => entry.seasonId === "season-2")).toBe(false);
  });

  it("also snapshots the completed season in the lightweight next-season setup path", () => {
    const sourceSave = save();
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;

    const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected lightweight next season setup to persist state.");
    expect(savedState.season.id).toBe("season-2");
    expect(savedState.seasonState.disciplineSchedule?.map((entry) => entry.matchdayId)).toEqual(savedState.season.matchdayIds);
    expect(savedState.seasonState.formCards?.every((card) => card.seasonId === "season-2")).toBe(true);
    expect(savedState.seasonState.matchdayResults).toEqual([]);
    expect(savedState.seasonState.cashPrizeApplyLogs?.filter((log) => log.seasonId === "season-1")).toHaveLength(2);
    expect(savedState.seasonState.seasonSnapshots?.[0]?.seasonId).toBe("season-1");
    expect(savedState.seasonState.seasonSnapshots?.[0]?.finalStandings).toHaveLength(2);
    expect(savedState.playerProgressionEvents?.filter((event) => event.seasonId === "season-1").length).toBeGreaterThan(0);
    const activeObjectives = savedState.seasonState.teamSeasonObjectives?.filter(
      (objective) => objective.seasonId === savedState.season.id,
    ) ?? [];
    const teamsWithObjectives = new Set(activeObjectives.map((objective) => objective.teamId));
    const objectiveKeys = new Set(activeObjectives.map((objective) => `${objective.teamId}:${objective.objectiveId}`));
    expect(teamsWithObjectives.size).toBe(savedState.teams.length);
    expect(objectiveKeys.size).toBe(activeObjectives.length);
    expect(Object.keys(savedState.seasonState.boardConfidence ?? {})).toHaveLength(savedState.teams.length);
  });

  it("resets rostered player fatigue to 0 on lightweight next-season setup", () => {
    const sourceSave = save();
    sourceSave.gameState.players = sourceSave.gameState.players.map((player) => ({ ...player, fatigue: 88 }));
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;

    const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected lightweight next season setup to persist state.");
    const rosterPlayerIds = new Set(savedState.rosters.map((entry) => entry.playerId));
    for (const player of savedState.players) {
      if (!rosterPlayerIds.has(player.id)) continue;
      expect(player.fatigue ?? 0).toBe(0);
    }
  });

  it("resets free-agent fatigue to 0 at the season boundary, consistently with rostered players", () => {
    // Regression: der seasonTrainingAccumulator wird an der Saisongrenze für ALLE geleert, aber die
    // Fatigue eines Free Agents wurde zuvor NUR geklemmt (volle Vorsaison-Fatigue inkl. Trainings-
    // Schicht behalten) — der Free Agent startete also mit stale/aufgeblähter Fatigue OHNE passenden
    // Accumulator. Jetzt wird sie wie bei rostered Spielern auf 0 zurückgesetzt.
    const sourceSave = save();
    const freeAgent = createPlayer({ id: "fa-fatigued", name: "Tired Free Agent", fatigue: 91 });
    sourceSave.gameState.players.push(freeAgent);
    sourceSave.gameState.playerBaselines = [
      ...(sourceSave.gameState.playerBaselines ?? []),
      createPlayerBaselineFromPlayer(freeAgent, { source: "seed", createdAt: "2026-06-11T00:00:00.000Z" }),
    ];
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;

    const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];

    expect(result.applied).toBe(true);
    if (!savedState) throw new Error("Expected lightweight next season setup to persist state.");
    const savedFreeAgent = savedState.players.find((player) => player.id === "fa-fatigued");
    const rosterPlayerIds = new Set(savedState.rosters.map((entry) => entry.playerId));
    expect(rosterPlayerIds.has("fa-fatigued")).toBe(false);
    expect(savedFreeAgent?.fatigue ?? 0).toBe(0);
    expect(savedFreeAgent?.seasonTrainingAccumulator ?? null).toBeNull();
  });

  it("advances the beliebtheit KPI even in transfer-pipeline FAST mode", () => {
    // Regression: der FAST-Pfad übersprang advanceTeamBeliebtheitForSeasonTransition — dadurch fror die
    // Arena-Kopplung (mean-reverting Beliebtheit) im Sim-/Fast-Übergang ein. Jetzt läuft die
    // Fortschreibung auch im FAST-Pfad.
    const previous = process.env.OLY_TRANSFER_PIPELINE_FAST;
    process.env.OLY_TRANSFER_PIPELINE_FAST = "1";
    try {
      const sourceSave = save();
      const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
      const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;

      const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
      const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];

      expect(result.applied).toBe(true);
      if (!savedState) throw new Error("Expected fast-mode next season setup to persist state.");
      // Wir sind tatsächlich im FAST-Pfad (teure Season-Prep übersprungen).
      expect(savedState.seasonState.preSeasonWorkflowLogs?.[0]?.warnings).toContain(
        "transfer_pipeline_fast_skip_expensive_season_prep",
      );
      const beliebtheit = savedState.seasonState.beliebtheitByTeamId ?? {};
      expect(Object.keys(beliebtheit).sort()).toEqual(["ai-1", "human-1"]);
      for (const teamId of ["human-1", "ai-1"]) {
        const value = beliebtheit[teamId]?.value;
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThanOrEqual(0.5);
        expect(value).toBeLessThanOrEqual(1.5);
      }
      // Zeitreihe je Team fortgeschrieben.
      expect(savedState.seasonState.beliebtheitHistoryByTeamId?.["human-1"]?.length ?? 0).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) {
        delete process.env.OLY_TRANSFER_PIPELINE_FAST;
      } else {
        process.env.OLY_TRANSFER_PIPELINE_FAST = previous;
      }
    }
  });

  it("keeps free agents at their developed values next season (no baseline regression)", () => {
    const sourceSave = save();
    const freeAgent = createPlayer({
      id: "fa-1",
      name: "Loose Cannon",
      marketValue: 42,
      salaryDemand: 5,
      currentXP: 30,
      attributeSheetStats: {
        power: 40,
        health: 38,
        stamina: 41,
        intelligence: 27,
        awareness: 29,
        determination: 39,
        speed: 43,
        dexterity: 40,
        charisma: 26,
        will: 28,
        spirit: 25,
        torment: 24,
      },
      disciplineRatings: {
        tdm: 42,
        fechten: 44,
        schach: 27,
        showcase: 25,
      },
      coreStats: { pow: 42, spe: 44, men: 27, soc: 25 },
    });
    const freeAgentBaseline = createPlayerBaselineFromPlayer({
      ...freeAgent,
      marketValue: 20,
      salaryDemand: 2,
      attributeSheetStats: {
        power: 31,
        health: 31,
        stamina: 31,
        intelligence: 31,
        awareness: 31,
        determination: 31,
        speed: 31,
        dexterity: 31,
        charisma: 31,
        will: 31,
        spirit: 31,
        torment: 31,
      },
      disciplineRatings: {
        tdm: 31,
        fechten: 31,
        schach: 31,
        showcase: 31,
      },
      coreStats: { pow: 31, spe: 31, men: 31, soc: 31 },
    });
    freeAgentBaseline.marketValue = 20;
    freeAgentBaseline.salary = 2;
    freeAgentBaseline.seasonZeroEconomy = {
      ...(freeAgentBaseline.seasonZeroEconomy ?? {}),
      marketValue: 20,
      salary: 2,
    };
    sourceSave.gameState.players.push(freeAgent);
    sourceSave.gameState.playerBaselines = [...(sourceSave.gameState.playerBaselines ?? []), freeAgentBaseline];
    sourceSave.gameState.playerMoraleState = [
      {
        playerId: "fa-1",
        teamId: "OLD",
        morale: 82,
        visibleMood: "excellent",
        lastUpdatedSeasonId: "season-1",
        inactiveSeasons: 0,
        reasons: [],
        contractIntent: "willing_to_extend",
      },
    ];

    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const token = buildPreSeasonNextSeasonSetupToken(sourceSave).confirmToken;

    const result = applyPreSeasonNextSeasonSetupLightweight(sourceSave, token, persistence);
    const savedState = saveSingleplayerState.mock.calls.at(-1)?.[1];
    const savedFreeAgent = savedState?.players.find((player) => player.id === "fa-1");

    expect(result.applied).toBe(true);
    expect(savedFreeAgent).toBeDefined();
    // Die Multi-Season-Free-Agent-Abwertung ist entfernt: der Free Agent wird NICHT mehr Richtung
    // seines (niedrigeren) Baseline zurückgezogen. Direkter Nachweis = die Attribute bleiben exakt auf
    // ihrem entwickelten Wert (früher drifteten sie 12% Richtung Baseline 31: power 40→~39, int 27→~27.5).
    expect(savedFreeAgent?.attributeSheetStats?.power).toBe(40);
    expect(savedFreeAgent?.attributeSheetStats?.intelligence).toBe(27);
    // Marktwert/Gehalt werden separat pool-relativ neu berechnet (nicht Teil der entfernten Abwertung),
    // aber sie werden nicht mehr Richtung Baseline (MW 20 / Gehalt 2) heruntergezogen.
    expect(savedFreeAgent?.marketValue).toBeGreaterThanOrEqual(42);
    expect(savedFreeAgent?.salaryDemand).toBeGreaterThanOrEqual(5);
    // Der XP-Cooloff für inaktive Free Agents bleibt bestehen (unabhängig von der Baseline-Abwertung).
    expect(savedFreeAgent?.currentXP).toBeLessThan(30);
    expect(savedState?.playerMoraleState?.find((entry) => entry.playerId === "fa-1")?.inactiveSeasons).toBe(1);
  });

  it("blocks next-season setup when a completed season snapshot cannot be built", async () => {
    const sourceSave = save();
    sourceSave.gameState.seasonState.matchdayResults = [];
    const { persistence, saveSingleplayerState } = persistenceMock(sourceSave);
    const preview = await buildPreSeasonWorkflowPreview(sourceSave, persistence);
    const token = preview.steps.find((step) => step.stepId === "next_season_setup")?.confirmToken;

    const result = await applyPreSeasonNextSeasonSetup(sourceSave, token, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("season_not_completed_for_snapshot");
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("keeps service source free from Prisma write paths", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        path.join(process.cwd(), "lib/season/preseason-workflow-service.ts"),
        "utf8",
      ),
    );

    expect(source).not.toMatch(/PrismaClient|@prisma\/client|prisma\./);
    expect(source).toContain("transfer_window_session");
  });
});
