import { describe, expect, it } from "vitest";

import { buildLeagueMarketBrackets, type LeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

import { planTeamLanes } from "../plan-team-lanes";
import { scoreCandidate } from "../score-candidate";
import type { CleanLanePlanSlot, CleanThemeTarget } from "../types";

// Realistic league price spread so buildLeagueMarketBrackets yields the standard tier floors.
const PRICES = Array.from({ length: 400 }, (_, i) => {
  const r = i / 400;
  if (r > 0.97) return 66 + (r - 0.97) * 800; // superstar tail
  if (r > 0.87) return 46 + (r - 0.87) * 180;
  if (r > 0.64) return 30 + (r - 0.64) * 60;
  if (r > 0.35) return 20 + (r - 0.35) * 30;
  if (r > 0.1) return 12 + (r - 0.1) * 30;
  return 2 + r * 90;
});
const BRACKETS: LeagueMarketBrackets = buildLeagueMarketBrackets(PRICES);

function makeIdentity(over: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId: "T-T",
    pow: 50,
    spe: 50,
    men: 50,
    soc: 50,
    ambition: 50,
    finances: 55,
    boardConfidence: 50,
    harmony: 50,
    manners: 50,
    popularity: 50,
    cooperation: 50,
    playerMin: 8,
    playerOpt: 11,
    ...over,
  } as TeamIdentity;
}

function makeStrategy(bias: Partial<TeamStrategyProfile["bias"]>): TeamStrategyProfile {
  return {
    teamId: "T-T",
    strategySummary: "",
    buyStyle: "",
    sellStyle: "",
    contractStyle: "",
    rosterStyle: "",
    preferredArchetypes: [],
    avoidedArchetypes: [],
    preferredRaces: [],
    avoidedRaces: [],
    preferredClasses: [],
    avoidedClasses: [],
    hardNoGos: [],
    bias: {
      cashPriority: 5,
      valuePriority: 5,
      starPriority: 5,
      riskTolerance: 5,
      wageSensitivity: 5,
      sellForProfitAggression: 5,
      shortContractPreference: 5,
      longContractPreference: 5,
      loyaltyBias: 5,
      harmonyStrictness: 5,
      rosterDepthPreference: 5,
      eliteSmallRosterPreference: 5,
      ...bias,
    },
  } as TeamStrategyProfile;
}

function makeCandidate(over: Partial<TransfermarktFreeAgentItem>): TransfermarktFreeAgentItem {
  return {
    playerId: "p",
    name: "P",
    className: "Fighter",
    race: "human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    preferredDisciplineIds: [],
    marketValue: 35,
    ovr: 60,
    mvs: 60,
    salary: 10,
    marketValueSalaryRatio: 1.5,
    pow: 50,
    spe: 50,
    men: 50,
    soc: 50,
    ...over,
  } as TransfermarktFreeAgentItem;
}

describe("planTeamLanes", () => {
  it("poor / low-ambition team: no premium (superstar/star), body is depth/backup", () => {
    const plan = planTeamLanes({
      teamId: "POOR",
      identity: makeIdentity({ ambition: 30, finances: 30, playerOpt: 11 }),
      strategy: makeStrategy({ starPriority: 2, rosterDepthPreference: 8, cashPriority: 5 }),
      spendableCash: 210,
      currentRosterCount: 0,
      brackets: BRACKETS,
    });

    expect(plan.slots.length).toBeGreaterThan(0);
    const lanes = plan.slots.map((slot) => slot.lane);
    expect(lanes).not.toContain("superstar");
    expect(lanes).not.toContain("star");

    const body = lanes.filter((lane) => lane === "depth" || lane === "backup").length;
    const core = lanes.filter((lane) => lane === "core").length;
    // Depth/Backup dominate; at most a small core anchor.
    expect(body).toBeGreaterThan(core);
    expect(body).toBeGreaterThanOrEqual(Math.ceil(plan.slots.length / 2));
  });

  it("rich + ambitious team: plan includes premium (superstar or star)", () => {
    const plan = planTeamLanes({
      teamId: "RICH",
      identity: makeIdentity({ ambition: 90, finances: 85, playerOpt: 12 }),
      strategy: makeStrategy({ starPriority: 9, rosterDepthPreference: 3, cashPriority: 3 }),
      spendableCash: 1200,
      currentRosterCount: 0,
      brackets: BRACKETS,
    });

    const lanes = plan.slots.map((slot) => slot.lane);
    expect(lanes.some((lane) => lane === "superstar" || lane === "star")).toBe(true);
  });

  it("plans toward OPT as a soft target within the flex band, consistent with targetRosterSize", () => {
    const plan = planTeamLanes({
      teamId: "MID",
      identity: makeIdentity({ playerOpt: 11 }),
      strategy: makeStrategy({}),
      spendableCash: 400,
      currentRosterCount: 3,
      brackets: BRACKETS,
    });
    // OPT=11, current=3 -> center 8 open, flex ~[6, 9].
    expect(plan.slots.length).toBeGreaterThanOrEqual(6);
    expect(plan.slots.length).toBeLessThanOrEqual(9);
    expect(plan.targetRosterSize).toBe(3 + plan.slots.length);
  });

  it("cash-poor ~11-slot team: mostly Depth/Backup, no Superstar, lands near opt", () => {
    const plan = planTeamLanes({
      teamId: "POOR2",
      identity: makeIdentity({ ambition: 40, finances: 35, playerOpt: 11 }),
      strategy: makeStrategy({ starPriority: 4, rosterDepthPreference: 6 }),
      spendableCash: 175,
      currentRosterCount: 0,
      brackets: BRACKETS,
    });
    const lanes = plan.slots.map((s) => s.lane);
    expect(plan.slots.length).toBeGreaterThanOrEqual(8); // near opt
    expect(lanes).not.toContain("superstar");
    const body = lanes.filter((l) => l === "depth" || l === "backup").length;
    expect(body).toBeGreaterThanOrEqual(Math.ceil(plan.slots.length / 2));
  });

  it("cash-rich ~12-slot team: at least one premium plus a real-tier body, lands near opt", () => {
    const plan = planTeamLanes({
      teamId: "RICH2",
      identity: makeIdentity({ ambition: 78, finances: 70, playerOpt: 12 }),
      strategy: makeStrategy({ starPriority: 8, rosterDepthPreference: 4 }),
      spendableCash: 325,
      currentRosterCount: 0,
      brackets: BRACKETS,
    });
    const lanes = plan.slots.map((s) => s.lane);
    expect(plan.slots.length).toBeGreaterThanOrEqual(10);
    expect(lanes.some((l) => l === "superstar" || l === "star")).toBe(true);
    // still has a real body, not 1 premium + filler
    const body = lanes.filter((l) => l === "core" || l === "depth" || l === "backup").length;
    expect(body).toBeGreaterThanOrEqual(6);
  });
});

describe("scoreCandidate theme weighting", () => {
  const slot: CleanLanePlanSlot = { lane: "core", priceFloor: 30, priceCap: 45 };
  const themeTarget: CleanThemeTarget = { coreRaces: ["fish"], minCorePct: 0.6 };
  const identity = makeIdentity({});
  const strategy = makeStrategy({});

  function score(candidate: TransfermarktFreeAgentItem) {
    return scoreCandidate({
      candidate,
      identity,
      strategy,
      slot,
      themeTarget,
      onThemeCountSoFar: 0,
      rosterCountSoFar: 4, // below the 60% quota -> strong theme urgency
      currentRosterPlayers: [],
    });
  }

  it("ranks on-theme above a marginally-better off-theme, but below a clearly-superior off-theme", () => {
    const onTheme = score(makeCandidate({ playerId: "on", race: "fish", ovr: 50, mvs: 50 }));
    const marginalOff = score(makeCandidate({ playerId: "marg", race: "human", ovr: 56, mvs: 56 }));
    const superiorOff = score(makeCandidate({ playerId: "sup", race: "human", ovr: 100, mvs: 100 }));

    expect(onTheme.onTheme).toBe(true);
    expect(marginalOff.onTheme).toBe(false);
    expect(superiorOff.onTheme).toBe(false);

    expect(onTheme.score).toBeGreaterThan(marginalOff.score);
    expect(superiorOff.score).toBeGreaterThan(onTheme.score);
  });

  it("no theme target -> onTheme false and no theme bonus", () => {
    const withTarget = score(makeCandidate({ playerId: "fish", race: "fish", ovr: 60, mvs: 60 }));
    const noTarget = scoreCandidate({
      candidate: makeCandidate({ playerId: "fish", race: "fish", ovr: 60, mvs: 60 }),
      identity,
      strategy,
      slot,
      themeTarget: null,
      onThemeCountSoFar: 0,
      rosterCountSoFar: 4,
      currentRosterPlayers: [],
    });
    expect(noTarget.onTheme).toBe(false);
    expect(withTarget.score).toBeGreaterThan(noTarget.score);
  });
});
