import type { ContractShape, GameState, RosterEntry } from "@/lib/data/olyDataTypes";
import {
  buildContractSalarySchedule,
  calculateOpenBuyoutCost,
} from "@/lib/market/contract-negotiation-preview";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export type TransfermarktSellProceedsBreakdown = {
  grossSalePrice: number;
  buyoutCost: number;
  /** Cash flow after buyout (can be negative). */
  netProceeds: number;
  netProfitVsPurchase: number | null;
};

export function resolveOpenBuyoutCostForRoster(input: {
  rosterEntry: RosterEntry;
  gameState?: GameState | null;
  seasonsElapsed?: number;
}) {
  const schedule =
    input.rosterEntry.yearlySalarySchedule && input.rosterEntry.yearlySalarySchedule.length > 0
      ? input.rosterEntry.yearlySalarySchedule
      : buildContractSalarySchedule({
          annualSalary: input.rosterEntry.salary,
          contractLength: input.rosterEntry.contractLength,
          shape: (input.rosterEntry.contractShape ?? "balanced") as ContractShape,
          seasonLabelBase:
            input.gameState != null
              ? getCanonicalSeasonLabel({
                  seasonId: input.gameState.season.id,
                  seasonName: input.gameState.season.name,
                })
              : "Season",
          seasonIdBase: input.gameState?.season.id ?? null,
        }).yearlySalarySchedule;

  return calculateOpenBuyoutCost(schedule, input.seasonsElapsed ?? 0) ?? 0;
}

export function resolveTransfermarktSellProceeds(input: {
  rosterEntry: RosterEntry;
  grossSalePrice: number;
  purchasePrice?: number | null;
  gameState?: GameState | null;
  seasonsElapsed?: number;
}): TransfermarktSellProceedsBreakdown {
  const grossSalePrice = roundValue(Math.max(0, input.grossSalePrice), 2);
  const buyoutCost = roundValue(
    Math.max(0, resolveOpenBuyoutCostForRoster({
      rosterEntry: input.rosterEntry,
      gameState: input.gameState ?? null,
      seasonsElapsed: input.seasonsElapsed,
    })),
    2,
  );
  const netProceeds = roundValue(grossSalePrice - buyoutCost, 2);
  const netProfitVsPurchase =
    input.purchasePrice != null && Number.isFinite(input.purchasePrice)
      ? roundValue(netProceeds - input.purchasePrice, 2)
      : null;

  return {
    grossSalePrice,
    buyoutCost,
    netProceeds,
    netProfitVsPurchase,
  };
}
