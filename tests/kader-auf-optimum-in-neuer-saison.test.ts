/**
 * GEMELDET: „passt nicht sind immernoch 6 teams unter 8 und man soll sich ja eher an opt
 * orientieren", danach „wenn c-c gerne 13 leute hätte wären 11 auch noch ok aber auf minimum zu
 * gehen ist scheiße! … schau dass kein team was das geld hat nur auf minimum geht!!!" und
 * schliesslich die Frage, die den Fix vorgibt: „wieso ist die Logik nicht wie beim kaufen in
 * season 1? da haben wir doch auch teils teams die 10 oder 12 spieler haben?"
 *
 * BEFUND: es gibt ZWEI Werkzeuge, und in der Folgesaison lief das falsche.
 *
 *   - `auto-roster-fill-service` BAUT Kader auf. Er zielt auf `teamIdentity.playerOpt`
 *     (`resolveTargetRoster`, dort Zeile 205-209), macht erst einen Minimum- und danach einen
 *     Optimum-Durchgang. Kein Saison-Gate — er wurde in Saison 2+ schlicht nie aufgerufen.
 *   - `applyAiMarketPlanLocally` PFLEGT Kader. Seine Schrittzahl kommt aus
 *     `resolveUnifiedMarketPickSteps` und ist am Bedarf bis zum MINIMUM aufgehaengt.
 *
 * Seit die Verkaeufe ans Saisonende gewandert sind (#445), stehen die Teams beim Saisonstart bei
 * 3 bis 7 Spielern. Fuer einen leergeraeumten Kader ist Pflege das falsche Werkzeug — genau das
 * war der Grund, warum Teams auf dem Minimum haengen blieben.
 *
 * Am Klon von Chris' Spielstand gemessen, jeweils ab demselben Zustand nach dem Saisonwechsel
 * (Kader 234, kleinster 3, 20 Teams unter Minimum, 30 unter Optimum):
 *
 *   nur Marktplan, VIER Laeufe : Kader 314, kleinster 5, 6 unter Minimum, 13 unter Optimum
 *   Fuell-Dienst, EIN Lauf     : Kader 350, kleinster 8, 0 unter Minimum,  1 unter Optimum
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { makeRosterEntry, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const applyAiMarketPlanLocally = vi.fn();
const applyAiManagerPlan = vi.fn();
const applyAiInjuryDepthTopup = vi.fn();
const runAiPicksExecutePreview = vi.fn();
const runAutoRosterFillForMatchdaySetup = vi.fn();

vi.mock("@/lib/ai/ai-market-plan-apply-service", () => ({ applyAiMarketPlanLocally }));
vi.mock("@/lib/ai/ai-manager-apply-service", () => ({ applyAiManagerPlan }));
vi.mock("@/lib/ai/ai-injury-depth-topup-service", () => ({ applyAiInjuryDepthTopup }));
vi.mock("@/lib/ai/ai-picks-run-service", () => ({ runAiPicksExecutePreview }));
vi.mock("@/lib/ai/auto-roster-fill-service", () => ({ runAutoRosterFillForMatchdaySetup }));

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

type Lauf = { transferBuysApplied: number; warnings: string[] };

describe("Kauffenster der neuen Saison: der Kader wird bis zum Optimum gefuellt", () => {
  beforeEach(() => {
    applyAiMarketPlanLocally.mockReset();
    applyAiManagerPlan.mockReset();
    applyAiInjuryDepthTopup.mockReset();
    runAiPicksExecutePreview.mockReset();
    runAutoRosterFillForMatchdaySetup.mockReset();
    applyAiManagerPlan.mockReturnValue({ actions: [], warnings: [], blockers: [] });
    applyAiInjuryDepthTopup.mockReturnValue({ playersBoughtTotal: 0, warnings: [] });
    applyAiMarketPlanLocally.mockResolvedValue({
      status: "ok",
      results: [{ teamId: "C-C", result: "applied" }],
      summary: { appliedBuys: 1, appliedSells: 0 },
      warnings: [],
      blockingReasons: [],
    });
    runAutoRosterFillForMatchdaySetup.mockResolvedValue({
      summary: { appliedBuys: 4 },
      teams: [
        { teamId: "C-C", status: "filled" },
        { teamId: "D-L", status: "partially_filled" },
        { teamId: "A-A", status: "target_unreachable_cash" },
      ],
    });
  });

  it("laeuft im Kauffenster — und zwar NACH dem Marktlauf", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(baueRequest());
    expect(response.status).toBe(200);

    expect(runAutoRosterFillForMatchdaySetup).toHaveBeenCalledTimes(1);
    // Reihenfolge ist keine Geschmacksfrage: der Markt macht die strategisch begruendeten
    // Zugaenge, der Fuell-Lauf schliesst danach die verbliebene Luecke bis zum Optimum. Umgekehrt
    // wuerde der Markt auf einen bereits vollen Kader treffen und nichts mehr beitragen.
    expect(applyAiMarketPlanLocally.mock.invocationCallOrder[0]).toBeLessThan(
      runAutoRosterFillForMatchdaySetup.mock.invocationCallOrder[0]!,
    );
  });

  it("schreibt wirklich (kein Trockenlauf) und weist sich als bestaetigt aus", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    const aufruf = runAutoRosterFillForMatchdaySetup.mock.calls[0]![0] as {
      dryRun?: boolean;
      confirmToken?: string;
      saveId?: string;
      seasonId?: string;
    };
    // Ein Trockenlauf haette denselben Bericht geliefert und nichts gekauft — der Kader waere
    // weiterhin auf Minimum geblieben, nur mit beruhigender Zusammenfassung.
    expect(aufruf.dryRun).toBe(false);
    expect(aufruf.confirmToken).toBeTruthy();
    expect(aufruf.saveId).toBe("save-local");
    expect(aufruf.seasonId).toBe("season-2");
  });

  it("zaehlt die Fuell-Kaeufe im Lauf-Protokoll mit", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { run: Lauf };

    // 1 aus dem Marktlauf + 0 aus dem Verletzungs-Topup + 4 aus der Fuellung.
    expect(payload.run.transferBuysApplied).toBe(5);
    expect(payload.run.warnings).toContain("roster_fill_auf_optimum:2/3");
  });

  it("laeuft NICHT, solange der Spielstand in der Saisonende-Kette steht", async () => {
    store.gameState = baueGameState("transfer_buy_phase");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { skipped: boolean };

    // Am Saisonende wird nur verkauft. Ein Fuell-Lauf dort wuerde genau die Spieler zurueckkaufen,
    // die der Verkaufsschritt eben erst abgegeben hat.
    expect(payload.skipped).toBe(true);
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("der gerufene Dienst zielt tatsaechlich auf das Optimum, nicht auf das Minimum", () => {
    // Gegenprobe zum ganzen Fix: wuerde `auto-roster-fill-service` selbst nur bis zum Minimum
    // fuellen, waere die Verdrahtung wirkungslos — dann haetten wir denselben Zustand mit einem
    // zweiten Dienst davor.
    const quelle = readFileSync(join(process.cwd(), "lib/ai/auto-roster-fill-service.ts"), "utf8");
    expect(quelle).toContain("teamIdentity.playerOpt");
    expect(quelle).toContain("team_identity_player_opt");
  });
});

/**
 * GEMELDET: „S-C hat gekauft. das ist MEIN TEAM. Wie kann das passieren dass die AI da wieder für
 * kauft. dachte du hast das sauber repariert."
 *
 * BEFUND, am echten Spielstand: drei Zugaenge fuer S-C in Saison 2, alle mit
 * `source=ai_roster_fill` — 15.09 + 10.30 + 9.13 = 34.52 Mio. S-C steht in
 * `teamControlSettings` auf `controlMode: "manual"`.
 *
 * URSACHE: der Fuell-Dienst laeuft ohne Einschraenkung ueber ALLE Teams. Sein eigener
 * Parameter-Kommentar warnt davor (`auto-roster-fill-service.ts:129`: „that was the S6 bug for this
 * path") und bietet `callerWritableTeamIds` genau dagegen an — beim Verdrahten in #446 wurde der
 * Parameter nicht mitgegeben. Jeder andere Schritt desselben Laufs hat seine Einschraenkung.
 */
describe("Fuell-Lauf fasst manuell gefuehrte Teams nicht an", () => {
  it("bekommt die KI-Teamliste als Schreibgrenze mit", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    const aufruf = runAutoRosterFillForMatchdaySetup.mock.calls[0]![0] as {
      callerWritableTeamIds?: string[] | null;
    };
    // Ohne diese Liste kauft der Dienst fuer JEDES Team im Spielstand, auch fuer Chris' eigenes.
    expect(Array.isArray(aufruf.callerWritableTeamIds)).toBe(true);
    expect(aufruf.callerWritableTeamIds).toEqual(["C-C"]);
  });

  it("die Grenze ist dieselbe Liste, die auch Markt und Manager-Plan benutzen", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    await POST(baueRequest());

    // Eine zweite, eigene Teamliste waere genau die Sorte Doppelpflege, an der es schon einmal
    // gescheitert ist — beide muessen aus `getAiTeamIds` kommen.
    const fuell = runAutoRosterFillForMatchdaySetup.mock.calls[0]![0] as { callerWritableTeamIds?: string[] | null };
    const manager = applyAiManagerPlan.mock.calls[0]![0] as { teamIds?: string[] };
    expect(fuell.callerWritableTeamIds).toEqual(manager.teamIds);
  });
});
