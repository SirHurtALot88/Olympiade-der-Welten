import { describe, expect, it } from "vitest";

import {
  AI_PREVIEW_BUDGET_WIDE_DEFAULT_FULL_SCORING,
  buildBudgetWideAffordableScope,
} from "@/lib/ai/ai-transfermarkt-preview-service";
import type { TransfermarktFreeAgentItem } from "@/lib/transfermarkt/transfermarkt-types";

function fa(partial: Partial<TransfermarktFreeAgentItem> & Pick<TransfermarktFreeAgentItem, "playerId" | "name">) {
  return {
    playerId: partial.playerId,
    name: partial.name,
    className: partial.className ?? "warrior",
    race: partial.race ?? "human",
    marketValue: partial.marketValue ?? 10,
    salary: partial.salary ?? 1,
    pow: partial.pow ?? 50,
    spe: partial.spe ?? 50,
    men: partial.men ?? 50,
    soc: partial.soc ?? 50,
    topDisciplineScores: partial.topDisciplineScores ?? [],
    mercenary: partial.mercenary ?? false,
    fit: partial.fit ?? 0,
    needMatchLabel: partial.needMatchLabel ?? null,
    ovr: partial.ovr ?? null,
    mvs: partial.mvs ?? null,
  } satisfies TransfermarktFreeAgentItem;
}

describe("budget_wide preview scope", () => {
  it("includes every affordable free agent without strategic pre-gates", () => {
    const baseFreeAgents = [
      fa({ playerId: "cheap", name: "Cheap", marketValue: 8 }),
      fa({ playerId: "mid-no-axis", name: "Mid", marketValue: 45, pow: 20, spe: 20, men: 20, soc: 20 }),
      fa({ playerId: "star", name: "Star", marketValue: 70, pow: 88, spe: 88, men: 88, soc: 88 }),
      fa({ playerId: "too-expensive", name: "Too expensive", marketValue: 120 }),
    ];

    const result = buildBudgetWideAffordableScope({
      baseFreeAgents,
      marketValueSortedAsc: true,
      spendableCash: 80,
      globallyExcludedPlayerIds: new Set(),
      recentlySoldPlayerIds: new Set(),
    });

    expect(result.affordableCount).toBe(3);
    expect(result.candidates.map((entry) => entry.playerId)).toEqual(["cheap", "mid-no-axis", "star"]);
    expect(result.stage0SkippedTargets.some((entry) => entry.playerId === "too-expensive")).toBe(true);
  });

  it("defaults full scoring budget wide cap to 480", () => {
    expect(AI_PREVIEW_BUDGET_WIDE_DEFAULT_FULL_SCORING).toBe(480);
  });
});
