import { describe, expect, it } from "vitest";

import { groupObjectivesByCategory, type TeamBoardObjective } from "@/lib/foundation/team-board-objectives";

function objective(partial: Partial<TeamBoardObjective> & Pick<TeamBoardObjective, "objectiveId" | "category">): TeamBoardObjective {
  return {
    label: partial.label ?? partial.objectiveId,
    targetValue: null,
    currentValue: null,
    status: "open",
    ...partial,
  };
}

describe("groupObjectivesByCategory", () => {
  it("groups objectives by category in canonical order", () => {
    const grouped = groupObjectivesByCategory([
      objective({ objectiveId: "p1", category: "player" }),
      objective({ objectiveId: "f1", category: "FINANCE" }),
      objective({ objectiveId: "s1", category: "Sport" }),
    ]);

    expect(grouped.map((group) => group.category)).toEqual(["SPORT", "FINANCE", "PLAYER"]);
    expect(grouped[0]?.objectives.map((entry) => entry.objectiveId)).toEqual(["s1"]);
  });

  it("appends unknown categories alphabetically after known ones", () => {
    const grouped = groupObjectivesByCategory([
      objective({ objectiveId: "z1", category: "ZZZ" }),
      objective({ objectiveId: "a1", category: "AAA" }),
      objective({ objectiveId: "s1", category: "SPORT" }),
    ]);

    expect(grouped.map((group) => group.category)).toEqual(["SPORT", "AAA", "ZZZ"]);
  });
});
