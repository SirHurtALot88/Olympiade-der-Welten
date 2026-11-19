/**
 * LIGA-DRAFT LAEUFT -> KEIN KI-KAUF DANEBEN (Review #1619, Befund A1).
 *
 * Solange der Einzelschritt-Draft (Schalter `OLY_LIGA_DRAFT_MODUS=einzelschritt`) laeuft, wird nur ueber `/api/draft`
 * gekauft. Die drei anderen KI-Kaufwege fragen dieselbe zentrale Funktion `ligaDraftLaeuft`:
 *  - der Preseason-Lauf (`fuehreKiPreseasonLaufAus`) wird uebersprungen, OHNE Lauf-Datensatz (nur verschoben);
 *  - `/api/ai/picks-run` (auch „Liga-Setup erneut versuchen“ und der Auto-Finish der Shell) antwortet 409;
 *  - `/api/ai/roster-fill` antwortet 409.
 * Schalter AUS: ein liegengebliebener Draft sperrt nichts — alles wie vorher (A2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState, LigaDraftZustand } from "@/lib/data/olyDataTypes";

const runAiPicksExecutePreview = vi.fn();
const runAutoRosterFillForMatchdaySetup = vi.fn();
const applyAiManagerPlan = vi.fn();

vi.mock("@/lib/ai/ai-picks-run-service", () => ({ runAiPicksExecutePreview }));
vi.mock("@/lib/ai/auto-roster-fill-service", () => ({ runAutoRosterFillForMatchdaySetup }));
vi.mock("@/lib/ai/ai-manager-apply-service", () => ({ applyAiManagerPlan }));
vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({ applyAiMarketPlanLocally: vi.fn() }));
vi.mock("@/lib/ai/ai-injury-depth-topup-service", () => ({ applyAiInjuryDepthTopup: vi.fn() }));
vi.mock("@/lib/ai/ai-loan-decision-service", () => ({ resolveAiLoanDecision: vi.fn() }));
vi.mock("@/lib/finance/loan-service", () => ({ buildLoanOffers: () => [], originateLoan: vi.fn(), applyInsolvencyBackstop: vi.fn() }));
vi.mock("@/lib/season/season-snapshot-service", () => ({ patchCompletedSeasonSnapshotAfterPreseasonBuy: vi.fn() }));
vi.mock("@/lib/room/server-authoritative-write-guard", () => ({
  authorizeServerRoomWrite: () => ({ allowed: true, warnings: [], room: null, participant: null, status: 200 }),
}));
vi.mock("@/lib/room/room-gameplay-write-notifier", () => ({ notifyRoomGameplayWrite: () => undefined }));
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId: vi.fn(async () => "user_local") }));

const store: { gameState: GameState | null } = { gameState: null };
const geschrieben = vi.fn();
const ablage = {
  getSaveById: (saveId: string) => (store.gameState ? { saveId, gameState: store.gameState, status: "active" } : null),
  saveSingleplayerState: (saveId: string, gameState: GameState) => {
    geschrieben(saveId, gameState);
    store.gameState = gameState;
    return { saveId, gameState, status: "active" };
  },
};
vi.mock("@/lib/persistence/persistence-service", () => ({ createPersistenceService: () => ablage }));

function draft(status: LigaDraftZustand["status"]): LigaDraftZustand {
  return {
    version: 1,
    saisonId: "season-1",
    status,
    seed: "s",
    regeln: { maxRunden: 16, maxPicksJeTeam: 14, minKader: 8 },
    runde: 1,
    reihenfolge: ["A-A"],
    platz: 0,
    teams: {},
    verlauf: [],
    erstelltAm: "x",
    aktualisiertAm: "x",
    beendetAm: null,
  };
}

function stand(ligaDraft: LigaDraftZustand | undefined): GameState {
  return {
    season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["matchday-1"] },
    gamePhase: "season_active",
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      teamControlSettings: { "A-A": { teamId: "A-A", controlMode: "ai" } },
      matchdayResults: [],
      leagueSetupStatus: ligaDraft?.status === "laeuft" ? "in_progress" : "ready",
      ...(ligaDraft ? { ligaDraft } : {}),
    },
    matchdayState: { matchdayId: "matchday-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "A-A", name: "A", shortCode: "A-A", cash: 100 }],
    teamIdentities: [],
    players: [],
    disciplines: [],
    rosters: [],
    transferHistory: [],
  } as unknown as GameState;
}

const PICKS_RUN = "http://localhost/api/ai/picks-run?saveId=save-1&seasonId=season-1";
const ROSTER_FILL = "http://localhost/api/ai/roster-fill?saveId=save-1&seasonId=season-1";
const ausfuehren = (token: string) =>
  JSON.stringify({ dryRun: false, confirmToken: token, teamScope: "all", allowSetupAllTeams: true, includeManualTeams: true });

describe("Liga-Draft laeuft: kein KI-Kauf neben dem Draft (A1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  });
  afterEach(() => {
    delete process.env.OLY_LIGA_DRAFT_MODUS;
  });

  it("zentrale Frage: laufend (auch Nachzug) ja, fertig nein, Schalter aus nie", async () => {
    const { ligaDraftLaeuft, ligaDraftSperrtMarktkauf } = await import("@/lib/draft/liga-draft-modell");
    expect(ligaDraftLaeuft(stand(draft("laeuft")))).toBe(true);
    expect(ligaDraftLaeuft(stand(draft("nachzug")))).toBe(true);
    expect(ligaDraftLaeuft(stand(draft("fertig")))).toBe(false);
    expect(ligaDraftLaeuft(stand(undefined))).toBe(false);
    // Markt fuer Menschen: nur die geordnete Phase.
    expect(ligaDraftSperrtMarktkauf(stand(draft("laeuft")))).toBe(true);
    expect(ligaDraftSperrtMarktkauf(stand(draft("nachzug")))).toBe(false);
    process.env.OLY_LIGA_DRAFT_MODUS = "block"; // Schalter aus = Rueckweg Blocklauf (Standard seit 19.11.: Einzelschritt)
    expect(ligaDraftLaeuft(stand(draft("laeuft")))).toBe(false);
    expect(ligaDraftSperrtMarktkauf(stand(draft("laeuft")))).toBe(false);
  });

  it("Preseason-Lauf: uebersprungen mit `liga_draft_laeuft`, kein Lauf-Datensatz, kein Kauf", async () => {
    store.gameState = stand(draft("laeuft"));
    const { fuehreKiPreseasonLaufAus } = await import("@/lib/ai/ai-preseason-background-service");
    const ergebnis = await fuehreKiPreseasonLaufAus({
      saveId: "save-1",
      seasonId: "season-1",
      scope: { room: null, participant: null, activeOwnerId: null },
      persistence: ablage as never,
    });
    expect(ergebnis.body).toMatchObject({ ok: true, skipped: true, reason: "liga_draft_laeuft", run: null });
    expect(geschrieben).not.toHaveBeenCalled();
    expect(applyAiManagerPlan).not.toHaveBeenCalled();
    expect(runAiPicksExecutePreview).not.toHaveBeenCalled();
  }, 30_000);

  it("/api/ai/picks-run und /api/ai/roster-fill: 409 `liga_draft_laeuft`, der Dienst wird nicht gerufen", async () => {
    store.gameState = stand(draft("nachzug"));
    const { AI_PICKS_RUN_CONFIRM_TOKEN } = await import("@/lib/ai/ai-picks-run-contract");
    const { AUTO_ROSTER_FILL_CONFIRM_TOKEN } = await import("@/lib/ai/auto-roster-fill-contract");
    const picksRun = await import("@/app/api/ai/picks-run/route");
    const rosterFill = await import("@/app/api/ai/roster-fill/route");

    const a = await picksRun.POST(new Request(PICKS_RUN, { method: "POST", body: ausfuehren(AI_PICKS_RUN_CONFIRM_TOKEN) }));
    expect(a.status).toBe(409);
    expect(await a.json()).toMatchObject({ error: "liga_draft_laeuft" });
    expect(runAiPicksExecutePreview).not.toHaveBeenCalled();

    const b = await rosterFill.POST(new Request(ROSTER_FILL, { method: "POST", body: ausfuehren(AUTO_ROSTER_FILL_CONFIRM_TOKEN) }));
    expect(b.status).toBe(409);
    expect(await b.json()).toMatchObject({ error: "liga_draft_laeuft" });
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  }, 30_000);

  it("Schalter AUS: ein liegengebliebener Draft sperrt die KI-Kaufwege nicht", async () => {
    process.env.OLY_LIGA_DRAFT_MODUS = "block"; // Schalter aus = Rueckweg Blocklauf
    store.gameState = stand(draft("laeuft"));
    runAiPicksExecutePreview.mockResolvedValue({ globalExecution: { appliedPickCount: 0 } });
    const { AI_PICKS_RUN_CONFIRM_TOKEN } = await import("@/lib/ai/ai-picks-run-contract");
    const picksRun = await import("@/app/api/ai/picks-run/route");
    const antwort = await picksRun.POST(new Request(PICKS_RUN, { method: "POST", body: ausfuehren(AI_PICKS_RUN_CONFIRM_TOKEN) }));
    expect(antwort.status).toBe(200);
    expect(runAiPicksExecutePreview).toHaveBeenCalledTimes(1);
  }, 30_000);
});
