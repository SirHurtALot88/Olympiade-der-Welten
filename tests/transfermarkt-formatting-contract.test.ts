import { describe, expect, it } from "vitest";

import {
  formatTransfermarktCurrency,
  getConfirmedAxisHeatStyle,
  getConfirmedTierStyle,
  isUnknownFormattingRule,
  TRANSFERMARKT_CONFIRMED_COLOR_RULES,
} from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";

describe("transfermarkt formatting contract", () => {
  it("contains only confirmed productive color rules", () => {
    expect(TRANSFERMARKT_CONFIRMED_COLOR_RULES.every((rule) => rule.certainty === "confirmed")).toBe(true);
    expect(TRANSFERMARKT_CONFIRMED_COLOR_RULES.flatMap((rule) => rule.colors)).toContain("#1565C0");
  });

  it("formats market value and salary as euro values", () => {
    expect(formatTransfermarktCurrency(100000)).toBe("100.000 €");
    expect(formatTransfermarktCurrency(null)).toBe("—");
  });

  it("does not expose unknown formatting as productive", () => {
    expect(isUnknownFormattingRule("kartenfarbe")).toBe(true);
    expect(isUnknownFormattingRule("core_axis_heat_scale")).toBe(false);
  });

  it("maps confirmed axis heat colors from Retool thresholds", () => {
    expect(getConfirmedAxisHeatStyle(90)?.backgroundColor).toBe("#1565C0");
    expect(getConfirmedAxisHeatStyle(50)?.backgroundColor).toBe("#F9A825");
    expect(getConfirmedAxisHeatStyle(10)?.backgroundColor).toBe("#EF5350");
  });

  it("maps raw stat points to Retool-style S+ to F tiers", () => {
    expect(getTransfermarktTierFromPoints(95)).toBe("S+");
    expect(getTransfermarktTierFromPoints(84)).toBe("S");
    expect(getTransfermarktTierFromPoints(77)).toBe("A");
    expect(getTransfermarktTierFromPoints(45)).toBe("F");
  });

  it("maps tier badges to the confirmed Retool palette", () => {
    expect(getConfirmedTierStyle("S+")?.backgroundColor).toBe("#1565C0");
    expect(getConfirmedTierStyle("C")?.backgroundColor).toBe("#F9A825");
    expect(getConfirmedTierStyle("F")?.backgroundColor).toBe("#EF5350");
  });
});
