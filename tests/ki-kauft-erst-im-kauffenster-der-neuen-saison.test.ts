/**
 * CHRIS' REGEL: „das ist falsch! wir verkaufen als separaten schritt zum ende der saison und
 * gekauft wird erst in der folgesaison."
 *
 * Diese Suite haelt die beiden Haelften der Regel VERHALTENSBASIERT fest (kein Zeichenketten-Grep):
 *
 *   1. Die Marktplan-VORSCHAU startet am Saisonende gar keinen Kauf-Scan mehr — der Plan ist ein
 *      reiner Verkaufsplan, und „unter Minimum ohne Kaufkandidat" ist dort kein Blocker (der
 *      Kader wird planmaessig erst im Kauffenster der neuen Saison aufgefuellt).
 *   2. Der Preseason-Hintergrundlauf (der einzige automatische S2+-Kaufausloeser) verschiebt sich
 *      am Saisonende komplett auf die neue Saison und laeuft dort als reiner KAUF-Lauf
 *      (applySellSteps: false) — verkauft wurde bereits als separater Schritt am Saisonende.
 *   3. Das Ausloeser-Fenster des Clients ist dasselbe wie beim Menschen: das Saisonstart-Setup
 *      (`isEarlySeasonTransferSetup` via getTransferWindowStatus), nicht die Saisonende-Kette.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const buildAiTransfermarktPreview = vi.fn();
const buildAiTransfermarktSellPreview = vi.fn();

vi.mock("@/lib/ai/ai-transfermarkt-preview-service", () => ({
  buildAiTransfermarktPreview,
}));

vi.mock("@/lib/ai/ai-transfermarkt-sell-preview-service", () => ({
  buildAiTransfermarktSellPreview,
}));

vi.mock("@/lib/db/read/foundation-read-repository", () => ({
  loadFoundationSnapshotFromPrisma: async () => null,
}));

// Der Spielstand kommt ueber den `gameState`-Parameter herein; die Persistenz darf nie gebraucht
// werden (die Vorschau bleibt read-only am uebergebenen Stand).
vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({ save: null }),
    getSaveById: () => null,
    getActiveSave: () => null,
  }),
}));

function baueGameState(gamePhase: GameState["gamePhase"]): GameState {
  const team = makeTeam({ teamId: "C-C", cash: 80 });
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      teamControlSettings: { "C-C": { teamId: "C-C", controlMode: "ai" } },
      teamStrategyProfiles: {},
      matchdayResults: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    gamePhase,
    teams: [team],
    teamIdentities: [makeTeamIdentity({ teamId: "C-C", playerMin: 3, playerOpt: 4 })],
    players: [],
    disciplines: [],
    rosters: [
      makeRosterEntry({ id: "r-1", teamId: "C-C", playerId: "p-1" }),
      makeRosterEntry({ id: "r-2", teamId: "C-C", playerId: "p-2" }),
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 0,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as GameState;
}

function mockeKaufVorschauMitEinemKandidaten() {
  buildAiTransfermarktPreview.mockResolvedValue({
    readOnly: true,
    source: "sqlite",
    scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
    totalTeams: 1,
    aiTeams: 1,
    skippedManual: 0,
    skippedPassive: 0,
    skippedDisabled: 0,
    readyTeams: 1,
    warningTeams: 0,
    blockedTeams: 0,
    teams: [
      {
        teamId: "C-C",
        teamCode: "C-C",
        teamName: "Cash Creators",
        controlMode: "ai",
        aiTransferPreviewEnabled: true,
        status: "ready",
        cash: 80,
        salary: 12,
        salaryTotal: 12,
        rosterSize: 2,
        rosterCount: 2,
        targetRosterMin: 3,
        targetRosterOpt: 4,
        marketValueTotal: 90,
        needSummary: "Kader unter Minimum.",
        budgetStatus: "healthy",
        rosterStatus: "under_min",
        topTargets: [],
        recommendedBuys: [
          {
            playerId: "fa-1",
            playerName: "Value Hunter",
            name: "Value Hunter",
            className: "Trader",
            race: "Human",
            ovr: 88,
            mvs: 21.4,
            price: 20,
            marketValue: 20,
            salary: 3,
            contractLength: 1,
            cashAfter: 60,
            rosterAfter: 3,
            salaryAfter: 15,
            fitSummary: "stark fuer Value",
            sportsSummary: "POW 40 / SPE 50 / MEN 45 / SOC 48",
            budgetReason: ["Cash bleibt gesund"],
            warnings: [],
            overallRecommendationScore: 71,
            score: 71,
            reason: "starker Value-Fit",
            fitNotes: ["Need"],
            riskNotes: [],
            strategyNotes: ["passt zum hinterlegten Team-Stil"],
          },
        ],
        skippedTargets: [],
        warnings: [],
        explanation: "Bank der Olympiade. Value first.",
      },
    ],
  });
}

function mockeVerkaufsVorschauOhneKandidaten() {
  buildAiTransfermarktSellPreview.mockResolvedValue({
    readOnly: true,
    source: "sqlite",
    scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "all" },
    totalTeams: 1,
    aiTeams: 1,
    skippedManual: 0,
    skippedPassive: 0,
    skippedDisabled: 0,
    readyTeams: 1,
    warningTeams: 0,
    blockedTeams: 0,
    teams: [
      {
        teamId: "C-C",
        teamCode: "C-C",
        teamName: "Cash Creators",
        controlMode: "ai",
        aiSellPreviewEnabled: true,
        status: "ready",
        strategySummary: "Hold cheap depth unless profit spikes.",
        cash: 80,
        rosterCount: 2,
        salaryTotal: 12,
        marketValueTotal: 90,
        rosterSize: 2,
        playerMin: 3,
        playerOpt: 4,
        targetRosterMin: 3,
        targetRosterOpt: 4,
        budgetPressure: "healthy",
        sellCandidates: [],
        keepCore: [],
        warnings: [],
        blockingReasons: [],
        explanation: "Hold cheap depth unless profit spikes.",
      },
    ],
  });
}

describe("Marktplan-Vorschau: am Saisonende wird nicht einmal mehr ein Kauf GEPLANT", () => {
  beforeEach(() => {
    buildAiTransfermarktPreview.mockReset();
    buildAiTransfermarktSellPreview.mockReset();
    process.env.OLY_UNIFIED_PICK = "0";
  });

  it("startet in der Saisonende-Kette keinen Kauf-Scan und plant null Kaeufe", async () => {
    mockeKaufVorschauMitEinemKandidaten();
    mockeVerkaufsVorschauOhneKandidaten();

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamScope: "all",
      gameState: baueGameState("transfer_buy_phase"),
    });

    // Der Kauf-Scan wird gar nicht erst gestartet — nicht bloss dessen Ergebnis verworfen.
    expect(buildAiTransfermarktPreview).not.toHaveBeenCalled();
    // Die Verkaufsseite laeuft unveraendert weiter.
    expect(buildAiTransfermarktSellPreview).toHaveBeenCalledTimes(1);
    const team = result.teams.find((entry) => entry.teamId === "C-C");
    expect(team).toBeDefined();
    expect(team!.buyPlan.candidates).toHaveLength(0);
    // Unter Minimum OHNE Kaufkandidat ist am Saisonende der GEPLANTE Zustand, kein Blocker:
    // aufgefuellt wird erst im Kauffenster der neuen Saison.
    expect(team!.blockingReasons).not.toContain("roster_under_min_without_buy_candidate");
    expect(team!.blockingReasons).not.toContain("roster_after_market_plan_below_player_min");
  }, 30000);

  it("Gegenprobe: in der laufenden neuen Saison laeuft der Kauf-Scan wie gehabt", async () => {
    mockeKaufVorschauMitEinemKandidaten();
    mockeVerkaufsVorschauOhneKandidaten();

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
      teamScope: "all",
      gameState: baueGameState("season_active"),
    });

    expect(buildAiTransfermarktPreview).toHaveBeenCalledTimes(1);
    const team = result.teams.find((entry) => entry.teamId === "C-C");
    expect(team).toBeDefined();
    expect(team!.buyPlan.candidates.length).toBeGreaterThan(0);
  }, 30000);

  it("deckt jede Station der Saisonende-Kette ab (abgeleitet, nicht aufgezaehlt)", async () => {
    const { isSeasonEndPhase } = await import("@/lib/season/season-transition-chain");
    for (const phase of [
      "season_completed",
      "season_review",
      "season_rewards",
      "player_development",
      "season_end_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
      "lineup_setup",
      "next_season_ready",
    ] as const) {
      mockeKaufVorschauMitEinemKandidaten();
      mockeVerkaufsVorschauOhneKandidaten();
      expect(isSeasonEndPhase(phase), `${phase} muss als Saisonende gelten`).toBe(true);

      const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
      const result = await buildAiMarketPlanPreview({
        source: "sqlite",
        saveId: "save-local",
        seasonId: "season-1",
        teamScope: "all",
        gameState: baueGameState(phase),
      });
      const geplant = result.teams.reduce((sum, entry) => sum + entry.buyPlan.candidates.length, 0);
      expect(geplant, `Phase ${phase} darf keine Kaeufe planen`).toBe(0);
    }
    expect(buildAiTransfermarktPreview).not.toHaveBeenCalled();
  }, 60000);
});

describe("Client-Ausloeser: das KI-Kauffenster ist das Saisonstart-Setup der neuen Saison", () => {
  // Der Hintergrundlauf-Ausloeser im Shell-Scope feuert fuer S2+ auf
  // `getTransferWindowStatus(gameState).isSeasonStartSetup` — dieselbe Regel wie fuers
  // menschliche Kaufen. Hier ist festgehalten, dass dieses Fenster GENAU die neue Saison vor
  // ihrem ersten Spieltag ist und NIE eine Station der Saisonende-Kette.
  it("ist in jeder Saisonende-Station geschlossen und im Saisonstart offen", async () => {
    const { getTransferWindowStatus } = await import("@/lib/market/transfer-window-policy");

    for (const phase of [
      "season_completed",
      "season_review",
      "season_end_management",
      "transfer_sell_phase",
      "transfer_buy_phase",
      "lineup_setup",
      "next_season_ready",
    ] as const) {
      const status = getTransferWindowStatus(baueGameState(phase));
      expect(status.isSeasonStartSetup, `${phase} ist kein Saisonstart`).toBe(false);
      expect(status.canBuy, `${phase} darf kein Kauffenster sein`).toBe(false);
    }

    const saisonstart = baueGameState("season_active");
    expect(getTransferWindowStatus(saisonstart).isSeasonStartSetup).toBe(true);
    expect(getTransferWindowStatus(saisonstart).canBuy).toBe(true);

    // Sobald der erste Spieltag gewertet ist, schliesst das Fenster wieder.
    const nachSpieltag1: GameState = {
      ...saisonstart,
      matchdayState: { ...saisonstart.matchdayState, status: "resolved" },
    };
    expect(getTransferWindowStatus(nachSpieltag1).isSeasonStartSetup).toBe(false);
  });
});
