import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { describe, expect, it } from "vitest";

import {
  buildStandingsTransferBalanceForTeam,
  buildStandingsTransferBalanceByTeamId,
} from "@/lib/season/transfer-standings-balance";

function transfer(partial: Partial<TransferHistoryEntry> & Pick<TransferHistoryEntry, "transferType">): TransferHistoryEntry {
  return {
    id: partial.id ?? "history-1",
    playerId: partial.playerId ?? "p1",
    seasonId: partial.seasonId ?? "season-1",
    matchdayId: partial.matchdayId ?? "matchday-10",
    phase: partial.phase ?? "manual_transfer_window",
    seasonLabel: partial.seasonLabel ?? "Season 1",
    transferType: partial.transferType,
    fromTeamId: partial.fromTeamId ?? null,
    toTeamId: partial.toTeamId ?? null,
    fee: partial.fee ?? 0,
    salary: partial.salary ?? 0,
    marketValue: partial.marketValue ?? 0,
    remainingContractLength: partial.remainingContractLength ?? 1,
    happenedAt: partial.happenedAt ?? "2026-06-06T00:00:00.000Z",
    source: partial.source,
  };
}

function gameState(history: TransferHistoryEntry[]): GameState {
  return {
    season: { id: "season-2", matchdayIds: ["matchday-1"] },
    teams: [{ teamId: "A-A", shortCode: "A-A", name: "Team A", cash: 100 }],
    transferHistory: history,
  } as GameState;
}

describe("transfer-standings-balance", () => {
  // Seit 18.11. (Chris): „das Fenster vor Saison N gehoert zu Saison N". Saison 1 hat keine Transferbilanz, der
  // Draft ist Kaderaufbau aus dem Startbudget; die Verkaeufe am Ende von S1 (letzter Spieltag) zaehlen zu S2.
  it("S1: Draft ist Kaderaufbau, Transferbilanz leer; Saisonende-Verkaeufe gehoeren zu S2", () => {
    const historie = [
      transfer({ id: "b", transferType: "buy", seasonId: "season-1", toTeamId: "A-A", source: "season1_autoprep_topup", fee: 200, matchdayId: "matchday-1" }),
      transfer({ id: "s", transferType: "sell", seasonId: "season-1", fromTeamId: "A-A", source: "ai_preseason_market_sell", fee: 30, matchdayId: "matchday-10" }),
    ];
    const s1 = buildStandingsTransferBalanceForTeam(gameState(historie), "season-1", "A-A");
    expect(s1.transferNet).toBeNull();
    expect(s1.transferBuyCount).toBe(0);
    expect(s1.transferSellCount).toBe(0);
    expect(s1.kaderaufbauNet).toBe(-200);
    const s2 = buildStandingsTransferBalanceForTeam(gameState(historie), "season-2", "A-A");
    expect(s2.transferSellTotal).toBe(30);
    expect(s2.transferNet).toBe(30);
  });

  it("ignores ai_roster_fill draft buys in season 1 (Kaderaufbau)", () => {
    const balance = buildStandingsTransferBalanceForTeam(
      gameState([
        transfer({ transferType: "buy", seasonId: "season-1", toTeamId: "A-A", source: "ai_roster_fill", fee: 180, matchdayId: "matchday-1" }),
      ]),
      "season-1",
      "A-A",
    );

    expect(balance.transferBuyCount).toBe(0);
    expect(balance.transferBuyTotal).toBe(0);
    expect(balance.kaderaufbauBuyTotal).toBe(180);
  });

  it("pairs prior-season end sells with current-season window buys from season 2 onward", () => {
    const balance = buildStandingsTransferBalanceForTeam(
      gameState([
        transfer({ id: "s", transferType: "sell", seasonId: "season-1", fromTeamId: "A-A", source: "ai_preseason_market_sell", fee: 40, matchdayId: "matchday-10" }),
        transfer({ id: "b1", transferType: "buy", seasonId: "season-2", toTeamId: "A-A", source: "preseason_roster_repair_buy", fee: 120, matchdayId: "season-2-matchday-1" }),
        transfer({ id: "b2", transferType: "buy", seasonId: "season-2", toTeamId: "A-A", source: "ai_preseason_market_buy", fee: 25, matchdayId: "season-2-matchday-1" }),
      ]),
      "season-2",
      "A-A",
    );

    expect(balance.transferSellTotal).toBe(40);
    expect(balance.transferBuyTotal).toBe(145);
    expect(balance.transferNet).toBe(-105);
  });

  it("builds per-team maps for the active season", () => {
    const historie = [
      transfer({ transferType: "sell", seasonId: "season-1", fromTeamId: "A-A", source: "ai_preseason_market_sell", fee: 10, matchdayId: "matchday-10" }),
    ];
    expect(buildStandingsTransferBalanceByTeamId(gameState(historie), "season-1")["A-A"]?.transferNet).toBeNull();
    expect(buildStandingsTransferBalanceByTeamId(gameState(historie), "season-2")["A-A"]?.transferNet).toBe(10);
  });
});
