import { describe, expect, it } from "vitest";

import {
  buildTrainingModeDemand,
  getTrainingModeMismatchSeverity,
  resolvePreferredTrainingMode,
} from "@/lib/training/training-mode-demand-service";

function makePlayer(partial: {
  id?: string;
  name?: string;
  trainingMode?: "leicht" | "mittel" | "hart" | null;
  traitsPositive?: string[];
  traitsNegative?: string[];
  fatigue?: number;
  potential?: number;
  age?: number;
}) {
  return {
    id: partial.id ?? "p-1",
    name: partial.name ?? "Test Spieler",
    trainingMode: partial.trainingMode ?? "mittel",
    traitsPositive: partial.traitsPositive ?? [],
    traitsNegative: partial.traitsNegative ?? [],
    fatigue: partial.fatigue ?? 0,
    potential: partial.potential ?? 70,
    age: partial.age ?? 24,
  };
}

describe("training mode demand service", () => {
  it("prefers leicht for lazy or exhausted players", () => {
    expect(
      resolvePreferredTrainingMode({
        player: makePlayer({ traitsNegative: ["Lazy"], fatigue: 60 }),
      }),
    ).toBe("leicht");
  });

  it("prefers hart for ambitious young prospects", () => {
    expect(
      resolvePreferredTrainingMode({
        player: makePlayer({ traitsPositive: ["Ambitious", "Motivated"], fatigue: 10, age: 20, potential: 82 }),
        rosterRank: 2,
      }),
    ).toBe("hart");
  });

  it("marks opposite modes as high severity", () => {
    expect(getTrainingModeMismatchSeverity("hart", "leicht")).toBe(2);
    expect(getTrainingModeMismatchSeverity("mittel", "hart")).toBe(1);
  });

  it("builds demand with morale framing and failed state after long ignore", () => {
    const demand = buildTrainingModeDemand({
      context: { seasonId: "s1", teamId: "t1", matchdayIndex: 5 },
      player: makePlayer({ trainingMode: "hart", traitsNegative: ["Lazy"], fatigue: 70 }),
    });

    expect(demand?.preferredMode).toBe("leicht");
    expect(demand?.status).toBe("failed");
    expect(demand?.moralePenalty).toBeLessThan(0);
  });

  it("treats fulfilled demand when current mode matches preference", () => {
    const demand = buildTrainingModeDemand({
      context: { seasonId: "s1", teamId: "t1", matchdayIndex: 1 },
      player: makePlayer({ trainingMode: "leicht", traitsNegative: ["Lazy"], fatigue: 70 }),
    });

    expect(demand?.status).toBe("fulfilled");
  });
});
