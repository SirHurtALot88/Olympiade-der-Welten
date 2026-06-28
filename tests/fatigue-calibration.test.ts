import { describe, expect, it } from "vitest";

import {
  getFatiguePerformanceMultiplier,
  getFatiguePerformancePenaltyPercent,
  getFatigueRiskLevel,
  getInjuryRiskBand,
  getInjuryRiskPercent,
} from "@/lib/fatigue/fatigue-calibration";

describe("fatigue-calibration", () => {
  it("maps performance fatigue linearly to 25% at 80 and caps above that", () => {
    expect(getFatiguePerformancePenaltyPercent(0)).toBe(0);
    expect(getFatiguePerformancePenaltyPercent(40)).toBe(12.5);
    expect(getFatiguePerformancePenaltyPercent(80)).toBe(25);
    expect(getFatiguePerformancePenaltyPercent(100)).toBe(25);
    expect(getFatiguePerformanceMultiplier(80)).toBe(0.75);
  });

  it("interpolates injury risk across anchor points", () => {
    expect(getInjuryRiskPercent(0)).toBe(0);
    expect(getInjuryRiskPercent(30)).toBe(5);
    expect(getInjuryRiskPercent(50)).toBe(10);
    expect(getInjuryRiskPercent(80)).toBe(25);
    expect(getInjuryRiskPercent(100)).toBe(40);
    expect(getInjuryRiskPercent(40)).toBe(7.5);
    expect(getInjuryRiskPercent(65)).toBe(17.5);
  });

  it("returns ui bands with live risk percent", () => {
    expect(getInjuryRiskBand(29).label).toBe("none");
    expect(getInjuryRiskBand(29).riskPercent).toBe(4.83);
    expect(getInjuryRiskBand(85).label).toBe("sehr_stark");
    expect(getInjuryRiskBand(85).riskPercent).toBe(28.75);
  });

  it("classifies fatigue risk levels on the 0-100 scale", () => {
    expect(getFatigueRiskLevel(20)).toBe("niedrig");
    expect(getFatigueRiskLevel(45)).toBe("mittel");
    expect(getFatigueRiskLevel(70)).toBe("hoch");
  });
});
