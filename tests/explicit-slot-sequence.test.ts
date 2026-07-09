import { describe, expect, it } from "vitest";

import { buildExplicitSlotSequence, interleaveLanePyramid } from "@/lib/ai/market-pick-engine/explicit-slot-sequence";

describe("explicit-slot-sequence", () => {
  it("interleaves premium with depth instead of block-ordering core before depth", () => {
    const sequence = buildExplicitSlotSequence({
      steps: 10,
      missingToMin: 0,
      targetSlotsMissing: 10,
      superstarAllowed: 0,
      starAllowed: 2,
      coreNeeded: 2,
      specialistNeeded: 1,
      depthNeeded: 3,
      backupNeeded: 2,
      cheapFillNeeded: 0,
      premiumCap: 2,
      premiumFirst: true,
    });
    const firstStar = sequence.findIndex((lane) => lane === "star" || lane === "superstar");
    const firstDepth = sequence.findIndex((lane) => lane === "depth");
    expect(firstStar).toBeGreaterThanOrEqual(0);
    expect(firstDepth).toBeGreaterThanOrEqual(0);
    expect(firstDepth).toBeLessThan(sequence.length - 1);
    expect(sequence.indexOf("depth")).toBeLessThan(sequence.lastIndexOf("core") + 3);
  });

  it("allows a high premium-appetite team (1 superstar plus stars) within premium cap", () => {
    const sequence = buildExplicitSlotSequence({
      steps: 12,
      missingToMin: 0,
      targetSlotsMissing: 12,
      superstarAllowed: 1,
      starAllowed: 2,
      coreNeeded: 2,
      specialistNeeded: 1,
      depthNeeded: 4,
      backupNeeded: 2,
      cheapFillNeeded: 0,
      premiumCap: 3,
      premiumFirst: true,
    });
    expect(sequence.filter((lane) => lane === "superstar")).toHaveLength(1);
    expect(sequence.filter((lane) => lane === "star").length).toBeGreaterThanOrEqual(1);
    expect(sequence[0]).toBe("core");
    expect(sequence.filter((lane) => lane === "depth").length).toBeGreaterThanOrEqual(3);
  });

  it("fills remaining slots with depth while under minimum roster", () => {
    const sequence = buildExplicitSlotSequence({
      steps: 8,
      missingToMin: 3,
      targetSlotsMissing: 8,
      superstarAllowed: 0,
      starAllowed: 1,
      coreNeeded: 1,
      specialistNeeded: 0,
      depthNeeded: 2,
      backupNeeded: 1,
      cheapFillNeeded: 0,
      premiumCap: 1,
      premiumFirst: true,
    });
    expect(sequence.length).toBe(8);
    expect(sequence.slice(0, 3).every((lane) => lane === "depth")).toBe(true);
  });

  it("plans a single star slot on small post-opt fills", () => {
    const sequence = buildExplicitSlotSequence({
      steps: 1,
      missingToMin: 0,
      targetSlotsMissing: 1,
      superstarAllowed: 0,
      starAllowed: 1,
      coreNeeded: 0,
      specialistNeeded: 0,
      depthNeeded: 0,
      backupNeeded: 0,
      cheapFillNeeded: 0,
      premiumCap: 1,
      premiumFirst: true,
    });
    expect(sequence).toEqual(["star"]);
  });

  it("interleaveLanePyramid alternates expensive and mid lanes", () => {
    const plan = interleaveLanePyramid(
      {
        superstar: 0,
        star: 2,
        core: 3,
        specialist: 0,
        depth: 3,
        backup: 2,
        cheap_fill: 0,
      },
      10,
    );
    expect(plan.slice(0, 4)).toEqual(["core", "star", "depth", "backup"]);
  });
});
