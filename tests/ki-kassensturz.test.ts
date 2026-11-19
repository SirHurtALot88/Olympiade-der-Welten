/**
 * Kassensturz am Schluss des gemeinsamen Transferfensters (Chris 18.11.): Minus → zuerst Ruecklage (die Kasse
 * selbst), dann Kredit (regulaer, dann Notkredit), Notverkauf nur als letztes Mittel und nie unter 8 Spieler.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const zustand = vi.hoisted(() => ({ gameState: null as unknown as GameState, gespeichert: 0 }));

const resolveAiLoanDecision = vi.hoisted(() => vi.fn());
const originateLoan = vi.hoisted(() => vi.fn());
const applyInsolvencyBackstop = vi.hoisted(() => vi.fn());
const buildLoanOffers = vi.hoisted(() => vi.fn(() => [{ lenderType: "bank" }]));
const executeLocalTransfermarktSell = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/ai-loan-decision-service", () => ({ resolveAiLoanDecision }));
vi.mock("@/lib/finance/loan-service", () => ({ applyInsolvencyBackstop, buildLoanOffers, originateLoan }));
vi.mock("@/lib/market/transfermarkt-local-service", () => ({ executeLocalTransfermarktSell }));

import { fuehreKiKassensturzAus } from "@/lib/ai/ki-kassensturz";

function mitKasse(gameState: GameState, teamId: string, delta: number): GameState {
  return {
    ...gameState,
    teams: gameState.teams.map((team) => (team.teamId === teamId ? { ...team, cash: team.cash + delta } : team)),
  };
}

const persistence = {
  getSaveById: () => ({ saveId: "s", gameState: zustand.gameState }),
  saveSingleplayerState: (_saveId: string, gameState: GameState) => {
    zustand.gameState = gameState;
    zustand.gespeichert += 1;
    return { saveId: "s", gameState };
  },
} as never;

function stand(cashA: number, kader = 10): GameState {
  return {
    season: { id: "season-2" },
    teams: [
      { teamId: "A", cash: cashA },
      { teamId: "B", cash: 5 },
    ],
    rosters: Array.from({ length: kader }, (_, i) => ({
      id: `r${i}`,
      teamId: "A",
      playerId: `p${i}`,
      salary: i === 3 ? 9 : 1,
      currentValue: 10,
    })),
  } as unknown as GameState;
}

beforeEach(() => {
  vi.clearAllMocks();
  zustand.gespeichert = 0;
  applyInsolvencyBackstop.mockImplementation(({ gameState }: { gameState: GameState }) => ({
    gameState,
    emergencyLoans: [],
    warnings: [],
  }));
});

describe("Kassensturz", () => {
  it("laesst ein Team mit Kasse >= 0 in Ruhe — die Ruecklage hat das Fenster getragen", () => {
    zustand.gameState = stand(3);
    const ergebnis = fuehreKiKassensturzAus({ saveId: "s", seasonId: "season-2", aiTeamIds: ["A", "B"], persistence });
    expect(ergebnis.imMinus).toEqual([]);
    expect(resolveAiLoanDecision).not.toHaveBeenCalled();
    expect(applyInsolvencyBackstop).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });

  it("nimmt bei Minus zuerst den regulaeren Kredit; dann braucht es weder Notkredit noch Notverkauf", () => {
    zustand.gameState = stand(-12);
    resolveAiLoanDecision.mockReturnValue({ shouldBorrow: true, loanAmount: 12, termSeasons: 2, reason: "liquidity_negative_cash" });
    originateLoan.mockImplementation((gameState: GameState) => ({ ok: true, gameState: mitKasse(gameState, "A", 12) }));
    const ergebnis = fuehreKiKassensturzAus({ saveId: "s", seasonId: "season-2", aiTeamIds: ["A", "B"], persistence });
    expect(ergebnis.kredite).toEqual([{ teamId: "A", betrag: 12 }]);
    expect(ergebnis.notkredite).toEqual([]);
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(ergebnis.nochImMinus).toEqual([]);
  });

  it("faellt auf den Notkredit zurueck, wenn der regulaere Kredit nein sagt", () => {
    zustand.gameState = stand(-7);
    resolveAiLoanDecision.mockReturnValue({ shouldBorrow: false, loanAmount: 0, termSeasons: 0, reason: "liquidity_no_capacity" });
    applyInsolvencyBackstop.mockImplementation(({ gameState }: { gameState: GameState }) => ({
      gameState: mitKasse(gameState, "A", 7),
      emergencyLoans: [{ teamId: "A", principal: 7 }],
      warnings: [],
    }));
    const ergebnis = fuehreKiKassensturzAus({ saveId: "s", seasonId: "season-2", aiTeamIds: ["A"], persistence });
    expect(originateLoan).not.toHaveBeenCalled();
    expect(ergebnis.notkredite).toEqual([{ teamId: "A", betrag: 7 }]);
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
  });

  it("verkauft nur als letztes Mittel — hoechstes Gehalt je Wert zuerst, nie unter 8 Spieler", () => {
    zustand.gameState = stand(-100, 10);
    resolveAiLoanDecision.mockReturnValue({ shouldBorrow: false, loanAmount: 0, termSeasons: 0, reason: "x" });
    executeLocalTransfermarktSell.mockImplementation(({ activePlayerId }: { activePlayerId: string }) => {
      zustand.gameState = {
        ...mitKasse(zustand.gameState, "A", 10),
        rosters: zustand.gameState.rosters.filter((r) => r.id !== activePlayerId),
      };
      return { transferCreated: true, netProceeds: 10 };
    });
    const ergebnis = fuehreKiKassensturzAus({ saveId: "s", seasonId: "season-2", aiTeamIds: ["A"], persistence });
    expect(ergebnis.notverkaeufe).toHaveLength(2);
    // Spieler r3 hat das hoechste Gehalt je Wert und geht zuerst.
    expect(executeLocalTransfermarktSell.mock.calls[0]![0]).toMatchObject({ activePlayerId: "r3", transferSource: "emergency_negative_cash_liquidation" });
    expect(zustand.gameState.rosters.filter((r) => r.teamId === "A")).toHaveLength(8);
    expect(ergebnis.nochImMinus).toEqual([{ teamId: "A", fehlbetrag: 80 }]);
  });

  it("verkauft nie fuer ein menschliches Team", () => {
    zustand.gameState = stand(-50, 12);
    const ergebnis = fuehreKiKassensturzAus({ saveId: "s", seasonId: "season-2", aiTeamIds: ["B"], persistence });
    expect(resolveAiLoanDecision).not.toHaveBeenCalled();
    expect(executeLocalTransfermarktSell).not.toHaveBeenCalled();
    expect(applyInsolvencyBackstop).toHaveBeenCalledTimes(1);
    expect(ergebnis.nochImMinus).toEqual([{ teamId: "A", fehlbetrag: 50 }]);
  });
});
