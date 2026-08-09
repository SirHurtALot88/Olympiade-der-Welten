/**
 * DER SAISON-RIEGEL der Saisonende-Buchung (`executeCashPrizeApply`).
 *
 * BEFUND (Saisonende-Prüfung am Live-Abbild, nachgestellt): Alle Idempotenz-Wachen des Schritts
 * prüfen `params.seasonId`, die Buchung selbst läuft aber immer auf `gameState.season.id` — der
 * aktuellen Saison. Ein Aufruf mit der Saison-ID der VORSAISON, nach dem Saisonwechsel abgeschickt
 * (veralteter Tab, Doppelklick im Rennen mit „Neue Saison starten"), rutschte an jeder Wache vorbei
 * (das alte Audit-Log trägt einen anderen `matchdayId`) und buchte die komplette
 * Saisonende-Abrechnung der NEUEN Saison an deren Spieltag 1 — gemessen am Testabbild: −299,5 netto
 * an Spieltag 1 von Season 3, ausgelöst durch einen „season-2"-Aufruf. Die Team-Idempotenz der
 * Sponsor-Abrechnung hätte danach am echten Saisonende der neuen Saison alle Zahlungen
 * übersprungen.
 *
 * Abrechnung und Vorschau sind GEMOCKT (Muster wie tests/cash-prize-apply-books-sponsor-cash.test.ts) —
 * geprüft wird der Riegel, nicht die Arithmetik.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply } from "@/lib/season/cash-prize-apply-service";

const { buildPrizeMoneyPreview, applySponsorSettlement } = vi.hoisted(() => ({
  buildPrizeMoneyPreview: vi.fn(),
  applySponsorSettlement: vi.fn(),
}));

vi.mock("@/lib/season/prize-money-preview", () => ({ buildPrizeMoneyPreview }));
vi.mock("@/lib/sponsor/sponsor-settlement-service", () => ({
  applySponsorSettlement,
  previewSponsorSettlement: vi.fn(),
}));

function createPersistenceMock() {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    gameState: {
      // Der Spielstand ist bereits in der NEUEN Saison (Spieltag 1) …
      season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: ["s2-md-1"] },
      gamePhase: "season_active",
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: { "W-W": { points: 0, rank: 1 }, "P-S": { points: 0, rank: 2 } },
        matchdayResults: [],
        cashPrizeApplyLogs: [
          // … und trägt das Audit-Log der Vorsaison, das wegen des anderen matchdayId
          // NICHT als Duplikat erkannt wird — genau die gemessene Lücke.
          {
            id: "cash-prize-apply-audit__save-local__season-1__s1-md-10",
            saveId: "save-local",
            seasonId: "season-1",
            matchdayId: "s1-md-10",
            action: "apply",
            payload: { idempotencyKey: "cash-prize-apply:save-local:season-1:s1-md-10" },
            createdAt: "2026-08-08T00:00:00.000Z",
          } as never,
        ],
        sponsorPayoutLogs: [
          { id: "p1", saveId: "save-local", seasonId: "season-1", teamId: "W-W", phase: "season_end", componentId: "base", cashDelta: 10, action: "apply", createdAt: "2026-08-08T00:00:00.000Z" } as never,
        ],
      },
      matchdayState: { matchdayId: "s2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 100, cash: 40, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "P-S", shortCode: "P-S", name: "Project Suicide", budget: 100, cash: 50, identityId: "b", humanControlled: true, rosterLimit: 12 },
      ],
      teamIdentities: [],
      players: [],
      disciplines: [],
      rosters: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
    } as unknown as GameState,
  };

  const persistence = {
    bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
    getActiveSave: vi.fn(() => save),
    getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
    saveSingleplayerState: vi.fn((_saveId: string, gameState: GameState) => {
      save.gameState = gameState;
      return save;
    }),
    createSave: vi.fn(),
    createFreshSeasonOneSave: vi.fn(),
    cloneSave: vi.fn(),
    activateSave: vi.fn(),
    listSaves: vi.fn(() => []),
  };

  return { save, persistence };
}

beforeEach(() => {
  vi.clearAllMocks();
  const item = (teamId: string, rank: number) => ({
    teamId,
    teamCode: teamId,
    teamName: teamId,
    rank,
    points: 0,
    currentCash: 40,
    prizeMoney: 10,
    basisCash: 50,
    salaryTotal: 12,
    rankChangePrize: { bonusMalus: 0, startRank: rank, finalRank: rank, rankDelta: 0, source: "sheet", startRankSource: "standing_startplatz", warning: null },
    projectedCash: 50,
    status: "ready",
    warnings: [],
  });
  buildPrizeMoneyPreview.mockResolvedValue({
    items: [item("W-W", 1), item("P-S", 2)],
    blockedRules: [],
    globalWarnings: [],
    scope: { saveId: "save-local", seasonId: "season-1" },
  });
  applySponsorSettlement.mockImplementation(({ gameState }: { gameState: GameState }) => ({
    applied: true,
    preview: { rows: [], canApply: true, blockingReasons: [], totalCashDelta: 0 },
    gameState,
  }));
});

describe("Saison-Riegel: eine Saisonende-Buchung für eine andere als die aktuelle Saison wird blockiert", () => {
  it("blockiert den veralteten season-1-Aufruf, statt die laufende season-2 abzurechnen", async () => {
    const { save, persistence } = createPersistenceMock();
    const cashBefore = save.gameState.teams.map((team) => team.cash);

    const result = await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );

    expect(result.applied).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.blockingReasons.some((reason) => reason.startsWith("stale_season_scope:"))).toBe(true);
    // Keine Abrechnung, kein Schreiben — der Spielstand bleibt unangetastet.
    expect(applySponsorSettlement).not.toHaveBeenCalled();
    expect(persistence.saveSingleplayerState).not.toHaveBeenCalled();
    expect(save.gameState.teams.map((team) => team.cash)).toEqual(cashBefore);
  });

  it("lässt die Buchung für die AKTUELLE Saison weiterhin durch", async () => {
    const { persistence } = createPersistenceMock();
    const result = await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-2", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    expect(result.blockingReasons.some((reason) => reason.startsWith("stale_season_scope:"))).toBe(false);
    expect(result.applied).toBe(true);
    expect(applySponsorSettlement).toHaveBeenCalledTimes(1);
  });
});
