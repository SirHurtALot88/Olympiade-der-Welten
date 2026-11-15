import { describe, expect, it } from "vitest";
import { freshness } from "./stand";

const now = new Date("2026-11-14T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("freshness", () => {
  it("ohne Zeitpunkt: none", () => expect(freshness(null, now, 2)).toBe("none"));
  it("frisch: ok", () => expect(freshness(ago(1), now, 2)).toBe("ok"));
  it("ab Warnschwelle: warn", () => expect(freshness(ago(2), now, 2)).toBe("warn"));
  it("ab doppelter Zeit: crit", () => expect(freshness(ago(4), now, 2)).toBe("crit"));
  it("Cardmarket 7 Tage", () => {
    expect(freshness(ago(6), now, 7)).toBe("ok");
    expect(freshness(ago(8), now, 7)).toBe("warn");
    expect(freshness(ago(15), now, 7)).toBe("crit");
  });
});
