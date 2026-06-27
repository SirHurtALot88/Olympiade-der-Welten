import { beforeEach, describe, expect, it, vi } from "vitest";

const buildAiTransfermarktPreview = vi.fn();
const buildAiTransfermarktSellPreview = vi.fn();

vi.mock("@/lib/ai/ai-transfermarkt-preview-service", () => ({
  buildAiTransfermarktPreview,
}));

vi.mock("@/lib/ai/ai-transfermarkt-sell-preview-service", () => ({
  buildAiTransfermarktSellPreview,
}));

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    bootstrapSingleplayerSave: () => ({ save: null }),
    getSaveById: () => null,
    getActiveSave: () => null,
  }),
}));

vi.mock("@/lib/db/read/foundation-read-repository", () => ({
  loadFoundationSnapshotFromPrisma: async () => null,
}));

describe("ai market plan preview service", () => {
  beforeEach(() => {
    buildAiTransfermarktPreview.mockReset();
    buildAiTransfermarktSellPreview.mockReset();
  });

  it("stays read-only and combines buy and sell previews for ai teams", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: null,
        teamScope: "ai",
      },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 2,
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
        {
          teamId: "D-L",
          teamCode: "D-L",
          teamName: "Dire Legion",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: 55,
          salary: 18,
          salaryTotal: 18,
          rosterSize: 5,
          rosterCount: 5,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          marketValueTotal: 110,
          needSummary: "Kader ueber Optimum.",
          budgetStatus: "tight",
          rosterStatus: "at_or_above_opt",
          topTargets: [],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: [],
          explanation: "Human-first faction style.",
        },
      ],
    });

    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: "save-local",
        seasonId: "season-1",
        teamId: null,
        teamScope: "ai",
      },
      totalTeams: 2,
      aiTeams: 2,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 2,
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
        {
          teamId: "D-L",
          teamCode: "D-L",
          teamName: "Dire Legion",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Non-human fit is fragile for this faction.",
          cash: 55,
          rosterCount: 5,
          salaryTotal: 18,
          marketValueTotal: 110,
          rosterSize: 5,
          playerMin: 3,
          playerOpt: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          budgetPressure: "tight",
          sellCandidates: [
            {
              activePlayerId: "ap-1",
              playerId: "p-1",
              playerName: "Hell Clerk",
              className: "Warlock",
              race: "Demon",
              raceName: "Demon",
              ovr: 61,
              mvs: 14.2,
              salary: 6,
              marketValue: 28,
              expectedSellValue: null,
              contractLength: 1,
              rosterAfter: 4,
              salaryAfter: 12,
              cashAfter: null,
              sportValueSummary: "Kaum Nutzen",
              performanceSummary: "Kaum Nutzen",
              strategyFitSummary: "Widerspricht eher dem Teamprofil.",
              reasonToSell: ["passt nur schwach zum Teamprofil"],
              reasonToKeep: [],
              reasonsToSell: ["passt nur schwach zum Teamprofil"],
              reasonsToKeep: [],
              warnings: ["Kein belastbarer Verkaufswert aus der aktuellen Sell-Preview vorhanden."],
              sellPriority: 79,
              sellPriorityScore: 79,
            },
          ],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Non-human fit is fragile for this faction.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
    });

    expect(result.readOnly).toBe(true);
    expect(result.totalTeams).toBe(2);
    expect(result.aiTeams).toBe(2);
    expect(result.buyOnlyTeams).toBe(1);
    expect(result.sellOnlyTeams).toBe(1);
    expect(result.blockedTeams).toBe(0);

    const cashCreators = result.teams.find((team) => team.teamId === "C-C");
    const direLegion = result.teams.find((team) => team.teamId === "D-L");

    expect(cashCreators?.status).toBe("buy_only");
    expect(cashCreators?.buyPlan.candidates[0]?.name).toBe("Value Hunter");
    expect(cashCreators?.buyPlan.candidates[0]?.mvs).toBe(21.4);
    expect(cashCreators?.projectedState.cashAfterPlan).toBe(60);
    expect(cashCreators?.buyPlan.rosterAfterBuy).toBe(3);

    expect(direLegion?.status).toBe("sell_only");
    expect(direLegion?.sellPlan.candidates[0]?.playerName).toBe("Hell Clerk");
    expect(direLegion?.sellPlan.candidates[0]?.mvs).toBe(14.2);
    expect(direLegion?.projectedState.cashAfterPlan).toBe(null);
    expect(direLegion?.sellPlan.totalExpectedSellValue).toBeNull();
    expect(direLegion?.projectedState.marketValueAfterPlan).toBe(null);
    expect(direLegion?.warnings.join(" ")).toContain("Kein belastbarer Verkaufswert");
    expect(direLegion?.planSteps[0]?.stepType).toBe("sell");
    expect(result.summary.sellOnly).toBe(1);
  });

  it("keeps manual and passive teams out of ai scope and reports disabled teams as blocked", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "ai" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 1,
      skippedPassive: 1,
      skippedDisabled: 1,
      readyTeams: 0,
      warningTeams: 0,
      blockedTeams: 1,
      teams: [
        {
          teamId: "Z-H",
          teamCode: "Z-H",
          teamName: "Zero Heroes",
          controlMode: "ai",
          aiTransferPreviewEnabled: false,
          status: "blocked",
          cash: 40,
          salary: 10,
          salaryTotal: 10,
          rosterSize: 3,
          rosterCount: 3,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          marketValueTotal: 75,
          needSummary: "Preview aus.",
          budgetStatus: "critical",
          rosterStatus: "under_opt",
          topTargets: [],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: ["AI-Transfer-Preview ist fuer dieses Team deaktiviert"],
          explanation: "All-in style.",
        },
      ],
    });
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "ai" },
      totalTeams: 1,
      aiTeams: 1,
      skippedManual: 0,
      skippedPassive: 0,
      skippedDisabled: 0,
      readyTeams: 0,
      warningTeams: 0,
      blockedTeams: 1,
      teams: [
        {
          teamId: "Z-H",
          teamCode: "Z-H",
          teamName: "Zero Heroes",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Aggressive hold if no buy path exists.",
          cash: 40,
          rosterCount: 3,
          salaryTotal: 10,
          marketValueTotal: 75,
          rosterSize: 3,
          playerMin: 3,
          playerOpt: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          budgetPressure: "critical",
          sellCandidates: [],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Aggressive hold if no buy path exists.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
    });

    expect(result.skippedManual).toBe(1);
    expect(result.skippedPassive).toBe(1);
    expect(result.skippedDisabled).toBe(1);
    expect(result.teams[0].status).toBe("blocked");
    expect(result.teams[0].blockingReasons).toContain("ai_transfer_preview_disabled");
    expect(result.summary.blocked).toBe(1);
  });

  it("plans a sale for negative cash management pressure even without a profit flip", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "ai" },
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
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Traders",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: -6,
          salary: 22,
          salaryTotal: 22,
          rosterSize: 4,
          rosterCount: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          marketValueTotal: 80,
          needSummary: "Cash negativ.",
          budgetStatus: "critical",
          rosterStatus: "at_opt",
          topTargets: [],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: [],
          explanation: "Cash recovery before luxury buys.",
        },
      ],
    });
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-1", teamId: null, teamScope: "ai" },
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
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Traders",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Cash recovery before luxury buys.",
          cash: -6,
          rosterCount: 4,
          salaryTotal: 22,
          marketValueTotal: 80,
          rosterSize: 4,
          playerMin: 3,
          playerOpt: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          budgetPressure: "critical",
          sellCandidates: [
            {
              activePlayerId: "ap-cash",
              playerId: "p-cash",
              playerName: "Cash Relief",
              className: "Runner",
              race: "Human",
              raceName: "Human",
              ovr: 50,
              mvs: 9,
              salary: 4,
              marketValue: 16,
              expectedSellValue: 16,
              contractLength: 1,
              rosterAfter: 3,
              salaryAfter: 18,
              cashAfter: 10,
              sportValueSummary: "unter Erwartung",
              performanceSummary: "unter Erwartung",
              strategyFitSummary: "Cash pressure.",
              reasonToSell: ["negatives Teamcash zum Seasonstart"],
              reasonToKeep: [],
              reasonsToSell: ["negatives Teamcash zum Seasonstart"],
              reasonsToKeep: [],
              warnings: [],
              sellPriority: 34,
              sellPriorityScore: 34,
            },
          ],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Cash recovery before luxury buys.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-1",
    });

    expect(result.sellOnlyTeams).toBe(1);
    expect(result.teams[0].status).toBe("sell_only");
    expect(result.teams[0].sellPlan.candidates[0]?.playerName).toBe("Cash Relief");
    expect(result.teams[0].planSteps[0]?.reason).toBe("negatives Teamcash zum Seasonstart");
  });

  it("plans a more active preseason churn when profit windows and expiring contracts create upgrade room", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Traders",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: 70,
          salary: 42,
          salaryTotal: 42,
          rosterSize: 10,
          rosterCount: 10,
          targetRosterMin: 7,
          targetRosterOpt: 10,
          marketValueTotal: 210,
          needSummary: "Kader bei Optimum, aber Upgrade-Fenster offen.",
          budgetStatus: "healthy",
          rosterStatus: "at_or_above_opt",
          topTargets: [],
          recommendedBuys: [
            {
              playerId: "buy-upgrade",
              playerName: "Top Ten Push",
              name: "Top Ten Push",
              className: "Tactician",
              race: "Human",
              ovr: 86,
              mvs: 22,
              price: 24,
              marketValue: 24,
              salary: 5,
              contractLength: 1,
              cashAfter: 46,
              rosterAfter: 11,
              salaryAfter: 47,
              fitSummary: "staerkt MEN",
              sportsSummary: "POW 42 / SPE 45 / MEN 88 / SOC 64",
              budgetReason: ["Cash bleibt gesund"],
              warnings: [],
              overallRecommendationScore: 66,
              score: 66,
              reason: "Upgrade fuer Top-10-Push",
              fitNotes: ["staerkt MEN"],
              riskNotes: [],
              strategyNotes: ["passt zum hinterlegten Team-Stil"],
            },
            {
              playerId: "buy-depth",
              playerName: "Depth Cover",
              name: "Depth Cover",
              className: "Rogue",
              race: "Elf",
              ovr: 72,
              mvs: 15,
              price: 14,
              marketValue: 14,
              salary: 3,
              contractLength: 1,
              cashAfter: 56,
              rosterAfter: 11,
              salaryAfter: 45,
              fitSummary: "breite Speed-Deckung",
              sportsSummary: "POW 38 / SPE 76 / MEN 52 / SOC 49",
              budgetReason: ["Depth finanzierbar"],
              warnings: [],
              overallRecommendationScore: 59,
              score: 59,
              reason: "Breite nach Verkauf",
              fitNotes: ["staerkt SPE"],
              riskNotes: [],
              strategyNotes: ["Value-Depth"],
            },
          ],
          skippedTargets: [],
          warnings: [],
          explanation: "Opportunistisch verbessern statt nur halten.",
        },
      ],
    });
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "A-I",
          teamCode: "A-I",
          teamName: "AI Traders",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Profit windows can fund upgrades.",
          cash: 70,
          rosterCount: 10,
          salaryTotal: 42,
          marketValueTotal: 210,
          rosterSize: 10,
          playerMin: 7,
          playerOpt: 10,
          targetRosterMin: 7,
          targetRosterOpt: 10,
          budgetPressure: "healthy",
          sellCandidates: [
            {
              activePlayerId: "ap-profit",
              playerId: "p-profit",
              playerName: "Peak Value",
              className: "Hero",
              race: "Human",
              raceName: "Human",
              ovr: 68,
              mvs: 11,
              salary: 6,
              marketValue: 20,
              expectedSellValue: 25,
              contractLength: 1,
              rosterAfter: 9,
              salaryAfter: 36,
              cashAfter: 95,
              sportValueSummary: "okay",
              performanceSummary: "okay",
              strategyFitSummary: "Profit window.",
              reasonToSell: ["realisierbarer Gewinn von 5", "kurze Restvertragslaenge"],
              reasonToKeep: [],
              reasonsToSell: ["realisierbarer Gewinn von 5", "kurze Restvertragslaenge"],
              reasonsToKeep: [],
              warnings: [],
              boardTrustScore: 48,
              boardTrustSmiley: ":|",
              boardTrustPolicy: "renewal_warning",
              boardTrustReasons: [],
              boardTrustWarnings: [],
              salaryCapMultiplier: 0.9,
              sellPriority: 52,
              sellPriorityScore: 52,
            },
            {
              activePlayerId: "ap-under",
              playerId: "p-under",
              playerName: "Flat Season",
              className: "Mage",
              race: "Elf",
              raceName: "Elf",
              ovr: 78,
              mvs: 9,
              salary: 8,
              marketValue: 30,
              expectedSellValue: 33,
              contractLength: 1,
              rosterAfter: 9,
              salaryAfter: 34,
              cashAfter: 103,
              sportValueSummary: "unter Erwartung",
              performanceSummary: "unter Erwartung",
              strategyFitSummary: "Underperformed.",
              reasonToSell: ["Performance blieb unter Erwartung", "Vertrag laeuft aus und Fit/Leistung rechtfertigt keine automatische Verlaengerung"],
              reasonToKeep: [],
              reasonsToSell: ["Performance blieb unter Erwartung", "Vertrag laeuft aus und Fit/Leistung rechtfertigt keine automatische Verlaengerung"],
              reasonsToKeep: [],
              warnings: [],
              boardTrustScore: 32,
              boardTrustSmiley: ":(",
              boardTrustPolicy: "do_not_renew",
              boardTrustReasons: ["performance_below_board_expectation"],
              boardTrustWarnings: [],
              salaryCapMultiplier: 0,
              sellPriority: 64,
              sellPriorityScore: 64,
            },
            {
              activePlayerId: "ap-hold",
              playerId: "p-hold",
              playerName: "Fine Depth",
              className: "Tank",
              race: "Orc",
              raceName: "Orc",
              ovr: 65,
              mvs: 14,
              salary: 3,
              marketValue: 12,
              expectedSellValue: 12.5,
              contractLength: 3,
              rosterAfter: 9,
              salaryAfter: 39,
              cashAfter: 82.5,
              sportValueSummary: "stabil",
              performanceSummary: "stabil",
              strategyFitSummary: "Keepable.",
              reasonToSell: ["passt nur schwach zum Teamprofil"],
              reasonToKeep: ["geringe Gehaltslast"],
              reasonsToSell: ["passt nur schwach zum Teamprofil"],
              reasonsToKeep: ["geringe Gehaltslast"],
              warnings: [],
              boardTrustScore: 61,
              boardTrustSmiley: ":)",
              boardTrustPolicy: "open",
              boardTrustReasons: [],
              boardTrustWarnings: [],
              salaryCapMultiplier: null,
              sellPriority: 36,
              sellPriorityScore: 36,
            },
          ],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Profit windows can fund upgrades.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
    });

    expect(result.sellThenBuyTeams).toBe(1);
    expect(result.teams[0].status).toBe("sell_then_buy");
    expect(result.teams[0].sellPlan.candidates.map((candidate) => candidate.playerName)).toEqual([
      "Flat Season",
      "Peak Value",
    ]);
    expect(result.teams[0].buyPlan.candidates.map((candidate) => candidate.playerName)).toContain("Top Ten Push");
    expect(result.teams[0].planSteps.filter((step) => step.stepType === "sell")).toHaveLength(2);
    expect(result.teams[0].planSteps.some((step) => step.reason.includes("realisierbarer Gewinn"))).toBe(true);
  });

  it("sells enough safe players to clear negative team cash without dropping below the player minimum", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "D-E",
          teamCode: "D-E",
          teamName: "Debt Engines",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: -30,
          salary: 44,
          salaryTotal: 44,
          rosterSize: 8,
          rosterCount: 8,
          targetRosterMin: 3,
          targetRosterOpt: 6,
          marketValueTotal: 160,
          needSummary: "Cash negativ.",
          budgetStatus: "critical",
          rosterStatus: "over_opt",
          topTargets: [],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: [],
          explanation: "Cash recovery before any buy.",
        },
      ],
    });

    const makeSell = (index: number, value: number) => ({
      activePlayerId: `ap-debt-${index}`,
      playerId: `p-debt-${index}`,
      playerName: `Debt Relief ${index}`,
      className: "Runner",
      race: "Human",
      raceName: "Human",
      ovr: 52,
      mvs: 8,
      salary: 3,
      marketValue: value,
      expectedSellValue: value,
      contractLength: 1,
      rosterAfter: 8 - index,
      salaryAfter: 44 - index * 3,
      cashAfter: -30 + value,
      sportValueSummary: "Cash relief",
      performanceSummary: "Cash relief",
      strategyFitSummary: "Cash relief.",
      reasonToSell: ["negatives Teamcash zum Seasonstart"],
      reasonToKeep: [],
      reasonsToSell: ["negatives Teamcash zum Seasonstart"],
      reasonsToKeep: [],
      warnings: [],
      sellPriority: 40 + index,
      sellPriorityScore: 40 + index,
    });

    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "D-E",
          teamCode: "D-E",
          teamName: "Debt Engines",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Cash recovery before any buy.",
          cash: -30,
          rosterCount: 8,
          salaryTotal: 44,
          marketValueTotal: 160,
          rosterSize: 8,
          playerMin: 3,
          playerOpt: 6,
          targetRosterMin: 3,
          targetRosterOpt: 6,
          budgetPressure: "critical",
          sellCandidates: [makeSell(1, 8), makeSell(2, 9), makeSell(3, 10), makeSell(4, 12)],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Cash recovery before any buy.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
    });

    expect(result.teams[0].status).toBe("sell_only");
    expect(result.teams[0].sellPlan.candidates.map((candidate) => candidate.playerName)).toEqual([
      "Debt Relief 4",
      "Debt Relief 3",
      "Debt Relief 2",
      "Debt Relief 1",
    ]);
    expect(result.teams[0].projectedState.cashAfterPlan).toBe(9);
    expect(result.teams[0].projectedState.rosterAfterPlan).toBe(4);
    expect(result.teams[0].blockingReasons).not.toContain("cash_after_market_plan_not_positive");
  });

  it("blocks a market plan when safe sells cannot clear negative team cash", async () => {
    buildAiTransfermarktPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "S-H",
          teamCode: "S-H",
          teamName: "Short Hands",
          controlMode: "ai",
          aiTransferPreviewEnabled: true,
          status: "ready",
          cash: -30,
          salary: 24,
          salaryTotal: 24,
          rosterSize: 4,
          rosterCount: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          marketValueTotal: 90,
          needSummary: "Cash negativ.",
          budgetStatus: "critical",
          rosterStatus: "at_opt",
          topTargets: [],
          recommendedBuys: [],
          skippedTargets: [],
          warnings: [],
          explanation: "Cash recovery before any buy.",
        },
      ],
    });
    buildAiTransfermarktSellPreview.mockResolvedValue({
      readOnly: true,
      source: "sqlite",
      scope: { saveId: "save-local", seasonId: "season-2", teamId: null, teamScope: "ai" },
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
          teamId: "S-H",
          teamCode: "S-H",
          teamName: "Short Hands",
          controlMode: "ai",
          aiSellPreviewEnabled: true,
          status: "ready",
          strategySummary: "Cash recovery before any buy.",
          cash: -30,
          rosterCount: 4,
          salaryTotal: 24,
          marketValueTotal: 90,
          rosterSize: 4,
          playerMin: 3,
          playerOpt: 4,
          targetRosterMin: 3,
          targetRosterOpt: 4,
          budgetPressure: "critical",
          sellCandidates: [
            {
              activePlayerId: "ap-short-1",
              playerId: "p-short-1",
              playerName: "Only Exit",
              className: "Runner",
              race: "Human",
              raceName: "Human",
              ovr: 50,
              mvs: 7,
              salary: 3,
              marketValue: 10,
              expectedSellValue: 10,
              contractLength: 1,
              rosterAfter: 3,
              salaryAfter: 21,
              cashAfter: -20,
              sportValueSummary: "Cash relief",
              performanceSummary: "Cash relief",
              strategyFitSummary: "Cash relief.",
              reasonToSell: ["negatives Teamcash zum Seasonstart"],
              reasonToKeep: [],
              reasonsToSell: ["negatives Teamcash zum Seasonstart"],
              reasonsToKeep: [],
              warnings: [],
              sellPriority: 42,
              sellPriorityScore: 42,
            },
          ],
          keepCore: [],
          warnings: [],
          blockingReasons: [],
          explanation: "Cash recovery before any buy.",
        },
      ],
    });

    const { buildAiMarketPlanPreview } = await import("@/lib/ai/ai-market-plan-preview-service");
    const result = await buildAiMarketPlanPreview({
      source: "sqlite",
      saveId: "save-local",
      seasonId: "season-2",
    });

    expect(result.teams[0].status).toBe("blocked");
    expect(result.teams[0].projectedState.cashAfterPlan).toBe(-20);
    expect(result.teams[0].blockingReasons).toContain("negative_cash_unresolved_after_safe_sells");
    expect(result.teams[0].blockingReasons).toContain("cash_after_market_plan_not_positive");
    expect(result.summary.blocked).toBe(1);
  });
});
