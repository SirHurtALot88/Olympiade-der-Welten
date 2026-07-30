/**
 * GEMELDET AUS DEM SPIEL (Saisonende, MD10):
 * „preisgeld und sponsoren buchen ist gelaufen, aber der GuV betrag wurde nicht auf das aktuelle
 * cash drauf gerechnet" — und auf Nachfrage: „bei allen teams hatte sich der Cash nicht geändert."
 *
 * Der Schritt schrieb bisher AUSSCHLIESSLICH die Tabellen-Spalten (`sponsorTotal`, `guv`,
 * `cashTotal`, `cashFc`) und ein Audit-Log; die Teams gingen unverändert durch
 * (`const nextTeams = save.gameState.teams;` → `teams: nextTeams`). Die Oberfläche meldete
 * trotzdem „Ist gebucht — das Geld steht auf dem Konto".
 *
 * Das Geld floss nur in `applySponsorSettlement`, gerufen an genau EINER Stelle:
 * `season-completion-service`. Der Saisonabschluss hängt aber nur im Cockpit; im Saisonende-Panel
 * des normalen Spielverlaufs gibt es ihn nicht, und „Neue Saison starten" (Preseason-Workflow)
 * ruft die Abrechnung nicht auf — es *previewt* sie nur und hat keinen Riegel dagegen.
 *
 * Man konnte also mit unverändertem Cash in die neue Saison gehen: kein Sponsorgeld, keine
 * Gehälter, bei allen 32 Teams. Genau das ist passiert.
 *
 * Die Abrechnung ist hier GEMOCKT — geprüft wird die Verdrahtung: dass sie überhaupt gerufen wird,
 * mit welchen Einstellungen, und dass ihr Ergebnis auch gespeichert wird. Was sie rechnet, ist
 * Sache von `sponsor-settlement-service` und dort getestet.
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

const CASH_BEFORE = { "W-W": 37.9, "P-S": 49.8 };
/** Was die Abrechnung im Test „auszahlt" — Sponsoren minus Gehälter, wie im Spiel. */
const CASH_AFTER = { "W-W": 61.2, "P-S": 44.1 };

function createPersistenceMock() {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState: {
      season: { id: "season-1", name: "Season 1", year: 1, currentMatchday: 10, matchdayIds: ["matchday-10"] },
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        standings: { "W-W": { points: 22, rank: 1 }, "P-S": { points: 19, rank: 2 } },
        matchdayResults: [{ id: "result-1" } as never],
        cashPrizeApplyLogs: [],
      },
      matchdayState: { matchdayId: "matchday-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
      teams: [
        { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 100, cash: CASH_BEFORE["W-W"], identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "P-S", shortCode: "P-S", name: "Project Suicide", budget: 100, cash: CASH_BEFORE["P-S"], identityId: "b", humanControlled: true, rosterLimit: 12 },
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
  const item = (teamId: keyof typeof CASH_BEFORE, rank: number, prize: number) => ({
    teamId,
    teamCode: teamId,
    teamName: teamId,
    rank,
    points: 20,
    currentCash: CASH_BEFORE[teamId],
    prizeMoney: prize,
    basisCash: 50,
    salaryTotal: 12,
    rankChangePrize: { bonusMalus: 0, startRank: rank, finalRank: rank, rankDelta: 0, source: "sheet", startRankSource: "standing_startplatz", warning: null },
    projectedCash: CASH_BEFORE[teamId] + prize,
    status: "ready",
    warnings: [],
  });
  buildPrizeMoneyPreview.mockResolvedValue({
    items: [item("W-W", 1, 91.4), item("P-S", 2, 88)],
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
    gameState: {
      ...gameState,
      teams: gameState.teams.map((team) => ({ ...team, cash: CASH_AFTER[team.teamId as keyof typeof CASH_AFTER] })),
    },
  }));
});

describe("Preisgeld & Sponsoren buchen — das Geld landet wirklich auf dem Konto", () => {
  /** DER GEMELDETE FALL: nach dem Buchen stand bei allen Teams derselbe Cash wie vorher. */
  it("schreibt den abgerechneten Cash in den Spielstand", async () => {
    const { save, persistence } = createPersistenceMock();
    await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    const cashByTeamId = Object.fromEntries(save.gameState.teams.map((team) => [team.teamId, team.cash]));
    expect(cashByTeamId).toEqual(CASH_AFTER);
    expect(cashByTeamId["W-W"]).not.toBe(CASH_BEFORE["W-W"]);
  });

  /**
   * `deductSalary: true` ist keine Kleinigkeit: ohne sie kaeme Sponsorgeld ohne die zugehoerigen
   * Gehaelter an, und die gebuchte Summe waere nicht die GuV, die in derselben Zeile steht.
   * Dieselbe Einstellung benutzt der Saisonabschluss.
   */
  it("rechnet mit Gehaltsabzug ab, wie der Saisonabschluss", async () => {
    const { persistence } = createPersistenceMock();
    await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    expect(applySponsorSettlement).toHaveBeenCalledTimes(1);
    expect(applySponsorSettlement.mock.calls[0]?.[0]).toMatchObject({
      phase: "season_end",
      execute: true,
      deductSalary: true,
    });
  });

  /**
   * Bleibt die Abrechnung aus (schon gebucht — der Saisonabschluss war zuerst dran), darf der
   * Schritt den Spielstand nicht mit einem unabgerechneten Stand ueberschreiben. Die
   * Tabellen-Spalten werden trotzdem geschrieben.
   */
  it("ueberschreibt nichts, wenn die Abrechnung schon gelaufen war", async () => {
    const { save, persistence } = createPersistenceMock();
    applySponsorSettlement.mockImplementation(({ gameState }: { gameState: GameState }) => ({
      applied: false,
      preview: { rows: [], canApply: false, blockingReasons: ["already_paid"], totalCashDelta: 0 },
      gameState,
    }));
    await executeCashPrizeApply(
      { saveId: "save-local", seasonId: "season-1", phase: "season_end", confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN },
      persistence as never,
    );
    const cashByTeamId = Object.fromEntries(save.gameState.teams.map((team) => [team.teamId, team.cash]));
    expect(cashByTeamId).toEqual(CASH_BEFORE);
    // Die Anzeige-Spalten entstehen trotzdem — sie sind der Zweck des Schritts.
    expect(save.gameState.seasonState.standings["W-W"]).toHaveProperty("guv");
  });
});
