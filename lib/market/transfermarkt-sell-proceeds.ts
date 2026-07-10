import type { ContractShape, ContractYearSalary, GameState, RosterEntry } from "@/lib/data/olyDataTypes";
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

function normalizeContractLength(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(Number(value)));
}

/**
 * Remaining salary schedule used for open buyout — prefers stored per-year rows (incl. BL shape),
 * otherwise rebuilds from contractShape + contractLength.
 */
export function resolveRemainingSalaryScheduleForBuyout(input: {
  rosterEntry: Pick<RosterEntry, "contractLength" | "yearlySalarySchedule" | "salary" | "contractShape">;
  gameState?: GameState | null;
}) {
  const contractLength = normalizeContractLength(input.rosterEntry.contractLength);
  if (contractLength <= 0) {
    return [] as ContractYearSalary[];
  }

  const stored = input.rosterEntry.yearlySalarySchedule ?? [];
  if (stored.length > 0) {
    if (stored.length > contractLength) {
      return stored.slice(stored.length - contractLength);
    }
    return stored.slice(0, contractLength);
  }

  const annualSalary =
    typeof input.rosterEntry.salary === "number" && Number.isFinite(input.rosterEntry.salary) && input.rosterEntry.salary > 0
      ? input.rosterEntry.salary
      : null;
  if (annualSalary == null) {
    return [];
  }

  const built = buildContractSalarySchedule({
    annualSalary,
    contractLength,
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

  return built.slice(0, contractLength);
}

export function resolveOpenBuyoutCostForRoster(input: {
  rosterEntry: Pick<RosterEntry, "contractLength" | "yearlySalarySchedule" | "salary" | "contractShape">;
  gameState?: GameState | null;
  seasonsElapsed?: number;
}) {
  const schedule = resolveRemainingSalaryScheduleForBuyout({
    rosterEntry: input.rosterEntry,
    gameState: input.gameState ?? null,
  });
  if (schedule.length === 0) {
    return 0;
  }
  return calculateOpenBuyoutCost(schedule, input.seasonsElapsed ?? 0) ?? 0;
}

export function resolveTransfermarktSellProceeds(input: {
  rosterEntry: Pick<RosterEntry, "contractLength" | "yearlySalarySchedule" | "salary" | "contractShape">;
  grossSalePrice: number;
  purchasePrice?: number | null;
  gameState?: GameState | null;
  seasonsElapsed?: number;
}): TransfermarktSellProceedsBreakdown {
  const grossSalePrice = roundValue(Math.max(0, input.grossSalePrice), 2);
  const buyoutCost = roundValue(
    Math.max(
      0,
      resolveOpenBuyoutCostForRoster({
        rosterEntry: input.rosterEntry,
        gameState: input.gameState ?? null,
        seasonsElapsed: input.seasonsElapsed,
      }),
    ),
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
