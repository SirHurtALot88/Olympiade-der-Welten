import { describe, expect, it } from "vitest";

import type { RosterEntry } from "@/lib/data/olyDataTypes";
import { buildContractSalarySchedule } from "@/lib/market/contract-negotiation-preview";
import {
  resolveOpenBuyoutCostForRoster,
  resolveTransfermarktSellProceeds,
} from "@/lib/market/transfermarkt-sell-proceeds";

function makeRoster(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    id: "roster-1",
    playerId: "player-1",
    teamId: "team-1",
    roleTag: "rotation",
    contractLength: 3,
    salary: 10,
    contractShape: "balanced",
    yearlySalarySchedule: [
      { seasonLabel: "Season 1", salary: 10 },
      { seasonLabel: "Season 2", salary: 10 },
      { seasonLabel: "Season 3", salary: 10 },
    ],
    purchasePrice: 20,
    joinedSeasonId: "season-1",
    ...overrides,
  };
}

describe("transfermarkt-sell-proceeds", () => {
  it("subtracts open buyout from gross sale price for net proceeds", () => {
    const breakdown = resolveTransfermarktSellProceeds({
      rosterEntry: makeRoster(),
      grossSalePrice: 25,
      purchasePrice: 20,
    });

    expect(breakdown.grossSalePrice).toBe(25);
    expect(breakdown.buyoutCost).toBe(30);
    expect(breakdown.netProceeds).toBe(-5);
    expect(breakdown.netProfitVsPurchase).toBe(-25);
  });

  it("allows positive net proceeds when fee exceeds buyout", () => {
    const breakdown = resolveTransfermarktSellProceeds({
      rosterEntry: makeRoster({ contractLength: 1, yearlySalarySchedule: [{ seasonLabel: "Season 1", salary: 5 }] }),
      grossSalePrice: 40,
      purchasePrice: 20,
    });

    expect(breakdown.buyoutCost).toBe(5);
    expect(breakdown.netProceeds).toBe(35);
    expect(breakdown.netProfitVsPurchase).toBe(15);
  });

  it("uses stored yearlySalarySchedule for buyout including back_loaded shape", () => {
    const schedule = buildContractSalarySchedule({
      annualSalary: 10,
      contractLength: 5,
      shape: "back_loaded",
      seasonLabelBase: "Season 1",
    }).yearlySalarySchedule;
    const buyout = resolveOpenBuyoutCostForRoster({
      rosterEntry: makeRoster({
        contractLength: 5,
        contractShape: "back_loaded",
        salary: 10,
        yearlySalarySchedule: schedule,
      }),
    });
    expect(buyout).toBe(schedule.reduce((sum, row) => sum + row.salary, 0));
    expect(schedule[4]!.salary).toBeGreaterThan(schedule[0]!.salary);
  });
});
