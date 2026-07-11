import { describe, expect, it } from "vitest";

import {
  computeBoardPressure,
  computeSalaryPressure,
  evaluateTeamBuyNeed,
  evaluateTeamMaintenanceNeed,
  evaluateTeamSellNeed,
} from "@/lib/ai/in-season-engine/need-detection";

const baseSell = {
  rosterCount: 10,
  playerOpt: 10,
  teamCash: 100,
  expiringCount: 0,
  salaryTotal: 10,
  boardConfidence: 5,
  sellRunwayPressureScore: 0,
  hasValueSellOpportunity: false,
  hasUpgradeSellOpportunity: false,
};

describe("in-season need-detection — arithmetic helpers", () => {
  it("computes salary pressure exactly like the legacy inline formula", () => {
    expect(computeSalaryPressure({ teamCash: 100, salaryTotal: 50 })).toBe(0.5);
    expect(computeSalaryPressure({ teamCash: 0, salaryTotal: 5 })).toBe(99);
    expect(computeSalaryPressure({ teamCash: 0, salaryTotal: 0 })).toBe(0);
    expect(computeSalaryPressure({ teamCash: -5, salaryTotal: 5 })).toBe(99);
  });

  it("computes board pressure from confidence", () => {
    expect(computeBoardPressure(5)).toBe(5);
    expect(computeBoardPressure(null)).toBe(5);
    expect(computeBoardPressure(2)).toBe(8);
  });
});

describe("in-season need-detection — buy need", () => {
  it("flags a post-opt upgrade deploy regardless of roster", () => {
    const r = evaluateTeamBuyNeed({ rosterCount: 12, playerMin: 8, playerOpt: 10, expiringCount: 0, needsPostOptUpgradeDeploy: true });
    expect(r.needsBuy).toBe(true);
  });
  it("flags below-opt rosters", () => {
    expect(evaluateTeamBuyNeed({ rosterCount: 9, playerMin: 8, playerOpt: 10, expiringCount: 0, needsPostOptUpgradeDeploy: false }).needsBuy).toBe(true);
  });
  it("flags a roster that drops below opt after expiries", () => {
    expect(evaluateTeamBuyNeed({ rosterCount: 10, playerMin: 8, playerOpt: 10, expiringCount: 1, needsPostOptUpgradeDeploy: false }).needsBuy).toBe(true);
  });
  it("does not flag a healthy roster at opt with no expiries", () => {
    expect(evaluateTeamBuyNeed({ rosterCount: 10, playerMin: 8, playerOpt: 10, expiringCount: 0, needsPostOptUpgradeDeploy: false }).needsBuy).toBe(false);
  });
});

describe("in-season need-detection — sell need", () => {
  it("does not flag a healthy team", () => {
    expect(evaluateTeamSellNeed(baseSell).needsSell).toBe(false);
  });
  it("flags over-opt rosters", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, rosterCount: 11 }).needsSell).toBe(true);
  });
  it("flags negative cash", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, teamCash: -1 }).needsSell).toBe(true);
  });
  it("flags high salary pressure (>0.75)", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, teamCash: 100, salaryTotal: 80 }).needsSell).toBe(true);
  });
  it("does not flag salary pressure at exactly 0.75", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, teamCash: 100, salaryTotal: 75 }).needsSell).toBe(false);
  });
  it("flags board pressure >= 6", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, boardConfidence: 4 }).needsSell).toBe(true);
  });
  it("flags sell-runway pressure >= 0.45", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, sellRunwayPressureScore: 0.45 }).needsSell).toBe(true);
  });
  it("flags an injected value-sell / upgrade-sell opportunity", () => {
    expect(evaluateTeamSellNeed({ ...baseSell, hasValueSellOpportunity: true }).needsSell).toBe(true);
    expect(evaluateTeamSellNeed({ ...baseSell, hasUpgradeSellOpportunity: true }).needsSell).toBe(true);
  });
  it("flags an expiry that needs a decision via salary pressure > 0.6", () => {
    // expiringCount>0 && rosterCount>0 && salaryPressure>0.6 -> expiryNeedsDecision
    expect(evaluateTeamSellNeed({ ...baseSell, expiringCount: 1, teamCash: 100, salaryTotal: 61 }).needsSell).toBe(true);
  });
  it("flags an expiry that drops the roster below opt (expiryCreatesOptRisk)", () => {
    // rosterCount 10, playerOpt 10, 1 expiring -> rosterAfterExpiry 9 < opt -> opt risk -> decision.
    // (Any expiry on a roster at/above opt is always either over-opt or opt-risk, hence a sell need.)
    expect(evaluateTeamSellNeed({ ...baseSell, expiringCount: 1, teamCash: 1000, salaryTotal: 10 }).needsSell).toBe(true);
  });
});

describe("in-season need-detection — maintenance need", () => {
  it("flags expiring contracts", () => {
    expect(evaluateTeamMaintenanceNeed({ expiringCount: 1, salaryTotal: 1, teamCash: 100, budgetStatus: "healthy" }).needsMaintenance).toBe(true);
  });
  it("flags salary pressure > 0.5", () => {
    expect(evaluateTeamMaintenanceNeed({ expiringCount: 0, salaryTotal: 60, teamCash: 100, budgetStatus: "healthy" }).needsMaintenance).toBe(true);
  });
  it("flags a non-healthy budget status", () => {
    expect(evaluateTeamMaintenanceNeed({ expiringCount: 0, salaryTotal: 1, teamCash: 100, budgetStatus: "tight" }).needsMaintenance).toBe(true);
  });
  it("does not flag a healthy, low-salary, no-expiry team", () => {
    expect(evaluateTeamMaintenanceNeed({ expiringCount: 0, salaryTotal: 10, teamCash: 100, budgetStatus: "healthy" }).needsMaintenance).toBe(false);
  });
});
