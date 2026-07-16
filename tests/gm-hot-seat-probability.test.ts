import { describe, expect, it } from "vitest";
import { getBoardReplacementProbability } from "@/lib/foundation/team-general-managers";
import type { TeamBoardConfidenceRecord, TeamIdentity } from "@/lib/data/olyDataTypes";

function makeBoard(value: number, pressure: number): TeamBoardConfidenceRecord {
  return { teamId: "t1", value, pressure, warnings: [] };
}

function makeIdentity(overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId: "t1",
    pow: 5, spe: 5, men: 5, soc: 5,
    ambition: 5, finances: 5, boardConfidence: 5,
    harmony: 5, manners: 5, popularity: 5, cooperation: 5,
    playerMin: 8, playerOpt: 12,
    ...overrides,
  } as TeamIdentity;
}

describe("getBoardReplacementProbability", () => {
  it("returns 0 in the safe zone (confidence >= 6.5, pressure <= 4)", () => {
    expect(getBoardReplacementProbability(makeBoard(7, 3), null)).toBe(0);
    expect(getBoardReplacementProbability(makeBoard(6.5, 4), null)).toBe(0);
  });

  it("returns 1 at the hard floor (confidence <= 2.0)", () => {
    expect(getBoardReplacementProbability(makeBoard(2.0, 5), null)).toBe(1);
    expect(getBoardReplacementProbability(makeBoard(1.5, 3), null)).toBe(1);
  });

  it("returns 1 at the hard floor (pressure >= 9.5)", () => {
    expect(getBoardReplacementProbability(makeBoard(5, 9.5), null)).toBe(1);
    expect(getBoardReplacementProbability(makeBoard(4, 10), null)).toBe(1);
  });

  it("returns 0 when board is null", () => {
    expect(getBoardReplacementProbability(null, null)).toBe(0);
  });

  it("returns ~20% for a mild underperformer (confidence=4.0, pressure=5)", () => {
    const prob = getBoardReplacementProbability(makeBoard(4.0, 5), null);
    expect(prob).toBeGreaterThan(0.15);
    expect(prob).toBeLessThan(0.30);
  });

  it("returns ~40% for a struggling team (confidence=3.5, pressure=7.5)", () => {
    const prob = getBoardReplacementProbability(makeBoard(3.5, 7.5), null);
    expect(prob).toBeGreaterThan(0.30);
    expect(prob).toBeLessThan(0.60);
  });

  it("returns ~80% near the hard floor (confidence=2.5, pressure=9.0)", () => {
    const prob = getBoardReplacementProbability(makeBoard(2.5, 9.0), null);
    expect(prob).toBeGreaterThan(0.70);
    expect(prob).toBeLessThan(1.0);
  });

  it("high ambition board fires sooner (+0.15)", () => {
    const base = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ ambition: 5 }));
    const impatient = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ ambition: 9 }));
    expect(impatient).toBeGreaterThan(base + 0.10);
  });

  it("high harmony board is more patient (-0.15)", () => {
    const base = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ harmony: 5 }));
    const loyal = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ harmony: 9 }));
    expect(loyal).toBeLessThan(base - 0.10);
  });

  it("low boardConfidence seed increases probability (+0.10)", () => {
    const normal = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ boardConfidence: 6 }));
    const unstable = getBoardReplacementProbability(makeBoard(4.0, 7.0), makeIdentity({ boardConfidence: 3 }));
    expect(unstable).toBeGreaterThan(normal + 0.05);
  });

  it("clamps result between 0 and 1 even with stacked positive modifiers", () => {
    // Edge: very bad board + all positive modifiers stacked
    const prob = getBoardReplacementProbability(
      makeBoard(2.5, 9.0),
      makeIdentity({ ambition: 9, harmony: 2, boardConfidence: 3 }),
    );
    expect(prob).toBeLessThanOrEqual(1.0);
    expect(prob).toBeGreaterThanOrEqual(0);
  });

  it("clamps result to 0 even with stacked negative modifiers in safe zone", () => {
    const prob = getBoardReplacementProbability(
      makeBoard(7, 2),
      makeIdentity({ ambition: 9, harmony: 2, boardConfidence: 3 }),
    );
    expect(prob).toBe(0);
  });
});
