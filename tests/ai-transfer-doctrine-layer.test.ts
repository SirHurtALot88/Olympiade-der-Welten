import { describe, expect, it } from "vitest";

import {
  adjustBuyDecisionForDoctrine,
  adjustSellScoreForDoctrine,
  resolveTransferDoctrineFromProfile,
  summarizeDoctrineSpread,
} from "@/lib/ai/ai-transfer-doctrine-layer";
import { inferKeepReasonCodes, inferSellReasonCodes } from "@/lib/ai/ai-transfer-reason-codes";
import { loadSourceTeams, loadSourceTeamIdentities } from "@/lib/data/dataAdapter";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function profile(overrides: Partial<TeamStrategyProfile["bias"]> = {}): TeamStrategyProfile {
  return {
    teamId: "T-T",
    strategySummary: "Test profile",
    bias: {
      starPriority: 5,
      cashPriority: 5,
      sellForProfitAggression: 5,
      valuePriority: 5,
      loyaltyBias: 5,
      rosterDepthPreference: 5,
      shortContractPreference: 5,
      ...overrides,
    },
  } as TeamStrategyProfile;
}

describe("ai-transfer-doctrine-layer", () => {
  it("resolves merchant persona for cash/value traders like C-C", () => {
    const doctrine = resolveTransferDoctrineFromProfile(
      profile({ cashPriority: 10, valuePriority: 10, sellForProfitAggression: 10, shortContractPreference: 9 }),
    );
    expect(doctrine.persona).toBe("merchant");
    expect(doctrine.profitWindowScale).toBeGreaterThan(1);
  });

  it("uses reason codes instead of brittle string matching for doctrine sell tuning", () => {
    const merchant = resolveTransferDoctrineFromProfile(profile({ cashPriority: 10, valuePriority: 10, sellForProfitAggression: 10 }));
    const sellReason = ["realisierbarer Gewinn von 12.5"];
    const keepReason = ["Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt"];

    expect(inferSellReasonCodes(sellReason)).toContain("profit_window");
    expect(inferKeepReasonCodes(keepReason)).toContain("star_core_protection");

    const tuned = adjustSellScoreForDoctrine({
      baseScore: 72,
      reasonToSell: sellReason,
      reasonToKeep: keepReason,
      doctrine: merchant,
    });
    expect(tuned).toBeGreaterThan(72);
  });

  it("softly scales sell scores without hard blocking star keep reasons", () => {
    const starBuilder = resolveTransferDoctrineFromProfile(profile({ starPriority: 8, loyaltyBias: 7 }));
    const churner = resolveTransferDoctrineFromProfile(profile({ sellForProfitAggression: 8, shortContractPreference: 7 }));

    const starKeepScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      sellReasonCodes: ["profit_window"],
      keepReasonCodes: ["star_core_protection"],
      doctrine: starBuilder,
    });
    const churnSellScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      sellReasonCodes: ["underperformance"],
      doctrine: churner,
    });

    expect(starKeepScore).toBeLessThan(72);
    expect(churnSellScore).toBeGreaterThan(72);
    expect(starKeepScore).toBeGreaterThan(0);
  });

  it("reduces hoarder buy intent while increasing pass intent", () => {
    const hoarder = resolveTransferDoctrineFromProfile(profile({ cashPriority: 8, sellForProfitAggression: 4 }));
    const adjusted = adjustBuyDecisionForDoctrine({
      buyIntentScore: 40,
      passIntentScore: 10,
      replacementFitScore: 0,
      doctrine: hoarder,
    });

    expect(hoarder.persona).toBe("hoarder");
    expect(adjusted.buyIntent).toBeLessThan(40);
    expect(adjusted.passIntent).toBeGreaterThan(10);
    expect(adjusted.strategicBuyScore).toBeLessThan(30);
  });

  it("keeps balanced persona under 40% across source teams", () => {
    const teams = loadSourceTeams();
    const identities = loadSourceTeamIdentities();
    const identityByTeamId = new Map(identities.map((identity) => [identity.teamId, identity] as const));
    const profiles = buildTeamStrategyProfileMap(teams, identities);
    const doctrines = teams
      .map((team) => resolveTransferDoctrineFromProfile(profiles[team.teamId] ?? null, identityByTeamId.get(team.teamId) ?? null))
      .filter(Boolean);
    const spread = summarizeDoctrineSpread(doctrines);
    const balancedPct = ((spread.balanced ?? 0) / doctrines.length) * 100;
    expect(balancedPct).toBeLessThanOrEqual(40);
  });
});
