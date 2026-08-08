/**
 * CHRIS' REGEL: „wir verkaufen als separaten schritt zum ende der saison und gekauft wird erst
 * in der folgesaison" — angewendet auf den Preseason-Hintergrundlauf, den einzigen
 * automatischen S2+-Marktausloeser des Spiels.
 *
 *   1. Solange der Spielstand in der Saisonende-Kette steht, wird der Season-Market-Lauf
 *      VERSCHOBEN (skipped, kein Run-Record): die Verkaeufe laufen dort bereits ueber den
 *      Saisonende-Assistenten, ein zweiter Marktlauf haette mitten in der Kette geschrieben.
 *   2. Im Kauffenster der neuen Saison laeuft er als reiner KAUF-Lauf (applySellSteps: false) —
 *      das Fenster ist fuer den Menschen aus demselben Grund kauf-only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const applyAiMarketPlanLocally = vi.fn();
const applyAiManagerPlan = vi.fn();
const applyAiInjuryDepthTopup = vi.fn();
const runAiPicksExecutePreview = vi.fn();
const runAutoRosterFillForMatchdaySetup = vi.fn();
const saveSingleplayerState = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({
  applyAiMarketPlanLocally,
}));

vi.mock("@/lib/ai/ai-manager-apply-service", () => ({
  applyAiManagerPlan,
}));

vi.mock("@/lib/ai/ai-injury-depth-topup-service", () => ({
  applyAiInjuryDepthTopup,
}));

vi.mock("@/lib/ai/ai-picks-run-service", () => ({
  runAiPicksExecutePreview,
}));

// Der Kader-Fuell-Lauf haengt hier nur als Nachbar mit drin; sein echter Modulbaum ist gross genug,
// dass das Laden allein den Test ueber die Zeit bringt. Was er tut, prueft
// tests/kader-auf-optimum-in-neuer-saison.test.ts.
vi.mock("@/lib/ai/auto-roster-fill-service", () => ({
  runAutoRosterFillForMatchdaySetup,
}));

// Der Kredit-Pass des Kauffensters haengt hier nur als Nachbar mit drin. Sein Modulbaum ist gross
// genug, dass das Laden allein den Test ueber die Zeit bringt; was er tut, prueft
// tests/kredite-im-kauffenster.test.ts.
vi.mock("@/lib/ai/ai-loan-decision-service", () => ({
  resolveAiLoanDecision: () => ({ shouldBorrow: false, loanAmount: 0, termSeasons: 0, reason: "test_kein_kredit" }),
}));
vi.mock("@/lib/finance/loan-service", () => ({
  buildLoanOffers: () => [],
  originateLoan: (gameState: unknown) => ({ ok: false, loan: null, reason: "test", capacity: 0, terms: null, gameState }),
  applyInsolvencyBackstop: ({ gameState }: { gameState: unknown }) => ({ gameState, emergencyLoans: [], warnings: [] }),
}));

// Der Snapshot-Patch am Ende des Laufs haengt hier nur als Nachbar mit drin; was er tut, prueft
// tests/kein-minus-nach-kauffenster.test.ts.
vi.mock("@/lib/season/season-snapshot-service", () => ({
  patchCompletedSeasonSnapshotAfterPreseasonBuy: (gameState: unknown) => ({
    gameState,
    patched: false,
    completedSeasonId: null,
    warnings: [],
  }),
}));

vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite: () => ({ allowed: true, warnings: [], room: null, participant: null, status: 200 }),
}));

vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({
  notifyRoomGameplayWrite: () => undefined,
}));

const store: { gameState: GameState | null } = { gameState: null };

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) =>
      store.gameState ? { saveId, gameState: store.gameState, status: "active" } : null,
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      saveSingleplayerState(saveId, gameState);
      store.gameState = gameState;
      return { saveId, gameState, status: "active" };
    },
  }),
}));

function baueGameState(gamePhase: GameState["gamePhase"]): GameState {
  const team = makeTeam({ teamId: "C-C", cash: 80 });
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: { "C-C": { teamId: "C-C", controlMode: "ai" } },
      teamStrategyProfiles: {},
      matchdayResults: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    gamePhase,
    teams: [team],
    teamIdentities: [makeTeamIdentity({ teamId: "C-C", playerMin: 1, playerOpt: 2 })],
    players: [],
    disciplines: [],
    rosters: [makeRosterEntry({ id: "r-1", teamId: "C-C", playerId: "p-1" })],
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
  } as unknown as GameState;
}

function baueRequest() {
  return new Request("http://localhost/api/ai/preseason-background?saveId=save-local&seasonId=season-2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("Preseason-Hintergrundlauf: Kaeufe gehoeren ins Kauffenster der neuen Saison", () => {
  beforeEach(() => {
    applyAiMarketPlanLocally.mockReset();
    applyAiManagerPlan.mockReset();
    applyAiInjuryDepthTopup.mockReset();
    runAiPicksExecutePreview.mockReset();
    runAutoRosterFillForMatchdaySetup.mockReset();
    saveSingleplayerState.mockReset();
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({ summary: { appliedBuys: 0 }, teams: [] });
    applyAiManagerPlan.mockReturnValue({ actions: [], warnings: [], blockers: [] });
    applyAiInjuryDepthTopup.mockReturnValue({ playersBoughtTotal: 0, warnings: [] });
    applyAiMarketPlanLocally.mockResolvedValue({
      status: "ok",
      results: [{ teamId: "C-C", result: "applied" }],
      summary: { appliedBuys: 1, appliedSells: 0 },
      warnings: [],
      blockingReasons: [],
    });
  });

  it("verschiebt den Season-Market-Lauf, solange der Spielstand in der Saisonende-Kette steht", async () => {
    store.gameState = baueGameState("transfer_buy_phase");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(baueRequest());
    const payload = (await response.json()) as { ok: boolean; skipped: boolean; reason?: string };

    expect(payload.ok).toBe(true);
    expect(payload.skipped).toBe(true);
    expect(payload.reason).toBe("ai_preseason_deferred_until_new_season_buy_window");
    // Kein Marktlauf, keine Manager-Aktionen, KEIN Run-Record: der Lauf ist verschoben, nicht
    // erledigt — im Kauffenster der neuen Saison muss er unter der neuen Saison-ID starten koennen.
    expect(applyAiMarketPlanLocally).not.toHaveBeenCalled();
    expect(applyAiManagerPlan).not.toHaveBeenCalled();
    expect(saveSingleplayerState).not.toHaveBeenCalled();
  });

  it("laeuft im Kauffenster der neuen Saison als reiner KAUF-Lauf (applySellSteps: false)", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(baueRequest());
    const payload = (await response.json()) as { ok: boolean; skipped: boolean };

    expect(payload.skipped).toBe(false);
    expect(payload.ok).toBe(true);
    expect(applyAiMarketPlanLocally).toHaveBeenCalledTimes(1);
    const aufruf = applyAiMarketPlanLocally.mock.calls[0]![0] as {
      options?: { applySellSteps?: boolean };
    };
    // Verkauft wurde als separater Schritt am Saisonende — der Saisonstart-Lauf kauft nur.
    expect(aufruf.options?.applySellSteps).toBe(false);
  });
});
