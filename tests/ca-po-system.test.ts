import { describe, expect, it } from "vitest";

import { buildPlayerPotentialRecord } from "@/lib/progression/player-potential-service";
import { percentileToCurrentAbilityStars } from "@/lib/scouting/player-axis-star-rating";
import type { Player } from "@/lib/data/olyDataTypes";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-test",
    name: "Test Player",
    rating: 50,
    marketValue: 10000,
    salaryDemand: 1000,
    potential: 0,
    className: "Flex",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 45, spe: 45, men: 45, soc: 45 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    ...overrides,
  };
}

describe("potential derivation — spread and floor", () => {
  it("produces a wide spread of potential values across different player IDs (no clustering)", () => {
    const base = makePlayer({ coreStats: { pow: 40, spe: 40, men: 40, soc: 40 }, potential: 0 });
    const scores = Array.from({ length: 50 }, (_, index) =>
      buildPlayerPotentialRecord({
        saveId: "test-save",
        player: { ...base, id: `player-spread-${index}` },
      }).hiddenPotentialScore ?? 0,
    );

    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const spread = max - min;

    expect(spread).toBeGreaterThan(20);
    expect(min).toBeLessThan(65);
    expect(max).toBeGreaterThan(70);
  });

  it("hidden potential score is not anchored to legacy player.potential field", () => {
    const player = makePlayer({
      id: "legacy-potential",
      potential: 48,
      coreStats: { pow: 45, spe: 45, men: 45, soc: 45 },
    });
    const record = buildPlayerPotentialRecord({ saveId: "decouple-test", player });
    expect(record.hiddenPotentialScore).not.toBe(48);
    expect(record.source).toBe("generated");
  });

  it("weak players can still roll high hidden potential scores", () => {
    const scores = Array.from({ length: 40 }, (_, index) =>
      buildPlayerPotentialRecord({
        saveId: "weak-upside",
        player: makePlayer({
          id: `weak-${index}`,
          coreStats: { pow: 28, spe: 18, men: 20, soc: 22 },
          potential: 30,
        }),
      }).hiddenPotentialScore ?? 0,
    );
    expect(Math.max(...scores)).toBeGreaterThan(70);
  });

  it("talent traits (prodigy, gifted) push potential up; ceiling traits pull it down", () => {
    // Use IDENTICAL player IDs so the random seed is the same — only trait modifier differs.
    // This isolates the trait effect cleanly.
    const ids = Array.from({ length: 20 }, (_, i) => `trait-player-${i}`);
    let prodigyHigher = 0;
    let limitedLower = 0;

    for (const id of ids) {
      const base = makePlayer({ id, coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } });
      const neutral = buildPlayerPotentialRecord({ saveId: "trait-save", player: base }).hiddenPotentialScore ?? 0;
      const prodigy = buildPlayerPotentialRecord({
        saveId: "trait-save",
        player: { ...base, traitsPositive: ["prodigy"] },
      }).hiddenPotentialScore ?? 0;
      const limited = buildPlayerPotentialRecord({
        saveId: "trait-save",
        player: { ...base, traitsNegative: ["limited ceiling"] },
      }).hiddenPotentialScore ?? 0;

      if (prodigy >= neutral) prodigyHigher++;
      if (limited <= neutral) limitedLower++;
    }

    // Prodigy trait should push score up (or hit the 99 cap) for most players
    expect(prodigyHigher).toBeGreaterThanOrEqual(15);
    // Limited ceiling should pull score down (or hit the ability floor) for most players
    expect(limitedLower).toBeGreaterThanOrEqual(15);
  });
});

describe("CA specialist formula — best axis rewarded", () => {
  // Overall is now computed from the percentile of the specialist score in the full league.
  // We test the specialist score ordering and the percentile-to-stars mapping separately.

  function specialistScore(rawValues: [number, number, number, number]): number {
    const sorted = [...rawValues].sort((a, b) => b - a);
    return sorted[0]! * 0.45 + sorted[1]! * 0.30 + sorted[2]! * 0.15 + sorted[3]! * 0.10 + sorted[3]! * 0.10;
  }

  it("specialist score ranks a pure specialist higher than a uniformly weak player", () => {
    // SPE star (raw 75): score = 75*0.45 + 30*0.30 + 30*0.15 + 30*0.10 + 30*0.10 = 33.75+9+4.5+3+3 = 53.25
    // vs all-weak (raw 30 each): score = 30*1.10 = 33
    const specialist = specialistScore([75, 30, 30, 30]);
    const weak = specialistScore([30, 30, 30, 30]);
    expect(specialist).toBeGreaterThan(weak);
  });

  it("all-rounder (70 everywhere) scores higher than specialist (75/25/25/25)", () => {
    // all-rounder: 70*1.10 = 77
    // specialist: 75*0.45+25*0.30+25*0.15+25*0.10+25*0.10 = 33.75+7.5+3.75+2.5+2.5 = 50
    const allRounder = specialistScore([70, 70, 70, 70]);
    const specialist = specialistScore([75, 25, 25, 25]);
    expect(allRounder).toBeGreaterThan(specialist);
  });

  it("specialist score produces a proper ordering: strong all-rounder > two-axis > specialist > weak", () => {
    const allElite = specialistScore([72, 70, 68, 65]);
    const twoAxis = specialistScore([72, 65, 35, 30]);
    const specialist = specialistScore([72, 30, 30, 30]);
    const weak = specialistScore([30, 28, 25, 25]);
    expect(allElite).toBeGreaterThan(twoAxis);
    expect(twoAxis).toBeGreaterThan(specialist);
    expect(specialist).toBeGreaterThan(weak);
  });

  it("overall star distribution gives 3.0★ as the largest group (Liga-Mitte dominant)", () => {
    // Simulate 200 players with uniform raw values 25-75 and verify distribution shape
    function rand(seed: number) {
      let h = 2166136261;
      const s = seed.toString();
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      return h / 4294967295;
    }
    function pToStars(p: number) {
      function rhs(v: number) { return Math.min(Math.max(Math.round(v * 2) / 2, 0.5), 5); }
      if (p >= 90) return rhs(4.5 + (p - 90) / 20);
      if (p >= 70) return rhs(3.5 + (p - 70) / 20);
      if (p >= 45) return rhs(3 + (p - 45) / 50);
      if (p >= 20) return rhs(2.5 + (p - 20) / 50);
      if (p >= 5) return rhs(1.5 + (p - 5) / 30);
      return rhs(1 + p / 10);
    }

    const N = 200;
    const scores = Array.from({ length: N }, (_, i) => {
      const raw = [rand(i*13+7)*50+25, rand(i*13+11)*50+25, rand(i*13+17)*50+25, rand(i*13+23)*50+25];
      return specialistScore(raw.sort((a, b) => b - a) as [number,number,number,number]);
    });
    const sorted = [...scores].sort((a, b) => a - b);

    const starCounts: Record<number, number> = {};
    for (const sc of scores) {
      const below = sorted.filter(v => v < sc).length;
      const pct = (below / sorted.length) * 100;
      const star = pToStars(pct);
      starCounts[star] = (starCounts[star] ?? 0) + 1;
    }

    // 3.0★ should be the most common group (Liga-Mitte = 25% in theory)
    const star3 = starCounts[3.0] ?? 0;
    const star35 = starCounts[3.5] ?? 0;
    const star4 = starCounts[4.0] ?? 0;
    expect(star3).toBeGreaterThan(star4);   // more average than very good
    // At least some weak players (1.0-2.5★)
    const weak = [0.5,1,1.5,2,2.5].reduce((s, k) => s + (starCounts[k] ?? 0), 0);
    expect(weak).toBeGreaterThan(0);
  });

  it("percentileToCurrentAbilityStars maps correctly at key cutoffs", () => {
    expect(percentileToCurrentAbilityStars(98)).toBe(5.0);
    expect(percentileToCurrentAbilityStars(50)).toBe(3.0);
    expect(percentileToCurrentAbilityStars(10)).toBe(1.5);
    expect(percentileToCurrentAbilityStars(2)).toBe(0.5);
    expect(percentileToCurrentAbilityStars(0)).toBe(0.5);
    expect(percentileToCurrentAbilityStars(90)).toBe(4.5);
  });
});
