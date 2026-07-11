import { afterEach, describe, expect, it } from "vitest";

import { buildLeagueMarketBrackets, type LeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import type { TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { loadDefaultTeamIdentities } from "@/lib/foundation/team-identity-settings";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

import { draftTeamRoster } from "../draft-team-roster";
import { planTeamLanes, resolveCashRetentionPct, resolveCleanTeamTraits } from "../plan-team-lanes";
import { buildCleanThemeTarget, isCleanDraftEnabled } from "../run-clean-draft";
import { scoreCandidate } from "../score-candidate";
import type { Player } from "@/lib/data/olyDataTypes";
import type { TeamThemeCompositionTarget } from "@/lib/ai/team-theme-composition-service";
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

// REAL runtime scale (see data/source/team-identities.json): pow/spe/men/soc are a ~20-point
// distribution across the four axes (NOT 0-100 ratings); ambition/finances/boardConfidence are 0-10.
function makeIdentity(over: Partial<TeamIdentity>): TeamIdentity {
  return {
    teamId: "T-T",
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 5,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
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

// Minimal Player projection (only the fields the clean scorer reads) for roster-so-far fixtures.
function makePlayer(id: string, over: Partial<Player> & { className?: string; race?: string }): Player {
  return {
    id,
    race: over.race ?? "human",
    className: over.className ?? "Fighter",
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    ...over,
  } as unknown as Player;
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
      identity: makeIdentity({ ambition: 3, finances: 3, playerOpt: 11 }),
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
      identity: makeIdentity({ ambition: 9, finances: 8.5, playerOpt: 12 }),
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
      identity: makeIdentity({ ambition: 4, finances: 3.5, playerOpt: 11 }),
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
      identity: makeIdentity({ ambition: 7.8, finances: 7, playerOpt: 12 }),
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

  // Regression guard for B1 (identity axis scale): load a REAL 0-10-scale identity straight from
  // data/source/team-identities.json and confirm the plan reads it correctly rather than collapsing
  // every axis to ~0 (the old raw/100 bug). C-S is a rich, ambitious team (ambition 7, finances 9.5).
  it("real-scale identity from team-identities.json: rich/ambitious team plans premium", () => {
    const identities = loadDefaultTeamIdentities();
    const real = identities.find((entry) => entry.teamId === "C-S");
    expect(real).toBeDefined();
    // Sanity: this really is the 0-10 runtime scale (would be a 0-100 rating if the data ever changed).
    expect(real!.ambition).toBeLessThanOrEqual(10);
    expect(real!.finances).toBeLessThanOrEqual(10);

    const plan = planTeamLanes({
      teamId: "C-S",
      identity: real!,
      strategy: makeStrategy({ starPriority: 7 }),
      spendableCash: 900,
      currentRosterCount: 0,
      brackets: BRACKETS,
    });
    const lanes = plan.slots.map((slot) => slot.lane);
    expect(lanes.some((lane) => lane === "superstar" || lane === "star")).toBe(true);
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

  // Color/class anti-monoculture must hold EVEN for a themed team whose core race has piled up one
  // form-color: an on-theme candidate of a NEW color outscores an on-theme candidate that would be
  // the 8th of the same color (both respect the theme; the penalty breaks the color tie).
  it("themed team with color-concentrated core race still spreads form-color", () => {
    // Seven on-theme (fish) red-color (Berserker) players already on the roster.
    const rosterPlayers = Array.from({ length: 7 }, (_, i) => makePlayer(`r${i}`, { race: "fish", className: "Berserker" }));
    const common = {
      identity,
      strategy,
      slot,
      themeTarget,
      onThemeCountSoFar: 7,
      rosterCountSoFar: 7,
      currentRosterPlayers: rosterPlayers,
    } as const;
    const sameColor = scoreCandidate({ ...common, candidate: makeCandidate({ playerId: "red8", race: "fish", className: "Berserker", ovr: 60, mvs: 60 }) });
    const newColor = scoreCandidate({ ...common, candidate: makeCandidate({ playerId: "green1", race: "fish", className: "Sprinter", ovr: 60, mvs: 60 }) });
    expect(sameColor.onTheme).toBe(true);
    expect(newColor.onTheme).toBe(true); // both stay on-theme (same race)
    expect(newColor.score).toBeGreaterThan(sameColor.score); // color penalty breaks the tie
  });
});

describe("draftTeamRoster executor", () => {
  const cheapPool: TransfermarktFreeAgentItem[] = Array.from({ length: 30 }, (_, i) =>
    makeCandidate({ playerId: `pool-${i}`, marketValue: 6 + (i % 5), ovr: 45 + (i % 12), mvs: 45 + (i % 12), salary: 8 }),
  );

  function draft(over: Partial<Parameters<typeof draftTeamRoster>[0]>) {
    return draftTeamRoster({
      teamId: "T-T",
      identity: makeIdentity({}),
      strategy: makeStrategy({}),
      spendableCash: 250,
      currentRoster: [],
      freeAgents: cheapPool,
      brackets: BRACKETS,
      themeTarget: null,
      playerMin: 8,
      ...over,
    });
  }

  it("never overspends the spendable cash", () => {
    const picks = draft({ spendableCash: 250 });
    const spent = picks.reduce((sum, pick) => sum + pick.fee, 0);
    expect(spent).toBeLessThanOrEqual(250 + 0.01);
  });

  it("reaches at least playerMin when the pool + cash allow (suffix-reserve + safety net)", () => {
    const picks = draft({ spendableCash: 250, playerMin: 8 });
    expect(picks.length).toBeGreaterThanOrEqual(8);
  });

  it("empty pool yields no picks", () => {
    expect(draft({ freeAgents: [] })).toEqual([]);
  });

  it("zero cash yields no picks", () => {
    expect(draft({ spendableCash: 0 })).toEqual([]);
  });

  it("tight cash still fills toward min with cheap players, never negative", () => {
    // Only enough for a handful of cheap bodies — the safety net keeps buying while cash allows.
    const picks = draft({ spendableCash: 60, playerMin: 8 });
    const spent = picks.reduce((sum, pick) => sum + pick.fee, 0);
    expect(spent).toBeLessThanOrEqual(60 + 0.01);
    expect(picks.length).toBeGreaterThan(0);
  });
});

describe("resolveCashRetentionPct", () => {
  it("finance/cash-priority teams retain more than ambitious ones (bounded 0.05..0.2)", () => {
    const rich = resolveCashRetentionPct(
      resolveCleanTeamTraits({ identity: makeIdentity({ finances: 10, ambition: 1 }), strategy: makeStrategy({ cashPriority: 10 }) }),
    );
    const ambitious = resolveCashRetentionPct(
      resolveCleanTeamTraits({ identity: makeIdentity({ finances: 1, ambition: 10 }), strategy: makeStrategy({ cashPriority: 1 }) }),
    );
    expect(rich).toBeGreaterThan(ambitious);
    expect(rich).toBeLessThanOrEqual(0.2);
    expect(ambitious).toBeGreaterThanOrEqual(0.05);
  });
});

describe("buildCleanThemeTarget", () => {
  it("null / no race quota -> null; race quota -> core races + min share", () => {
    expect(buildCleanThemeTarget(null)).toBeNull();
    expect(buildCleanThemeTarget({ targetShare: 0.9, minimumShare: 0.6 } as TeamThemeCompositionTarget)).toBeNull();
    const target = buildCleanThemeTarget({
      raceQuotaScoped: { races: ["Fish", "Aqua"] },
      targetShare: 0.9,
      minimumShare: 0.6,
    } as TeamThemeCompositionTarget);
    expect(target).toEqual({ coreRaces: ["fish", "aqua"], minCorePct: 0.6 });
  });
});

describe("isCleanDraftEnabled", () => {
  const prior = process.env.OLY_CLEAN_DRAFT;
  afterEach(() => {
    if (prior === undefined) delete process.env.OLY_CLEAN_DRAFT;
    else process.env.OLY_CLEAN_DRAFT = prior;
  });

  it("defaults ON and opts out only for 0 / false", () => {
    delete process.env.OLY_CLEAN_DRAFT;
    expect(isCleanDraftEnabled()).toBe(true);
    process.env.OLY_CLEAN_DRAFT = "1";
    expect(isCleanDraftEnabled()).toBe(true);
    process.env.OLY_CLEAN_DRAFT = "0";
    expect(isCleanDraftEnabled()).toBe(false);
    process.env.OLY_CLEAN_DRAFT = "false";
    expect(isCleanDraftEnabled()).toBe(false);
  });
});
