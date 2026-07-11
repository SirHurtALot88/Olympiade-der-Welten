import { describe, expect, it } from "vitest";

import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import {
  canExecuteAffordPick,
  resolveExecuteLivePickForSlot,
  resolveExecutePoolMwBounds,
  resolveSlotLaneFromPick,
} from "@/lib/ai/market-pick-engine/execute-live-pick";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

function fa(partial: Partial<TransfermarktFreeAgentItem> & { playerId: string; name: string }): TransfermarktFreeAgentItem {
  return {
    playerId: partial.playerId,
    name: partial.name,
    className: partial.className ?? "Fighter",
    race: partial.race ?? "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    preferredDisciplineIds: partial.preferredDisciplineIds ?? [],
    scoutingLevel: null,
    scoutingDisclosure: null,
    hiddenPositiveTraitCount: 0,
    hiddenNegativeTraitCount: 0,
    preferredDisciplineIdsVisible: true,
    subclass1: null,
    subclass2: null,
    subclass3: null,
    traitPos1: null,
    traitPos2: null,
    traitPos3: null,
    traitNeg1: null,
    traitNeg2: null,
    traitNeg3: null,
    marketValue: partial.marketValue ?? 24,
    ovr: partial.ovr ?? 50,
    mvs: partial.mvs ?? 50,
    salary: partial.salary ?? 5,
    marketValueSalaryRatio: null,
    bracket: null,
    salaryStatus: "fair",
    pow: partial.pow ?? 40,
    spe: partial.spe ?? 40,
    men: partial.men ?? 40,
    soc: partial.soc ?? 40,
    powTier: null,
    speTier: null,
    menTier: null,
    socTier: null,
    disciplineFitScore: null,
    teamFitScore: null,
    buyPreviewCanBuy: true,
    buyPreviewBlockingReasons: [],
    overallRecommendationScore: null,
    strategicBuyScore: null,
  };
}

describe("execute-live-pick", () => {
  it("canExecuteAffordPick allows pick when sum cash stays >= 0", () => {
    expect(canExecuteAffordPick(20, 25)).toBe(true);
    expect(canExecuteAffordPick(20, 19.99)).toBe(false);
  });

  it("resolveSlotLaneFromPick keeps planned lane token", () => {
    expect(resolveSlotLaneFromPick({ plannedLane: "core", pickLane: "depth" })).toBe("core");
  });

  it("ranks need-matching player for open core slot without changing lane", () => {
    const brackets = buildLeagueMarketBrackets([12, 18, 24, 30, 36, 45, 65]);
    const freeAgents = [
      fa({ playerId: "p-low", name: "Low", marketValue: 22, pow: 30, preferredDisciplineIds: [] }),
      fa({
        playerId: "p-power",
        name: "Power",
        marketValue: 32,
        pow: 78,
        preferredDisciplineIds: ["discipline-power"],
      }),
    ];
    const pick = resolveExecuteLivePickForSlot({
      saveId: "save",
      seasonId: "season-1",
      teamId: "T-A",
      teamRunContext: {} as never,
      slotLane: "core",
      bestNeedDisciplineId: "discipline-power",
      affordabilityCash: 50,
      unavailablePlayerIds: new Set(),
      brackets,
      freeAgents,
      useFastBatchExecute: true,
    });
    expect(pick?.playerId).toBe("p-power");
  });

  it("resolveExecutePoolMwBounds unions planned lane fallback bands without cheap_fill by default", () => {
    const brackets = buildLeagueMarketBrackets([12, 18, 24, 30, 36, 45, 65]);
    const bounds = resolveExecutePoolMwBounds({
      slotLane: "core",
      brackets,
      affordabilityCash: 80,
      includeCheapFill: false,
    });
    expect(bounds.minMarketValue).toBe(20);
    expect(bounds.maxMarketValue).toBe(65);
    expect(bounds.lanes).toEqual(["core", "star", "depth"]);
  });

  it("resolveExecutePoolMwBounds caps max at affordability cash", () => {
    const brackets = buildLeagueMarketBrackets([12, 18, 24, 30, 36, 45, 65]);
    const bounds = resolveExecutePoolMwBounds({
      slotLane: "star",
      brackets,
      affordabilityCash: 40,
      includeCheapFill: false,
    });
    expect(bounds.maxMarketValue).toBe(40);
  });

  it("resolveExecutePoolMwBounds widens to cheap_fill when cash is below lane floor", () => {
    const brackets = buildLeagueMarketBrackets([12, 18, 24, 30, 36, 45, 65]);
    const bounds = resolveExecutePoolMwBounds({
      slotLane: "core",
      brackets,
      affordabilityCash: 8,
      includeCheapFill: false,
    });
    expect(bounds.minMarketValue).toBe(0);
    expect(bounds.maxMarketValue).toBe(8);
  });
});
