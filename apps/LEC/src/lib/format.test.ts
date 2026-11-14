import { describe, expect, it } from "vitest";
import { formatPercent } from "./format";

describe("formatPercent: keine negative Null", () => {
  it("zeigt -0,02 % als 0", () => {
    expect(formatPercent(-0.0002)).not.toMatch(/^[-−]/);
  });
  it("laesst echte negative Werte stehen", () => {
    expect(formatPercent(-0.12)).toMatch(/^[-−]12/);
  });
});
