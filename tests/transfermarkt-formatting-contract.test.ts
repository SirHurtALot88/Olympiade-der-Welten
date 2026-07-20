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
    // Die Heat-Skalen wurden von rohen Hex-Werten auf die zentrale Heat-Palette
    // (CSS-Variablen) umgestellt.
    expect(TRANSFERMARKT_CONFIRMED_COLOR_RULES.flatMap((rule) => rule.colors)).toContain("var(--heat-blue-dark)");
  });

  it("formats market value and salary in the app-wide Mio convention", () => {
    // Werte liegen in Mio-Einheit vor — konsistent zu formatNlMoney.
    expect(formatTransfermarktCurrency(506.4)).toBe("506,4 Mio");
    expect(formatTransfermarktCurrency(0.75)).toBe("750k");
    expect(formatTransfermarktCurrency(null)).toBe("—");
  });

  it("does not expose unknown formatting as productive", () => {
    expect(isUnknownFormattingRule("kartenfarbe")).toBe(true);
    expect(isUnknownFormattingRule("core_axis_heat_scale")).toBe(false);
  });

  it("maps confirmed axis heat colors from Retool thresholds", () => {
    // Rohe Hex-Werte wurden auf die zentrale Heat-Palette (CSS-Variablen) umgestellt.
    expect(getConfirmedAxisHeatStyle(90)?.backgroundColor).toBe("var(--heat-best-bg)");
    expect(getConfirmedAxisHeatStyle(50)?.backgroundColor).toBe("var(--heat-neutral-bg)");
    expect(getConfirmedAxisHeatStyle(10)?.backgroundColor).toBe("var(--heat-danger-bg)");
  });

  it("maps raw stat points to Retool-style S+ to F tiers", () => {
    expect(getTransfermarktTierFromPoints(95)).toBe("S+");
    expect(getTransfermarktTierFromPoints(84)).toBe("S");
    expect(getTransfermarktTierFromPoints(77)).toBe("A");
    expect(getTransfermarktTierFromPoints(45)).toBe("F");
  });

  it("maps tier badges to the confirmed Retool palette", () => {
    // Rohe Hex-Werte wurden auf die zentrale Heat-Palette (CSS-Variablen) umgestellt.
    expect(getConfirmedTierStyle("S+")?.backgroundColor).toBe("var(--heat-best-bg)");
    expect(getConfirmedTierStyle("C")?.backgroundColor).toBe("var(--heat-neutral-bg)");
    expect(getConfirmedTierStyle("F")?.backgroundColor).toBe("var(--heat-danger-bg)");
  });
});
