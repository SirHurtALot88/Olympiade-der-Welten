/**
 * GEMELDET: „Kredite sollen verfügbar sein und ich will sehen ob die genutzt werden. Gerade auch
 * bei teams wie D-P die mit negativem Cash rein gehen. … Wenn kein team sich dafür interessiert
 * wäre das auch falsch."
 *
 * BEFUND, am Klon von Chris' Spielstand gemessen: `resolveAiLoanDecision` qualifiziert sehr wohl
 * Teams — im Kauffenster der neuen Saison zwei (M-M 38.3 Mio, V-D 27.6 Mio). Im Spielstand stand
 * `seasonState.loans` trotzdem auf LEER, ueber die gesamte Historie kein einziger KI-Kredit.
 *
 * URSACHE, mit Zeile: der einzige KI-Kredit-Aufruf sitzt in
 * `lib/ai/ai-transfer-window-session-service.ts:704` hinter `isPreseasonBuyPhase && allowBuys`.
 * Der einzige Aufrufer dieser Sitzung im Spiel ist `lib/season/season-transition-service.ts` — und
 * der ruft sie mit `phase: "season_end"` und `allowBuys: false`. `phase: "preseason"` benutzen nur
 * noch Skripte (`scripts/long-run-sandbox-s1-s6.ts` und Geschwister). Der Hook war im laufenden
 * Spiel unerreichbar; das Kauffenster selbst laeuft ueber `applyAiMarketPlanLocally` und den
 * Fuell-Dienst, die beide nichts von Krediten wissen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const applyAiMarketPlanLocally = vi.fn();
const applyAiManagerPlan = vi.fn();
const applyAiInjuryDepthTopup = vi.fn();
const runAiPicksExecutePreview = vi.fn();
const runAutoRosterFillForMatchdaySetup = vi.fn();
const resolveAiLoanDecision = vi.fn();
const buildLoanOffers = vi.fn();
const originateLoan = vi.fn();
const applyInsolvencyBackstop = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({ applyAiMarketPlanLocally }));
vi.mock("@/lib/ai/ai-manager-apply-service", () => ({ applyAiManagerPlan }));
vi.mock("@/lib/ai/ai-injury-depth-topup-service", () => ({ applyAiInjuryDepthTopup }));
vi.mock("@/lib/ai/ai-picks-run-service", () => ({ runAiPicksExecutePreview }));
vi.mock("@/lib/ai/auto-roster-fill-service", () => ({ runAutoRosterFillForMatchdaySetup }));
vi.mock("@/lib/ai/ai-loan-decision-service", () => ({ resolveAiLoanDecision }));
vi.mock("@/lib/finance/loan-service", () => ({ buildLoanOffers, originateLoan, applyInsolvencyBackstop }));

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
const gespeichert: string[] = [];

vi.mock("@/lib/persistence/persistence-service", () => ({
  createPersistenceService: () => ({
    getSaveById: (saveId: string) =>
      store.gameState ? { saveId, gameState: store.gameState, status: "active" } : null,
    saveSingleplayerState: (saveId: string, gameState: GameState) => {
      gespeichert.push(saveId);
      store.gameState = gameState;
      return { saveId, gameState, status: "active" };
    },
  }),
}));

function baueGameState(gamePhase: GameState["gamePhase"]): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: { "C-C": { teamId: "C-C", controlMode: "ai" } },
      teamStrategyProfiles: {},
      matchdayResults: [],
      loans: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    gamePhase,
    teams: [makeTeam({ teamId: "C-C", cash: -4.2 })],
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

type Lauf = { warnings: string[] };

describe("Kauffenster der neuen Saison: die KI nimmt Kredite auf", () => {
  beforeEach(() => {
    gespeichert.length = 0;
    for (const spion of [
      applyAiMarketPlanLocally,
      applyAiManagerPlan,
      applyAiInjuryDepthTopup,
      runAiPicksExecutePreview,
      runAutoRosterFillForMatchdaySetup,
      resolveAiLoanDecision,
      buildLoanOffers,
      originateLoan,
      applyInsolvencyBackstop,
    ]) {
      spion.mockReset();
    }
    applyAiManagerPlan.mockReturnValue({ actions: [], warnings: [], blockers: [] });
    applyAiInjuryDepthTopup.mockReturnValue({ playersBoughtTotal: 0, warnings: [] });
    applyAiMarketPlanLocally.mockResolvedValue({
      status: "ok",
      results: [{ teamId: "C-C", result: "applied" }],
      summary: { appliedBuys: 1, appliedSells: 0 },
      warnings: [],
      blockingReasons: [],
    });
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({ summary: { appliedBuys: 0 }, teams: [] });
    resolveAiLoanDecision.mockReturnValue({
      shouldBorrow: true,
      loanAmount: 12.5,
      termSeasons: 3,
      reason: "liquidity_negative_cash",
    });
    applyInsolvencyBackstop.mockImplementation(({ gameState }: { gameState: GameState }) => ({
      gameState,
      emergencyLoans: [],
      warnings: [],
    }));
    buildLoanOffers.mockReturnValue([{ lenderType: "bank", lenderTeamId: null }]);
    originateLoan.mockImplementation((gameState: GameState) => ({
      ok: true,
      loan: { loanId: "loan-1" },
      reason: null,
      capacity: 100,
      terms: null,
      gameState,
    }));
  });

  it("nimmt im Kauffenster ueberhaupt einen Kredit auf", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(baueRequest());
    expect(response.status).toBe(200);

    expect(resolveAiLoanDecision).toHaveBeenCalled();
    // `execute: true` ist der Unterschied zwischen einer Vorschau und echtem Geld auf dem Konto.
    expect(originateLoan.mock.calls[0]![2]).toMatchObject({ execute: true });
  });

  it("fragt ZWEIMAL — vor dem Markt und noch einmal danach", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    /**
     * Vor dem Markt liest sich fast jedes Team als `cash_sufficient` — das Geld ist ja noch da.
     * Erst nach dem Markt steht fest, wer sich leergekauft hat und trotzdem unter seinem Ziel
     * steht. Am Klon gemessen: nur Pass 1 = 2 Kredite und 3 Teams unter Optimum, mit Pass 2 =
     * 8 Kredite und 2 Teams unter Optimum.
     */
    expect(originateLoan).toHaveBeenCalledTimes(2);
    const markt = applyAiMarketPlanLocally.mock.invocationCallOrder[0]!;
    /*
     * NACHGEZOGEN: Anker war frueher der FUELL-LAUF. Diese Aussage gilt NACHWEISLICH nicht mehr —
     * er ist per Eigentuemer-Entscheid aus dem Kauffenster entfernt (Commit 6a685998, „keine
     * filler mehr! VERBOT"), der Mock lief nie und der Vergleich fiel mit „expected value must be
     * number, received undefined". Der letzte KAUFENDE Schritt der Kette ist jetzt das
     * Verletzungs-Topup; genau dort muss das geliehene Geld noch wirken koennen.
     */
    const letzterKauf = applyAiInjuryDepthTopup.mock.invocationCallOrder[0]!;
    // Erster Kredit vor dem Markt — sonst waere das geliehene Geld beim Kaufen nicht da.
    expect(originateLoan.mock.invocationCallOrder[0]!).toBeLessThan(markt);
    // Zweiter zwischen Markt und letztem Kauf — danach kaeme das Geld zu spaet und waere reine Zinslast.
    expect(originateLoan.mock.invocationCallOrder[1]!).toBeGreaterThan(markt);
    expect(originateLoan.mock.invocationCallOrder[1]!).toBeLessThan(letzterKauf);
    // Und der Fuell-Lauf gehoert nicht mehr in diese Kette — meldet auch seine Rueckkehr.
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("schreibt den Kredit in den Spielstand, nicht nur ins Protokoll", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    // Ohne diesen Speicherschritt saehe der anschliessende Marktlauf das geliehene Geld nie.
    expect(gespeichert).toContain("save-local");
  });

  it("macht den Kredit im Lauf-Protokoll sichtbar — mit Betrag, Laufzeit und Grund", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { run: Lauf };

    // Chris: „ich will sehen ob die genutzt werden."
    expect(payload.run.warnings).toContain("ai_loan_borrow:C-C:12.5:3s:liquidity_negative_cash");
  });

  it("haelt eine Ablehnung der Bank fest, statt sie zu verschlucken", async () => {
    originateLoan.mockImplementation((gameState: GameState) => ({
      ok: false,
      loan: null,
      reason: "capacity_exceeded",
      capacity: 0,
      terms: null,
      gameState,
    }));
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { run: Lauf };

    expect(payload.run.warnings).toContain("ai_loan_abgelehnt:C-C:capacity_exceeded");
    expect(payload.run.warnings.some((w) => w.startsWith("ai_loan_borrow:"))).toBe(false);

    // Und er darf nichts in den Spielstand schreiben. Der Lauf speichert an mehreren Stellen
    // (Lauf-Protokoll, Manager-Plan), deshalb zaehlt hier die DIFFERENZ zum geglueckten Kredit:
    // genau die zwei Schreibvorgaenge der beiden Kredit-Durchgaenge weniger.
    const nachAblehnung = gespeichert.length;
    gespeichert.length = 0;
    originateLoan.mockImplementation((gameState: GameState) => ({
      ok: true,
      loan: { loanId: "loan-1" },
      reason: null,
      capacity: 100,
      terms: null,
      gameState,
    }));
    store.gameState = baueGameState("season_active");
    await POST(baueRequest());
    expect(gespeichert.length).toBe(nachAblehnung + 2);
  });

  it("leiht nicht, wenn die Entscheidung nein sagt", async () => {
    resolveAiLoanDecision.mockReturnValue({
      shouldBorrow: false,
      loanAmount: 0,
      termSeasons: 0,
      reason: "cash_sufficient",
    });
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    expect(originateLoan).not.toHaveBeenCalled();
  });

  it("leiht NICHT am Saisonende — dort wird verkauft, nicht gekauft", async () => {
    store.gameState = baueGameState("transfer_buy_phase");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { skipped: boolean };

    // Ein Kredit ohne anschliessende Kaufmoeglichkeit waere reine Zinslast.
    expect(payload.skipped).toBe(true);
    expect(originateLoan).not.toHaveBeenCalled();
  });
});
