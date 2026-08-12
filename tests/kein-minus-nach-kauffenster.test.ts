/**
 * CHRIS' REGEL, in zwei Teilen:
 *
 *   „d-p darf negativ in die neue Saison gehen das ist ok! Nur nach dem kaufen und kredite
 *   aufnehmen darf es nicht mehr negativ sein."
 *
 *   „die snapshots für Cash und Marktwert sollen ja auch erst am anfang der Saison nach den
 *   Käufen stattfinden für die ewige Tabelle / Finanzen."
 *
 * BEFUND ZU TEIL 1: der regulaere Kredit-Pass darf ein Minus stehen lassen — er prueft Kapazitaet
 * und Tragfaehigkeit, und beides kann nein sagen. Danach hat das Team keinen Weg mehr, denn
 * verkauft wird erst am naechsten Saisonende (#445). `applyInsolvencyBackstop` ist genau dafuer
 * gebaut (`emergency: true` umgeht Kapazitaet, Distress-Gate und S1-Sperre) und lief bisher nur bei
 * der Saison-Abrechnung, nicht am Ende des Kauffensters.
 *
 * BEFUND ZU TEIL 2: `patchCompletedSeasonSnapshotAfterPreseasonBuy` existiert seit Langem und tut
 * genau das Verlangte — im Spiel rief es aber NIEMAND auf. Die einzigen Aufrufer waren
 * `scripts/long-run-sandbox-s1-s6.ts:3514` und die Tests.
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
const patchCompletedSeasonSnapshotAfterPreseasonBuy = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({ applyAiMarketPlanLocally }));
vi.mock("@/lib/ai/ai-manager-apply-service", () => ({ applyAiManagerPlan }));
vi.mock("@/lib/ai/ai-injury-depth-topup-service", () => ({ applyAiInjuryDepthTopup }));
vi.mock("@/lib/ai/ai-picks-run-service", () => ({ runAiPicksExecutePreview }));
vi.mock("@/lib/ai/auto-roster-fill-service", () => ({ runAutoRosterFillForMatchdaySetup }));
vi.mock("@/lib/ai/ai-loan-decision-service", () => ({ resolveAiLoanDecision }));
vi.mock("@/lib/finance/loan-service", () => ({ buildLoanOffers, originateLoan, applyInsolvencyBackstop }));
vi.mock("@/lib/season/season-snapshot-service", () => ({ patchCompletedSeasonSnapshotAfterPreseasonBuy }));

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
      store.gameState = gameState;
      return { saveId, gameState, status: "active" };
    },
  }),
}));

function baueGameState(gamePhase: GameState["gamePhase"], cash = -4.2): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: { "D-P": { teamId: "D-P", controlMode: "ai" } },
      teamStrategyProfiles: {},
      matchdayResults: [],
      loans: [],
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    gamePhase,
    teams: [makeTeam({ teamId: "D-P", cash })],
    teamIdentities: [makeTeamIdentity({ teamId: "D-P", playerMin: 1, playerOpt: 2 })],
    players: [],
    disciplines: [],
    rosters: [makeRosterEntry({ id: "r-1", teamId: "D-P", playerId: "p-1" })],
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

async function laufen() {
  const { POST } = await import("@/app/api/ai/preseason-background/route");
  return (await (await POST(baueRequest())).json()) as { run: Lauf; skipped: boolean };
}

describe("Kauffenster: am Ende steht kein Team mehr im Minus", () => {
  beforeEach(() => {
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
      patchCompletedSeasonSnapshotAfterPreseasonBuy,
    ]) {
      spion.mockReset();
    }
    applyAiManagerPlan.mockReturnValue({ actions: [], warnings: [], blockers: [] });
    applyAiInjuryDepthTopup.mockReturnValue({ playersBoughtTotal: 0, warnings: [] });
    applyAiMarketPlanLocally.mockResolvedValue({
      status: "ok",
      results: [{ teamId: "D-P", result: "applied" }],
      summary: { appliedBuys: 0, appliedSells: 0 },
      warnings: [],
      blockingReasons: [],
    });
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({ summary: { appliedBuys: 0 }, teams: [] });
    // Die Bank sagt nein — genau der Fall, in dem der regulaere Kredit das Minus stehen laesst.
    resolveAiLoanDecision.mockReturnValue({
      shouldBorrow: false,
      loanAmount: 0,
      termSeasons: 0,
      reason: "liquidity_debt_service_ceiling",
    });
    buildLoanOffers.mockReturnValue([{ lenderType: "bank", lenderTeamId: null }]);
    originateLoan.mockImplementation((gameState: GameState) => ({
      ok: true,
      loan: null,
      reason: null,
      capacity: 0,
      terms: null,
      gameState,
    }));
    applyInsolvencyBackstop.mockImplementation(({ gameState }: { gameState: GameState }) => ({
      gameState: {
        ...gameState,
        teams: gameState.teams.map((team) => ({ ...team, cash: Math.max(0, team.cash ?? 0) })),
      },
      emergencyLoans: [{ teamId: "D-P", principal: 4.2 }],
      warnings: [],
    }));
    patchCompletedSeasonSnapshotAfterPreseasonBuy.mockImplementation((gameState: GameState) => ({
      gameState,
      patched: true,
      completedSeasonId: "season-1",
      warnings: [],
    }));
  });

  it("gleicht ein verbliebenes Minus mit einem Notkredit aus", async () => {
    store.gameState = baueGameState("season_active", -4.2);

    const payload = await laufen();

    expect(applyInsolvencyBackstop).toHaveBeenCalledTimes(1);
    expect(payload.run.warnings).toContain("ai_notkredit:D-P:4.2");
    // Und der ausgeglichene Stand landet wirklich im Spielstand.
    expect(store.gameState!.teams.find((team) => team.teamId === "D-P")!.cash).toBe(0);
  });

  it("laeuft NACH Markt und Verletzungs-Topup — und der Fuell-Lauf ist raus", async () => {
    store.gameState = baueGameState("season_active", -4.2);

    await laufen();

    // Vorher waere der Kontostand noch gar nicht der, mit dem das Team in die Saison geht —
    // jeder spaetere Kauf koennte ihn wieder ins Minus ziehen.
    expect(applyInsolvencyBackstop.mock.invocationCallOrder[0]!).toBeGreaterThan(
      applyAiMarketPlanLocally.mock.invocationCallOrder[0]!,
    );
    expect(applyInsolvencyBackstop.mock.invocationCallOrder[0]!).toBeGreaterThan(
      applyAiInjuryDepthTopup.mock.invocationCallOrder[0]!,
    );
    /*
     * NACHGEZOGEN: die alte Fassung verankerte die Reihenfolge zusaetzlich am FUELL-LAUF
     * (`runAutoRosterFillForMatchdaySetup`). Diese Aussage gilt NACHWEISLICH nicht mehr — der
     * Lauf ist per Eigentuemer-Entscheid aus dem Kauffenster entfernt (Commit 6a685998, Chris:
     * „Du sollst auf den Organic Lauf umschalten und der soll picken" / „keine filler mehr!
     * VERBOT"); die Sperre sitzt seither im Dienst selbst (nur noch season-1). Der Mock wurde
     * darum nie aufgerufen, `invocationCallOrder[0]` war `undefined` und der Vergleich fiel mit
     * „expected value must be number" — kein Befund am Produkt, ein liegengebliebener Test.
     *
     * Statt die Zeile ersatzlos zu streichen wird sie umgedreht: der Fuell-Lauf DARF hier nicht
     * mehr vorkommen. Das ist die schaerfere Zusicherung — sie meldet auch die Rueckkehr.
     */
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("laesst ein Team im Plus unangetastet", async () => {
    applyInsolvencyBackstop.mockImplementation(({ gameState }: { gameState: GameState }) => ({
      gameState,
      emergencyLoans: [],
      warnings: [],
    }));
    store.gameState = baueGameState("season_active", 40);

    const payload = await laufen();

    // Der Ausgleich wird gefragt, findet aber nichts — und schreibt entsprechend keine Notiz.
    expect(payload.run.warnings.some((w) => w.startsWith("ai_notkredit:"))).toBe(false);
  });

  it("greift am Saisonende gar nicht — dort DARF das Minus stehen bleiben", async () => {
    store.gameState = baueGameState("transfer_buy_phase", -4.2);

    const payload = await laufen();

    // Chris: „d-p darf negativ in die neue Saison gehen das ist ok!"
    expect(payload.skipped).toBe(true);
    expect(applyInsolvencyBackstop).not.toHaveBeenCalled();
  });
});

describe("Kauffenster: der Snapshot der Vorsaison bekommt den Eintrittsstand", () => {
  beforeEach(() => {
    patchCompletedSeasonSnapshotAfterPreseasonBuy.mockClear();
  });

  it("zieht den Snapshot der abgeschlossenen Saison nach", async () => {
    store.gameState = baueGameState("season_active", 40);

    const payload = await laufen();

    expect(patchCompletedSeasonSnapshotAfterPreseasonBuy).toHaveBeenCalledTimes(1);
    expect(patchCompletedSeasonSnapshotAfterPreseasonBuy.mock.calls[0]![1]).toBe("season-2");
    expect(payload.run.warnings).toContain("snapshot_eintrittsstand_gesetzt:season-1");
  });

  it("tut das ganz am Ende — nach Kaeufen, Verletzungs-Topup und Zahlungsausgleich", async () => {
    store.gameState = baueGameState("season_active", -4.2);

    await laufen();

    // Sonst stuende im Snapshot ein Zwischenstand, nicht der, mit dem das Team wirklich startet.
    const patch = patchCompletedSeasonSnapshotAfterPreseasonBuy.mock.invocationCallOrder[0]!;
    expect(patch).toBeGreaterThan(applyAiMarketPlanLocally.mock.invocationCallOrder[0]!);
    // NACHGEZOGEN: der Fuell-Lauf war hier der dritte Anker und ist per Eigentuemer-Entscheid
    // aus dem Kauffenster raus (Commit 6a685998) — an seine Stelle tritt der letzte KAUFENDE
    // Schritt der Kette, das Verletzungs-Topup. Begruendung ausfuehrlich oben.
    expect(patch).toBeGreaterThan(applyAiInjuryDepthTopup.mock.invocationCallOrder[0]!);
    expect(patch).toBeGreaterThan(applyInsolvencyBackstop.mock.invocationCallOrder[0]!);
  });
});
