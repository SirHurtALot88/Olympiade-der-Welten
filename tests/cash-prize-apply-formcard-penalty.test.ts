/**
 * FORMKARTEN-STRAFE AUF DEM SPIELERWEG („Sponsoren buchen", executeCashPrizeApply).
 *
 * BEFUND (Saisonende-Prüfung, gleiche Fehlerfamilie wie #467/#468 — „zum falschen Zeitpunkt
 * gemessen"): Die Formkarten-Übernutzungs-Strafe (Punktabzug + Re-Rank, Audit R2/V4) lief NUR im
 * Cockpit-Saisonabschluss (`season-completion-service`). Der Weg, den das Saisonende-Panel im
 * normalen Spielverlauf benutzt — `executeCashPrizeApply` mit `phase: "season_end"` — kannte sie
 * nicht: Sponsor- und Apron-Abrechnung sowie der später eingefrorene Season-Snapshot rechneten
 * auf der UNbestraften Endtabelle. Der Rückfall im Preseason-Workflow zieht erst bei
 * `next_season_setup` nur Punkte ab (kein Re-Rank) und liegt hinter allen Payouts — wirkungslos.
 *
 * Diese Tests halten fest: die Strafe läuft jetzt auch auf dem Spielerweg, VOR der Abrechnung,
 * und bleibt idempotent gegenüber dem Cockpit-Weg.
 *
 * Abrechnung und Preisgeld-Vorschau sind GEMOCKT (dasselbe Muster wie
 * tests/cash-prize-apply-books-sponsor-cash.test.ts) — geprüft wird die Verdrahtung und die
 * Reihenfolge, nicht die Sponsor-Arithmetik.
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

function createPersistenceMock(input?: { penaltyAlreadyApplied?: boolean }) {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    gameState: {
      season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 10, matchdayIds: ["matchday-10"] },
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        // W-W führt mit 22 Punkten — aber mit einer UNBENUTZTEN negativen Formkarte (−8 ⇒ 4
        // Strafpunkte ⇒ 18 Punkte). Nach der Strafe muss P-S (19 Punkte) auf Rang 1 stehen.
        standings: { "W-W": { points: 22, rank: 1 }, "P-S": { points: 19, rank: 2 } },
        formCards: [{ id: "card-1", seasonId: "season-1", teamId: "W-W", cardValue: -8 } as never],
        ...(input?.penaltyAlreadyApplied ? { formCardPenaltyAppliedSeasonIds: ["season-1"] } : {}),
        matchdayResults: [{ id: "result-1" } as never],
        cashPrizeApplyLogs: [],
      },
      matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
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

function mockHealthyPreview() {
  const item = (teamId: string, rank: number) => ({
    teamId,
    teamCode: teamId,
    teamName: teamId,
    rank,
    points: 20,
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
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHealthyPreview();
  applySponsorSettlement.mockImplementation(({ gameState }: { gameState: GameState }) => ({
    applied: true,
    preview: { rows: [], canApply: true, blockingReasons: [], totalCashDelta: 0 },
    gameState,
  }));
});

describe("Formkarten-Strafe läuft auch auf dem Spielerweg (executeCashPrizeApply, season_end)", () => {
  it("zieht Strafpunkte ab und re-rankt die Endtabelle, BEVOR die Abrechnung bucht", async () => {
    const { save, persistence } = createPersistenceMock();
    const result = await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    expect(result.applied).toBe(true);

    const standings = save.gameState.seasonState.standings!;
    // Strafe: 22 − round(8 × 0,5) = 18 → P-S (19) übernimmt Rang 1.
    expect(standings["W-W"].points).toBe(18);
    expect(standings["W-W"].rank).toBe(2);
    expect(standings["P-S"].rank).toBe(1);
    expect(save.gameState.seasonState.formCardPenaltyAppliedSeasonIds).toContain("season-1");

    // REIHENFOLGE: die Abrechnung (Sponsor → Apron → …) hat die BESTRAFTE Tabelle gesehen.
    expect(applySponsorSettlement).toHaveBeenCalledTimes(1);
    const settlementInput = applySponsorSettlement.mock.calls[0]?.[0] as { gameState: GameState };
    expect(settlementInput.gameState.seasonState.standings?.["P-S"]?.rank).toBe(1);
    expect(settlementInput.gameState.seasonState.standings?.["W-W"]?.rank).toBe(2);
  });

  it("straft NICHT doppelt, wenn der Cockpit-Saisonabschluss die Strafe schon angewandt hat", async () => {
    const { save, persistence } = createPersistenceMock({ penaltyAlreadyApplied: true });
    const result = await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    expect(result.applied).toBe(true);
    const standings = save.gameState.seasonState.standings!;
    expect(standings["W-W"].points).toBe(22);
    expect(standings["W-W"].rank).toBe(1);
  });
});
