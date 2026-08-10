/**
 * GEMELDET: „schau mal die neuen spieler bei N-N sind alles so filler, wir müssen die noch mal
 * raus nehmen im save und dann auch den korrekten lauf einmal durch laufen lassen organic picking
 * sonst haben alle teams so trash picks drin!" — und, als ich den Fuell-Lauf nur begrenzen wollte:
 * „Du sollst auf den Organic Lauf umschalten und der soll picken" / „keine filler mehr! VERBOT".
 *
 * BEFUND: `scoreRosterFillCandidate` hat KEINEN Qualitaetsterm. `valueScore` belohnt ein gutes
 * Marktwert-Gehalt-Verhaeltnis, `pricePenalty` bestraft teure Spieler — ein 9-Mio-Fueller schlaegt
 * damit einen 40-Mio-Star. In Chris' Liga, Saison 2:
 *
 *     ai_preseason_market_buy (organisch)  33 Kaeufe, 1013.8 Mio,  0 unter 12 Mio
 *     ai_roster_fill (Fuell-Lauf)          74 Kaeufe,  826.9 Mio, 52 unter 12 Mio
 *
 * N-N stand mit drei ordentlichen Spielern aus dem Erst-Draft und sechs Zugaengen des Fuell-Laufs
 * da, fuenf davon unter 10 Mio — bei 98.4 Mio Cash auf dem Konto.
 *
 * Diese Datei sicherte frueher die GEGENTEILIGE Zusicherung ab: dass der Fuell-Lauf im Kauffenster
 * laeuft (#446). Seine Begruendung war, dass der Marktplan damals zu wenig kaufte — gemessen 314
 * gegen 350 Spieler. Nach den Engine-Reparaturen (Blatt-Opt als Untergrenze, Kredit gegen
 * Kaufplan, Qualitaets-Pyramide) stimmt das nicht mehr. Am selben Ausgangszustand gemessen:
 *
 *     mit Fuell-Lauf   Kader 343, unter Min 1, unter Opt 5, 109 Kaeufe, stark/mittel/schwach 49/44/16
 *     ohne Fuell-Lauf  Kader 342, unter Min 1, unter Opt 5, 108 Kaeufe, stark/mittel/schwach 49/44/15
 *
 * Ein Spieler Unterschied, ein schwacher fuer 8.4 Mio. N-N bekommt ohne den Lauf stattdessen
 * Nevara 44.7, Nachtschatten 25.7, Akali 21.5 und Titania 20.8 — und gibt sein Geld aus (98.4 -> 12.1).
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

describe("Kauffenster der neuen Saison: der organische Planer pickt, kein Fuell-Lauf", () => {
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
  });

  it("ruft den Fuell-Lauf NICHT mehr auf", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(baueRequest());
    expect(response.status).toBe(200);

    // Der Kern des Verbots: in der automatischen Kette darf dieser Dienst gar nicht mehr vorkommen.
    expect(runAutoRosterFillForMatchdaySetup).not.toHaveBeenCalled();
  });

  it("der Marktlauf laeuft weiterhin und zaehlt seine Kaeufe", async () => {
    store.gameState = baueGameState("season_active");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { run: Lauf };

    // 1 aus dem Marktlauf + 0 aus dem Verletzungs-Topup. Der frueher addierte Fuell-Anteil ist weg.
    expect(payload.run.transferBuysApplied).toBe(1);
    expect(payload.run.warnings.some((eintrag) => eintrag.startsWith("roster_fill_auf_optimum:"))).toBe(false);
  });

  it("laeuft NICHT, solange der Spielstand in der Saisonende-Kette steht", async () => {
    store.gameState = baueGameState("transfer_buy_phase");

    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const payload = (await (await POST(baueRequest())).json()) as { skipped: boolean };

    // Am Saisonende wird nur verkauft — daran aendert der Wegfall des Fuell-Laufs nichts.
    expect(payload.skipped).toBe(true);
  });

  it("die Preseason-Route bindet den Fuell-Dienst nicht mehr ein", () => {
    // Gegenprobe auf Quelltext-Ebene: solange der Import dasteht, kann ihn jemand versehentlich
    // wieder aufrufen, ohne dass ein Test darueber stolpert.
    const quelle = readFileSync(join(process.cwd(), "app/api/ai/preseason-background/route.ts"), "utf8");
    expect(quelle).not.toContain("runAutoRosterFillForMatchdaySetup");
  });

  it("der Fuell-Dienst selbst bleibt erhalten — Saison 1 und der Handgriff brauchen ihn", () => {
    // Abgeschaltet ist die automatische Kette, nicht das Werkzeug. Saison 1 BAUT damit die Kader
    // auf, und `app/api/ai/roster-fill` bleibt als ausdruecklicher Aufruf bestehen.
    const dienst = readFileSync(join(process.cwd(), "lib/ai/auto-roster-fill-service.ts"), "utf8");
    expect(dienst).toContain("export async function runAutoRosterFillForMatchdaySetup");
    const route = readFileSync(join(process.cwd(), "app/api/ai/roster-fill/route.ts"), "utf8");
    expect(route).toContain("runAutoRosterFillForMatchdaySetup");
  });
});
